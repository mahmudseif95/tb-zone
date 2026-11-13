const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// تنسيق التاريخ ليبدأ بـ YYYY-MM-DD أولاً بدون إزاحة توقيت
const formatDateOnly = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return val.toString().split('T')[0];
};

// دالة موحدة لتسديد ديون الصناديق بنفس عملة الدين حصراً (طرح مباشر بدون سعر صرف عند تطابق العملة)
async function settleBoxDebts(conn, { shopId, targetSimId, targetLineId, saleAmount, saleCurrency, rate, noteLabel }) {
    const conditions = [];
    const params = [shopId];

    if (targetSimId) {
        conditions.push('target_sim_id = ?');
        params.push(targetSimId);
    }
    if (targetLineId) {
        conditions.push('target_line_id = ?');
        params.push(targetLineId);
    }
    if (conditions.length === 0) return { costInSaleCurr: 0, costInUSD: 0, hasBoxDebts: false };

    const [boxDebts] = await conn.query(
        `SELECT id, amount, currency, source_wallet_id FROM debts 
     WHERE shop_id = ? AND category = 'boxes' AND (${conditions.join(' OR ')}) AND paid = 0 
     ORDER BY created_at ASC`,
        params
    );

    if (boxDebts.length === 0) return { costInSaleCurr: 0, costInUSD: 0, hasBoxDebts: false };

    let remSaleInNativeCurr = parseFloat(saleAmount) || 0;
    const isSaleLBP = saleCurrency === 'LBP';
    let totalCostInSaleCurr = 0;

    for (const d of boxDebts) {
        if (remSaleInNativeCurr <= 0) break;
        const isDebtLBP = d.currency === 'LBP';
        const dRemNative = parseFloat(d.amount) || 0;
        if (dRemNative <= 0) continue;

        let payInDebtCurr = 0;
        let usedFromSaleCurr = 0;

        if (isDebtLBP === isSaleLBP) {
            // نفس العملة (ليرة مع ليرة، أو دولار مع دولار): طرح مباشر 100% بدون أي سعر صرف
            payInDebtCurr = Math.min(remSaleInNativeCurr, dRemNative);
            usedFromSaleCurr = payInDebtCurr;
        } else if (isDebtLBP && !isSaleLBP) {
            // الدين بالليرة والزبون دفع بالدولار: نحول الدفعة لليرة لتعود للمحفظة ليرة
            const remSaleInLBP = Math.round(remSaleInNativeCurr * rate);
            payInDebtCurr = Math.min(remSaleInLBP, dRemNative);
            usedFromSaleCurr = parseFloat((payInDebtCurr / rate).toFixed(4));
        } else {
            // الدين بالدولار والزبون دفع بالليرة: نحول الدفعة لدولار لتعود للمحفظة دولار
            const remSaleInUSD = remSaleInNativeCurr / rate;
            payInDebtCurr = parseFloat(Math.min(remSaleInUSD, dRemNative).toFixed(2));
            usedFromSaleCurr = Math.round(payInDebtCurr * rate);
        }

        remSaleInNativeCurr = Math.max(0, parseFloat((remSaleInNativeCurr - usedFromSaleCurr).toFixed(4)));
        totalCostInSaleCurr += usedFromSaleCurr;

        const newDebtAmt = Math.max(0, parseFloat((dRemNative - payInDebtCurr).toFixed(2)));
        const isPaid = newDebtAmt <= (isDebtLBP ? 100 : 0.01) ? 1 : 0;

        await conn.query('UPDATE debts SET amount = ?, paid = ? WHERE id = ?', [newDebtAmt, isPaid, d.id]);

        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [`dh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, shopId, d.id, isPaid ? 'full_payment' : 'payment', payInDebtCurr, d.currency, newDebtAmt, noteLabel]
        );

        // إعادة المبلغ إلى المحفظة بنفس عملة الدين حصراً (ليرة -> balance_lbp | دولار -> balance_usd)
        if (d.source_wallet_id && payInDebtCurr > 0) {
            await conn.query(
                'UPDATE sources SET balance_usd = balance_usd + ?, balance_lbp = balance_lbp + ? WHERE id = ? AND shop_id = ?',
                [!isDebtLBP ? payInDebtCurr : 0, isDebtLBP ? payInDebtCurr : 0, d.source_wallet_id, shopId]
            );
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp) 
         VALUES (?, ?, ?, 'deposit', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [`tx_ret_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, shopId, d.source_wallet_id, `استرداد ${noteLabel}`, payInDebtCurr, d.currency, d.source_wallet_id, d.source_wallet_id]
            );
        }
    }

    const costInUSD = isSaleLBP ? parseFloat((totalCostInSaleCurr / rate).toFixed(2)) : parseFloat(totalCostInSaleCurr.toFixed(2));
    return { costInSaleCurr: totalCostInSaleCurr, costInUSD, hasBoxDebts: true };
}

// ==========================================
// 1. سعر الصرف
// ==========================================
router.put('/exchange-rate', async (req, res) => {
    const shopId = req.shopId;
    const { rate } = req.body;
    try {
        await pool.query('UPDATE shops SET exchange_rate = ? WHERE id = ?', [rate, shopId]);
        res.json({ success: true, rate });
    } catch (err) {
        res.status(500).json({ message: 'فشل تحديث سعر الصرف' });
    }
});

