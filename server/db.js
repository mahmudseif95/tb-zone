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