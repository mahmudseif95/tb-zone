const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ==========================================
// 8. الديون (إضافة / تعديل / سداد مع التسجيل الشامل والتراجع)
// ==========================================
router.post('/debt', async (req, res) => {
    const shopId = req.shopId;
    const { category, name, phone, amount, currency, dueDate, notes, sourceWalletId, targetSimId, targetLineId } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const debtId = `debt_${Date.now()}`;
        const dhId = `dh_${Date.now()}`;
        const numAmt = parseFloat(amount) || 0;
        const curr = currency === 'LBP' ? 'LBP' : 'USD';
        const isLBP = curr === 'LBP';
        const cat = category || 'customers';

        await conn.query(
            `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, paid, source_wallet_id, target_sim_id, target_line_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [
                debtId, shopId, cat, name.trim(), phone || '',
                numAmt, numAmt, curr, dueDate || null,
                cat === 'boxes' ? (sourceWalletId || null) : null,
                targetSimId || null, targetLineId || null, notes || ''
            ]
        );

        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
       VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
            [dhId, shopId, debtId, numAmt, curr, numAmt, notes || 'تسجيل ذمة جديدة']
        );

        let ledgerId = null;
        let walletName = name.trim();

        if (cat === 'boxes' && sourceWalletId) {
            const [wRows] = await conn.query('SELECT name FROM sources WHERE id = ? AND shop_id = ?', [sourceWalletId, shopId]);
            if (wRows[0]?.name) walletName = wRows[0].name;

            await conn.query(
                `UPDATE sources SET 
         balance_lbp = GREATEST(0, balance_lbp - ?),
         balance_usd = GREATEST(0, balance_usd - ?)
         WHERE id = ? AND shop_id = ?`,
                [isLBP ? numAmt : 0, !isLBP ? numAmt : 0, sourceWalletId, shopId]
            );

            ledgerId = `tx_box_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, sourceWalletId, `سحب / استلاف من الصندوق: ${notes || walletName}`, numAmt, curr, sourceWalletId, sourceWalletId]
            );
        }

        const catLabel = cat === 'boxes' ? 'صندوق' : cat === 'merchants' ? 'تاجر' : 'زبون';
        const explanation = cat === 'boxes'
            ? `تم تسجيل استلاف / دين صندوق بقيمة ${numAmt.toLocaleString()} ${curr} على محفظة "${walletName}" وخُصم من رصيدها${notes ? ` (${notes})` : ''}.`
            : `تم تسجيل ذمة جديدة على ${catLabel} "${name.trim()}" بقيمة ${numAmt.toLocaleString()} ${curr}${notes ? ` (${notes})` : ''}.`;

        const meta = {
            kind: 'debt_create',
            debtId,
            dhId,
            category: cat,
            sourceWalletId: cat === 'boxes' ? (sourceWalletId || null) : null,
            amount: numAmt,
            currency: curr,
            ledgerId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes, explanation, meta_json)
       VALUES (?, ?, 'debt_create', ?, ?, ?, ?, 0, 0, ?, ?, 1, 'debt', ?, ?, ?)`,
            [
                `op_debt_${Date.now()}`, shopId,
                `تسجيل دين (${catLabel}): ${name.trim()}`,
                `تسجيل دين (${catLabel}): ${name.trim()}`,
                numAmt, curr, name.trim(), phone || '', notes || '', explanation, JSON.stringify(meta)
            ]
        );

        await conn.commit();
        res.status(201).json({ success: true, id: debtId });
    } catch (err) {
        await conn.rollback();
        console.error('Create debt error:', err);
        res.status(500).json({ message: 'فشل تسجيل الدين' });
    } finally {
        conn.release();
    }
});

router.put('/debt/:id', async (req, res) => {
    const shopId = req.shopId;
    const { name, amount, currency, dueDate, notes, paid } = req.body;
    try {
        await pool.query(
            `UPDATE debts SET 
       name = COALESCE(?, name),
       amount = COALESCE(?, amount),
       currency = COALESCE(?, currency),
       due_date = COALESCE(?, due_date),
       notes = COALESCE(?, notes),
       paid = COALESCE(?, paid)
       WHERE id = ? AND shop_id = ?`,
            [name, amount, currency, dueDate, notes, paid !== undefined ? (paid ? 1 : 0) : undefined, req.params.id, shopId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل تعديل الدين' });
    }
});

router.delete('/debt/:id', async (req, res) => {
    const shopId = req.shopId;
    try {
        await pool.query('DELETE FROM debts WHERE id = ? AND shop_id = ?', [req.params.id, shopId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل حذف الدين' });
    }
});

router.post('/debt-payment', async (req, res) => {
    const shopId = req.shopId;
    const { debtId, amount, notes } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [debtRows] = await conn.query('SELECT * FROM debts WHERE id = ? AND shop_id = ?', [debtId, shopId]);
        if (debtRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'الدين غير موجود' });
        }

        const debt = debtRows[0];
        const debtCurrency = debt.currency === 'LBP' ? 'LBP' : 'USD';
        const isLBP = debtCurrency === 'LBP';

        const currentAmt = parseFloat(debt.amount) || 0;
        const payAmt = parseFloat(amount) || 0;
        const newAmt = Math.max(0, parseFloat((currentAmt - payAmt).toFixed(2)));
        const isPaid = newAmt <= (isLBP ? 100 : 0.01) ? 1 : 0;

        await conn.query('UPDATE debts SET amount = ?, paid = ? WHERE id = ?', [newAmt, isPaid, debtId]);

        const dhId = `dh_${Date.now()}`;
        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [dhId, shopId, debtId, isPaid ? 'full_payment' : 'payment', payAmt, debtCurrency, newAmt, notes || 'سداد دفعة من الدين']
        );

        let ledgerId = null;
        if (debt.category === 'boxes' && debt.source_wallet_id) {
            await conn.query(
                `UPDATE sources SET 
         balance_lbp = balance_lbp + ?, 
         balance_usd = balance_usd + ? 
         WHERE id = ? AND shop_id = ?`,
                [isLBP ? payAmt : 0, !isLBP ? payAmt : 0, debt.source_wallet_id, shopId]
            );

            ledgerId = `tx_repay_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'deposit', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, debt.source_wallet_id, `استرداد سداد دين: ${debt.notes || debt.name}`, payAmt, debtCurrency, debt.source_wallet_id, debt.source_wallet_id]
            );
        }

        const explanation = debt.category === 'boxes'
            ? `تم استرداد / تسديد ${payAmt.toLocaleString()} ${debtCurrency} إلى محفظة "${debt.name}" (المتبقي من دين الصندوق: ${newAmt.toLocaleString()} ${debtCurrency}).`
            : `تم قبض دفعة دين من "${debt.name}" بقيمة ${payAmt.toLocaleString()} ${debtCurrency} (المتبقي عليه: ${newAmt.toLocaleString()} ${debtCurrency}).`;

        const meta = {
            kind: 'debt_payment',
            debtId,
            dhId,
            category: debt.category,
            sourceWalletId: debt.source_wallet_id || null,
            amount: payAmt,
            currency: debtCurrency,
            ledgerId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes, explanation, meta_json)
       VALUES (?, ?, 'debt_payment', ?, ?, ?, ?, 0, 0, ?, ?, 0, 'cash', ?, ?, ?)`,
            [
                `op_dpay_${Date.now()}`, shopId,
                `تسديد دين: ${debt.name}`,
                `تسديد دين: ${debt.name}`,
                payAmt, debtCurrency, debt.name, debt.phone || '', notes || '', explanation, JSON.stringify(meta)
            ]
        );

        await conn.commit();
        res.json({ success: true, remainingAmount: newAmt, paid: Boolean(isPaid) });
    } catch (err) {
        await conn.rollback();
        console.error('Debt payment error:', err);
        res.status(500).json({ message: 'فشل معالجة سداد الدين' });
    } finally {
        conn.release();
    }
});


// ==========================================
// 9. الزبائن والمصاريف (Customers & Expenses)
// ==========================================
router.post('/customer', async (req, res) => {
    const shopId = req.shopId;
    const { name, phone, address } = req.body;
    const custId = `cust_${Date.now()}`;
    try {
        await pool.query(
            'INSERT INTO customers (id, shop_id, name, phone, address) VALUES (?, ?, ?, ?, ?)',
            [custId, shopId, name.trim(), phone || '', address || '']
        );
        res.status(201).json({ success: true, id: custId });
    } catch (err) {
        res.status(500).json({ message: 'فشل إضافة الزبون' });
    }
});

router.put('/customer/:id', async (req, res) => {
    const shopId = req.shopId;
    const { name, phone, address } = req.body;
    try {
        await pool.query(
            'UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ? AND shop_id = ?',
            [name, phone, address, req.params.id, shopId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل تعديل الزبون' });
    }
});

router.delete('/customer/:id', async (req, res) => {
    const shopId = req.shopId;
    try {
        await pool.query('DELETE FROM customers WHERE id = ? AND shop_id = ?', [req.params.id, shopId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل حذف الزبون' });
    }
});

module.exports = router;
