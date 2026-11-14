const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'telecom_os_db',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// اختبار الاتصال عند الإقلاع
pool.getConnection()
    .then(connection => {
        console.log('✅ تم الاتصال بقاعدة بيانات MySQL بنجاح.');
        connection.release();
    })
    .catch(err => {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات MySQL:', err.message);
    });

module.exports = pool;
// ترقية آمنة لجدول locked_lines: أعمدة مزامنة Alfa Self-Care (تُضاف فقط إن لم تكن موجودة)
(async () => {
    const cols = [
        ['alfa_username', 'VARCHAR(120) NULL'],
        ['alfa_password_enc', 'TEXT NULL'],
        ['alfa_sync_enabled', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['alfa_session_status', "VARCHAR(30) NOT NULL DEFAULT 'unlinked'"],
        ['alfa_last_sync_at', 'DATETIME NULL']
    ];
    try {
        const [rows] = await pool.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'locked_lines'`
        );
        const existing = new Set(rows.map(r => r.COLUMN_NAME));
        for (const [name, def] of cols) {
            if (!existing.has(name)) {
                await pool.query(`ALTER TABLE locked_lines ADD COLUMN \`${name}\` ${def}`);
                console.log(`➕ تمت إضافة العمود locked_lines.${name}`);
            }
        }
    } catch (err) {
        console.error('❌ فشل ترقية أعمدة Alfa في locked_lines:', err.message);
    }
})();
