const crypto = require('crypto');

// المفتاح: ALFA_SECRET_KEY من .env. بدونه نشتق مفتاحاً من JWT_SECRET (أفضل من لا شيء) — يُنصح بتعيين مفتاح مستقل.
const getKey = () => {
    const raw = process.env.ALFA_SECRET_KEY || `alfa-fallback:${process.env.JWT_SECRET || 'telecom-os-dev'}`;
    return crypto.createHash('sha256').update(raw).digest(); // 32 bytes
};

function encrypt(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, enc].map(b => b.toString('base64')).join(':');
}

function decrypt(payload) {
    const [iv, tag, enc] = String(payload).split(':').map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, encryptPassword: encrypt, decryptPassword: decrypt };
