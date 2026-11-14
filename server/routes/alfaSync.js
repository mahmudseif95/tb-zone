const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const automation = require('../services/alfaAutomation');
const { encrypt } = require('../services/alfaCrypto');
const { loadLine, markStatus, runSync, statusForError } = require('../services/alfaLineSync');

router.use(authMiddleware);

// الخطوط المسكرة فقط
const getLockedLine = async (req, res) => {
    const data = await loadLine(req.shopId, req.params.lineId);
    if (!data) {
        res.status(404).json({ message: 'الخط غير موجود' });
        return null;
    }
    if ((data.line.line_type || 'locked') !== 'locked') {
        res.status(400).json({ message: 'مزامنة Alfa متاحة للخطوط المسكرة فقط' });
        return null;
    }
    return data;
};

const fail = (res, err) => {
    console.error('Alfa sync error:', err.code || '', err.message);
    return res.status(err.code === 'BAD_INPUT' ? 400 : 502).json({
        message: err.message || 'فشلت المزامنة مع Alfa',
        code: err.code || 'ALFA_ERROR'
    });
};

// 1. حفظ بيانات الدخول (كلمة المرور مشفّرة AES-256-GCM ولا تُعاد للواجهة أبداً)
router.post('/credentials/:lineId', async (req, res) => {
    try {
        const data = await getLockedLine(req, res);
        if (!data) return;
        const { username, password, syncEnabled } = req.body;
        const sets = [];
        const params = [];
        if (username !== undefined) {
            sets.push('alfa_username = ?');
            params.push(String(username).trim().slice(0, 120) || null);
        }
        if (password) {
            sets.push('alfa_password_enc = ?');
            params.push(encrypt(password));
        }
        if (username !== undefined || password) sets.push("alfa_session_status = 'unlinked'");
        if (syncEnabled !== undefined) {
            sets.push('alfa_sync_enabled = ?');
            params.push(syncEnabled ? 1 : 0);
        }
        if (sets.length === 0) return res.status(400).json({ message: 'لا توجد بيانات للحفظ' });
        await pool.query(
            `UPDATE locked_lines SET ${sets.join(', ')} WHERE id = ? AND shop_id = ?`,
            [...params, req.params.lineId, req.shopId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Save alfa credentials error:', err);
        res.status(500).json({ message: 'فشل حفظ بيانات حساب Alfa' });
    }
});

// 2. ربط وفحص الجلسة (interactive: true يفتح نافذة مرئية لحل CAPTCHA)
router.post('/connect/:lineId', async (req, res) => {
    try {
        const data = await getLockedLine(req, res);
        if (!data) return;
        if (!data.creds) return res.status(400).json({ message: 'احفظ اسم المستخدم وكلمة المرور أولاً' });
        try {
            await automation.connectAndVerifySession({
                shopId: req.shopId,
                lineId: req.params.lineId,
                username: data.creds.username,
                password: data.creds.password,
                interactive: Boolean(req.body && req.body.interactive === true)
            });
            await markStatus(req.shopId, req.params.lineId, 'active', true);
            res.json({ success: true, status: 'active' });
        } catch (err) {
            await markStatus(req.shopId, req.params.lineId, statusForError(err)).catch(() => { });
            fail(res, err);
        }
    } catch (err) {
        console.error('Alfa connect error:', err);
        res.status(500).json({ message: 'خطأ داخلي أثناء ربط حساب Alfa' });
    }
});

// 3. حالة U-Share الحية من موقع Alfa
router.get('/status/:lineId', async (req, res) => {
    try {
        const data = await getLockedLine(req, res);
        if (!data) return;
        try {
            const live = await automation.fetchLiveUShareStatus({
                shopId: req.shopId,
                lineId: req.params.lineId,
                creds: data.creds
            });
            await markStatus(req.shopId, req.params.lineId, 'active', true);
            res.json({ success: true, subscribers: live.subscribers });
        } catch (err) {
            await markStatus(req.shopId, req.params.lineId, statusForError(err)).catch(() => { });
            fail(res, err);
        }
    } catch (err) {
        console.error('Alfa status error:', err);
        res.status(500).json({ message: 'خطأ داخلي أثناء جلب حالة Alfa' });
    }
});

// 4. تنفيذ فوري لإجراء على Alfa (بدون المساس بالقيود المحاسبية)
router.post('/sync-now/:lineId', async (req, res) => {
    try {
        const data = await getLockedLine(req, res);
        if (!data) return;
        const { action, targetPhone, oldPhone, quotaGB } = req.body;
        if (!['add', 'edit', 'remove'].includes(action)) return res.status(400).json({ message: 'إجراء غير صالح' });
        try {
            const result = await runSync(req.shopId, req.params.lineId, data.creds, { action, targetPhone, oldPhone, quotaGB });
            res.json({ success: true, subscribers: result.subscribers });
        } catch (err) {
            fail(res, err);
        }
    } catch (err) {
        console.error('Alfa sync-now error:', err);
        res.status(500).json({ message: 'خطأ داخلي أثناء المزامنة' });
    }
});

module.exports = router;
