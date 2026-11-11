const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// حماية كامل المسارات بواسطة التوكن وعزل المحل
router.use(authMiddleware);

// 1. جلب كافة بيانات المحل المعتمدة دفعة واحدة (Bootstrap)
router.get('/bootstrap', async (req, res) => {
    const shopId = req.shopId;

    try {
        // إعدادات وبيانات المحل
        const [shopRows] = await pool.query(
            'SELECT id, name, subtitle, phone, logo, exchange_rate FROM shops WHERE id = ?',
            [shopId]
        );
        const shop = shopRows[0] || {};

        // المحافظ والصناديق
        const [sourcesRows] = await pool.query(
            'SELECT * FROM sources WHERE shop_id = ? ORDER BY created_at ASC',
            [shopId]
        );
        const [ledgerRows] = await pool.query(
            'SELECT * FROM source_ledger WHERE shop_id = ? ORDER BY date DESC LIMIT 200',
            [shopId]
        );

        const sources = sourcesRows.map(s => ({
            id: s.id,
            name: s.name,
            balanceUSD: parseFloat(s.balance_usd),
            balanceLBP: parseFloat(s.balance_lbp),
            balance: parseFloat(s.balance_usd),
            ledger: ledgerRows
                .filter(l => l.source_id === s.id)
                .map(l => ({
                    id: l.id,
                    type: l.type,
                    itemName: l.item_name,
                    amount: parseFloat(l.amount),
                    currency: l.currency,
                    balanceAfterUSD: parseFloat(l.balance_after_usd),
                    balanceAfterLBP: parseFloat(l.balance_after_lbp),
                    date: l.date
                }))
        }));

        // شرائح الرصيد ودفعاتها
        const [simsRows] = await pool.query(
            'SELECT * FROM sims WHERE shop_id = ? ORDER BY created_at ASC',
            [shopId]
        );
        const [batchesRows] = await pool.query(
            'SELECT * FROM sim_batches WHERE shop_id = ? ORDER BY created_at ASC',
            [shopId]
        );

        const sims = simsRows.map(sim => ({
            id: sim.id,
            operator: sim.operator,
            name: sim.name,
            number: sim.phone_number,
            balance: parseFloat(sim.balance),
            batches: batchesRows
                .filter(b => b.sim_id === sim.id)
                .map(b => ({
                    id: b.id,
                    label: b.label,
                    cycleId: b.cycle_id,
                    amountUSD: parseFloat(b.amount_usd),
                    remainingUSD: parseFloat(b.remaining_usd),
                    costPrice: parseFloat(b.cost_price),
                    costCurrency: b.cost_currency,
                    date: b.created_at
                }))
        }));

        // الخطوط المسكرة
        const [linesRows] = await pool.query(
            'SELECT * FROM locked_lines WHERE shop_id = ? ORDER BY slot_number ASC',
            [shopId]
        );
        const lines = linesRows.map(l => ({
            id: l.id,
            slotNumber: l.slot_number,
            phoneNumber: l.phone_number,
            number: l.phone_number,
            balanceUSD: parseFloat(l.balance_usd).toString(),
            balance: parseFloat(l.balance_usd),
            hasService: Boolean(l.has_service),
            serviceActive: Boolean(l.service_active),
            serviceStartDate: l.service_start_date,
            serviceDays: l.service_days,
            user1: l.user1 || '',
            user2: l.user2 || '',
            user3: l.user3 || ''
        }));

        // الديون وكشوفات السداد
        const [debtsRows] = await pool.query(
            'SELECT * FROM debts WHERE shop_id = ? ORDER BY created_at DESC',
            [shopId]
        );
        const [debtHistoryRows] = await pool.query(
            'SELECT * FROM debt_history WHERE shop_id = ? ORDER BY date ASC',
            [shopId]
        );

        const debts = debtsRows.map(d => ({
            id: d.id,
            category: d.category,
            name: d.name,
            phone: d.phone,
            amount: parseFloat(d.amount),
            originalAmount: parseFloat(d.original_amount),
            currency: d.currency,
            dueDate: d.due_date,
            paid: Boolean(d.paid),
            sourceWalletId: d.source_wallet_id,
            targetSimId: d.target_sim_id,
            targetLineId: d.target_line_id,
            cycleId: d.cycle_id,
            notes: d.notes,
            createdAt: d.created_at,
            history: debtHistoryRows
                .filter(h => h.debt_id === d.id)
                .map(h => ({
                    id: h.id,
                    type: h.type,
                    amount: parseFloat(h.amount),
                    currency: h.currency,
                    notes: h.notes,
                    date: h.date
                }))
        }));

        // الزبائن
        const [customersRows] = await pool.query(
            'SELECT * FROM customers WHERE shop_id = ? ORDER BY name ASC',
            [shopId]
        );
        const customers = customersRows.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address
        }));

        // سجل المبيعات
        const [salesRows] = await pool.query(
            'SELECT * FROM sales_history WHERE shop_id = ? ORDER BY date DESC LIMIT 200',
            [shopId]
        );
        const salesHistory = salesRows.map(s => ({
            id: s.id,
            type: s.type,
            operator: s.operator,
            title: s.title,
            itemName: s.item_name,
            sellingPrice: parseFloat(s.selling_price),
            currency: s.currency,
            costUSD: parseFloat(s.cost_usd),
            profitUSD: parseFloat(s.profit_usd),
            customerName: s.customer_name,
            customerPhone: s.customer_phone,
            isDebt: Boolean(s.is_debt),
            paymentType: s.payment_type,
            notes: s.notes,
            cycleId: s.cycle_id,
            date: s.date
        }));

        // المصاريف
        const [expensesRows] = await pool.query(
            'SELECT * FROM expenses WHERE shop_id = ? ORDER BY date DESC LIMIT 100',
            [shopId]
        );
        const expenses = expensesRows.map(e => ({
            id: e.id,
            title: e.title,
            amount: parseFloat(e.amount),
            currency: e.currency,
            sourceWalletId: e.source_wallet_id,
            notes: e.notes,
            date: e.date
        }));

        res.json({
            brandConfig: {
                name: shop.name || 'ZOLFA TECH',
                subtitle: shop.subtitle || 'OS TELECOM',
                phone: shop.phone || '78877026',
                logo: shop.logo || ''
            },
            exchangeRate: parseFloat(shop.exchange_rate) || 89500,
            sources,
            sims,
            lines,
            debts,
            customers,
            salesHistory,
            expenses
        });

    } catch (err) {
        console.error('Bootstrap data error:', err);
        res.status(500).json({ message: 'فشل جلب بيانات المحل من السيرفر' });
    }
});

