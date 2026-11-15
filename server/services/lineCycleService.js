// أرشفة دورات الخطوط (مسكرة أو مفتوحة): لقطة كاملة قبل التصفير، صالحة للمراجعة لاحقاً عبر "سجل الدورات السابقة".
// لا يُحذف الخط نفسه أبداً ولا سجلاته المحاسبية (المبيعات/الديون) — فقط خانات المشتركين وحالة الخدمة الحالية.
// لا تُغيَّر هنا آلية "صلاحية الخط" (validity_days / validity_start_date) بأي شكل.
const pool = require('../db');

// يحلل نص الخانة "الاسم (N GB)" إلى { name, quotaGB } أو null إن كانت فارغة
function parseSlotText(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const name = t.split('(')[0].trim();
    const gbMatch = t.match(/\(([^)]+)\)/);
    const quotaGB = gbMatch ? parseFloat(gbMatch[1].replace(/[^0-9.]/g, '')) : null;
    return { name, quotaGB: Number.isFinite(quotaGB) ? quotaGB : null };
}

const toNum = (v) => (v !== null && v !== undefined ? parseFloat(v) : null);

// يبني لقطة كل المشتركين المسجَّلين على الخط لحظة الأرشفة (user1..user3، وحصة الأدمن إن كان خطاً مفتوحاً)
function buildSnapshot(line) {
    const slots = [];
    for (const n of [1, 2, 3]) {
        const parsed = parseSlotText(line[`user${n}`]);
        if (!parsed) continue;
        slots.push({
            slot: `user${n}`,
            name: parsed.name,
            phone: line[`user${n}_phone`] || null,
            quotaGB: parsed.quotaGB,
            usedGB: toNum(line[`user${n}_used_gb`])
        });
    }
    if ((line.line_type || 'locked') === 'open' && String(line.admin_name || '').trim()) {
        slots.push({
            slot: 'admin',
            name: line.admin_name,
            phone: line.admin_phone || null,
            quotaGB: line.admin_gb ? parseFloat(line.admin_gb) : null,
            usedGB: toNum(line.admin_used_gb)
        });
    }
    return slots;
}

/**
 * يحفظ لقطة كاملة عن حالة الخط الحالية في جدول الأرشيف (line_cycles)، ثم يصفّر خاناته
 * (المشتركين وحصة الأدمن وحالة الخدمة) استعداداً لدورة جديدة. لا يلمس صلاحية الخط (validity_*).
 */
async function archiveAndResetLine(shopId, line, { reason = 'manual' } = {}) {
    const slots = buildSnapshot(line);
    const cycleId = `cyc_arch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await pool.query(
        `INSERT INTO line_cycles (id, shop_id, line_id, line_type, line_phone, started_at, expired_at, subscribers_json)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
            cycleId,
            shopId,
            line.id,
            line.line_type || 'locked',
            line.phone_number || null,
            line.service_start_date || null,
            JSON.stringify({ reason, slots })
        ]
    );

    await pool.query(
        `UPDATE locked_lines SET
            user1 = '', user1_phone = NULL, user1_used_gb = NULL,
            user2 = '', user2_phone = NULL, user2_used_gb = NULL,
            user3 = '', user3_phone = NULL, user3_used_gb = NULL,
            admin_name = '', admin_phone = '', admin_address = '', admin_used_gb = NULL,
            has_service = 0, service_active = 0, service_start_date = NULL
         WHERE id = ? AND shop_id = ?`,
        [line.id, shopId]
    );

    return { cycleId, archivedSlots: slots.length, slots };
}

/**
 * يفحص جميع خطوط هذا المحل (مسكرة ومفتوحة) التي انتهت دورة خدمتها الشهرية (30 يوماً من
 * service_start_date) ويؤرشفها ويصفّرها تلقائياً. لا علاقة له بصلاحية الخط (validity_days).
 * يُستدعى بشكل كسول (lazy) عند كل تحميل بيانات المحل، وليس عبر مهمة مجدولة (cron) حقيقية.
 */
async function archiveAndResetExpiredLines(shopId) {
    const [rows] = await pool.query(
        `SELECT * FROM locked_lines
         WHERE shop_id = ? AND service_active = 1 AND service_start_date IS NOT NULL
           AND DATE_ADD(service_start_date, INTERVAL COALESCE(service_days, 30) DAY) <= CURDATE()`,
        [shopId]
    );

    const archived = [];
    for (const line of rows) {
        try {
            const result = await archiveAndResetLine(shopId, line, { reason: 'expired' });
            archived.push({ lineId: line.id, ...result });
        } catch (err) {
            console.error('Archive expired line error:', line.id, err.message);
        }
    }
    return archived;
}

// سجل الدورات السابقة لخط معيّن (الأحدث أولاً)
async function listCycles(shopId, lineId) {
    const [rows] = await pool.query(
        'SELECT * FROM line_cycles WHERE shop_id = ? AND line_id = ? ORDER BY expired_at DESC LIMIT 50',
        [shopId, lineId]
    );
    return rows.map((r) => {
        let parsed = {};
        try {
            parsed = JSON.parse(r.subscribers_json || '{}');
        } catch (e) {
            parsed = {};
        }
        return {
            id: r.id,
            lineType: r.line_type,
            linePhone: r.line_phone,
            startedAt: r.started_at,
            expiredAt: r.expired_at,
            reason: parsed.reason || 'manual',
            slots: parsed.slots || []
        };
    });
}

module.exports = { archiveAndResetLine, archiveAndResetExpiredLines, listCycles };
