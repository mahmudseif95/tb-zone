const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { formatDateOnly } = require('./helpers');
const { loadLine, runSync } = require('../../services/alfaLineSync');
const { encryptPassword } = require('../../services/alfaCrypto');
const { archiveAndResetLine, listCycles } = require('../../services/lineCycleService');

// ==========================================
// 4. الخطوط المسكرة والمفتوحة (Locked & Open Lines)
// ==========================================
router.post('/line', async (req, res) => {
    const shopId = req.shopId;
    const l = req.body;
    const lineId = `line_${Date.now()}`;

    try {
        // بيانات Alfa الاختيارية: للخطوط المسكرة فقط وعند توفر الاسم وكلمة السر معاً
        const alfaUser = typeof l.alfaUsername === 'string' ? l.alfaUsername.trim().slice(0, 120) : '';
        const alfaPass = typeof l.alfaPassword === 'string' ? l.alfaPassword : '';
        const linkAlfa = alfaUser && alfaPass; // الخطوط المسكرة والمفتوحة كلاهما

        await pool.query(
            `INSERT INTO locked_lines (id, shop_id, line_type, slot_number, phone_number, validity_days, validity_start_date, balance_usd, has_service, service_active, service_start_date, service_days, admin_name, admin_phone, admin_address, admin_gb, admin_price, user1, user2, user3, notes, alfa_username, alfa_password_enc, alfa_sync_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                lineId,
                shopId,
                l.type || 'locked',
                l.slotNumber || 1,
                l.phoneNumber || l.number || '',
                parseInt(l.validityDays ?? 30, 10),
                formatDateOnly(l.validityStartDate) || formatDateOnly(new Date()),
                parseFloat(l.balanceUSD || l.balance || 0),
                l.hasService ? 1 : 0,
                (l.serviceActive ?? l.hasService) ? 1 : 0,
                l.hasService ? formatDateOnly(l.serviceStartDate) : null,
                30,
                l.adminName || '',
                l.adminPhone || '',
                l.adminAddress || '',
                l.adminGB || '22',
                l.adminPrice || '',
                l.user1 || '',
                l.user2 || '',
                l.user3 || '',
                l.notes || '',
                linkAlfa ? alfaUser : null,
                linkAlfa ? encryptPassword(alfaPass) : null,
                linkAlfa ? 1 : 0
            ]
        );
        res.status(201).json({ success: true, id: lineId });
    } catch (err) {
        console.error('Add line error:', err);
        res.status(500).json({ message: 'فشل إضافة الخط في قاعدة البيانات' });
    }
});

router.put('/line/:id', async (req, res) => {
    const shopId = req.shopId;
    const lineId = req.params.id;
    const l = req.body;

    try {
        // نحمّل الخط الحالي مرة واحدة عند الحاجة (لمزامنة Alfa أو لفحص بدء دورة 30 يوم جديدة)
        let data = null;
        const needsCurrentLine = Boolean(l.alfaSync) || l.hasService === true;
        if (needsCurrentLine) {
            data = await loadLine(shopId, lineId);
            if (!data) return res.status(404).json({ message: 'الخط غير موجود' });
        }

        // مزامنة Alfa Self-Care أولاً: عند الفشل نوقف العملية دون تعديل MySQL
        const sync = l.alfaSync;
        if (sync && l.skipAlfaSync !== true) {
            if (data.line.alfa_sync_enabled && (data.line.line_type || 'locked') === 'locked') {
                if (!['add', 'edit', 'remove'].includes(sync.action)) {
                    return res.status(400).json({ message: 'إجراء مزامنة غير صالح' });
                }
                try {
                    await runSync(shopId, lineId, data.creds, {
                        action: sync.action,
                        targetPhone: sync.phone,
                        oldPhone: sync.oldPhone,
                        quotaGB: sync.quotaGB,
                        linePhone: data.line.phone_number
                    });
                } catch (alfaErr) {
                    return res.status(alfaErr.code === 'BAD_INPUT' ? 400 : 502).json({
                        message: alfaErr.message || 'فشلت المزامنة مع Alfa',
                        code: alfaErr.code || 'ALFA_ERROR'
                    });
                }
            }
        }

        // بدء دورة خدمة 30 يوم جديدة على خط كانت خدمته متوقفة: نؤرشف بيانات الدورة السابقة ونصفّرها أولاً
        // (لا نلمس صلاحية الخط validity_* هنا إطلاقاً)
        if (needsCurrentLine && l.hasService === true && !data.line.service_active) {
            try {
                await archiveAndResetLine(shopId, data.line, { reason: 'new_cycle' });
            } catch (archErr) {
                console.error('Archive on new cycle error:', archErr.message);
            }
        }

        await pool.query(
            `UPDATE locked_lines SET
       line_type = COALESCE(?, line_type),
       slot_number = COALESCE(?, slot_number),
       phone_number = COALESCE(?, phone_number),
       validity_days = COALESCE(?, validity_days),
       validity_start_date = COALESCE(?, validity_start_date),
       balance_usd = COALESCE(?, balance_usd),
       has_service = COALESCE(?, has_service),
       service_active = COALESCE(?, service_active),
       service_start_date = CASE WHEN ? = 0 THEN NULL ELSE COALESCE(?, service_start_date) END,
       service_days = COALESCE(?, service_days),
       admin_name = COALESCE(?, admin_name),
       admin_phone = COALESCE(?, admin_phone),
       admin_address = COALESCE(?, admin_address),
       admin_gb = COALESCE(?, admin_gb),
       admin_price = COALESCE(?, admin_price),
       user1 = COALESCE(?, user1),
       user2 = COALESCE(?, user2),
       user3 = COALESCE(?, user3),
       user1_phone = COALESCE(?, user1_phone),
       user2_phone = COALESCE(?, user2_phone),
       user3_phone = COALESCE(?, user3_phone),
       notes = COALESCE(?, notes)
       WHERE id = ? AND shop_id = ?`,
            [
                l.type,
                l.slotNumber,
                l.phoneNumber || l.number,
                l.validityDays !== undefined ? parseInt(l.validityDays, 10) : undefined,
                l.validityStartDate ? formatDateOnly(l.validityStartDate) : undefined,
                l.balanceUSD !== undefined ? parseFloat(l.balanceUSD) : undefined,
                l.hasService !== undefined ? (l.hasService ? 1 : 0) : undefined,
                l.hasService !== undefined ? (l.hasService ? 1 : 0) : undefined,
                l.hasService === false ? 0 : 1,
                l.serviceStartDate ? formatDateOnly(l.serviceStartDate) : null,
                l.serviceDays,
                l.adminName,
                l.adminPhone,
                l.adminAddress,
                l.adminGB,
                l.adminPrice,
                l.user1,
                l.user2,
                l.user3,
                l.user1Phone,
                l.user2Phone,
                l.user3Phone,
                l.notes,
                lineId,
                shopId
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Update line error:', err);
        res.status(500).json({ message: 'فشل تحديث بيانات الخط' });
    }
});

router.delete('/line/:id', async (req, res) => {
    const shopId = req.shopId;
    try {
        await pool.query('DELETE FROM locked_lines WHERE id = ? AND shop_id = ?', [req.params.id, shopId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل حذف الخط' });
    }
});

// التحقق من نوع الخط (إن طُلب) قبل عمليات الأرشفة/السجل، إضافة إلى عزل المحل
async function loadLineChecked(shopId, lineId, requestedType, res) {
    const data = await loadLine(shopId, lineId);
    if (!data) {
        res.status(404).json({ message: 'الخط غير موجود' });
        return null;
    }
    const actualType = data.line.line_type || 'locked';
    if (requestedType && requestedType !== actualType) {
        res.status(400).json({ message: `نوع الخط المطلوب (${requestedType}) لا يطابق نوعه الفعلي (${actualType})` });
        return null;
    }
    return data;
}

// سجل الدورات السابقة لخط (مسكر أو مفتوح) — الأحدث أولاً
router.get('/line/:lineId/cycles', async (req, res) => {
    const shopId = req.shopId;
    try {
        const data = await loadLineChecked(shopId, req.params.lineId, req.query.type, res);
        if (!data) return;
        const cycles = await listCycles(shopId, req.params.lineId);
        res.json({ success: true, cycles });
    } catch (err) {
        console.error('List line cycles error:', err);
        res.status(500).json({ message: 'فشل جلب سجل الدورات السابقة' });
    }
});

// إنهاء الدورة الحالية وتصفير الخط يدوياً (بدون انتظار انتهاء 30 يوماً تلقائياً)
router.post('/line/:lineId/archive-reset', async (req, res) => {
    const shopId = req.shopId;
    try {
        const data = await loadLineChecked(shopId, req.params.lineId, req.query.type, res);
        if (!data) return;
        const result = await archiveAndResetLine(shopId, data.line, { reason: 'manual' });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Archive-reset line error:', err);
        res.status(500).json({ message: 'فشل إنهاء الدورة وتصفير الخط' });
    }
});

module.exports = router;
