const pool = require('../db');
const { decrypt } = require('./alfaCrypto');
const automation = require('./alfaAutomation');

const { normPhone8 } = automation;

// بادئات شبكة الخلوي اللبنانية لأرقام المشتركين الثانويين (8 خانات محلية)
const LEBANESE_PREFIXES = ['03', '70', '71', '76', '78', '79', '81'];
const PHONE_RX = new RegExp(`(?:\\+?961[\\s.-]?|00961[\\s.-]?)?(${LEBANESE_PREFIXES.join('|')})[\\s.-]?(\\d{3})[\\s.-]?(\\d{3})`, 'g');

// يحلّل تاريخاً بصيغة DD/MM/YYYY أو DD-MM-YYYY (مع سنة من رقمين أو أربعة) إلى Date محلي، أو null
function parseDMY(str) {
    const m = String(str || '').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!m) return null;
    let [, d, mo, y] = m.map(Number);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, mo - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
}

const toIsoDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * يستخرج معلومات الباقة الرئيسية للخط (الصلاحية/الأيام المتبقية، الحالة، الاستهلاك، الرصيد) من
 * نص صفحة U-Share، بحثاً في المقدمة (قبل أول رقم مشترك ثانوي) حيث تظهر هذه المعلومات عادة.
 */
function extractMainBundleInfo(fullText, headerText) {
    const info = { remainingDays: null, isActive: null, quotaGB: null, usedGB: null, balanceUSD: null };

    // الأيام المتبقية: صريحة بالإنكليزية أو العربية (بأي من الترتيبين)
    const daysPatterns = [
        /(\d+)\s*days?\s*remaining/i,
        /remaining\s*:?\s*(\d+)\s*days?/i,
        /متبقي\s*:?\s*(\d+)\s*يوم/,
        /(\d+)\s*يوم\s*متبقي/
    ];
    for (const rx of daysPatterns) {
        const mm = fullText.match(rx);
        if (mm) { info.remainingDays = parseInt(mm[1], 10); break; }
    }

    // تاريخ الانتهاء الصريح (Expires on / Valid until / تنتهي / صالح حتى)
    const expiryPatterns = [
        /expir(?:es|y|ation)?\s*(?:on|date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /valid\s*until\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(?:تنتهي|صالح حتى|تاريخ الانتهاء)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
    ];
    let expiryDate = null;
    for (const rx of expiryPatterns) {
        const mm = fullText.match(rx);
        if (mm) { expiryDate = parseDMY(mm[1]); if (expiryDate) break; }
    }
    // احتياطي: أي تاريخ صريح DD/MM/YYYY في مقدمة الصفحة إن لم نجد أياماً متبقية ولا تاريخاً موسوماً
    if (!expiryDate && info.remainingDays === null) {
        const bare = headerText.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/);
        if (bare) expiryDate = parseDMY(bare[1]);
    }
    if (expiryDate && info.remainingDays === null) {
        const todayMid = new Date();
        todayMid.setHours(0, 0, 0, 0);
        info.remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - todayMid.getTime()) / 86400000));
    }
    info.expiryDateIso = expiryDate ? toIsoDate(expiryDate) : null;

    // حالة الباقة الرئيسية (في مقدمة الصفحة فقط، بعيداً عن حالات المشتركين الثانويين)
    if (/\b(active|valid)\b/i.test(headerText) || /نشط/.test(headerText)) info.isActive = true;
    else if (/\b(expired|suspended|inactive)\b/i.test(headerText) || /(منتهي|متوقف)/.test(headerText)) info.isActive = false;

    // استهلاك/حصة الباقة الرئيسية (مثال: "10.99 / 30 GB" في مقدمة الصفحة)
    const mainUsedTotal = headerText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*GB/i);
    if (mainUsedTotal) {
        info.usedGB = parseFloat(mainUsedTotal[1]);
        info.quotaGB = parseFloat(mainUsedTotal[2]);
    } else {
        const totalOnly = headerText.match(/(\d+(?:\.\d+)?)\s*GB/i);
        if (totalOnly) info.quotaGB = parseFloat(totalOnly[1]);
    }

    // الرصيد الرئيسي بالدولار (يتطلب كلمة Balance/الرصيد قريبة لتجنّب الالتباس مع أي مبلغ آخر)
    const balMatch = fullText.match(/(?:balance|الرصيد)\s*:?\s*\$?\s*(\d+(?:\.\d+)?)/i)
        || fullText.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:balance|رصيد)/i);
    if (balMatch) info.balanceUSD = parseFloat(balMatch[1]);

    return info;
}

