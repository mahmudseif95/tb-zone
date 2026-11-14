/**
 * أتمتة موقع Alfa Self-Care (الخطوط المسكرة فقط — U-Share).
 *
 * ⚠️ المحددات (SELECTORS) أدناه مبنية على نصوص الواجهة المتوقعة ولم تُختبر على حساب حقيقي.
 *    عند أول تشغيل استخدم الوضع التفاعلي (interactive) وعدّل هذا الكائن حسب صفحات Alfa الفعلية.
 *    - لا نتجاوز الكابتشا: إن ظهرت تُحل يدوياً في نافذة مرئية وتُحفظ الكوكيز في ملف الجلسة.
 */
const path = require('path');
const fs = require('fs');

const BASE = 'https://www.alfa.com.lb';
const SESSIONS_ROOT = path.join(__dirname, '..', '.alfa-sessions');
const USHARE_URL = `${BASE}/en/account/manage-services/ushare`;

const SELECTORS = {
    // تسجيل الدخول
    loginUrl: `${BASE}/en/account/login`,
    username: 'input[name*="user" i], input[id*="user" i], input[type="tel"], input[type="text"]',
    password: 'input[type="password"]',
    loginButton: 'button:has-text("Login"), button:has-text("Sign in"), input[type="submit"]',
    captcha: 'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .h-captcha',
    loginError: '.alert-danger, .error-message, [class*="error" i]',
    // U-Share
    secondaryRow: 'tr:has-text("GB"), .ushare-row, [class*="secondary" i] li',
    phoneInput: 'input[name*="number" i], input[placeholder*="number" i], input[type="tel"]',
    quotaInput: 'input[name*="quota" i], input[name*="gb" i], input[placeholder*="GB" i]',
    addButton: 'button:has-text("Add"), a:has-text("Add")',
    editButton: 'button:has-text("Edit"), a:has-text("Edit")',
    removeButton: 'button:has-text("Remove"), button:has-text("Delete"), a:has-text("Remove")',
    submitButton: 'button:has-text("SUBMIT"), button:has-text("Submit"), input[type="submit"]',
    confirmButton: 'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK")',
    errorBanner: '.alert-danger, .error-message'
};

let chromium;
const loadPlaywright = () => {
    if (!chromium) chromium = require('playwright').chromium;
    return chromium;
};

// طابور لكل خط: يمنع فتح نفس ملف الجلسة بمتصفحين بالتوازي
const queues = new Map();
const enqueue = (key, task) => {
    const prev = queues.get(key) || Promise.resolve();
    const next = prev.catch(() => { }).then(task);
    queues.set(key, next);
    next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => { });
    return next;
};

