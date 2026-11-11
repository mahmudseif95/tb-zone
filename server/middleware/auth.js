const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ message: 'الوصول مرفوض: يرجى تسجيل الدخول أولاً' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.shopId = decoded.shopId;
        req.shopEmail = decoded.email;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'جلسة الدخول منتهية أو غير صالحة' });
    }
};