/**
 * يحلل النص المنسوخ من صفحة U-Share على alfa.com.lb (إنكليزي أو عربي) ويستخرج
 * أرقام المشتركين الثانويين مع حصتهم المستهلكة/الإجمالية وحالتهم، متجاهلاً رقم الخط الأساسي،
 * بالإضافة إلى معلومات الباقة الرئيسية (الصلاحية، الحالة، الاستهلاك، الرصيد).
 * يُعيد { subscribers, mainInfo }.
 */
function parseAlfaUShareText(rawText, primaryLinePhone) {
    const text = String(rawText || '');
    if (!text.trim()) return { subscribers: [], mainInfo: null };

    const primary = normPhone8(primaryLinePhone);
    const found = new Map(); // phone -> index أول ظهور (لتفادي تكرار نفس الرقم)

    let m;
    while ((m = PHONE_RX.exec(text)) !== null) {
        const phone = normPhone8(`${m[1]}${m[2]}${m[3]}`);
        if (phone.length !== 8) continue;
        if (primary && phone === primary) continue; // تجاهل رقم الخط الأساسي في الترويسة
        if (!found.has(phone)) found.set(phone, m.index);
    }

    // بنية كل بطاقة مشترك في الصفحة: الرقم أولاً ثم الحصة والحالة بعده (وفق ترتيب العناصر في HTML
    // المصدر: h2 للرقم، h4 للحصة والحالة). لذلك نبحث فقط للأمام، ونحدّه بموضع الرقم التالي حتى لا
    // تُقرأ حصة/حالة تخص مشتركاً آخر.
    const ordered = [...found.entries()].sort((a, b) => a[1] - b[1]);
    const out = [];
    for (let i = 0; i < ordered.length; i++) {
        const [phone, idx] = ordered[i];
        const nextIdx = i + 1 < ordered.length ? ordered[i + 1][1] : text.length;
        const windowEnd = Math.min(idx + 200, nextIdx);
        const windowText = text.slice(idx, windowEnd);

        // أنماط الحصة: "1.48 / 5 GB" أو "1.48/5GB" أو "5 GB" فقط (بدون مستهلك)
        const usedTotal = windowText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*GB/i);
        const totalOnly = !usedTotal && windowText.match(/(\d+(?:\.\d+)?)\s*GB/i);

        let usedGB = null;
        let quotaGB = null;
        if (usedTotal) {
            usedGB = parseFloat(usedTotal[1]);
            quotaGB = parseFloat(usedTotal[2]);
        } else if (totalOnly) {
            quotaGB = parseFloat(totalOnly[1]);
        }

        const statusMatch = windowText.match(/\b(Active|Pending)\b/i) || windowText.match(/(نشط|قيد الانتظار)/);
        let status = 'Active';
        if (statusMatch) {
            const s = statusMatch[1];
            status = /pending|قيد الانتظار/i.test(s) ? 'Pending' : 'Active';
        }

        out.push({
            phone,
            usedGB: Number.isFinite(usedGB) ? usedGB : null,
            quotaGB: Number.isFinite(quotaGB) ? quotaGB : null,
            status
        });
    }

    // معلومات الباقة الرئيسية تظهر عادة في مقدمة الصفحة، قبل أول رقم مشترك ثانوي
    const headerText = ordered.length > 0 ? text.slice(0, ordered[0][1]) : text;
    const mainInfo = extractMainBundleInfo(text, headerText);

    return { subscribers: out, mainInfo };
}

const SESSION_CODES = ['SESSION_EXPIRED', 'LOGIN_FAILED', 'CAPTCHA_REQUIRED', 'CAPTCHA_TIMEOUT'];