// ==========================================
// 2. إدارة المحافظ والصناديق (Sources)
// ==========================================
router.post('/source', async (req, res) => {
    const shopId = req.shopId;
    const { name, initialUSD, initialLBP } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'اسم المحفظة مطلوب' });
    }

    const sourceId = `src_${Date.now()}`;
    const balUSD = parseFloat(initialUSD) || 0;
    const balLBP = parseFloat(initialLBP) || 0;

    try {
        await pool.query(
            `INSERT INTO sources (id, shop_id, name, balance_usd, balance_lbp) VALUES (?, ?, ?, ?, ?)`,
            [sourceId, shopId, name.trim(), balUSD, balLBP]
        );

        if (balUSD > 0 || balLBP > 0) {
            await pool.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'deposit', 'رصيد افتتاحي', ?, ?, ?, ?)`,
                [
                    `tx_init_${Date.now()}`,
                    shopId,
                    sourceId,
                    balUSD > 0 ? balUSD : balLBP,
                    balUSD > 0 ? 'USD' : 'LBP',
                    balUSD,
                    balLBP
                ]
            );
        }

        res.status(201).json({ success: true, id: sourceId });
    } catch (err) {
        console.error('Add source error:', err);
        res.status(500).json({ message: 'فشل حفظ المحفظة في MySQL' });
    }
});

router.put('/source/:id', async (req, res) => {
    const shopId = req.shopId;
    const sourceId = req.params.id;
    const { name, balanceUSD, balanceLBP } = req.body;

    try {
        await pool.query(
            `UPDATE sources 
       SET name = COALESCE(?, name),
           balance_usd = COALESCE(?, balance_usd),
           balance_lbp = COALESCE(?, balance_lbp)
       WHERE id = ? AND shop_id = ?`,
            [name, balanceUSD, balanceLBP, sourceId, shopId]
        );

        await pool.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'deposit', 'تعديل / تسوية رصيد يدوي', 0, 'USD', 
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [`tx_adj_${Date.now()}`, shopId, sourceId, sourceId, sourceId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Update source error:', err);
        res.status(500).json({ message: 'فشل تعديل المحفظة' });
    }
});

router.delete('/source/:id', async (req, res) => {
    const shopId = req.shopId;
    try {
        await pool.query('DELETE FROM sources WHERE id = ? AND shop_id = ?', [req.params.id, shopId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل حذف المحفظة' });
    }
});

// تحويل بين محفظتين أو تصريف عملة
router.post('/wallet-transfer', async (req, res) => {
    const shopId = req.shopId;
    const { fromWalletId, toWalletId, amount, currency, convertedAmount, toCurrency, notes } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const amt = parseFloat(amount) || 0;
        const convAmt = parseFloat(convertedAmount) || amt;
        const isFromLBP = currency === 'LBP';
        const isToLBP = (toCurrency || currency) === 'LBP';

        await conn.query(
            `UPDATE sources SET 
       balance_lbp = GREATEST(0, balance_lbp - ?),
       balance_usd = GREATEST(0, balance_usd - ?)
       WHERE id = ? AND shop_id = ?`,
            [isFromLBP ? amt : 0, !isFromLBP ? amt : 0, fromWalletId, shopId]
        );

        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'withdrawal', ?, ?, ?,
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [`tx_out_${Date.now()}`, shopId, fromWalletId, notes || 'تحويل / تصريف صادر', amt, currency, fromWalletId, fromWalletId]
        );

        const targetId = toWalletId || fromWalletId;
        await conn.query(
            `UPDATE sources SET 
       balance_lbp = balance_lbp + ?,
       balance_usd = balance_usd + ?
       WHERE id = ? AND shop_id = ?`,
            [isToLBP ? convAmt : 0, !isToLBP ? convAmt : 0, targetId, shopId]
        );

        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'deposit', ?, ?, ?,
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [`tx_in_${Date.now()}`, shopId, targetId, notes || 'تحويل / تصريف وارد', convAmt, toCurrency || currency, targetId, targetId]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Wallet transfer error:', err);
        res.status(500).json({ message: 'فشل تنفيذ التحويل أو التصريف' });
    } finally {
        conn.release();
    }
});

// حركات المحافظ وسنة الأيام (ليرة بليرة 100%)
router.post('/wallet-tx', async (req, res) => {
    const shopId = req.shopId;
    const { walletId, tx } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const isLBP = tx.currency === 'LBP';
        const amountNum = parseFloat(tx.amount) || 0;

        if (tx.type === 'deposit') {
            await conn.query(
                `UPDATE sources SET balance_lbp = balance_lbp + ?, balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?`,
                [isLBP ? amountNum : 0, !isLBP ? amountNum : 0, walletId, shopId]
            );
        } else if (tx.type === 'withdrawal') {
            await conn.query(
                `UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?`,
                [isLBP ? amountNum : 0, !isLBP ? amountNum : 0, walletId, shopId]
            );
        } else if (tx.type === 'sale' && !tx.isDaysYear) {
            const costUSD = parseFloat(tx.costUSD || 0);
            if (costUSD > 0) {
                await conn.query(
                    'UPDATE sources SET balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                    [costUSD, walletId, shopId]
                );
            }
            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type)
         VALUES (?, ?, 'wallet_sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `sale_${Date.now()}`, shopId, tx.itemName, tx.itemName, tx.amount, tx.currency || 'USD',
                    costUSD, parseFloat(tx.profitUSD || 0), tx.customerName || 'عام', tx.customerPhone || '',
                    tx.isDebt ? 1 : 0, tx.paymentType || 'cash'
                ]
            );

            if (tx.remainingDebt && parseFloat(tx.remainingDebt) > 0) {
                const debtId = `debt_${Date.now()}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                    [debtId, shopId, tx.customerType || 'customers', tx.customerName || 'عميل', tx.customerPhone || '', tx.remainingDebt, tx.remainingDebt, tx.currency || 'USD', tx.itemName || 'متبقي مبيع من المحفظة']
                );
                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                    [`dh_${Date.now()}`, shopId, debtId, tx.remainingDebt, tx.currency || 'USD', tx.remainingDebt, tx.itemName || 'متبقي مبيع']
                );
            }
        }

        if (!tx.isDaysYear) {
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, ?, ?, ?, ?, 
           (SELECT balance_usd FROM sources WHERE id = ?), 
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [`tx_${Date.now()}`, shopId, walletId, tx.type, tx.itemName || 'حركة محفظة', amountNum, tx.currency || 'USD', walletId, walletId]
            );
        }

        // دورة سنة أيام Alfa: ليرة من المحفظة ➔ دين ليرة ➔ استرداد ليرة صافية للمحفظة
        if (tx.isDaysYear && tx.targetSimId) {
            const opRate = parseFloat(tx.daysFxRate) || 89500;
            const isDeductLBP = tx.walletDeductCurrency === 'LBP';
            const deductVal = parseFloat(tx.walletDeduction) || 0;
            const debtCurr = isDeductLBP ? 'LBP' : 'USD';

            // 1. خصم تكلفة الكارت السني من المحفظة بنفس عملتها
            await conn.query(
                `UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?`,
                [isDeductLBP ? deductVal : 0, !isDeductLBP ? deductVal : 0, walletId, shopId]
            );

            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', 'شراء سنة أيام Alfa', ?, ?, 
           (SELECT balance_usd FROM sources WHERE id = ?), 
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [`tx_dy_out_${Date.now()}`, shopId, walletId, deductVal, debtCurr, walletId, walletId]
            );

            // 2. إضافة رصيد المردود إلى الشريحة
            const returnCredit = parseFloat(tx.returnCreditUSD) || 73.5;
            const batchId = `batch_days_${Date.now()}`;
            await conn.query(
                `INSERT INTO sim_batches (id, shop_id, sim_id, label, amount_usd, remaining_usd, cost_price, cost_currency)
         VALUES (?, ?, ?, 'مردود سنة أيام', ?, ?, ?, 'LBP')`,
                [batchId, shopId, tx.targetSimId, returnCredit, returnCredit, tx.costLBP || 93500]
            );
            await conn.query(
                'UPDATE sims SET balance = (SELECT SUM(remaining_usd) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [tx.targetSimId, tx.targetSimId, shopId]
            );

            // 3. حساب الدفعة الأولى المستردة من بيع الأيام بنفس العملة مباشرة
            let saleInDebtCurr = 0;
            if (isDeductLBP === isLBP) {
                saleInDebtCurr = amountNum;
            } else if (isDeductLBP && !isLBP) {
                saleInDebtCurr = Math.round(amountNum * opRate);
            } else {
                saleInDebtCurr = parseFloat((amountNum / opRate).toFixed(2));
            }

            const initialPay = Math.min(deductVal, saleInDebtCurr);
            const remDebt = parseFloat(Math.max(0, deductVal - initialPay).toFixed(2));
            const isPaid = remDebt <= (isDeductLBP ? 100 : 0.01) ? 1 : 0;

            // 4. تسجيل دين الصندوق بالعملة الأصلية (LBP أو USD)
            const debtId = `debt_box_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, source_wallet_id, target_sim_id, paid, notes)
         VALUES (?, ?, 'boxes', (SELECT name FROM sources WHERE id = ?), ?, ?, ?, ?, ?, ?, 'دين دورة سنة أيام')`,
                [debtId, shopId, walletId, remDebt, deductVal, debtCurr, walletId, tx.targetSimId, isPaid]
            );

            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, 'أصل تكلفة سنة أيام Alfa')`,
                [`dh_dy_init_${Date.now()}`, shopId, debtId, deductVal, debtCurr, deductVal]
            );

            // 5. إعادة ثمن الأيام المسددة فوراً إلى نفس العملة في المحفظة
            if (initialPay > 0) {
                await conn.query(
                    `UPDATE sources SET balance_usd = balance_usd + ?, balance_lbp = balance_lbp + ? WHERE id = ? AND shop_id = ?`,
                    [!isDeductLBP ? initialPay : 0, isDeductLBP ? initialPay : 0, walletId, shopId]
                );

                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'payment', ?, ?, ?, 'سداد من مبيع الأيام للزبون')`,
                    [`dh_dy_pay_${Date.now()}`, shopId, debtId, initialPay, debtCurr, remDebt]
                );

                await conn.query(
                    `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
           VALUES (?, ?, ?, 'deposit', 'استرداد مبيع أيام Alfa', ?, ?, 
             (SELECT balance_usd FROM sources WHERE id = ?), 
             (SELECT balance_lbp FROM sources WHERE id = ?)
           )`,
                    [`tx_dy_in_${Date.now()}`, shopId, walletId, initialPay, debtCurr, walletId, walletId]
                );
            }

            // 6. تسجيل عملية بيع الأيام في سجل المبيعات العام
            const profitSurplusInDebtCurr = Math.max(0, saleInDebtCurr - deductVal);
            const profitUSDVal = isDeductLBP
                ? parseFloat((profitSurplusInDebtCurr / opRate).toFixed(2))
                : parseFloat(profitSurplusInDebtCurr.toFixed(2));

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes)
         VALUES (?, ?, 'wallet_sale', 'alfa', 'بيع سنة أيام Alfa', 'بيع سنة أيام Alfa', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `sale_dy_${Date.now()}`, shopId, amountNum, tx.currency || 'LBP',
                    isDeductLBP ? parseFloat((initialPay / opRate).toFixed(2)) : initialPay,
                    profitUSDVal,
                    tx.customerName || 'عام', tx.customerPhone || '',
                    tx.remainingDebt > 0 ? 1 : 0, tx.paymentType || 'cash',
                    `استرداد للمحفظة: ${initialPay.toLocaleString()} ${debtCurr}`
                ]
            );

            // 7. إذا بقي دين على الزبون المشتري للأيام
            if (tx.remainingDebt && parseFloat(tx.remainingDebt) > 0) {
                const custDebtId = `debt_cust_${Date.now()}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'متبقي بيع سنة أيام Alfa')`,
                    [custDebtId, shopId, tx.customerType || 'customers', tx.customerName || 'عميل', tx.customerPhone || '', tx.remainingDebt, tx.remainingDebt, tx.currency || 'LBP']
                );
                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, 'متبقي بيع سنة أيام Alfa')`,
                    [`dh_cust_${Date.now()}`, shopId, custDebtId, tx.remainingDebt, tx.currency || 'LBP', tx.remainingDebt]
                );
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Wallet TX error:', err);
        res.status(500).json({ message: 'فشل تسجيل حركة الصندوق' });
    } finally {
        conn.release();
    }
});

// ==========================================
// 3. إدارة الشرائح ودفعات الرصيد (SIMs & Batches)
// ==========================================
router.post('/sim', async (req, res) => {
    const shopId = req.shopId;
    const { operator, name, number, balance, batches } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const simId = `sim_${Date.now()}`;
        const initBal = parseFloat(balance) || 0;

        await conn.query(
            `INSERT INTO sims (id, shop_id, operator, name, phone_number, balance) VALUES (?, ?, ?, ?, ?, ?)`,
            [simId, shopId, operator || 'alfa', name, number || '', initBal]
        );

        if (Array.isArray(batches) && batches.length > 0) {
            for (let i = 0; i < batches.length; i++) {
                const b = batches[i];
                await conn.query(
                    `INSERT INTO sim_batches (id, shop_id, sim_id, label, cycle_id, amount_usd, remaining_usd, cost_price, cost_currency)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        b.id || `batch_${Date.now()}_${i}`,
                        shopId,
                        simId,
                        b.label || 'دفعة رصيد',
                        b.cycleId || null,
                        parseFloat(b.amountUSD) || initBal,
                        parseFloat(b.remainingUSD) || initBal,
                        parseFloat(b.costPrice) || 0,
                        b.costCurrency || 'LBP'
                    ]
                );
            }
        } else if (initBal > 0) {
            await conn.query(
                `INSERT INTO sim_batches (id, shop_id, sim_id, label, amount_usd, remaining_usd, cost_price, cost_currency)
         VALUES (?, ?, ?, 'رصيد افتتاحي', ?, ?, 0, 'USD')`,
                [`batch_${Date.now()}`, shopId, simId, initBal, initBal]
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, id: simId });
    } catch (err) {
        await conn.rollback();
        console.error('Add SIM error:', err);
        res.status(500).json({ message: 'فشل حفظ الشريحة في قاعدة البيانات' });
    } finally {
        conn.release();
    }
});

