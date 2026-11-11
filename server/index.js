const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const operationsRoutes = require('./routes/operations'); // الراوتر الجديد

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/operations', operationsRoutes); // تفعيل المسار

app.get('/api/health', (req, res) => {
    res.json({ status: 'active', message: 'Telecom OS Backend is running smoothly 🚀' });
});

app.listen(PORT, () => {
    console.log(`📡 الخادم يعمل بنجاح على المنفذ: http://localhost:${PORT}`);
});