// جلب الخط (مع عزل المحل) وفك تشفير بيانات الدخول
async function loadLine(shopId, lineId) {
    const [rows] = await pool.query('SELECT * FROM locked_lines WHERE id = ? AND shop_id = ?', [lineId, shopId]);
    const line = rows[0];
    if (!line) return null;
    let creds = null;
    if (line.alfa_username && line.alfa_password_enc) {
        try {
            creds = { username: line.alfa_username, password: decrypt(line.alfa_password_enc) };
        } catch (e) {
            creds = null; // مفتاح التشفير تغيّر
        }
    }
    return { line, creds };
}

async function markStatus(shopId, lineId, status, touchSync = false) {
    await pool.query(
        `UPDATE locked_lines SET alfa_session_status = ?${touchSync ? ', alfa_last_sync_at = NOW()' : ''} WHERE id = ? AND shop_id = ?`,
        [status, lineId, shopId]
    );
}

const statusForError = (err) => (SESSION_CODES.includes(err.code) ? 'expired' : 'error');

// تنفيذ المزامنة وتحديث حالة الجلسة؛ يرمي Error بالعربية عند الفشل
async function runSync(shopId, lineId, creds, payload) {
    try {
        const result = await automation.executeUShareSync({ shopId, lineId, creds, ...payload });
        await markStatus(shopId, lineId, 'active', true);
        return result;
    } catch (err) {
        await markStatus(shopId, lineId, statusForError(err)).catch(() => { });
        throw err;
    }
}

