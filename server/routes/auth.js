const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// توليد توكن JWT للمتجر
const generateToken = (shop) => {
    return jwt.sign(
        { shopId: shop.id, email: shop.email },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// 1. إنشاء حساب متجر جديد (Register)
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, subtitle, phone } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
        }

        // فحص ما إذا كان البريد مسجلاً مسبقاً
        const [existing] = await pool.query('SELECT id FROM shops WHERE email = ?', [email.trim().toLowerCase()]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً لمحل آخر' });
        }

        const shopId = `shop_${Date.now()}`;
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const shopName = name ? name.trim() : '';
        const shopSubtitle = subtitle ? subtitle.trim() : '';
        const shopPhone = phone ? phone.trim() : '';

        await pool.query(
            `INSERT INTO shops (id, email, password_hash, name, subtitle, phone, exchange_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [shopId, email.trim().toLowerCase(), passwordHash, shopName, shopSubtitle, shopPhone, 89500]
        );

        const token = generateToken({ id: shopId, email: email.trim().toLowerCase() });

        res.status(201).json({
            message: 'تم إنشاء حساب المحل بنجاح',
            token,
            shop: {
                id: shopId,
                email: email.trim().toLowerCase(),
                name: shopName,
                subtitle: shopSubtitle,
                phone: shopPhone,
                exchangeRate: 89500
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'خطأ داخلي في الخادم أثناء إنشاء الحساب' });
    }
});

// 2. تسجيل الدخول (Login)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
        }

        const [rows] = await pool.query('SELECT * FROM shops WHERE email = ?', [email.trim().toLowerCase()]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        const shop = rows[0];
        const isMatch = await bcrypt.compare(password, shop.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        const token = generateToken(shop);

        res.json({
            message: 'تم تسجيل الدخول بنجاح',
            token,
            shop: {
                id: shop.id,
                email: shop.email,
                name: shop.name,
                subtitle: shop.subtitle,
                phone: shop.phone,
                logo: shop.logo,
                exchangeRate: parseFloat(shop.exchange_rate)
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'خطأ داخلي في الخادم أثناء تسجيل الدخول' });
    }
});

// 3. التحقق من التوكن وجلب بيانات المحل الحالية (Session Check)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, email, name, subtitle, phone, logo, exchange_rate, created_at FROM shops WHERE id = ?',
            [req.shopId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'المحل غير موجود' });
        }

        const shop = rows[0];
        res.json({
            shop: {
                id: shop.id,
                email: shop.email,
                name: shop.name,
                subtitle: shop.subtitle,
                phone: shop.phone,
                logo: shop.logo,
                exchangeRate: parseFloat(shop.exchange_rate)
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'خطأ في جلب بيانات الحساب' });
    }
});

module.exports = router;