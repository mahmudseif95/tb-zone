const pool = require('../db');
const { decrypt } = require('./alfaCrypto');
const automation = require('./alfaAutomation');

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

module.exports = { loadLine, markStatus, runSync, statusForError };