router.put('/sim/:id', async (req, res) => {
    const shopId = req.shopId;
    const simId = req.params.id;
    const { name, number, balance, newBatch } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        if (newBatch) {
            const addUSD = parseFloat(newBatch.amountUSD) || 0;
            await conn.query(
                `INSERT INTO sim_batches (id, shop_id, sim_id, label, cycle_id, amount_usd, remaining_usd, cost_price, cost_currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newBatch.id || `batch_${Date.now()}`,
                    shopId,
                    simId,
                    newBatch.label || 'تعبئة كرت / رصيد',
                    newBatch.cycleId || null,
                    addUSD,
                    parseFloat(newBatch.remainingUSD ?? addUSD),
                    parseFloat(newBatch.costPrice) || 0,
                    newBatch.costCurrency || 'LBP'
                ]
            );

            await conn.query(
                `UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?`,
                [simId, simId, shopId]
            );
        } else {
            await conn.query(
                `UPDATE sims SET 
         name = COALESCE(?, name),
         phone_number = COALESCE(?, phone_number),
         balance = COALESCE(?, balance)
         WHERE id = ? AND shop_id = ?`,
                [name, number, balance, simId, shopId]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Update SIM error:', err);
        res.status(500).json({ message: 'فشل تحديث الشريحة' });
    } finally {
        conn.release();
    }
});

router.delete('/sim/:id', async (req, res) => {
    const shopId = req.shopId;
    try {
        await pool.query('DELETE FROM sims WHERE id = ? AND shop_id = ?', [req.params.id, shopId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل حذف الشريحة' });
    }
});

router.post('/sim-transfer', async (req, res) => {
    const shopId = req.shopId;
    const { fromSimId, toSimId, credits, tax = 0.14 } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const totalDeduct = parseFloat(credits) + parseFloat(tax);
        let rem = totalDeduct;

        const [batches] = await conn.query(
            'SELECT id, remaining_usd FROM sim_batches WHERE sim_id = ? AND shop_id = ? AND remaining_usd > 0 ORDER BY created_at ASC',
            [fromSimId, shopId]
        );
        for (const b of batches) {
            if (rem <= 0) break;
            const bRem = parseFloat(b.remaining_usd);
            const cut = Math.min(bRem, rem);
            await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd - ? WHERE id = ?', [cut, b.id]);
            rem -= cut;
        }

        await conn.query(
            'UPDATE sims SET balance = GREATEST(0, balance - ?) WHERE id = ? AND shop_id = ?',
            [totalDeduct, fromSimId, shopId]
        );

        await conn.query(
            `INSERT INTO sim_batches (id, shop_id, sim_id, label, amount_usd, remaining_usd, cost_price, cost_currency)
       VALUES (?, ?, ?, 'تحويل رصيد وارد', ?, ?, 0, 'USD')`,
            [`batch_tr_${Date.now()}`, shopId, toSimId, parseFloat(credits), parseFloat(credits)]
        );
        await conn.query(
            'UPDATE sims SET balance = balance + ? WHERE id = ? AND shop_id = ?',
            [parseFloat(credits), toSimId, shopId]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ message: 'فشل تحويل الرصيد بين الشرائح' });
    } finally {
        conn.release();
    }
});

// ==========================================
// 4. الخطوط المسكرة والمفتوحة (Locked & Open Lines)
// ==========================================
router.post('/line', async (req, res) => {
    const shopId = req.shopId;
    const l = req.body;
    const lineId = `line_${Date.now()}`;

    try {
        await pool.query(
            `INSERT INTO locked_lines (id, shop_id, line_type, slot_number, phone_number, validity_days, validity_start_date, balance_usd, has_service, service_active, service_start_date, service_days, admin_name, admin_phone, admin_address, admin_gb, admin_price, user1, user2, user3, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                lineId,
                shopId,
                l.type || 'locked',
                l.slotNumber || 1,
                l.phoneNumber || l.number || '',
                parseInt(l.validityDays ?? 30, 10),
                formatDateOnly(l.validityStartDate) || formatDateOnly(new Date()),
                parseFloat(l.balanceUSD || l.balance || 0),
                l.hasService ? 1 : 0,
                (l.serviceActive ?? l.hasService) ? 1 : 0,
                l.hasService ? formatDateOnly(l.serviceStartDate) : null,
                30,
                l.adminName || '',
                l.adminPhone || '',
                l.adminAddress || '',
                l.adminGB || '22',
                l.adminPrice || '',
                l.user1 || '',
                l.user2 || '',
                l.user3 || '',
                l.notes || ''
            ]
        );
        res.status(201).json({ success: true, id: lineId });
    } catch (err) {
        console.error('Add line error:', err);
        res.status(500).json({ message: 'فشل إضافة الخط في قاعدة البيانات' });
    }
});