// حماية من path traversal في أسماء المجلدات
const safeId = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '');
const profileDir = (shopId, lineId) => {
    const dir = path.join(SESSIONS_ROOT, safeId(shopId), safeId(lineId));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

class AlfaError extends Error {
    constructor(message, code = 'ALFA_ERROR') {
        super(message);
        this.code = code;
    }
}

async function withContext({ shopId, lineId, headless }, fn) {
    let ctx;
    try {
        ctx = await loadPlaywright().launchPersistentContext(profileDir(shopId, lineId), {
            headless,
            viewport: { width: 1280, height: 900 },
            locale: 'en-US'
        });
    } catch (err) {
        throw new AlfaError(`تعذّر تشغيل المتصفح (نفّذ: npx playwright install chromium) — ${err.message}`, 'BROWSER_LAUNCH');
    }
    try {
        const page = ctx.pages()[0] || await ctx.newPage();
        page.setDefaultTimeout(20000);
        return await fn(page);
    } finally {
        await ctx.close().catch(() => { });
    }
}

const onLoginPage = async (page) =>
    /login/i.test(page.url()) || await page.locator(SELECTORS.password).first().isVisible().catch(() => false);

async function gotoUShare(page) {
    await page.goto(USHARE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => { });
    return !(await onLoginPage(page)); // false = الجلسة منتهية
}

async function doLogin(page, { username, password, interactive }) {
    await page.goto(SELECTORS.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.locator(SELECTORS.username).first().fill(String(username));
    await page.locator(SELECTORS.password).first().fill(String(password));

    const hasCaptcha = await page.locator(SELECTORS.captcha).first().isVisible().catch(() => false);
    if (hasCaptcha && !interactive) {
        throw new AlfaError('يطلب موقع Alfa حل CAPTCHA. استخدم "ربط تفاعلي" لفتح نافذة وحلّها مرة واحدة.', 'CAPTCHA_REQUIRED');
    }
    if (hasCaptcha && interactive) {
        // ننتظر المستخدم (حتى 3 دقائق) ليحل الكابتشا ويضغط دخول بنفسه
        try {
            await page.waitForURL(url => !/login/i.test(url.toString()), { timeout: 180000 });
        } catch (e) {
            throw new AlfaError('انتهت مهلة حل CAPTCHA. أعد المحاولة.', 'CAPTCHA_TIMEOUT');
        }
    } else {
        await page.locator(SELECTORS.loginButton).first().click();
        await page.waitForLoadState('networkidle').catch(() => { });
    }

    if (await onLoginPage(page)) {
        const msg = await page.locator(SELECTORS.loginError).first().textContent().catch(() => '');
        throw new AlfaError(`فشل تسجيل الدخول إلى Alfa${msg && msg.trim() ? `: ${msg.trim()}` : ' — تحقق من اسم المستخدم وكلمة المرور'}`, 'LOGIN_FAILED');
    }
}

// يضمن وجود جلسة صالحة، ويعيد تسجيل الدخول مرة واحدة تلقائياً عند انتهائها
async function ensureSession(page, creds) {
    if (await gotoUShare(page)) return;
    if (!creds || !creds.username || !creds.password) {
        throw new AlfaError('جلسة Alfa منتهية ولا توجد بيانات دخول محفوظة', 'SESSION_EXPIRED');
    }
    await doLogin(page, { ...creds, interactive: false });
    if (!(await gotoUShare(page))) {
        throw new AlfaError('تعذّر الوصول إلى صفحة U-Share بعد تسجيل الدخول', 'USHARE_UNREACHABLE');
    }
}

const normPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^961/, '').replace(/^0/, '');

// ==========================================
// 1. ربط وفحص الجلسة
// ==========================================
function connectAndVerifySession({ shopId, lineId, username, password, interactive = false }) {
    return enqueue(`${shopId}:${lineId}`, () =>
        withContext({ shopId, lineId, headless: !interactive }, async (page) => {
            if (!(await gotoUShare(page))) {
                await doLogin(page, { username, password, interactive });
                if (!(await gotoUShare(page))) {
                    throw new AlfaError('تم تسجيل الدخول لكن تعذّر الوصول إلى صفحة U-Share لهذا الحساب', 'USHARE_UNREACHABLE');
                }
            }
            return { ok: true, status: 'active' };
        })
    );
}

// ==========================================
// 2. جلب المشتركين الثانويين الحاليين وحصصهم
// ==========================================
async function readSecondaries(page) {
    const rows = await page.locator(SELECTORS.secondaryRow).all();
    const out = [];
    for (const row of rows) {
        const text = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
        const phoneMatch = text.match(/(?:\+?961[\s-]?|0)?(\d{2}[\s-]?\d{3}[\s-]?\d{3})/);
        const gbMatch = text.match(/(\d+(?:\.\d+)?)\s*GB/i);
        if (phoneMatch) {
            out.push({
                phone: normPhone(phoneMatch[1]),
                quotaGB: gbMatch ? parseFloat(gbMatch[1]) : null
            });
        }
    }
    return out;
}

function fetchLiveUShareStatus({ shopId, lineId, creds }) {
    return enqueue(`${shopId}:${lineId}`, () =>
        withContext({ shopId, lineId, headless: true }, async (page) => {
            await ensureSession(page, creds);
            return { subscribers: await readSecondaries(page) };
        })
    );
}

// ==========================================
// 3. تنفيذ إضافة / تعديل / حذف مشترك
// ==========================================
async function findRow(page, phone) {
    const wanted = normPhone(phone);
    const rows = await page.locator(SELECTORS.secondaryRow).all();
    for (const row of rows) {
        const digits = (await row.innerText().catch(() => '')).replace(/\D/g, '');
        if (digits.includes(wanted)) return row;
    }
    return null;
}

async function failIfRejected(page) {
    const err = page.locator(SELECTORS.errorBanner).first();
    if (await err.isVisible().catch(() => false)) {
        const msg = ((await err.textContent().catch(() => '')) || '').trim();
        throw new AlfaError(`رفض موقع Alfa العملية${msg ? `: ${msg}` : ''}`, 'ALFA_REJECTED');
    }
}

function executeUShareSync({ shopId, lineId, action, targetPhone, oldPhone, quotaGB, creds }) {
    return enqueue(`${shopId}:${lineId}`, () =>
        withContext({ shopId, lineId, headless: true }, async (page) => {
            await ensureSession(page, creds);
            const target = normPhone(targetPhone || oldPhone);
            if (!target) throw new AlfaError('رقم المشترك مطلوب للمزامنة مع Alfa', 'BAD_INPUT');

            if (action === 'add') {
                await page.locator(SELECTORS.addButton).first().click();
                await page.locator(SELECTORS.phoneInput).first().fill(target);
                await page.locator(SELECTORS.quotaInput).first().fill(String(quotaGB));
                await page.locator(SELECTORS.submitButton).first().click();
            } else if (action === 'edit') {
                const row = await findRow(page, oldPhone || targetPhone);
                if (!row) throw new AlfaError(`الرقم ${target} غير موجود في U-Share على Alfa`, 'NOT_FOUND');
                await row.locator(SELECTORS.editButton).first().click();
                await page.locator(SELECTORS.quotaInput).first().fill(String(quotaGB));
                await page.locator(SELECTORS.submitButton).first().click();
            } else if (action === 'remove') {
                const row = await findRow(page, oldPhone || targetPhone);
                if (!row) throw new AlfaError(`الرقم ${target} غير موجود في U-Share على Alfa`, 'NOT_FOUND');
                await row.locator(SELECTORS.removeButton).first().click();
                await page.locator(SELECTORS.confirmButton).first().click().catch(() => { });
            } else {
                throw new AlfaError('إجراء مزامنة غير معروف', 'BAD_INPUT');
            }

            await page.waitForLoadState('networkidle').catch(() => { });
            await failIfRejected(page);

            // تحقق نهائي: قراءة الحالة الفعلية بعد التنفيذ
            await gotoUShare(page);
            const after = await readSecondaries(page);
            const present = after.find(s => s.phone === target);
            if (action === 'remove' && present) throw new AlfaError('لم يؤكد موقع Alfa حذف المشترك', 'NOT_CONFIRMED');
            if (action !== 'remove' && !present) throw new AlfaError('لم يؤكد موقع Alfa تنفيذ العملية', 'NOT_CONFIRMED');
            return { ok: true, subscribers: after };
        })
    );
}

module.exports = { connectAndVerifySession, fetchLiveUShareStatus, executeUShareSync, AlfaError, SELECTORS };
