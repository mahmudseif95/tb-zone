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
        ['alfa_last_sync_at', 'DATETIME NULL'],
        ['user1_phone', 'VARCHAR(30) NULL'],
        ['user2_phone', 'VARCHAR(30) NULL'],
        ['user3_phone', 'VARCHAR(30) NULL'],
        ['user1_used_gb', 'DECIMAL(6,2) NULL'],
        ['user2_used_gb', 'DECIMAL(6,2) NULL'],
        ['user3_used_gb', 'DECIMAL(6,2) NULL'],
        // استهلاك حصة الأدمن (الخط المفتوح) من موقع Alfa — مكافئ لـ userX_used_gb لكن لباقة الأدمن نفسه
        ['admin_used_gb', 'DECIMAL(6,2) NULL']
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

// أرشيف الدورات: لقطة كاملة عن أي خط (مسكر أو مفتوح) عند انتهاء صلاحيته أو تصفيره يدوياً
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS line_cycles (
                id VARCHAR(50) PRIMARY KEY,
                shop_id VARCHAR(50) NOT NULL,
                line_id VARCHAR(50) NOT NULL,
                line_type VARCHAR(20) NOT NULL DEFAULT 'locked',
                line_phone VARCHAR(50) NULL,
                started_at DATE NULL,
                expired_at DATETIME NOT NULL,
                subscribers_json TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_line_cycles_shop_line (shop_id, line_id),
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (line_id) REFERENCES locked_lines(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    } catch (err) {
        console.error('❌ فشل إنشاء جدول line_cycles:', err.message);
    }
})();