router.put('/line/:id', async (req, res) => {
    const shopId = req.shopId;
    const lineId = req.params.id;
    const l = req.body;

    try {
        await pool.query(
            `UPDATE locked_lines SET
       line_type = COALESCE(?, line_type),
       slot_number = COALESCE(?, slot_number),
       phone_number = COALESCE(?, phone_number),
       validity_days = COALESCE(?, validity_days),
       validity_start_date = COALESCE(?, validity_start_date),
       balance_usd = COALESCE(?, balance_usd),
       has_service = COALESCE(?, has_service),
       service_active = COALESCE(?, service_active),
       service_start_date = CASE WHEN ? = 0 THEN NULL ELSE COALESCE(?, service_start_date) END,
       service_days = COALESCE(?, service_days),
       admin_name = COALESCE(?, admin_name),
       admin_phone = COALESCE(?, admin_phone),
       admin_address = COALESCE(?, admin_address),
       admin_gb = COALESCE(?, admin_gb),
       admin_price = COALESCE(?, admin_price),
       user1 = COALESCE(?, user1),
       user2 = COALESCE(?, user2),
       user3 = COALESCE(?, user3),
       notes = COALESCE(?, notes)
       WHERE id = ? AND shop_id = ?`,
            [
                l.type,
                l.slotNumber,
                l.phoneNumber || l.number,
                l.validityDays !== undefined ? parseInt(l.validityDays, 10) : undefined,
                l.validityStartDate ? formatDateOnly(l.validityStartDate) : undefined,
                l.balanceUSD !== undefined ? parseFloat(l.balanceUSD) : undefined,
                l.hasService !== undefined ? (l.hasService ? 1 : 0) : undefined,
                l.hasService !== undefined ? (l.hasService ? 1 : 0) : undefined,
                l.hasService === false ? 0 : 1,
                l.serviceStartDate ? formatDateOnly(l.serviceStartDate) : null,
                l.serviceDays,
                l.adminName,
                l.adminPhone,
                l.adminAddress,
                l.adminGB,
                l.adminPrice,
                l.user1,
                l.user2,
                l.user3,
                l.notes,
                lineId,
                shopId
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Update line error:', err);
        res.status(500).json({ message: 'فشل تحديث بيانات الخط' });
    }
});

router.delete('/line/:id', async (req, res) => {
    const shopId = req.shopId;
    try {
        await pool.query('DELETE FROM locked_lines WHERE id = ? AND shop_id = ?', [req.params.id, shopId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'فشل حذف الخط' });
    }
});

// ==========================================
// 5. بيع رصيد عادي
// ==========================================
router.post('/sale', async (req, res) => {
    const shopId = req.shopId;
    const data = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const saleId = `sale_${Date.now()}`;
        const rate = parseFloat(data.exchangeRate) || 89500;
        const rawSale = parseFloat(data.sellingPrice) || 0;
        const saleCurrency = data.currency || 'LBP';
        const saleUSD = saleCurrency === 'LBP' ? (rawSale / rate) : rawSale;
        let costUSD = parseFloat(data.costUSD || 0);
        let profitUSD = data.profitUSD !== undefined ? parseFloat(data.profitUSD) : Math.max(0, saleUSD - costUSD);

        if (data.simId && data.totalDeduction > 0) {
            let remDeduct = parseFloat(data.totalDeduction);

            if (data.selectedBatchId) {
                await conn.query(
                    'UPDATE sim_batches SET remaining_usd = GREATEST(0, remaining_usd - ?) WHERE id = ? AND shop_id = ?',
                    [remDeduct, data.selectedBatchId, shopId]
                );
            } else {
                const [batches] = await conn.query(
                    'SELECT id, remaining_usd FROM sim_batches WHERE sim_id = ? AND shop_id = ? AND remaining_usd > 0 ORDER BY created_at ASC',
                    [data.simId, shopId]
                );
                for (const b of batches) {
                    if (remDeduct <= 0) break;
                    const bRem = parseFloat(b.remaining_usd);
                    const deduct = Math.min(bRem, remDeduct);
                    await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd - ? WHERE id = ?', [deduct, b.id]);
                    remDeduct -= deduct;
                }
            }

            await conn.query(
                'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [data.simId, data.simId, shopId]
            );
        }

        // تسديد ديون الصندوق بنفس عملة الدين مباشرة (ليرة بليرة بدون تحويل)
        const debtSettlement = await settleBoxDebts(conn, {
            shopId,
            targetSimId: data.simId || null,
            targetLineId: null,
            saleAmount: rawSale,
            saleCurrency,
            rate,
            noteLabel: `من مبيع (${data.itemName})`
        });

        if (debtSettlement.hasBoxDebts) {
            costUSD = debtSettlement.costInUSD;
            const profitInSaleCurr = Math.max(0, rawSale - debtSettlement.costInSaleCurr);
            profitUSD = saleCurrency === 'LBP' ? parseFloat((profitInSaleCurr / rate).toFixed(2)) : parseFloat(profitInSaleCurr.toFixed(2));
        }

        if (data.remainingDebt && parseFloat(data.remainingDebt) > 0) {
            const debtId = `debt_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
         VALUES (?, ?, 'customers', ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                [debtId, shopId, data.customerName, data.customerPhone || '', data.remainingDebt, data.remainingDebt, saleCurrency, data.itemName]
            );
            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                [`dh_${Date.now()}`, shopId, debtId, data.remainingDebt, saleCurrency, data.remainingDebt, data.itemName]
            );
        }

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes)
       VALUES (?, ?, 'recharge_sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                saleId, shopId, data.operator, data.title || data.itemName, data.itemName,
                rawSale, saleCurrency, costUSD, profitUSD,
                data.customerName || 'عام', data.customerPhone || '', data.remainingDebt > 0 ? 1 : 0,
                data.paymentType || 'cash', data.notes || ''
            ]
        );

        if (data.customerName && !['عام', 'حركة مباشرة'].includes(data.customerName.trim())) {
            const [existingCust] = await conn.query('SELECT id FROM customers WHERE shop_id = ? AND name = ?', [shopId, data.customerName.trim()]);
            if (existingCust.length === 0) {
                await conn.query(
                    `INSERT INTO customers (id, shop_id, name, phone) VALUES (?, ?, ?, ?)`,
                    [`cust_${Date.now()}`, shopId, data.customerName.trim(), data.customerPhone || '']
                );
            }
        }

        await conn.commit();
        res.json({ success: true, saleId });
    } catch (err) {
        await conn.rollback();
        console.error('Sale error:', err);
        res.status(500).json({ message: 'فشل إتمام العملية' });
    } finally {
        conn.release();
    }
});

// ==========================================
// 6. Alfa Gift (مشتري واحد) + U-Share (توزيع حتى 3 مستفيدين) + حصص الخطوط
// ==========================================
router.post('/alfa-gift-sale', async (req, res) => {
    const shopId = req.shopId;
    const {
        mode = 'ushare',
        simId,
        selectedBatchId,
        deductUSD,
        lockedLineId,
        totalGB = 77,
        recipients = [],
        exchangeRate = 89500
    } = req.body;

    const conn = await pool.getConnection();
    const rate = parseFloat(exchangeRate) || 89500;

    try {
        await conn.beginTransaction();

        // أ) خصم الرصيد من الشريحة أو الخط
        if (simId) {
            if (selectedBatchId) {
                await conn.query(
                    'UPDATE sim_batches SET remaining_usd = GREATEST(0, remaining_usd - ?) WHERE id = ? AND shop_id = ?',
                    [deductUSD, selectedBatchId, shopId]
                );
            } else {
                let rem = parseFloat(deductUSD) || 0;
                const [batches] = await conn.query(
                    'SELECT id, remaining_usd FROM sim_batches WHERE sim_id = ? AND shop_id = ? AND remaining_usd > 0 ORDER BY created_at ASC',
                    [simId, shopId]
                );
                for (const b of batches) {
                    if (rem <= 0) break;
                    const bRem = parseFloat(b.remaining_usd);
                    const cut = Math.min(bRem, rem);
                    await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd - ? WHERE id = ?', [cut, b.id]);
                    rem -= cut;
                }
            }
            await conn.query(
                'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [simId, simId, shopId]
            );
        } else if (lockedLineId) {
            if (mode === 'ushare') {
                await conn.query(
                    `UPDATE locked_lines SET 
           balance_usd = GREATEST(0, balance_usd - ?),
           has_service = 1, service_active = 1, service_start_date = CURDATE(), service_days = 30,
           user1 = ?, user2 = ?, user3 = ?
           WHERE id = ? AND shop_id = ?`,
                    [
                        deductUSD,
                        recipients[0] ? `${recipients[0].name} (${recipients[0].gb} GB)` : '',
                        recipients[1] ? `${recipients[1].name} (${recipients[1].gb} GB)` : '',
                        recipients[2] ? `${recipients[2].name} (${recipients[2].gb} GB)` : '',
                        lockedLineId, shopId
                    ]
                );
            } else if (parseFloat(deductUSD) > 0) {
                await conn.query(
                    `UPDATE locked_lines SET balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?`,
                    [deductUSD, lockedLineId, shopId]
                );
            }
        }

        // ب) تسجيل المبيعات والديون واسترداد الصناديق بنفس عملتها مباشرة (مع دعم الدفع الجزئي)
        for (let i = 0; i < recipients.length; i++) {
            const rec = recipients[i];
            const saleVal = parseFloat(rec.price) || 0;
            const recCurrency = rec.currency || 'USD';
            const payType = rec.paymentType || (rec.isDebt ? 'debt' : 'cash');

            const remDebtVal = rec.remainingDebt !== undefined
                ? parseFloat(rec.remainingDebt)
                : (payType === 'debt' ? saleVal : 0);

            const paidNowVal = rec.paidAmount !== undefined
                ? parseFloat(rec.paidAmount)
                : Math.max(0, saleVal - remDebtVal);

            const saleUSD = recCurrency === 'LBP' ? (saleVal / rate) : saleVal;

            const labelTitle = rec.itemName || (mode === 'direct_gift'
                ? `Alfa Gift ${totalGB}GB`
                : `U-Share (${rec.gb} GB)`);

            const debtSettlement = await settleBoxDebts(conn, {
                shopId,
                targetSimId: simId || null,
                targetLineId: lockedLineId || null,
                saleAmount: paidNowVal,
                saleCurrency: recCurrency,
                rate,
                noteLabel: `من مبيع ${labelTitle}`
            });

            const finalCostUSD = debtSettlement.hasBoxDebts
                ? debtSettlement.costInUSD
                : (mode === 'direct_gift' ? (parseFloat(deductUSD) || 0) : 0);

            let netProfitUSD = 0;
            if (debtSettlement.hasBoxDebts) {
                const profitInRecCurr = Math.max(0, paidNowVal - debtSettlement.costInSaleCurr);
                netProfitUSD = recCurrency === 'LBP' ? parseFloat((profitInRecCurr / rate).toFixed(2)) : parseFloat(profitInRecCurr.toFixed(2));
            } else {
                netProfitUSD = Math.max(0, parseFloat((saleUSD - finalCostUSD).toFixed(2)));
            }

            if (remDebtVal > 0) {
                const debtId = `debt_cust_${Date.now()}_${i}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                    [debtId, shopId, rec.customerType || 'customers', rec.name.trim(), rec.phone || '', remDebtVal, remDebtVal, recCurrency, labelTitle]
                );
                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                    [`dh_gift_${Date.now()}_${i}`, shopId, debtId, remDebtVal, recCurrency, remDebtVal, labelTitle]
                );
            }

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type)
         VALUES (?, ?, ?, 'alfa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `gift_sale_${Date.now()}_${i}`,
                    shopId,
                    mode === 'direct_gift' ? 'alfa_gift' : 'ushare',
                    labelTitle,
                    labelTitle,
                    saleVal,
                    recCurrency,
                    finalCostUSD,
                    netProfitUSD,
                    rec.name.trim() || 'عام',
                    rec.phone || '',
                    remDebtVal > 0 ? 1 : 0,
                    payType
                ]
            );

            if (rec.name && !['عام', 'حركة مباشرة'].includes(rec.name.trim())) {
                const [existingCust] = await conn.query('SELECT id FROM customers WHERE shop_id = ? AND name = ?', [shopId, rec.name.trim()]);
                if (existingCust.length === 0) {
                    await conn.query(
                        `INSERT INTO customers (id, shop_id, name, phone) VALUES (?, ?, ?, ?)`,
                        [`cust_${Date.now()}_${i}`, shopId, rec.name.trim(), rec.phone || '']
                    );
                }
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Alfa Gift / U-Share error:', err);
        res.status(500).json({ message: 'فشل تسجيل العملية' });
    } finally {
        conn.release();
    }
});