// يدمج المشتركين الذين جُلبوا من Alfa في خانات user1..user3 للخط (دون حذف أي مشترك محلي):
//  - رقم موجود محلياً: يبقى الاسم المحلي وتُحدَّث الحصة (GB) من Alfa
//  - رقم جديد: يُوضع في أول خانة فارغة باسم الزبون المطابق للرقم في جدول الزبائن، وإلا بالرقم نفسه
//  - ما زاد عن 3 مشتركين لا يتّسع له الخط ويُبلَّغ عنه في overflow
// يحدّث أيضاً صلاحية الخط (الأيام المتبقية) وحالة الخدمة والرصيد من mainInfo إن توفرت — ولا يُطفئ
// الخدمة أبداً من هذا المسار (فقط يُشعلها عند وجود دليل نشاط)، حتى لا تظهر "متوقفة" خطأً.
async function mergeSubscribersIntoLine(shopId, line, subscribers, mainInfo = null) {
    const [custRows] = await pool.query('SELECT name, phone FROM customers WHERE shop_id = ?', [shopId]);
    const phoneByName = new Map();
    const nameByPhone = new Map();
    for (const c of custRows) {
        const p = normPhone8(c.phone);
        if (!p) continue;
        phoneByName.set(String(c.name || '').toLowerCase().trim(), p);
        if (!nameByPhone.has(p)) nameByPhone.set(p, c.name);
    }

    const usedGbOf = (n) => {
        const v = line[`user${n}_used_gb`];
        return v !== null && v !== undefined ? parseFloat(v) : null;
    };

    const slots = [1, 2, 3].map((n) => {
        const text = String(line[`user${n}`] || '').trim();
        const name = text.split('(')[0].trim();
        const phone = normPhone8(line[`user${n}_phone`]) || (name ? phoneByName.get(name.toLowerCase()) || '' : '');
        const usedGB = usedGbOf(n);
        return { n, text, name, phone, usedGB, origText: text, origPhone: normPhone8(line[`user${n}_phone`]), origUsedGB: usedGB };
    });

    let added = 0;
    let updated = 0;
    let overflow = 0;
    for (const sub of subscribers || []) {
        const phone = normPhone8(sub.phone);
        if (!phone) continue;
        const hasQuota = sub.quotaGB !== null && sub.quotaGB !== undefined && Number.isFinite(Number(sub.quotaGB));
        const hasUsed = sub.usedGB !== null && sub.usedGB !== undefined && Number.isFinite(Number(sub.usedGB));

        const existing = slots.find((s) => s.text && s.phone === phone);
        if (existing) {
            if (hasQuota) existing.text = `${existing.name} (${sub.quotaGB} GB)`;
            existing.phone = phone;
            existing.usedGB = hasUsed ? Number(sub.usedGB) : null;
            updated++;
            continue;
        }
        const empty = slots.find((s) => !s.text);
        if (!empty) {
            overflow++;
            continue;
        }
        empty.name = nameByPhone.get(phone) || phone;
        empty.text = hasQuota ? `${empty.name} (${sub.quotaGB} GB)` : empty.name;
        empty.phone = phone;
        empty.usedGB = hasUsed ? Number(sub.usedGB) : null;
        added++;
    }

    const slotsChanged = slots.some((s) => s.text !== s.origText || s.phone !== s.origPhone || s.usedGB !== s.origUsedGB);

    // الأيام المتبقية: من mainInfo مباشرة (أيام صريحة أو محسوبة من تاريخ الانتهاء على Alfa)
    const remainingDays = Number.isFinite(mainInfo?.remainingDays) ? Math.max(0, Math.round(mainInfo.remainingDays)) : null;

    // حالة النشاط: نُشغّلها فقط عند وجود دليل (لا نُطفئها أبداً من هذا المسار):
    // حالة الباقة الرئيسية = نشطة، أو وجود مشترك ثانوي نشط واحد على الأقل، أو أيام متبقية > 0
    const anyActiveSub = (subscribers || []).some((s) => s.status === 'Active');
    const shouldActivate = Boolean(
        mainInfo?.isActive === true || anyActiveSub || (remainingDays !== null && remainingDays > 0)
    );

    const balanceUSD = Number.isFinite(mainInfo?.balanceUSD) ? mainInfo.balanceUSD : null;

    // للخطوط المفتوحة فقط: استهلاك/حصة باقة الأدمن نفسه (المستخرجة من مقدمة صفحة U-Share)
    const isOpenLine = (line.line_type || 'locked') === 'open';
    const adminUsedGB = isOpenLine && Number.isFinite(mainInfo?.usedGB) ? mainInfo.usedGB : null;
    const adminQuotaGBText = isOpenLine && Number.isFinite(mainInfo?.quotaGB) ? String(mainInfo.quotaGB) : null;

    const shouldUpdate = slotsChanged || remainingDays !== null || shouldActivate || balanceUSD !== null
        || adminUsedGB !== null || adminQuotaGBText !== null;
    if (shouldUpdate) {
        await pool.query(
            `UPDATE locked_lines SET
                user1 = ?, user1_phone = ?, user1_used_gb = ?,
                user2 = ?, user2_phone = ?, user2_used_gb = ?,
                user3 = ?, user3_phone = ?, user3_used_gb = ?,
                validity_days = COALESCE(?, validity_days),
                validity_start_date = CASE WHEN ? IS NOT NULL THEN CURDATE() ELSE validity_start_date END,
                has_service = CASE WHEN ? = 1 THEN 1 ELSE has_service END,
                service_active = CASE WHEN ? = 1 THEN 1 ELSE service_active END,
                service_start_date = CASE WHEN ? = 1 AND service_start_date IS NULL THEN CURDATE() ELSE service_start_date END,
                balance_usd = COALESCE(?, balance_usd),
                admin_used_gb = COALESCE(?, admin_used_gb),
                admin_gb = COALESCE(?, admin_gb)
             WHERE id = ? AND shop_id = ?`,
            [
                slots[0].text, slots[0].phone, slots[0].usedGB,
                slots[1].text, slots[1].phone, slots[1].usedGB,
                slots[2].text, slots[2].phone, slots[2].usedGB,
                remainingDays, remainingDays,
                shouldActivate ? 1 : 0, shouldActivate ? 1 : 0, shouldActivate ? 1 : 0,
                balanceUSD,
                adminUsedGB, adminQuotaGBText,
                line.id, shopId
            ]
        );
    }

    const out = {};
    slots.forEach((s) => {
        out[`user${s.n}`] = s.text;
        out[`user${s.n}Phone`] = s.phone;
        out[`user${s.n}UsedGb`] = s.usedGB;
    });

    return {
        added,
        updated,
        overflow,
        slots: out,
        mainInfo: {
            remainingDays,
            isActive: shouldActivate ? true : null,
            balanceUSD,
            adminUsedGb: adminUsedGB,
            adminGb: adminQuotaGBText
        }
    };
}

module.exports = { loadLine, markStatus, runSync, statusForError, mergeSubscribersIntoLine, parseAlfaUShareText };
