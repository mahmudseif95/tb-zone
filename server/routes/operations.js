const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// 1. تحديث سعر الصرف
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

// 2. تنفيذ بيع رصيد عادي وتحديث الشريحة والديون
router.post('/sale', async (req, res) => {
    const shopId = req.shopId;
    const data = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const saleId = `sale_${Date.now()}`;
        const saleUSD = data.currency === 'LBP' ? (parseFloat(data.sellingPrice) / data.exchangeRate) : parseFloat(data.sellingPrice);
        let costUSD = parseFloat(data.costUSD || 0);
        let profitUSD = data.profitUSD !== undefined ? parseFloat(data.profitUSD) : Math.max(0, saleUSD - costUSD);

        // أ) خصم الرصيد من دفعات الشريحة أو رصيدها العام
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

        // ب) سداد ديون الصناديق التراكمية في حال وجود دين سنة أيام للشريحة (FIFO)
        const [boxDebts] = await conn.query(
            `SELECT id, amount, source_wallet_id FROM debts 
       WHERE shop_id = ? AND category = 'boxes' AND target_sim_id = ? AND paid = 0 
       ORDER BY created_at ASC`,
            [shopId, data.simId]
        );

        let remSaleForDebt = saleUSD;
        let costAssigned = 0;

        for (const d of boxDebts) {
            if (remSaleForDebt <= 0) break;
            const dRem = parseFloat(d.amount);
            const pay = Math.min(remSaleForDebt, dRem);
            remSaleForDebt -= pay;
            costAssigned += pay;

            const newDebtAmt = parseFloat((dRem - pay).toFixed(2));
            const isPaid = newDebtAmt <= 0.01 ? 1 : 0;

            await conn.query('UPDATE debts SET amount = ?, paid = ? WHERE id = ?', [newDebtAmt, isPaid, d.id]);

            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, notes) 
         VALUES (?, ?, ?, 'payment', ?, 'USD', ?)`,
                [`dh_${Date.now()}_${Math.random()}`, shopId, d.id, pay, `سداد من مبيع رصيد (${data.itemName})`]
            );

            if (d.source_wallet_id) {
                await conn.query(
                    'UPDATE sources SET balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?',
                    [pay, d.source_wallet_id, shopId]
                );
                await conn.query(
                    `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd) 
           VALUES (?, ?, ?, 'deposit', ?, ?, 'USD', (SELECT balance_usd FROM sources WHERE id = ?))`,
                    [`tx_ret_${Date.now()}`, shopId, d.source_wallet_id, `استرداد دين من مبيع رصيد (${data.itemName})`, pay, d.source_wallet_id]
                );
            }
        }

        if (boxDebts.length > 0) {
            costUSD = costAssigned;
            profitUSD = Math.max(0, parseFloat((saleUSD - costAssigned).toFixed(2)));
        }

        // ج) تسجيل دين على الزبون إذا كان المبيع ديناً
        if (data.remainingDebt && parseFloat(data.remainingDebt) > 0) {
            const debtId = `debt_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
         VALUES (?, ?, 'customers', ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                [debtId, shopId, data.customerName, data.customerPhone || '', data.remainingDebt, data.remainingDebt, data.currency || 'LBP', data.itemName]
            );
            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?)`,
                [`dh_${Date.now()}`, shopId, debtId, data.remainingDebt, data.currency || 'LBP', data.itemName]
            );
        }

        // د) تسجيل الحركة في سجل المبيعات العام
        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes)
       VALUES (?, ?, 'recharge_sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                saleId, shopId, data.operator, data.title || data.itemName, data.itemName,
                data.sellingPrice, data.currency || 'LBP', costUSD, profitUSD,
                data.customerName || 'عام', data.customerPhone || '', data.remainingDebt > 0 ? 1 : 0,
                data.paymentType || 'cash', data.notes || ''
            ]
        );

        // هـ) إضافة الزبون في الدليل إن لم يكن موجوداً
        if (data.customerName && !['عام', 'حركة مباشرة'].includes(data.customerName.trim())) {
            await conn.query(
                `INSERT INTO customers (id, shop_id, name, phone) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE phone = COALESCE(VALUES(phone), phone)`,
                [`cust_${Date.now()}`, shopId, data.customerName.trim(), data.customerPhone || '']
            );
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

// 3. حركات المحافظ وسنة الأيام
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
                `UPDATE sources SET 
         balance_lbp = balance_lbp + ?, 
         balance_usd = balance_usd + ? 
         WHERE id = ? AND shop_id = ?`,
                [isLBP ? amountNum : 0, !isLBP ? amountNum : 0, walletId, shopId]
            );
        } else if (tx.type === 'withdrawal') {
            await conn.query(
                `UPDATE sources SET 
         balance_lbp = GREATEST(0, balance_lbp - ?), 
         balance_usd = GREATEST(0, balance_usd - ?) 
         WHERE id = ? AND shop_id = ?`,
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
        }

        // تسجيل في ليدجر المحفظة
        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, ?, ?, ?, ?, 
         (SELECT balance_usd FROM sources WHERE id = ?), 
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [`tx_${Date.now()}`, shopId, walletId, tx.type, tx.itemName || 'حركة محفظة', amountNum, tx.currency || 'USD', walletId, walletId]
        );

        // إذا كانت دورة سنة أيام كاملة
        if (tx.isDaysYear && tx.targetSimId) {
            const opRate = parseFloat(tx.daysFxRate) || 89500;
            const isDeductLBP = tx.walletDeductCurrency === 'LBP';
            const deductVal = parseFloat(tx.walletDeduction) || (isDeductLBP ? Math.round(86.5 * opRate) : 86.5);
            const deductUSD = isDeductLBP ? (deductVal / opRate) : deductVal;

            // أ) خصم كلفة سنة الأيام من المحفظة
            await conn.query(
                `UPDATE sources SET 
         balance_lbp = GREATEST(0, balance_lbp - ?), 
         balance_usd = GREATEST(0, balance_usd - ?) 
         WHERE id = ? AND shop_id = ?`,
                [isDeductLBP ? deductVal : 0, !isDeductLBP ? deductVal : 0, walletId, shopId]
            );

            // ب) إضافة دفعة مردود الأيام إلى الشريحة
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

            // ج) إنشاء دين الصندوق على الشريحة للمتبقي
            const saleUSD = tx.currency === 'LBP' ? (amountNum / opRate) : amountNum;
            const initialPayUSD = Math.min(deductUSD, saleUSD);
            const remDebtUSD = parseFloat(Math.max(0, deductUSD - initialPayUSD).toFixed(2));

            const debtId = `debt_box_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, source_wallet_id, target_sim_id, paid, notes)
         VALUES (?, ?, 'boxes', (SELECT name FROM sources WHERE id = ?), ?, ?, 'USD', ?, ?, ?, 'دين دورة سنة أيام')`,
                [debtId, shopId, walletId, remDebtUSD, deductUSD, walletId, tx.targetSimId, remDebtUSD <= 0.01 ? 1 : 0]
            );

            // د) إعادة المبلغ المسدد كاش للمحفظة
            if (initialPayUSD > 0) {
                await conn.query(
                    `UPDATE sources SET 
           balance_usd = balance_usd + ?, 
           balance_lbp = balance_lbp + ? 
           WHERE id = ? AND shop_id = ?`,
                    [!isDeductLBP ? initialPayUSD : 0, isDeductLBP ? Math.round(initialPayUSD * opRate) : 0, walletId, shopId]
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

// 4. تنفيذ بيع حصص Alfa Gift
router.post('/alfa-gift-sale', async (req, res) => {
    const shopId = req.shopId;
    const { simId, selectedBatchId, deductUSD, lockedLineId, recipients, exchangeRate } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // أ) خصم رصيد الـ 77GB من الشريحة أو الخط
        if (simId) {
            await conn.query(
                'UPDATE sim_batches SET remaining_usd = GREATEST(0, remaining_usd - ?) WHERE id = ? AND shop_id = ?',
                [deductUSD, selectedBatchId, shopId]
            );
            await conn.query(
                'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [simId, simId, shopId]
            );
        } else if (lockedLineId) {
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
        }

        // ب) معالجة كل مستفيد ومبيعه ودينه واسترداد ديون الصناديق
        for (let i = 0; i < recipients.length; i++) {
            const rec = recipients[i];
            const saleVal = parseFloat(rec.price) || 0;
            const saleUSD = rec.currency === 'LBP' ? (saleVal / exchangeRate) : saleVal;

            // سداد ديون الصناديق المرتبطة بالخط أو الشريحة
            const [matchingDebts] = await conn.query(
                `SELECT id, amount, source_wallet_id FROM debts 
         WHERE shop_id = ? AND category = 'boxes' 
         AND (target_line_id = ? OR target_sim_id = ?) AND paid = 0 
         ORDER BY created_at ASC`,
                [shopId, lockedLineId || '', simId || '']
            );

            let remSale = saleUSD;
            let costAssigned = 0;

            for (const d of matchingDebts) {
                if (remSale <= 0) break;
                const dRem = parseFloat(d.amount);
                const pay = Math.min(remSale, dRem);
                remSale -= pay;
                costAssigned += pay;

                const newDebtAmt = parseFloat((dRem - pay).toFixed(2));
                await conn.query('UPDATE debts SET amount = ?, paid = ? WHERE id = ?', [newDebtAmt, newDebtAmt <= 0.01 ? 1 : 0, d.id]);

                if (d.source_wallet_id) {
                    await conn.query('UPDATE sources SET balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?', [pay, d.source_wallet_id, shopId]);
                }
            }

            const netProfit = Math.max(0, parseFloat((saleUSD - costAssigned).toFixed(2)));

            // تسجيل دين على المشترك إذا كان ديناً
            if (rec.isDebt) {
                const debtId = `debt_cust_${Date.now()}_${i}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
           VALUES (?, ?, 'customers', ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                    [debtId, shopId, rec.name.trim(), rec.phone || '', saleVal, saleVal, rec.currency || 'USD', `حصة Alfa Gift (${rec.gb} GB)`]
                );
            }

            // تسجيل الحركة في سجل العمليات
            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type)
         VALUES (?, ?, 'alfa_gift', 'alfa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `gift_sale_${Date.now()}_${i}`, shopId, `حصة ${rec.gb}GB`, `حصة Alfa Gift (${rec.gb} GB)`,
                    saleVal, rec.currency || 'USD', costAssigned, netProfit, rec.name.trim(), rec.phone || '',
                    rec.isDebt ? 1 : 0, rec.isDebt ? 'debt' : 'cash'
                ]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Alfa Gift error:', err);
        res.status(500).json({ message: 'فشل تسجيل خدمة Alfa Gift' });
    } finally {
        conn.release();
    }
});