// 2. تحديث إعدادات وهوية المتجر وسعر الصرف
router.put('/brand', async (req, res) => {
    const shopId = req.shopId;
    const { name, subtitle, phone, logo, exchangeRate } = req.body;

    try {
        await pool.query(
            `UPDATE shops 
       SET name = COALESCE(?, name),
           subtitle = COALESCE(?, subtitle),
           phone = COALESCE(?, phone),
           logo = COALESCE(?, logo),
           exchange_rate = COALESCE(?, exchange_rate)
       WHERE id = ?`,
            [name, subtitle, phone, logo, exchangeRate, shopId]
        );
        res.json({ message: 'تم تحديث هوية المحل بنجاح' });
    } catch (err) {
        console.error('Update brand error:', err);
        res.status(500).json({ message: 'خطأ أثناء تحديث بيانات المتجر' });
    }
});

// 3. ترحيل ونقل بيانات LocalStorage كاملة إلى MySQL (Import / Seed)
router.post('/import-local', async (req, res) => {
    const shopId = req.shopId;
    const { brandConfig, exchangeRate, sources, sims, lines, debts, customers, expenses, salesHistory } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // تحديث المحل وسعر الصرف
        if (brandConfig || exchangeRate) {
            await connection.query(
                'UPDATE shops SET name = ?, subtitle = ?, phone = ?, logo = ?, exchange_rate = ? WHERE id = ?',
                [
                    brandConfig?.name || 'ZOLFA TECH',
                    brandConfig?.subtitle || 'OS TELECOM',
                    brandConfig?.phone || '78877026',
                    brandConfig?.logo || '',
                    exchangeRate || 89500,
                    shopId
                ]
            );
        }

        // استيراد المحافظ
        if (Array.isArray(sources)) {
            for (const s of sources) {
                await connection.query(
                    `INSERT INTO sources (id, shop_id, name, balance_usd, balance_lbp)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE balance_usd = VALUES(balance_usd), balance_lbp = VALUES(balance_lbp)`,
                    [s.id, shopId, s.name, s.balanceUSD || s.balance || 0, s.balanceLBP || 0]
                );
            }
        }

        // استيراد الشرائح والدفعات
        if (Array.isArray(sims)) {
            for (const sim of sims) {
                await connection.query(
                    `INSERT INTO sims (id, shop_id, operator, name, phone_number, balance)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE balance = VALUES(balance), name = VALUES(name)`,
                    [sim.id, shopId, sim.operator || 'alfa', sim.name, sim.number || '', sim.balance || 0]
                );

                if (Array.isArray(sim.batches)) {
                    for (const b of sim.batches) {
                        await connection.query(
                            `INSERT INTO sim_batches (id, shop_id, sim_id, label, cycle_id, amount_usd, remaining_usd, cost_price, cost_currency)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE remaining_usd = VALUES(remaining_usd)`,
                            [
                                b.id, shopId, sim.id, b.label || 'دفعة', b.cycleId || null,
                                b.amountUSD || 0, b.remainingUSD || 0, b.costPrice || 0, b.costCurrency || 'LBP'
                            ]
                        );
                    }
                }
            }
        }

        // استيراد الخطوط المسكرة
        if (Array.isArray(lines)) {
            for (const l of lines) {
                await connection.query(
                    `INSERT INTO locked_lines (id, shop_id, slot_number, phone_number, balance_usd, has_service, service_active, service_start_date, service_days, user1, user2, user3)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE balance_usd = VALUES(balance_usd), user1 = VALUES(user1), user2 = VALUES(user2), user3 = VALUES(user3)`,
                    [
                        l.id, shopId, l.slotNumber || 1, l.phoneNumber || l.number || '',
                        parseFloat(l.balanceUSD || l.balance || 0), l.hasService ? 1 : 0, l.serviceActive ? 1 : 0,
                        l.serviceStartDate || null, l.serviceDays || 30, l.user1 || '', l.user2 || '', l.user3 || ''
                    ]
                );
            }
        }

        // استيراد الديون
        if (Array.isArray(debts)) {
            for (const d of debts) {
                await connection.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, paid, source_wallet_id, target_sim_id, target_line_id, cycle_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE amount = VALUES(amount), paid = VALUES(paid)`,
                    [
                        d.id, shopId, d.category || 'customers', d.name, d.phone || '',
                        d.amount || 0, d.originalAmount || d.amount || 0, d.currency || 'USD',
                        d.dueDate || null, d.paid ? 1 : 0, d.sourceWalletId || null,
                        d.targetSimId || null, d.targetLineId || null, d.cycleId || null, d.notes || ''
                    ]
                );

                if (Array.isArray(d.history)) {
                    for (const h of d.history) {
                        await connection.query(
                            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
                            [h.id || `dh_${Date.now()}_${Math.random()}`, shopId, d.id, h.type || 'payment', h.amount || 0, h.currency || 'USD', h.notes || '']
                        );
                    }
                }
            }
        }

        // استيراد الزبائن
        if (Array.isArray(customers)) {
            for (const c of customers) {
                await connection.query(
                    `INSERT INTO customers (id, shop_id, name, phone, address)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE phone = VALUES(phone), address = VALUES(address)`,
                    [c.id, shopId, c.name, c.phone || '', c.address || '']
                );
            }
        }

        // استيراد العمليات السابقة
        if (Array.isArray(salesHistory)) {
            for (const s of salesHistory) {
                await connection.query(
                    `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes, cycle_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE selling_price = VALUES(selling_price)`,
                    [
                        s.id, shopId, s.type || 'sale', s.operator || null, s.title || '', s.itemName || s.title || '',
                        s.sellingPrice || 0, s.currency || 'USD', s.costUSD || 0, s.profitUSD || 0,
                        s.customerName || 'عام', s.customerPhone || '', s.isDebt ? 1 : 0, s.paymentType || 'cash',
                        s.notes || '', s.cycleId || null
                    ]
                );
            }
        }

        await connection.commit();
        res.json({ message: 'تم ترحيل وحفظ كافة البيانات في قاعدة بيانات MySQL بنجاح!' });
    } catch (err) {
        await connection.rollback();
        console.error('Import local data error:', err);
        res.status(500).json({ message: 'فشل استيراد البيانات إلى السيرفر' });
    } finally {
        connection.release();
    }
});

module.exports = router;