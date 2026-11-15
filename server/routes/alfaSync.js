const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const automation = require('../services/alfaAutomation');
const { encrypt } = require('../services/alfaCrypto');
const { loadLine, markStatus, runSync, statusForError, mergeSubscribersIntoLine, parseAlfaUShareText } = require('../services/alfaLineSync');

// حد أدنى 15 ثانية بين طلبات الجلب لكل خط حتى لا نتجاوز حد الطلبات في جدار Alfa (F5)
const STATUS_COOLDOWN_MS = 15000;
const lastStatusAt = new Map();

router.use(authMiddleware);

// الخطوط المسكرة والمفتوحة كلاهما (نوع الخط الفعلي يُقرأ من قاعدة البيانات دائماً)
const getLockedLine = async (req, res) => {
    const data = await loadLine(req.shopId, req.params.lineId);
    if (!data) {
        res.status(404).json({ message: 'الخط غير موجود' });
        return null;
    }
    const actualType = data.line.line_type || 'locked';
    // فحص اختياري: إن مرّر الطرف الآخر ?type= ولم يطابق نوع الخط الفعلي، نرفض بوضوح بدل تنفيذ العملية على نوع خاطئ
    const requestedType = req.query && req.query.type;
    if (requestedType && requestedType !== actualType) {
        res.status(400).json({ message: `نوع الخط المطلوب (${requestedType}) لا يطابق نوعه الفعلي (${actualType})` });
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
                linePhone: data.line.phone_number,
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

        const throttleKey = `${req.shopId}:${req.params.lineId}`;
        const wait = STATUS_COOLDOWN_MS - (Date.now() - (lastStatusAt.get(throttleKey) || 0));
        if (wait > 0) {
            return res.status(429).json({ message: `انتظر ${Math.ceil(wait / 1000)} ثانية قبل الجلب من Alfa مرة أخرى`, code: 'COOLDOWN' });
        }
        lastStatusAt.set(throttleKey, Date.now());

        try {
            const live = await automation.fetchLiveUShareStatus({
                shopId: req.shopId,
                lineId: req.params.lineId,
                creds: data.creds,
                linePhone: data.line.phone_number
            });
            await markStatus(req.shopId, req.params.lineId, 'active', true);

            // حفظ المشتركين في MySQL حتى لا يضيعوا عند إغلاق النافذة؛ فشل الحفظ لا يُفشل الجلب
            let saved = null;
            try {
                saved = await mergeSubscribersIntoLine(req.shopId, data.line, live.subscribers);
            } catch (mergeErr) {
                console.error('Persist Alfa subscribers error:', mergeErr);
            }
            res.json({ success: true, subscribers: live.subscribers, saved });
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
            const result = await runSync(req.shopId, req.params.lineId, data.creds, { action, targetPhone, oldPhone, quotaGB, linePhone: data.line.phone_number });
            res.json({ success: true, subscribers: result.subscribers });
        } catch (err) {
            fail(res, err);
        }
    } catch (err) {
        console.error('Alfa sync-now error:', err);
        res.status(500).json({ message: 'خطأ داخلي أثناء المزامنة' });
    }
});

// 5. لصق نص صفحة U-Share المنسوخ يدوياً وحفظ المشتركين المستخرجين منه (بدون أي اتصال بموقع Alfa)
router.post('/parse/:lineId', async (req, res) => {
    try {
        const data = await getLockedLine(req, res);
        if (!data) return;
        const text = String((req.body && req.body.text) || '');
        if (!text.trim()) return res.status(400).json({ message: 'الصق نص صفحة U-Share أولاً' });

        const { subscribers, mainInfo } = parseAlfaUShareText(text, data.line.phone_number);
        const hasMainInfo = mainInfo && Object.values(mainInfo).some((v) => v !== null && v !== undefined);
        if (subscribers.length === 0 && !hasMainInfo) {
            return res.status(400).json({ message: 'لم يُعثر على أي معلومات مشتركين أو باقة في النص الملصق' });
        }

        const merge = await mergeSubscribersIntoLine(req.shopId, data.line, subscribers, mainInfo);
        await markStatus(req.shopId, req.params.lineId, 'active', true);
        res.json({ ok: true, subscribers, merge });
    } catch (err) {
        console.error('Alfa parse error:', err);
        res.status(500).json({ message: 'خطأ داخلي أثناء تحليل النص الملصق' });
    }
});

module.exports = router;