// 5. سداد الديون (جزئي أو كامل)
router.post('/debt-payment', async (req, res) => {
    const shopId = req.shopId;
    const { debtId, amount, currency, notes, walletId } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [debtRows] = await conn.query('SELECT * FROM debts WHERE id = ? AND shop_id = ?', [debtId, shopId]);
        if (debtRows.length === 0) return res.status(404).json({ message: 'الدين غير موجود' });

        const debt = debtRows[0];
        const currentAmt = parseFloat(debt.amount);
        const payAmt = parseFloat(amount);
        const newAmt = Math.max(0, parseFloat((currentAmt - payAmt).toFixed(2)));
        const isPaid = newAmt <= 0.01 ? 1 : 0;

        await conn.query('UPDATE debts SET amount = ?, paid = ? WHERE id = ?', [newAmt, isPaid, debtId]);

        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, notes)
       VALUES (?, ?, ?, 'payment', ?, ?, ?)`,
            [`dh_${Date.now()}`, shopId, debtId, payAmt, currency, notes || 'سداد دفعة من الدين']
        );

        // إذا تم تحديد محفظة لإيداع الدفعة المسددة
        if (walletId) {
            const isLBP = currency === 'LBP';
            await conn.query(
                `UPDATE sources SET 
         balance_lbp = balance_lbp + ?, 
         balance_usd = balance_usd + ? 
         WHERE id = ? AND shop_id = ?`,
                [isLBP ? payAmt : 0, !isLBP ? payAmt : 0, walletId, shopId]
            );
        }

        await conn.commit();
        res.json({ success: true, remainingAmount: newAmt, paid: Boolean(isPaid) });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ message: 'فشل معالجة سداد الدين' });
    } finally {
        conn.release();
    }
});

// إضافة محفظة / صندوق جديد في MySQL
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
            `INSERT INTO sources (id, shop_id, name, balance_usd, balance_lbp)
       VALUES (?, ?, ?, ?, ?)`,
            [sourceId, shopId, name.trim(), balUSD, balLBP]
        );

        // إذا كان هناك رصيد افتتاحي، نسجله في ليدجر المحفظة
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

        res.status(201).json({
            success: true,
            source: { id: sourceId, name: name.trim(), balanceUSD: balUSD, balanceLBP: balLBP, balance: balUSD, ledger: [] }
        });
    } catch (err) {
        console.error('Add source error:', err);
        res.status(500).json({ message: 'فشل حفظ المحفظة في قاعدة البيانات' });
    }
});

// حذف محفظة من MySQL
router.delete('/source/:id', async (req, res) => {
    const shopId = req.shopId;
    const sourceId = req.params.id;

    try {
        await pool.query('DELETE FROM sources WHERE id = ? AND shop_id = ?', [sourceId, shopId]);
        res.json({ success: true, message: 'تم حذف المحفظة بنجاح' });
    } catch (err) {
        console.error('Delete source error:', err);
        res.status(500).json({ message: 'فشل حذف المحفظة' });
    }
});


// تعديل اسم المحفظة أو تصحيح أرصدتها مباشرة (من زر القلم)
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

        // تسجيل حركة تسوية في الليدجر لتوثيق التصحيح
        await pool.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'deposit', 'تعديل / تسوية رصيد يدوي', 0, 'USD', 
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [`tx_adj_${Date.now()}`, shopId, sourceId, sourceId, sourceId]
        );

        res.json({ success: true, message: 'تم تعديل المحفظة بنجاح' });
    } catch (err) {
        console.error('Update source error:', err);
        res.status(500).json({ message: 'فشل تعديل المحفظة' });
    }
});



module.exports = router;