// ==========================================
// 7. الديون (إضافة / تعديل / سداد مع عزل العملة التام)
// ==========================================
router.post('/debt', async (req, res) => {
    const shopId = req.shopId;
    const { category, name, phone, amount, currency, dueDate, notes, sourceWalletId, targetSimId, targetLineId } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const debtId = `debt_${Date.now()}`;
        const numAmt = parseFloat(amount) || 0;
        const curr = currency === 'LBP' ? 'LBP' : 'USD';
        const isLBP = curr === 'LBP';

        await conn.query(
            `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, paid, source_wallet_id, target_sim_id, target_line_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [
                debtId, shopId, category || 'customers', name.trim(), phone || '',
                numAmt, numAmt, curr, dueDate || null,
                category === 'boxes' ? (sourceWalletId || null) : null,
                targetSimId || null, targetLineId || null, notes || ''
            ]
        );

        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
       VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
            [`dh_${Date.now()}`, shopId, debtId, numAmt, curr, numAmt, notes || 'تسجيل ذمة جديدة']
        );

        if (category === 'boxes' && sourceWalletId) {
            await conn.query(
                `UPDATE sources SET 
         balance_lbp = GREATEST(0, balance_lbp - ?),
         balance_usd = GREATEST(0, balance_usd - ?)
         WHERE id = ? AND shop_id = ?`,
                [isLBP ? numAmt : 0, !isLBP ? numAmt : 0, sourceWalletId, shopId]
            );

            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [`tx_box_${Date.now()}`, shopId, sourceWalletId, `سحب / استلاف من الصندوق: ${notes || name}`, numAmt, curr, sourceWalletId, sourceWalletId]
            );
        }

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
    const { name, amount, currency, dueDate, notes } = req.body;
    try {
        await pool.query(
            `UPDATE debts SET 
       name = COALESCE(?, name),
       amount = COALESCE(?, amount),
       currency = COALESCE(?, currency),
       due_date = COALESCE(?, due_date),
       notes = COALESCE(?, notes)
       WHERE id = ? AND shop_id = ?`,
            [name, amount, currency, dueDate, notes, req.params.id, shopId]
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

        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [`dh_${Date.now()}`, shopId, debtId, isPaid ? 'full_payment' : 'payment', payAmt, debtCurrency, newAmt, notes || 'سداد دفعة من الدين']
        );

        if (debt.category === 'boxes' && debt.source_wallet_id) {
            await conn.query(
                `UPDATE sources SET 
         balance_lbp = balance_lbp + ?, 
         balance_usd = balance_usd + ? 
         WHERE id = ? AND shop_id = ?`,
                [isLBP ? payAmt : 0, !isLBP ? payAmt : 0, debt.source_wallet_id, shopId]
            );

            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'deposit', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [`tx_repay_${Date.now()}`, shopId, debt.source_wallet_id, `استرداد سداد دين: ${debt.notes || debt.name}`, payAmt, debtCurrency, debt.source_wallet_id, debt.source_wallet_id]
            );
        }

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
// 8. الزبائن والمصاريف (Customers & Expenses)
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

router.post('/expense', async (req, res) => {
    const shopId = req.shopId;
    const { title, amount, currency, sourceWalletId, notes } = req.body;
    const expId = `exp_${Date.now()}`;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const numAmt = parseFloat(amount) || 0;
        const isLBP = currency === 'LBP';

        await conn.query(
            'INSERT INTO expenses (id, shop_id, title, amount, currency, source_wallet_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [expId, shopId, title, numAmt, currency || 'USD', sourceWalletId || null, notes || '']
        );

        if (sourceWalletId) {
            await conn.query(
                'UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                [isLBP ? numAmt : 0, !isLBP ? numAmt : 0, sourceWalletId, shopId]
            );
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [`tx_exp_${Date.now()}`, shopId, sourceWalletId, `مصروف: ${title}`, numAmt, currency || 'USD', sourceWalletId, sourceWalletId]
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, id: expId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ message: 'فشل تسجيل المصروف' });
    } finally {
        conn.release();
    }
});

module.exports = router;