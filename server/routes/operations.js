const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

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

// دالة تسديد ديون الصناديق بنفس عملة الدين حصراً مع إرجاع سجل التسديدات للتراجع الآمن
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
    if (conditions.length === 0) {
        return { costInSaleCurr: 0, costInUSD: 0, hasBoxDebts: false, remainingBoxDebtUSD: 0, settledList: [] };
    }

    const [boxDebts] = await conn.query(
        `SELECT id, amount, currency, source_wallet_id FROM debts 
     WHERE shop_id = ? AND category = 'boxes' AND (${conditions.join(' OR ')}) AND paid = 0 
     ORDER BY created_at ASC`,
        params
    );

    if (boxDebts.length === 0) {
        return { costInSaleCurr: 0, costInUSD: 0, hasBoxDebts: false, remainingBoxDebtUSD: 0, settledList: [] };
    }

    let remSaleInNativeCurr = parseFloat(saleAmount) || 0;
    const isSaleLBP = saleCurrency === 'LBP';
    let totalCostInSaleCurr = 0;
    let remainingBoxDebtUSD = 0;
    const settledList = [];

    for (const d of boxDebts) {
        const isDebtLBP = d.currency === 'LBP';
        const dRemNative = parseFloat(d.amount) || 0;
        if (dRemNative <= 0) continue;

        if (remSaleInNativeCurr <= 0) {
            remainingBoxDebtUSD += isDebtLBP ? (dRemNative / rate) : dRemNative;
            continue;
        }

        let payInDebtCurr = 0;
        let usedFromSaleCurr = 0;

        if (isDebtLBP === isSaleLBP) {
            payInDebtCurr = Math.min(remSaleInNativeCurr, dRemNative);
            usedFromSaleCurr = payInDebtCurr;
        } else if (isDebtLBP && !isSaleLBP) {
            const remSaleInLBP = Math.round(remSaleInNativeCurr * rate);
            payInDebtCurr = Math.min(remSaleInLBP, dRemNative);
            usedFromSaleCurr = parseFloat((payInDebtCurr / rate).toFixed(4));
        } else {
            const remSaleInUSD = remSaleInNativeCurr / rate;
            payInDebtCurr = parseFloat(Math.min(remSaleInUSD, dRemNative).toFixed(2));
            usedFromSaleCurr = Math.round(payInDebtCurr * rate);
        }

        remSaleInNativeCurr = Math.max(0, parseFloat((remSaleInNativeCurr - usedFromSaleCurr).toFixed(4)));
        totalCostInSaleCurr += usedFromSaleCurr;

        const newDebtAmt = Math.max(0, parseFloat((dRemNative - payInDebtCurr).toFixed(2)));
        const isPaid = newDebtAmt <= (isDebtLBP ? 100 : 0.01) ? 1 : 0;
        remainingBoxDebtUSD += isDebtLBP ? (newDebtAmt / rate) : newDebtAmt;

        await conn.query('UPDATE debts SET amount = ?, paid = ? WHERE id = ?', [newDebtAmt, isPaid, d.id]);

        const dhId = `dh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await conn.query(
            `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [dhId, shopId, d.id, isPaid ? 'full_payment' : 'payment', payInDebtCurr, d.currency, newDebtAmt, noteLabel]
        );

        let ledgerId = null;
        if (d.source_wallet_id && payInDebtCurr > 0) {
            await conn.query(
                'UPDATE sources SET balance_usd = balance_usd + ?, balance_lbp = balance_lbp + ? WHERE id = ? AND shop_id = ?',
                [!isDebtLBP ? payInDebtCurr : 0, isDebtLBP ? payInDebtCurr : 0, d.source_wallet_id, shopId]
            );
            ledgerId = `tx_ret_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp) 
         VALUES (?, ?, ?, 'deposit', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, d.source_wallet_id, `استرداد ${noteLabel}`, payInDebtCurr, d.currency, d.source_wallet_id, d.source_wallet_id]
            );
        }

        if (payInDebtCurr > 0) {
            settledList.push({
                debtId: d.id,
                walletId: d.source_wallet_id || null,
                amount: payInDebtCurr,
                currency: d.currency,
                ledgerId,
                dhId
            });
        }
    }

    const costInUSD = isSaleLBP ? parseFloat((totalCostInSaleCurr / rate).toFixed(2)) : parseFloat(totalCostInSaleCurr.toFixed(2));
    return {
        costInSaleCurr: totalCostInSaleCurr,
        costInUSD,
        hasBoxDebts: true,
        remainingBoxDebtUSD: parseFloat(remainingBoxDebtUSD.toFixed(2)),
        settledList
    };
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
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO sources (id, shop_id, name, balance_usd, balance_lbp) VALUES (?, ?, ?, ?, ?)`,
            [sourceId, shopId, name.trim(), balUSD, balLBP]
        );

        if (balUSD > 0 || balLBP > 0) {
            const ledgerId = `tx_init_${Date.now()}`;
            const mainAmt = balUSD > 0 ? balUSD : balLBP;
            const mainCurr = balUSD > 0 ? 'USD' : 'LBP';

            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'deposit', 'رصيد افتتاحي', ?, ?, ?, ?)`,
                [ledgerId, shopId, sourceId, mainAmt, mainCurr, balUSD, balLBP]
            );

            const explanation = `تم إنشاء محفظة "${name.trim()}" برصيد افتتاحي: $${balUSD.toFixed(2)} و ${Math.round(balLBP).toLocaleString()} ل.ل.`;
            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, explanation, meta_json)
         VALUES (?, ?, 'wallet_deposit', ?, ?, ?, ?, 0, 0, ?, 0, 'cash', ?, ?)`,
                [
                    `op_init_${Date.now()}`, shopId,
                    `رصيد افتتاحي: ${name.trim()}`,
                    `رصيد افتتاحي: ${name.trim()}`,
                    mainAmt, mainCurr, name.trim(), explanation,
                    JSON.stringify({ kind: 'wallet_init', walletId: sourceId, usd: balUSD, lbp: balLBP, ledgerId })
                ]
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, id: sourceId });
    } catch (err) {
        await conn.rollback();
        console.error('Add source error:', err);
        res.status(500).json({ message: 'فشل حفظ المحفظة في MySQL' });
    } finally {
        conn.release();
    }
});

router.put('/source/:id', async (req, res) => {
    const shopId = req.shopId;
    const sourceId = req.params.id;
    const { name, balanceUSD, balanceLBP } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [prevRows] = await conn.query(
            'SELECT name, balance_usd, balance_lbp FROM sources WHERE id = ? AND shop_id = ?',
            [sourceId, shopId]
        );
        if (prevRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'المحفظة غير موجودة' });
        }

        const prev = prevRows[0];
        const prevUSD = parseFloat(prev.balance_usd) || 0;
        const prevLBP = parseFloat(prev.balance_lbp) || 0;
        const nextUSD = balanceUSD !== undefined ? parseFloat(balanceUSD) : prevUSD;
        const nextLBP = balanceLBP !== undefined ? parseFloat(balanceLBP) : prevLBP;

        await conn.query(
            `UPDATE sources 
       SET name = COALESCE(?, name),
           balance_usd = ?,
           balance_lbp = ?
       WHERE id = ? AND shop_id = ?`,
            [name, nextUSD, nextLBP, sourceId, shopId]
        );

        const ledgerId = `tx_adj_${Date.now()}`;
        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'deposit', 'تعديل / تسوية رصيد يدوي', ?, 'USD', ?, ?)`,
            [ledgerId, shopId, sourceId, Math.abs(nextUSD - prevUSD), nextUSD, nextLBP]
        );

        if (balanceUSD !== undefined || balanceLBP !== undefined) {
            const wName = name || prev.name;
            const explanation = `تعديل رصيد محفظة "${wName}" يدوياً: الدولار من $${prevUSD.toFixed(2)} إلى $${nextUSD.toFixed(2)}، والليرة من ${Math.round(prevLBP).toLocaleString()} إلى ${Math.round(nextLBP).toLocaleString()} ل.ل.`;
            const meta = {
                kind: 'source_adjust',
                walletId: sourceId,
                prevUSD,
                prevLBP,
                nextUSD,
                nextLBP,
                ledgerId
            };

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, explanation, meta_json)
         VALUES (?, ?, 'source_adjust', ?, ?, ?, 'USD', 0, 0, ?, 0, 'cash', ?, ?)`,
                [
                    `op_adj_${Date.now()}`, shopId,
                    `تسوية رصيد: ${wName}`,
                    `تسوية رصيد: ${wName}`,
                    nextUSD, wName, explanation, JSON.stringify(meta)
                ]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Update source error:', err);
        res.status(500).json({ message: 'فشل تعديل المحفظة' });
    } finally {
        conn.release();
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

// تحويل بين محفظتين أو تصريف عملة مع تسجيله في سجل العمليات العام
router.post('/wallet-transfer', async (req, res) => {
    const shopId = req.shopId;
    const { fromWalletId, toWalletId, amount, currency, convertedAmount, toCurrency, notes } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const amt = parseFloat(amount) || 0;
        const convAmt = parseFloat(convertedAmount) || amt;
        const isFromLBP = currency === 'LBP';
        const targetCurr = toCurrency || currency;
        const isToLBP = targetCurr === 'LBP';
        const targetId = toWalletId || fromWalletId;
        const isExchange = fromWalletId === targetId && currency !== targetCurr;

        const [fromRows] = await conn.query('SELECT name FROM sources WHERE id = ? AND shop_id = ?', [fromWalletId, shopId]);
        const [toRows] = await conn.query('SELECT name FROM sources WHERE id = ? AND shop_id = ?', [targetId, shopId]);
        const fromName = fromRows[0]?.name || 'محفظة';
        const toName = toRows[0]?.name || 'محفظة';

        await conn.query(
            `UPDATE sources SET 
       balance_lbp = GREATEST(0, balance_lbp - ?),
       balance_usd = GREATEST(0, balance_usd - ?)
       WHERE id = ? AND shop_id = ?`,
            [isFromLBP ? amt : 0, !isFromLBP ? amt : 0, fromWalletId, shopId]
        );

        const outLedgerId = `tx_out_${Date.now()}`;
        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'withdrawal', ?, ?, ?,
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [outLedgerId, shopId, fromWalletId, notes || (isExchange ? 'تصريف عملة صادر' : `تحويل صادر إلى ${toName}`), amt, currency, fromWalletId, fromWalletId]
        );

        await conn.query(
            `UPDATE sources SET 
       balance_lbp = balance_lbp + ?,
       balance_usd = balance_usd + ?
       WHERE id = ? AND shop_id = ?`,
            [isToLBP ? convAmt : 0, !isToLBP ? convAmt : 0, targetId, shopId]
        );

        const inLedgerId = `tx_in_${Date.now()}`;
        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'deposit', ?, ?, ?,
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [inLedgerId, shopId, targetId, notes || (isExchange ? 'تصريف عملة وارد' : `تحويل وارد من ${fromName}`), convAmt, targetCurr, targetId, targetId]
        );

        const opTitle = isExchange
            ? `صرافة عملة داخل (${fromName})`
            : `تحويل كاش: ${fromName} ➔ ${toName}`;

        const explanation = isExchange
            ? `تم تصريف ${amt.toLocaleString()} ${currency} من محفظة "${fromName}" وإضافة ${convAmt.toLocaleString()} ${targetCurr} إلى نفس المحفظة.`
            : `تم تحويل ${amt.toLocaleString()} ${currency} من محفظة "${fromName}" إلى محفظة "${toName}".`;

        const meta = {
            kind: isExchange ? 'fx_exchange' : 'wallet_transfer',
            fromWalletId,
            toWalletId: targetId,
            fromAmount: amt,
            fromCurrency: currency,
            toAmount: convAmt,
            toCurrency: targetCurr,
            outLedgerId,
            inLedgerId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, notes, explanation, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 'cash', ?, ?, ?)`,
            [
                `op_tr_${Date.now()}`,
                shopId,
                isExchange ? 'fx_exchange' : 'wallet_transfer',
                opTitle,
                opTitle,
                amt,
                currency,
                fromName,
                notes || '',
                explanation,
                JSON.stringify(meta)
            ]
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

// شراء كارت من محفظة وتوجيهه (خط مسكر / خط أدمن / شريحة / رقم مباشر) مع دورة كاملة قابلة للتراجع
router.post('/buy-card', async (req, res) => {
    const shopId = req.shopId;
    const {
        walletId,
        operator = 'ALFA',
        credit = 0,
        days = 30,
        deductAmount = 0,
        payCurrency = 'USD',
        destination = 'locked',
        targetLineId = null,
        targetSimId = null,
        adminSelectMode = 'new',
        adminName = '',
        adminPhone = '',
        adminAddress = '',
        adminGB = '22',
        adminPrice = '',
        adminLinePhone = '',
        directPhone = '',
        directCustomerName = '',
        directSellingPrice = 0,
        directSellingCurrency = 'USD',
        exchangeRate = 89500
    } = req.body;

    const conn = await pool.getConnection();
    const rate = parseFloat(exchangeRate) || 89500;
    const creditNum = parseFloat(credit) || 0;
    const daysNum = parseInt(days, 10) || 30;
    const deductNum = parseFloat(deductAmount) || 0;
    const isPayLBP = payCurrency === 'LBP';
    const cycleId = `cyc_card_${Date.now()}`;

    try {
        await conn.beginTransaction();

        const [walletRows] = await conn.query('SELECT name, balance_usd, balance_lbp FROM sources WHERE id = ? AND shop_id = ?', [walletId, shopId]);
        if (walletRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'المحفظة غير موجودة' });
        }
        const walletName = walletRows[0].name;

        await conn.query(
            `UPDATE sources SET 
       balance_lbp = GREATEST(0, balance_lbp - ?),
       balance_usd = GREATEST(0, balance_usd - ?)
       WHERE id = ? AND shop_id = ?`,
            [isPayLBP ? deductNum : 0, !isPayLBP ? deductNum : 0, walletId, shopId]
        );

        const ledgerId = `tx_card_${Date.now()}`;
        const cardLabel = `شراء كارت ${operator} (${creditNum}$) من ${walletName}`;

        await conn.query(
            `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, cycle_id, amount, currency, balance_after_usd, balance_after_lbp)
       VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, ?,
         (SELECT balance_usd FROM sources WHERE id = ?),
         (SELECT balance_lbp FROM sources WHERE id = ?)
       )`,
            [ledgerId, shopId, walletId, cardLabel, cycleId, deductNum, payCurrency, walletId, walletId]
        );

        const meta = {
            kind: 'card_purchase',
            cycleId,
            walletId,
            walletName,
            deductAmount: deductNum,
            payCurrency,
            ledgerId,
            destination,
            addedCredit: creditNum,
            addedDays: daysNum,
            targetLineId: null,
            createdLineId: null,
            targetSimId: null,
            createdBatchId: null,
            boxDebtId: null,
            childSaleId: null
        };

        let explanation = `تم خصم ${deductNum.toLocaleString()} ${payCurrency} من محفظة "${walletName}" لشراء كارت ${operator} بقيمة $${creditNum} وصلاحية ${daysNum} يوم. `;

        if (destination === 'locked' && targetLineId) {
            const [lineRows] = await conn.query(
                'SELECT slot_number, phone_number, validity_days, validity_start_date FROM locked_lines WHERE id = ? AND shop_id = ?',
                [targetLineId, shopId]
            );
            const lineInfo = lineRows[0] || {};
            const elapsedDays = lineInfo.validity_start_date
                ? Math.max(0, Math.floor((Date.now() - new Date(lineInfo.validity_start_date).getTime()) / (1000 * 60 * 60 * 24)))
                : 0;
            const currentRemDays = Math.max(0, (parseInt(lineInfo.validity_days, 10) || 0) - elapsedDays);
            const cappedTotalDays = Math.min(365, currentRemDays + daysNum);
            const actualAddedDays = Math.max(0, cappedTotalDays - currentRemDays);

            await conn.query(
                `UPDATE locked_lines SET 
         balance_usd = balance_usd + ?,
         validity_days = ?,
         validity_start_date = CURDATE(),
         cycle_id = ?
         WHERE id = ? AND shop_id = ?`,
                [creditNum, cappedTotalDays, cycleId, targetLineId, shopId]
            );

            const boxDebtId = `debt_box_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, due_date, source_wallet_id, target_line_id, cycle_id, notes)
         VALUES (?, ?, 'boxes', ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, ?, ?)`,
                [boxDebtId, shopId, walletName, deductNum, deductNum, payCurrency, walletId, targetLineId, cycleId, `تكلفة كارت ${operator} (${creditNum}$) لخط #${lineInfo.slot_number || ''}`]
            );

            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                [`dh_card_${Date.now()}`, shopId, boxDebtId, deductNum, payCurrency, deductNum, `أصل تكلفة كارت ${operator} (${creditNum}$)`]
            );

            meta.targetLineId = targetLineId;
            meta.boxDebtId = boxDebtId;
            meta.addedDays = actualAddedDays;
            const capNote = actualAddedDays < daysNum ? ` (مقفول على سقف 365 يوم — أُضيف فعلياً ${actualAddedDays} يوم)` : '';
            explanation += `أُضيف الرصيد (+$${creditNum}) و(${actualAddedDays} يوم صلاحية)${capNote} إلى الخط المسكر #${lineInfo.slot_number || ''} (${lineInfo.phone_number || ''})، وسُجّل دين صندوق بقيمة ${deductNum.toLocaleString()} ${payCurrency}.`;
        }

        else if (destination === 'open_admin') {
            if (adminSelectMode === 'new') {
                const [maxRows] = await conn.query('SELECT COALESCE(MAX(slot_number), 0) AS maxSlot FROM locked_lines WHERE shop_id = ? AND line_type = "open"', [shopId]);
                const nextSlot = (maxRows[0]?.maxSlot || 0) + 1;
                const newLineId = `line_${Date.now()}`;
                const linePhone = (adminLinePhone || adminPhone || '').trim();

                await conn.query(
                    `INSERT INTO locked_lines (id, shop_id, line_type, slot_number, phone_number, validity_days, validity_start_date, balance_usd, has_service, service_active, service_start_date, service_days, admin_name, admin_phone, admin_address, admin_gb, admin_price, cycle_id)
           VALUES (?, ?, 'open', ?, ?, ?, CURDATE(), ?, 1, 1, CURDATE(), 30, ?, ?, ?, ?, ?, ?)`,
                    [newLineId, shopId, nextSlot, linePhone, daysNum, creditNum, adminName.trim(), adminPhone.trim(), adminAddress.trim(), adminGB || '22', adminPrice || '', cycleId]
                );

                const boxDebtId = `debt_box_${Date.now()}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, due_date, source_wallet_id, target_line_id, cycle_id, notes)
           VALUES (?, ?, 'boxes', ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, ?, ?)`,
                    [boxDebtId, shopId, walletName, deductNum, deductNum, payCurrency, walletId, newLineId, cycleId, `تكلفة كارت ${operator} (${creditNum}$) لخط أدمن #${nextSlot} (${adminName.trim()})`]
                );

                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                    [`dh_card_${Date.now()}`, shopId, boxDebtId, deductNum, payCurrency, deductNum, `أصل تكلفة كارت أدمن #${nextSlot}`]
                );

                meta.createdLineId = newLineId;
                meta.boxDebtId = boxDebtId;
                explanation += `تم فتح خط أدمن جديد #${nextSlot} باسم "${adminName.trim()}" برصيد $${creditNum} وخدمة 30 يوم، وسُجّل دين صندوق بقيمة ${deductNum.toLocaleString()} ${payCurrency}.`;
            } else if (targetLineId) {
                const [lineRows] = await conn.query(
                    'SELECT slot_number, admin_name, validity_days, validity_start_date FROM locked_lines WHERE id = ? AND shop_id = ?',
                    [targetLineId, shopId]
                );
                const lineInfo = lineRows[0] || {};
                const elapsedDays = lineInfo.validity_start_date
                    ? Math.max(0, Math.floor((Date.now() - new Date(lineInfo.validity_start_date).getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;
                const currentRemDays = Math.max(0, (parseInt(lineInfo.validity_days, 10) || 0) - elapsedDays);
                const cappedTotalDays = Math.min(365, currentRemDays + daysNum);
                const actualAddedDays = Math.max(0, cappedTotalDays - currentRemDays);

                await conn.query(
                    `UPDATE locked_lines SET 
           balance_usd = balance_usd + ?,
           validity_days = ?,
           validity_start_date = CURDATE(),
           cycle_id = ?
           WHERE id = ? AND shop_id = ?`,
                    [creditNum, cappedTotalDays, cycleId, targetLineId, shopId]
                );

                const boxDebtId = `debt_box_${Date.now()}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, due_date, source_wallet_id, target_line_id, cycle_id, notes)
           VALUES (?, ?, 'boxes', ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, ?, ?)`,
                    [boxDebtId, shopId, walletName, deductNum, deductNum, payCurrency, walletId, targetLineId, cycleId, `تكلفة كارت ${operator} (${creditNum}$) لأدمن #${lineInfo.slot_number || ''}`]
                );

                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                    [`dh_card_${Date.now()}`, shopId, boxDebtId, deductNum, payCurrency, deductNum, `أصل تكلفة شحن أدمن #${lineInfo.slot_number || ''}`]
                );

                meta.targetLineId = targetLineId;
                meta.boxDebtId = boxDebtId;
                meta.addedDays = actualAddedDays;
                const capNote = actualAddedDays < daysNum ? ` (مقفول على سقف 365 يوم — أُضيف فعلياً ${actualAddedDays} يوم)` : '';
                explanation += `تم شحن خط الأدمن #${lineInfo.slot_number || ''} (${lineInfo.admin_name || ''}) برصيد +$${creditNum} و+${actualAddedDays} يوم${capNote}، وسُجّل دين صندوق ${deductNum.toLocaleString()} ${payCurrency}.`;
            }
        }

        else if (destination === 'sim' && targetSimId) {
            const batchId = `batch_card_${Date.now()}`;
            await conn.query(
                `INSERT INTO sim_batches (id, shop_id, sim_id, label, cycle_id, amount_usd, remaining_usd, cost_price, cost_currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [batchId, shopId, targetSimId, `كارت ${operator} (${creditNum}$)`, cycleId, creditNum, creditNum, deductNum, payCurrency]
            );
            await conn.query(
                'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [targetSimId, targetSimId, shopId]
            );

            const boxDebtId = `debt_box_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, due_date, source_wallet_id, target_sim_id, cycle_id, notes)
         VALUES (?, ?, 'boxes', ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, ?, ?)`,
                [boxDebtId, shopId, walletName, deductNum, deductNum, payCurrency, walletId, targetSimId, cycleId, `تكلفة كارت ${operator} (${creditNum}$) للشريحة`]
            );

            meta.targetSimId = targetSimId;
            meta.createdBatchId = batchId;
            meta.boxDebtId = boxDebtId;
            explanation += `أُضيفت دفعة رصيد $${creditNum} إلى الشريحة، وسُجّل دين صندوق بقيمة ${deductNum.toLocaleString()} ${payCurrency}.`;
        } else if (destination === 'direct') {
            const sellVal = parseFloat(directSellingPrice) || 0;
            const costUSD = isPayLBP ? (deductNum / rate) : deductNum;
            const sellUSD = directSellingCurrency === 'LBP' ? (sellVal / rate) : sellVal;
            const profitUSD = sellVal > 0 ? Math.max(0, parseFloat((sellUSD - costUSD).toFixed(2))) : 0;

            if (sellVal > 0) {
                const childSaleId = `sale_dir_${Date.now()}`;
                await conn.query(
                    `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, cycle_id, explanation)
           VALUES (?, ?, 'recharge_sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'cash', ?, ?)`,
                    [
                        childSaleId, shopId, operator.toLowerCase(),
                        `مبيع كارت مباشر ${operator} (${creditNum}$)`,
                        `مبيع كارت ${operator} (${creditNum}$) للرقم ${directPhone}`,
                        sellVal, directSellingCurrency, parseFloat(costUSD.toFixed(2)), profitUSD,
                        directCustomerName.trim() || 'زبون مباشر', directPhone.trim(), cycleId,
                        `مبيع كارت مباشر للرقم ${directPhone} بمبلغ ${sellVal.toLocaleString()} ${directSellingCurrency} (صافي الربح: +$${profitUSD.toFixed(2)}).`
                    ]
                );
                meta.childSaleId = childSaleId;
                explanation += `تم شحنه مباشرة للرقم ${directPhone} وبيعه بمبلغ ${sellVal.toLocaleString()} ${directSellingCurrency} بصافي ربح +$${profitUSD.toFixed(2)}.`;
            } else {
                explanation += `تم شحنه مباشرة للرقم ${directPhone} بدون تسجيل مبيع نقدي.`;
            }
        }

        const opId = `op_card_${Date.now()}`;
        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, cycle_id, explanation, meta_json)
       VALUES (?, ?, 'card_purchase', ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'cash', ?, ?, ?)`,
            [
                opId,
                shopId,
                operator.toLowerCase(),
                cardLabel,
                cardLabel,
                deductNum,
                payCurrency,
                isPayLBP ? parseFloat((deductNum / rate).toFixed(2)) : deductNum,
                walletName,
                directPhone || '',
                cycleId,
                explanation,
                JSON.stringify(meta)
            ]
        );

        await conn.commit();
        res.json({ success: true, opId, cycleId });
    } catch (err) {
        await conn.rollback();
        console.error('Buy card error:', err);
        res.status(500).json({ message: 'فشل تنفيذ شراء الكارت' });
    } finally {
        conn.release();
    }
});

// حركات المحافظ وسنة الأيام
router.post('/wallet-tx', async (req, res) => {
    const shopId = req.shopId;
    const { walletId, tx } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [walletRows] = await conn.query('SELECT name, balance_usd, balance_lbp FROM sources WHERE id = ? AND shop_id = ?', [walletId, shopId]);
        const walletName = walletRows[0]?.name || 'محفظة';

        const isLBP = tx.currency === 'LBP';
        const amountNum = parseFloat(tx.amount) || 0;

        if (tx.type === 'deposit') {
            await conn.query(
                `UPDATE sources SET balance_lbp = balance_lbp + ?, balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?`,
                [isLBP ? amountNum : 0, !isLBP ? amountNum : 0, walletId, shopId]
            );

            const ledgerId = `tx_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'deposit', ?, ?, ?, 
           (SELECT balance_usd FROM sources WHERE id = ?), 
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, walletId, tx.itemName || `إيداع نقدي (${tx.currency})`, amountNum, tx.currency || 'USD', walletId, walletId]
            );

            const explanation = `تم إيداع ${amountNum.toLocaleString()} ${tx.currency} في محفظة "${walletName}"${tx.notes ? ` (${tx.notes})` : ''}.`;
            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, notes, explanation, meta_json)
         VALUES (?, ?, 'wallet_deposit', ?, ?, ?, ?, 0, 0, ?, 0, 'cash', ?, ?, ?)`,
                [
                    `op_dep_${Date.now()}`, shopId,
                    tx.itemName || `إيداع في ${walletName}`,
                    tx.itemName || `إيداع في ${walletName}`,
                    amountNum, tx.currency || 'USD', walletName, tx.notes || '', explanation,
                    JSON.stringify({ kind: 'wallet_deposit', walletId, amount: amountNum, currency: tx.currency || 'USD', ledgerId })
                ]
            );
        } else if (tx.type === 'withdrawal') {
            await conn.query(
                `UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?`,
                [isLBP ? amountNum : 0, !isLBP ? amountNum : 0, walletId, shopId]
            );

            const ledgerId = `tx_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, 
           (SELECT balance_usd FROM sources WHERE id = ?), 
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, walletId, tx.itemName || `سحب نقدي (${tx.currency})`, amountNum, tx.currency || 'USD', walletId, walletId]
            );

            const explanation = `تم سحب ${amountNum.toLocaleString()} ${tx.currency} من محفظة "${walletName}"${tx.notes ? ` (${tx.notes})` : ''}.`;
            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, notes, explanation, meta_json)
         VALUES (?, ?, 'wallet_withdrawal', ?, ?, ?, ?, 0, 0, ?, 0, 'cash', ?, ?, ?)`,
                [
                    `op_wdr_${Date.now()}`, shopId,
                    tx.itemName || `سحب من ${walletName}`,
                    tx.itemName || `سحب من ${walletName}`,
                    amountNum, tx.currency || 'USD', walletName, tx.notes || '', explanation,
                    JSON.stringify({ kind: 'wallet_withdrawal', walletId, amount: amountNum, currency: tx.currency || 'USD', ledgerId })
                ]
            );
        } else if (tx.type === 'sale' && !tx.isDaysYear) {
            const costUSD = parseFloat(tx.costUSD || 0);
            if (costUSD > 0) {
                await conn.query(
                    'UPDATE sources SET balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                    [costUSD, walletId, shopId]
                );
            }
            const ledgerId = `tx_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'sale', ?, ?, ?, 
           (SELECT balance_usd FROM sources WHERE id = ?), 
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, walletId, tx.itemName || 'عملية بيع', amountNum, tx.currency || 'USD', walletId, walletId]
            );

            let custDebtId = null;
            if (tx.remainingDebt && parseFloat(tx.remainingDebt) > 0) {
                custDebtId = `debt_${Date.now()}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                    [custDebtId, shopId, tx.customerType || 'customers', tx.customerName || 'عميل', tx.customerPhone || '', tx.remainingDebt, tx.remainingDebt, tx.currency || 'USD', tx.itemName || 'متبقي مبيع من المحفظة']
                );
                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                    [`dh_${Date.now()}`, shopId, custDebtId, tx.remainingDebt, tx.currency || 'USD', tx.remainingDebt, tx.itemName || 'متبقي مبيع']
                );
            }

            const profitVal = parseFloat(tx.profitUSD || 0);
            const explanation = `عملية بيع "${tx.itemName}" للزبون "${tx.customerName || 'عام'}" بمبلغ ${amountNum.toLocaleString()} ${tx.currency || 'USD'} (صافي الربح: +$${profitVal.toFixed(2)}).`;

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, explanation, meta_json)
         VALUES (?, ?, 'wallet_sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `sale_${Date.now()}`, shopId, tx.itemName, tx.itemName, amountNum, tx.currency || 'USD',
                    costUSD, profitVal, tx.customerName || 'عام', tx.customerPhone || '',
                    tx.isDebt ? 1 : 0, tx.paymentType || 'cash', explanation,
                    JSON.stringify({ kind: 'wallet_sale', walletId, costUSD, ledgerId, custDebtId })
                ]
            );
        }

        if (tx.isDaysYear && tx.targetSimId) {
            const opRate = parseFloat(tx.daysFxRate) || 89500;
            const isDeductLBP = tx.walletDeductCurrency === 'LBP';
            const deductVal = parseFloat(tx.walletDeduction) || 0;
            const debtCurr = isDeductLBP ? 'LBP' : 'USD';
            const cycleId = `cyc_days_${Date.now()}`;

            await conn.query(
                `UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?`,
                [isDeductLBP ? deductVal : 0, !isDeductLBP ? deductVal : 0, walletId, shopId]
            );

            const outLedgerId = `tx_dy_out_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, cycle_id, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', 'شراء سنة أيام Alfa', ?, ?, ?, 
           (SELECT balance_usd FROM sources WHERE id = ?), 
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [outLedgerId, shopId, walletId, cycleId, deductVal, debtCurr, walletId, walletId]
            );

            const returnCredit = parseFloat(tx.returnCreditUSD) || 77.28;
            const batchId = `batch_days_${Date.now()}`;
            await conn.query(
                `INSERT INTO sim_batches (id, shop_id, sim_id, label, cycle_id, amount_usd, remaining_usd, cost_price, cost_currency)
         VALUES (?, ?, ?, 'مردود سنة أيام', ?, ?, ?, ?, 'LBP')`,
                [batchId, shopId, tx.targetSimId, cycleId, returnCredit, returnCredit, tx.costLBP || 93500]
            );
            await conn.query(
                'UPDATE sims SET balance = (SELECT SUM(remaining_usd) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [tx.targetSimId, tx.targetSimId, shopId]
            );

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

            const boxDebtId = `debt_box_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, amount, original_amount, currency, source_wallet_id, target_sim_id, cycle_id, paid, notes)
         VALUES (?, ?, 'boxes', ?, ?, ?, ?, ?, ?, ?, ?, 'دين دورة سنة أيام')`,
                [boxDebtId, shopId, walletName, remDebt, deductVal, debtCurr, walletId, tx.targetSimId, cycleId, isPaid]
            );

            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, 'أصل تكلفة سنة أيام Alfa')`,
                [`dh_dy_init_${Date.now()}`, shopId, boxDebtId, deductVal, debtCurr, deductVal]
            );

            let inLedgerId = null;
            if (initialPay > 0) {
                await conn.query(
                    `UPDATE sources SET balance_usd = balance_usd + ?, balance_lbp = balance_lbp + ? WHERE id = ? AND shop_id = ?`,
                    [!isDeductLBP ? initialPay : 0, isDeductLBP ? initialPay : 0, walletId, shopId]
                );

                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'payment', ?, ?, ?, 'سداد من مبيع الأيام للزبون')`,
                    [`dh_dy_pay_${Date.now()}`, shopId, boxDebtId, initialPay, debtCurr, remDebt]
                );

                inLedgerId = `tx_dy_in_${Date.now()}`;
                await conn.query(
                    `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, cycle_id, amount, currency, balance_after_usd, balance_after_lbp)
           VALUES (?, ?, ?, 'deposit', 'استرداد مبيع أيام Alfa', ?, ?, ?, 
             (SELECT balance_usd FROM sources WHERE id = ?), 
             (SELECT balance_lbp FROM sources WHERE id = ?)
           )`,
                    [inLedgerId, shopId, walletId, cycleId, initialPay, debtCurr, walletId, walletId]
                );
            }

            const profitSurplusInDebtCurr = Math.max(0, saleInDebtCurr - deductVal);
            const profitUSDVal = isDeductLBP
                ? parseFloat((profitSurplusInDebtCurr / opRate).toFixed(2))
                : parseFloat(profitSurplusInDebtCurr.toFixed(2));

            let custDebtId = null;
            if (tx.remainingDebt && parseFloat(tx.remainingDebt) > 0) {
                custDebtId = `debt_cust_${Date.now()}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, cycle_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?, 'متبقي بيع سنة أيام Alfa')`,
                    [custDebtId, shopId, tx.customerType || 'customers', tx.customerName || 'عميل', tx.customerPhone || '', tx.remainingDebt, tx.remainingDebt, tx.currency || 'LBP', cycleId]
                );
                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, 'متبقي بيع سنة أيام Alfa')`,
                    [`dh_cust_${Date.now()}`, shopId, custDebtId, tx.remainingDebt, tx.currency || 'LBP', tx.remainingDebt]
                );
            }

            const explanation = `دورة سنة أيام Alfa: خُصم ${deductVal.toLocaleString()} ${debtCurr} من "${walletName}"، أُضيف رصيد $${returnCredit} للشريحة، تم بيع الأيام بـ ${amountNum.toLocaleString()} ${tx.currency || 'LBP'} واستُرد ${initialPay.toLocaleString()} ${debtCurr} للمحفظة (متبقي دين صندوق: ${remDebt.toLocaleString()} ${debtCurr}).`;

            const meta = {
                kind: 'days_year',
                cycleId,
                walletId,
                deductAmount: deductVal,
                refundedToWallet: initialPay,
                debtCurr,
                targetSimId: tx.targetSimId,
                batchId,
                boxDebtId,
                custDebtId,
                outLedgerId,
                inLedgerId
            };

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes, cycle_id, explanation, meta_json)
         VALUES (?, ?, 'days_year', 'alfa', 'دورة سنة أيام Alfa', 'دورة سنة أيام Alfa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `sale_dy_${Date.now()}`, shopId, amountNum, tx.currency || 'LBP',
                    isDeductLBP ? parseFloat((initialPay / opRate).toFixed(2)) : initialPay,
                    profitUSDVal,
                    tx.customerName || 'عام', tx.customerPhone || '',
                    tx.remainingDebt > 0 ? 1 : 0, tx.paymentType || 'cash',
                    `استرداد للمحفظة: ${initialPay.toLocaleString()} ${debtCurr}`,
                    cycleId, explanation, JSON.stringify(meta)
                ]
            );
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
            const batchId = newBatch.id || `batch_${Date.now()}`;
            const [simRows] = await conn.query('SELECT name, operator FROM sims WHERE id = ? AND shop_id = ?', [simId, shopId]);
            const simName = simRows[0]?.name || 'شريحة';
            const simOp = simRows[0]?.operator || 'alfa';

            await conn.query(
                `INSERT INTO sim_batches (id, shop_id, sim_id, label, cycle_id, amount_usd, remaining_usd, cost_price, cost_currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    batchId,
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

            const explanation = `تمت تعبئة دفعة رصيد جديدة (+$${addUSD.toFixed(2)}) في شريحة "${simName}" (${newBatch.label || 'دفعة رصيد'}).`;
            const meta = {
                kind: 'sim_topup',
                simId,
                batchId,
                addedUSD: addUSD
            };

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, explanation, meta_json)
         VALUES (?, ?, 'sim_topup', ?, ?, ?, ?, 'USD', 0, 0, ?, 0, 'cash', ?, ?)`,
                [
                    `op_topup_${Date.now()}`, shopId, simOp,
                    `تعبئة شريحة: ${simName}`,
                    `تعبئة شريحة: ${simName} (+$${addUSD.toFixed(2)})`,
                    addUSD, simName, explanation, JSON.stringify(meta)
                ]
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
        const creditNum = parseFloat(credits) || 0;
        const taxNum = parseFloat(tax) || 0;
        const totalDeduct = parseFloat((creditNum + taxNum).toFixed(2));
        let rem = totalDeduct;
        const deductedBatches = [];

        const [fromRows] = await conn.query('SELECT name, operator FROM sims WHERE id = ? AND shop_id = ?', [fromSimId, shopId]);
        const [toRows] = await conn.query('SELECT name FROM sims WHERE id = ? AND shop_id = ?', [toSimId, shopId]);
        const fromName = fromRows[0]?.name || 'شريحة مصدر';
        const toName = toRows[0]?.name || 'شريحة مستقبلة';
        const opName = fromRows[0]?.operator || 'alfa';

        const [batches] = await conn.query(
            'SELECT id, remaining_usd FROM sim_batches WHERE sim_id = ? AND shop_id = ? AND remaining_usd > 0 ORDER BY created_at ASC',
            [fromSimId, shopId]
        );
        for (const b of batches) {
            if (rem <= 0) break;
            const bRem = parseFloat(b.remaining_usd);
            const cut = Math.min(bRem, rem);
            await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd - ? WHERE id = ?', [cut, b.id]);
            deductedBatches.push({ batchId: b.id, amount: cut });
            rem = parseFloat((rem - cut).toFixed(4));
        }

        await conn.query(
            'UPDATE sims SET balance = GREATEST(0, balance - ?) WHERE id = ? AND shop_id = ?',
            [totalDeduct, fromSimId, shopId]
        );

        const newBatchId = `batch_tr_${Date.now()}`;
        await conn.query(
            `INSERT INTO sim_batches (id, shop_id, sim_id, label, amount_usd, remaining_usd, cost_price, cost_currency)
       VALUES (?, ?, ?, 'تحويل رصيد وارد', ?, ?, 0, 'USD')`,
            [newBatchId, shopId, toSimId, creditNum, creditNum]
        );
        await conn.query(
            'UPDATE sims SET balance = balance + ? WHERE id = ? AND shop_id = ?',
            [creditNum, toSimId, shopId]
        );

        const explanation = `تم تحويل $${creditNum.toFixed(2)} رصيد من شريحة "${fromName}" إلى شريحة "${toName}" (إجمالي المخصوم شامل الضريبة $${taxNum}: $${totalDeduct.toFixed(2)}).`;
        const meta = {
            kind: 'sim_transfer',
            fromSimId,
            toSimId,
            credits: creditNum,
            tax: taxNum,
            totalDeduct,
            deductedBatches,
            newBatchId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, explanation, meta_json)
       VALUES (?, ?, 'sim_transfer', ?, ?, ?, ?, 'USD', 0, 0, ?, 0, 'cash', ?, ?)`,
            [
                `op_simtr_${Date.now()}`, shopId, opName,
                `تحويل رصيد: ${fromName} ➔ ${toName}`,
                `تحويل رصيد: ${fromName} ➔ ${toName}`,
                creditNum, toName, explanation, JSON.stringify(meta)
            ]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('SIM transfer error:', err);
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
        const deductedBatches = [];

        if (data.simId && data.totalDeduction > 0) {
            let remDeduct = parseFloat(data.totalDeduction);

            if (data.selectedBatchId) {
                await conn.query(
                    'UPDATE sim_batches SET remaining_usd = GREATEST(0, remaining_usd - ?) WHERE id = ? AND shop_id = ?',
                    [remDeduct, data.selectedBatchId, shopId]
                );
                deductedBatches.push({ batchId: data.selectedBatchId, amount: remDeduct });
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
                    deductedBatches.push({ batchId: b.id, amount: deduct });
                    remDeduct -= deduct;
                }
            }

            await conn.query(
                'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                [data.simId, data.simId, shopId]
            );
        }

        const paidCashVal = Math.max(0, rawSale - (parseFloat(data.remainingDebt) || 0));
        const debtSettlement = await settleBoxDebts(conn, {
            shopId,
            targetSimId: data.simId || null,
            targetLineId: null,
            saleAmount: paidCashVal,
            saleCurrency,
            rate,
            noteLabel: `من مبيع (${data.itemName})`
        });

        if (debtSettlement.hasBoxDebts) {
            costUSD = debtSettlement.costInUSD;
            const profitInSaleCurr = Math.max(0, paidCashVal - debtSettlement.costInSaleCurr);
            profitUSD = saleCurrency === 'LBP' ? parseFloat((profitInSaleCurr / rate).toFixed(2)) : parseFloat(profitInSaleCurr.toFixed(2));
        }

        let custDebtId = null;
        if (data.remainingDebt && parseFloat(data.remainingDebt) > 0) {
            custDebtId = `debt_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, notes)
         VALUES (?, ?, 'customers', ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?)`,
                [custDebtId, shopId, data.customerName, data.customerPhone || '', data.remainingDebt, data.remainingDebt, saleCurrency, data.itemName]
            );
            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                [`dh_${Date.now()}`, shopId, custDebtId, data.remainingDebt, saleCurrency, data.remainingDebt, data.itemName]
            );
        }

        const explanation = debtSettlement.hasBoxDebts
            ? `بيع "${data.itemName}" بمبلغ ${rawSale.toLocaleString()} ${saleCurrency}: استُرد $${debtSettlement.costInUSD.toFixed(2)} لتسديد رأس مال المحفظة، وصافي الربح المحقق +$${profitUSD.toFixed(2)}.`
            : `بيع "${data.itemName}" للزبون "${data.customerName || 'عام'}" بمبلغ ${rawSale.toLocaleString()} ${saleCurrency} (صافي الربح: +$${profitUSD.toFixed(2)}).`;

        const meta = {
            kind: 'recharge_sale',
            simId: data.simId || null,
            deductedBatches,
            settledDebts: debtSettlement.settledList,
            custDebtId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, notes, explanation, meta_json)
       VALUES (?, ?, 'recharge_sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                saleId, shopId, data.operator, data.title || data.itemName, data.itemName,
                rawSale, saleCurrency, costUSD, profitUSD,
                data.customerName || 'عام', data.customerPhone || '', data.remainingDebt > 0 ? 1 : 0,
                data.paymentType || 'cash', data.notes || '', explanation, JSON.stringify(meta)
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
// 6. Alfa Gift + U-Share + فتح دورة خدمة مستمرة (Service Cycles)
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
    const deductNum = parseFloat(deductUSD) || 0;
    const totalGBNum = parseFloat(totalGB) || 0;

    try {
        await conn.beginTransaction();

        let inheritedCycleId = null;
        if (lockedLineId && deductNum === 0) {
            const [lineCheck] = await conn.query('SELECT cycle_id FROM locked_lines WHERE id = ? AND shop_id = ?', [lockedLineId, shopId]);
            inheritedCycleId = lineCheck[0]?.cycle_id || null;
        }

        const cycleId = inheritedCycleId || (deductNum > 0 ? `cyc_srv_${Date.now()}` : null);
        const deductedBatches = [];

        if (simId && deductNum > 0) {
            if (selectedBatchId) {
                await conn.query(
                    'UPDATE sim_batches SET remaining_usd = GREATEST(0, remaining_usd - ?) WHERE id = ? AND shop_id = ?',
                    [deductNum, selectedBatchId, shopId]
                );
                deductedBatches.push({ batchId: selectedBatchId, amount: deductNum });
            } else {
                let rem = deductNum;
                const [batches] = await conn.query(
                    'SELECT id, remaining_usd FROM sim_batches WHERE sim_id = ? AND shop_id = ? AND remaining_usd > 0 ORDER BY created_at ASC',
                    [simId, shopId]
                );
                for (const b of batches) {
                    if (rem <= 0) break;
                    const bRem = parseFloat(b.remaining_usd);
                    const cut = Math.min(bRem, rem);
                    await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd - ? WHERE id = ?', [cut, b.id]);
                    deductedBatches.push({ batchId: b.id, amount: cut });
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
           cycle_id = COALESCE(?, cycle_id),
           user1 = ?, user2 = ?, user3 = ?
           WHERE id = ? AND shop_id = ?`,
                    [
                        deductNum,
                        cycleId,
                        recipients[0] ? `${recipients[0].name} (${recipients[0].gb} GB)` : '',
                        recipients[1] ? `${recipients[1].name} (${recipients[1].gb} GB)` : '',
                        recipients[2] ? `${recipients[2].name} (${recipients[2].gb} GB)` : '',
                        lockedLineId, shopId
                    ]
                );
            } else if (deductNum > 0) {
                await conn.query(
                    `UPDATE locked_lines SET balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?`,
                    [deductNum, lockedLineId, shopId]
                );
            }
        }

        let createdCycleId = null;
        if (mode === 'ushare' && deductNum > 0 && cycleId) {
            createdCycleId = cycleId;
            const allocGB = recipients.reduce((s, r) => s + (parseFloat(r.gb) || 0), 0);
            const isFull = recipients.length >= 3 || (totalGBNum > 0 && allocGB >= totalGBNum);
            const sourceLabel = simId ? 'شريحة أساسية' : 'خط مسكر';

            await conn.query(
                `INSERT INTO service_cycles (id, shop_id, source_type, sim_id, batch_id, locked_line_id, package_name, total_gb, allocated_gb, cost_usd, status, user1_name, user1_phone, user1_gb, user2_name, user2_phone, user2_gb, user3_name, user3_phone, user3_gb)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    createdCycleId,
                    shopId,
                    simId ? 'sim' : 'closed_line',
                    simId || null,
                    selectedBatchId || null,
                    lockedLineId || null,
                    `باقة U-Share ${totalGBNum} GB (${sourceLabel})`,
                    totalGBNum,
                    allocGB,
                    deductNum,
                    isFull ? 'completed' : 'open',
                    recipients[0]?.name || '',
                    recipients[0]?.phone || '',
                    parseFloat(recipients[0]?.gb) || 0,
                    recipients[1]?.name || '',
                    recipients[1]?.phone || '',
                    parseFloat(recipients[1]?.gb) || 0,
                    recipients[2]?.name || '',
                    recipients[2]?.phone || '',
                    parseFloat(recipients[2]?.gb) || 0
                ]
            );
        }

        let rootOpId = null;

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
                ? `Alfa Gift ${totalGBNum}GB`
                : `U-Share (${rec.gb} GB) - ${rec.name}`);

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
                : (mode === 'direct_gift' ? deductNum : 0);

            let netProfitUSD = 0;
            if (debtSettlement.hasBoxDebts) {
                const profitInRecCurr = Math.max(0, paidNowVal - debtSettlement.costInSaleCurr);
                netProfitUSD = recCurrency === 'LBP' ? parseFloat((profitInRecCurr / rate).toFixed(2)) : parseFloat(profitInRecCurr.toFixed(2));
            } else {
                netProfitUSD = Math.max(0, parseFloat((saleUSD - finalCostUSD).toFixed(2)));
            }

            let custDebtId = null;
            if (remDebtVal > 0) {
                custDebtId = `debt_cust_${Date.now()}_${i}`;
                await conn.query(
                    `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, cycle_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?, ?)`,
                    [custDebtId, shopId, rec.customerType || 'customers', rec.name.trim(), rec.phone || '', remDebtVal, remDebtVal, recCurrency, cycleId, labelTitle]
                );
                await conn.query(
                    `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
           VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                    [`dh_gift_${Date.now()}_${i}`, shopId, custDebtId, remDebtVal, recCurrency, remDebtVal, labelTitle]
                );
            }

            const thisOpId = `gift_sale_${Date.now()}_${i}`;
            if (i === 0) rootOpId = thisOpId;

            let explanation = '';
            if (i === 0 && deductNum > 0) {
                explanation += `تم سحب $${deductNum.toFixed(2)} من ${simId ? 'الشريحة الأساسية' : 'الخط المسكر'} لفتح الباقة (${totalGBNum} GB). `;
            }
            if (debtSettlement.hasBoxDebts) {
                explanation += `قُبض ${paidNowVal.toLocaleString()} ${recCurrency} من "${rec.name}": ذهب $${debtSettlement.costInUSD.toFixed(2)} لاسترداد رأس مال الكارت للمحفظة (المتبقي لاسترداد رأس المال: $${debtSettlement.remainingBoxDebtUSD.toFixed(2)})، وصافي الربح: +$${netProfitUSD.toFixed(2)}.`;
            } else {
                explanation += `حصة "${rec.name}" (${rec.gb} GB) بمبلغ ${saleVal.toLocaleString()} ${recCurrency} — صافي الربح: +$${netProfitUSD.toFixed(2)}.`;
            }

            const meta = {
                kind: mode === 'direct_gift' ? 'alfa_gift' : 'ushare',
                isCycleRoot: i === 0 && deductNum > 0,
                cycleId,
                createdCycleId: i === 0 ? createdCycleId : null,
                simId: simId || null,
                lockedLineId: lockedLineId || null,
                deductedUSD: i === 0 ? deductNum : 0,
                deductedBatches: i === 0 ? deductedBatches : [],
                settledDebts: debtSettlement.settledList,
                custDebtId,
                slotIndex: i + 1,
                gb: parseFloat(rec.gb) || 0
            };

            await conn.query(
                `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, cycle_id, parent_op_id, explanation, meta_json)
         VALUES (?, ?, ?, 'alfa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    thisOpId,
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
                    payType,
                    cycleId,
                    i > 0 ? rootOpId : null,
                    explanation,
                    JSON.stringify(meta)
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
        res.json({ success: true, cycleId });
    } catch (err) {
        await conn.rollback();
        console.error('Alfa Gift / U-Share error:', err);
        res.status(500).json({ message: 'فشل تسجيل العملية' });
    } finally {
        conn.release();
    }
});

// إضافة مشترك جديد إلى دورة خدمة مفتوحة مسبقاً بدون خصم تكلفة الباقة مرة ثانية
router.post('/cycle-add-user', async (req, res) => {
    const shopId = req.shopId;
    const {
        cycleId,
        name,
        phone = '',
        gb = 22,
        price = 0,
        currency = 'USD',
        isDebt = false,
        paymentType,
        paidAmount,
        remainingDebt,
        customerType = 'customers',
        exchangeRate = 89500
    } = req.body;

    const conn = await pool.getConnection();
    const rate = parseFloat(exchangeRate) || 89500;

    try {
        await conn.beginTransaction();

        const [cycles] = await conn.query('SELECT * FROM service_cycles WHERE id = ? AND shop_id = ?', [cycleId, shopId]);
        if (cycles.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'دورة الخدمة غير موجودة' });
        }

        const cycle = cycles[0];
        let targetSlot = 0;
        if (!cycle.user1_name) targetSlot = 1;
        else if (!cycle.user2_name) targetSlot = 2;
        else if (!cycle.user3_name) targetSlot = 3;
        else {
            await conn.rollback();
            return res.status(400).json({ message: 'اكتمل العدد الأقصى (3 مشتركين) في هذه الدورة' });
        }

        const gbNum = parseFloat(gb) || 0;
        const newAllocated = parseFloat(cycle.allocated_gb || 0) + gbNum;
        const totalGB = parseFloat(cycle.total_gb || 0);
        const isNowComplete = targetSlot === 3 || (totalGB > 0 && newAllocated >= totalGB);

        await conn.query(
            `UPDATE service_cycles SET
       user${targetSlot}_name = ?,
       user${targetSlot}_phone = ?,
       user${targetSlot}_gb = ?,
       allocated_gb = ?,
       status = ?
       WHERE id = ? AND shop_id = ?`,
            [name.trim(), phone.trim(), gbNum, newAllocated, isNowComplete ? 'completed' : 'open', cycleId, shopId]
        );

        if (cycle.locked_line_id) {
            await conn.query(
                `UPDATE locked_lines SET user${targetSlot} = ? WHERE id = ? AND shop_id = ?`,
                [`${name.trim()} (${gbNum} GB)`, cycle.locked_line_id, shopId]
            );
        }

        const saleVal = parseFloat(price) || 0;
        const payType = paymentType || (isDebt ? 'debt' : 'cash');
        const remDebtVal = remainingDebt !== undefined
            ? parseFloat(remainingDebt)
            : (payType === 'debt' ? saleVal : 0);
        const paidNowVal = paidAmount !== undefined
            ? parseFloat(paidAmount)
            : Math.max(0, saleVal - remDebtVal);

        const saleUSD = currency === 'LBP' ? (saleVal / rate) : saleVal;
        const labelTitle = `U-Share (${gbNum} GB) - ${name.trim()} [مشترك #${targetSlot}]`;

        const debtSettlement = await settleBoxDebts(conn, {
            shopId,
            targetSimId: cycle.sim_id || null,
            targetLineId: cycle.locked_line_id || null,
            saleAmount: paidNowVal,
            saleCurrency: currency,
            rate,
            noteLabel: `من مبيع ${labelTitle}`
        });

        const finalCostUSD = debtSettlement.hasBoxDebts ? debtSettlement.costInUSD : 0;
        let netProfitUSD = 0;
        if (debtSettlement.hasBoxDebts) {
            const profitInRecCurr = Math.max(0, paidNowVal - debtSettlement.costInSaleCurr);
            netProfitUSD = currency === 'LBP' ? parseFloat((profitInRecCurr / rate).toFixed(2)) : parseFloat(profitInRecCurr.toFixed(2));
        } else {
            netProfitUSD = Math.max(0, parseFloat(saleUSD.toFixed(2)));
        }

        let custDebtId = null;
        if (remDebtVal > 0) {
            custDebtId = `debt_cust_${Date.now()}`;
            await conn.query(
                `INSERT INTO debts (id, shop_id, category, name, phone, amount, original_amount, currency, due_date, cycle_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?, ?)`,
                [custDebtId, shopId, customerType, name.trim(), phone.trim(), remDebtVal, remDebtVal, currency, cycleId, labelTitle]
            );
            await conn.query(
                `INSERT INTO debt_history (id, shop_id, debt_id, type, amount, currency, remaining_after, notes)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, ?)`,
                [`dh_cyc_${Date.now()}`, shopId, custDebtId, remDebtVal, currency, remDebtVal, labelTitle]
            );
        }

        const explanation = debtSettlement.hasBoxDebts
            ? `إضافة مشترك #${targetSlot} (${name.trim()} - ${gbNum} GB) على الدورة المفتوحة: قُبض ${paidNowVal.toLocaleString()} ${currency}، ذهب $${debtSettlement.costInUSD.toFixed(2)} لاسترداد رأس مال الكارت (المتبقي: $${debtSettlement.remainingBoxDebtUSD.toFixed(2)})، وصافي الربح: +$${netProfitUSD.toFixed(2)}.`
            : `إضافة مشترك #${targetSlot} (${name.trim()} - ${gbNum} GB) على الدورة المفتوحة بمبلغ ${saleVal.toLocaleString()} ${currency} — صافي الربح: +$${netProfitUSD.toFixed(2)}.`;

        const meta = {
            kind: 'cycle_user',
            cycleId,
            slotIndex: targetSlot,
            gb: gbNum,
            simId: cycle.sim_id || null,
            lockedLineId: cycle.locked_line_id || null,
            settledDebts: debtSettlement.settledList,
            custDebtId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, operator, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, customer_phone, is_debt, payment_type, cycle_id, explanation, meta_json)
       VALUES (?, ?, 'ushare', 'alfa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                `cyc_sale_${Date.now()}`,
                shopId,
                labelTitle,
                labelTitle,
                saleVal,
                currency,
                finalCostUSD,
                netProfitUSD,
                name.trim(),
                phone.trim(),
                remDebtVal > 0 ? 1 : 0,
                payType,
                cycleId,
                explanation,
                JSON.stringify(meta)
            ]
        );

        if (name && !['عام', 'حركة مباشرة'].includes(name.trim())) {
            const [existingCust] = await conn.query('SELECT id FROM customers WHERE shop_id = ? AND name = ?', [shopId, name.trim()]);
            if (existingCust.length === 0) {
                await conn.query(
                    `INSERT INTO customers (id, shop_id, name, phone) VALUES (?, ?, ?, ?)`,
                    [`cust_${Date.now()}`, shopId, name.trim(), phone.trim()]
                );
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Cycle add user error:', err);
        res.status(500).json({ message: 'فشل إضافة المشترك للدورة' });
    } finally {
        conn.release();
    }
});

// ==========================================
// 7. التراجع المتسلسل الذكي عن أي عملية (Cascading Rollback)
// ==========================================
router.delete('/rollback/:id', async (req, res) => {
    const shopId = req.shopId;
    const opId = req.params.id;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [opRows] = await conn.query('SELECT * FROM sales_history WHERE id = ? AND shop_id = ?', [opId, shopId]);
        if (opRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'العملية غير موجودة' });
        }

        const op = opRows[0];
        let meta = {};
        if (op.meta_json) {
            try {
                meta = JSON.parse(op.meta_json);
            } catch (e) {
                meta = {};
            }
        }

        const isRootCascade = (op.type === 'card_purchase' || op.type === 'days_year' || meta.isCycleRoot) && op.cycle_id;

        if (isRootCascade) {
            const cycleId = op.cycle_id;

            await conn.query('DELETE FROM debts WHERE shop_id = ? AND cycle_id = ?', [shopId, cycleId]);
            await conn.query('DELETE FROM service_cycles WHERE shop_id = ? AND id = ?', [shopId, cycleId]);

            if (meta.createdBatchId && meta.targetSimId) {
                await conn.query('DELETE FROM sim_batches WHERE shop_id = ? AND id = ?', [shopId, meta.createdBatchId]);
                await conn.query(
                    'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                    [meta.targetSimId, meta.targetSimId, shopId]
                );
            }
            if (Array.isArray(meta.deductedBatches) && meta.simId) {
                for (const b of meta.deductedBatches) {
                    await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd + ? WHERE id = ? AND shop_id = ?', [b.amount, b.batchId, shopId]);
                }
                await conn.query(
                    'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                    [meta.simId, meta.simId, shopId]
                );
            }

            if (meta.createdLineId) {
                await conn.query('DELETE FROM locked_lines WHERE shop_id = ? AND id = ?', [shopId, meta.createdLineId]);
            } else if (meta.targetLineId) {
                await conn.query(
                    `UPDATE locked_lines SET
           balance_usd = GREATEST(0, balance_usd - ?),
           validity_days = GREATEST(0, validity_days - ?),
           has_service = 0, service_active = 0, service_start_date = NULL,
           user1 = '', user2 = '', user3 = '', cycle_id = NULL
           WHERE id = ? AND shop_id = ?`,
                    [parseFloat(meta.addedCredit) || 0, parseInt(meta.addedDays, 10) || 0, meta.targetLineId, shopId]
                );
            } else if (meta.lockedLineId && meta.deductedUSD > 0) {
                await conn.query(
                    `UPDATE locked_lines SET
           balance_usd = balance_usd + ?,
           has_service = 0, service_active = 0, service_start_date = NULL,
           user1 = '', user2 = '', user3 = '', cycle_id = NULL
           WHERE id = ? AND shop_id = ?`,
                    [parseFloat(meta.deductedUSD) || 0, meta.lockedLineId, shopId]
                );
            }

            if (meta.walletId) {
                const isLBP = (meta.payCurrency || meta.debtCurr) === 'LBP';
                const netWalletRefund = (parseFloat(meta.deductAmount) || 0) - (parseFloat(meta.refundedToWallet) || 0);
                if (netWalletRefund !== 0) {
                    await conn.query(
                        `UPDATE sources SET 
             balance_lbp = GREATEST(0, balance_lbp + ?),
             balance_usd = GREATEST(0, balance_usd + ?)
             WHERE id = ? AND shop_id = ?`,
                        [isLBP ? netWalletRefund : 0, !isLBP ? netWalletRefund : 0, meta.walletId, shopId]
                    );
                    await conn.query(
                        `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
             VALUES (?, ?, ?, 'deposit', 'تراجع عن دورة كاملة', ?, ?,
               (SELECT balance_usd FROM sources WHERE id = ?),
               (SELECT balance_lbp FROM sources WHERE id = ?)
             )`,
                        [`tx_rb_${Date.now()}`, shopId, meta.walletId, Math.abs(netWalletRefund), isLBP ? 'LBP' : 'USD', meta.walletId, meta.walletId]
                    );
                }
            }

            await conn.query('DELETE FROM sales_history WHERE shop_id = ? AND cycle_id = ?', [shopId, cycleId]);
        } else {
            // 1. تراجع عن تسجيل دين يدوي
            if (meta.kind === 'debt_create' && meta.debtId) {
                await conn.query('DELETE FROM debt_history WHERE shop_id = ? AND debt_id = ?', [shopId, meta.debtId]);
                await conn.query('DELETE FROM debts WHERE shop_id = ? AND id = ?', [shopId, meta.debtId]);
                if (meta.category === 'boxes' && meta.sourceWalletId) {
                    const isLBP = meta.currency === 'LBP';
                    await conn.query(
                        'UPDATE sources SET balance_lbp = balance_lbp + ?, balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?',
                        [isLBP ? meta.amount : 0, !isLBP ? meta.amount : 0, meta.sourceWalletId, shopId]
                    );
                    if (meta.ledgerId) {
                        await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                    }
                }
            }

            // 2. تراجع عن قبض/سداد دين
            if (meta.kind === 'debt_payment' && meta.debtId) {
                await conn.query(
                    'UPDATE debts SET amount = amount + ?, paid = 0 WHERE id = ? AND shop_id = ?',
                    [meta.amount, meta.debtId, shopId]
                );
                if (meta.dhId) {
                    await conn.query('DELETE FROM debt_history WHERE shop_id = ? AND id = ?', [shopId, meta.dhId]);
                }
                if (meta.category === 'boxes' && meta.sourceWalletId) {
                    const isLBP = meta.currency === 'LBP';
                    await conn.query(
                        'UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                        [isLBP ? meta.amount : 0, !isLBP ? meta.amount : 0, meta.sourceWalletId, shopId]
                    );
                    if (meta.ledgerId) {
                        await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                    }
                }
            }

            // 3. تراجع عن تسجيل مصروف
            if (meta.kind === 'expense' && meta.expId) {
                await conn.query('DELETE FROM expenses WHERE shop_id = ? AND id = ?', [shopId, meta.expId]);
                if (meta.sourceWalletId) {
                    const isLBP = meta.currency === 'LBP';
                    await conn.query(
                        'UPDATE sources SET balance_lbp = balance_lbp + ?, balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?',
                        [isLBP ? meta.amount : 0, !isLBP ? meta.amount : 0, meta.sourceWalletId, shopId]
                    );
                    if (meta.ledgerId) {
                        await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                    }
                }
            }

            // 4. تراجع عن تحويل رصيد بين شريحتين
            if (meta.kind === 'sim_transfer') {
                if (meta.newBatchId) {
                    await conn.query('DELETE FROM sim_batches WHERE shop_id = ? AND id = ?', [shopId, meta.newBatchId]);
                }
                if (meta.toSimId) {
                    await conn.query(
                        'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                        [meta.toSimId, meta.toSimId, shopId]
                    );
                }
                if (Array.isArray(meta.deductedBatches)) {
                    for (const b of meta.deductedBatches) {
                        await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd + ? WHERE id = ? AND shop_id = ?', [b.amount, b.batchId, shopId]);
                    }
                }
                if (meta.fromSimId) {
                    await conn.query(
                        'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                        [meta.fromSimId, meta.fromSimId, shopId]
                    );
                }
            }

            // 5. تراجع عن تعبئة دفعة شريحة
            if (meta.kind === 'sim_topup' && meta.batchId && meta.simId) {
                await conn.query('DELETE FROM sim_batches WHERE shop_id = ? AND id = ?', [shopId, meta.batchId]);
                await conn.query(
                    'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                    [meta.simId, meta.simId, shopId]
                );
            }

            // 6. تراجع عن تعديل رصيد صندوق يدوياً
            if (meta.kind === 'source_adjust' && meta.walletId) {
                await conn.query(
                    'UPDATE sources SET balance_usd = ?, balance_lbp = ? WHERE id = ? AND shop_id = ?',
                    [meta.prevUSD || 0, meta.prevLBP || 0, meta.walletId, shopId]
                );
                if (meta.ledgerId) {
                    await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                }
            }

            // 7. تراجع عن رصيد افتتاحي لمحفظة
            if (meta.kind === 'wallet_init' && meta.walletId) {
                await conn.query(
                    'UPDATE sources SET balance_usd = GREATEST(0, balance_usd - ?), balance_lbp = GREATEST(0, balance_lbp - ?) WHERE id = ? AND shop_id = ?',
                    [meta.usd || 0, meta.lbp || 0, meta.walletId, shopId]
                );
                if (meta.ledgerId) {
                    await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                }
            }

            // 8. تراجع عن دين زبون ناتج عن بيعة فردية
            if (meta.custDebtId) {
                await conn.query('DELETE FROM debt_history WHERE shop_id = ? AND debt_id = ?', [shopId, meta.custDebtId]);
                await conn.query('DELETE FROM debts WHERE shop_id = ? AND id = ?', [shopId, meta.custDebtId]);
            }

            // 9. عكس تسديدات ديون الصناديق التي تمت من هذه العملية
            if (Array.isArray(meta.settledDebts)) {
                for (const sd of meta.settledDebts) {
                    const isSD_LBP = sd.currency === 'LBP';
                    await conn.query(
                        'UPDATE debts SET amount = amount + ?, paid = 0 WHERE id = ? AND shop_id = ?',
                        [sd.amount, sd.debtId, shopId]
                    );
                    if (sd.dhId) {
                        await conn.query('DELETE FROM debt_history WHERE shop_id = ? AND id = ?', [shopId, sd.dhId]);
                    }
                    if (sd.ledgerId) {
                        await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, sd.ledgerId]);
                    }
                    if (sd.walletId) {
                        await conn.query(
                            `UPDATE sources SET
               balance_lbp = GREATEST(0, balance_lbp - ?),
               balance_usd = GREATEST(0, balance_usd - ?)
               WHERE id = ? AND shop_id = ?`,
                            [isSD_LBP ? sd.amount : 0, !isSD_LBP ? sd.amount : 0, sd.walletId, shopId]
                        );
                    }
                }
            }

            // 10. إذا كانت العملية لمشترك داخل دورة خدمة، نفرّغ خانته ونعيد فتح الدورة
            if (op.cycle_id && meta.slotIndex) {
                const slot = parseInt(meta.slotIndex, 10);
                const gbBack = parseFloat(meta.gb) || 0;
                if (slot >= 1 && slot <= 3) {
                    await conn.query(
                        `UPDATE service_cycles SET
             user${slot}_name = '', user${slot}_phone = '', user${slot}_gb = 0,
             allocated_gb = GREATEST(0, allocated_gb - ?),
             status = 'open'
             WHERE id = ? AND shop_id = ?`,
                        [gbBack, op.cycle_id, shopId]
                    );
                }
                if (meta.lockedLineId && slot >= 1 && slot <= 3) {
                    await conn.query(
                        `UPDATE locked_lines SET user${slot} = '' WHERE id = ? AND shop_id = ?`,
                        [meta.lockedLineId, shopId]
                    );
                }
            }

            // 11. إرجاع رصيد الشريحة إذا كانت بيع رصيد
            if (Array.isArray(meta.deductedBatches) && meta.simId && meta.kind !== 'sim_transfer') {
                for (const b of meta.deductedBatches) {
                    await conn.query('UPDATE sim_batches SET remaining_usd = remaining_usd + ? WHERE id = ? AND shop_id = ?', [b.amount, b.batchId, shopId]);
                }
                await conn.query(
                    'UPDATE sims SET balance = (SELECT COALESCE(SUM(remaining_usd), 0) FROM sim_batches WHERE sim_id = ?) WHERE id = ? AND shop_id = ?',
                    [meta.simId, meta.simId, shopId]
                );
            }

            // 12. عكس حركات المحافظ المباشرة (إيداع / سحب / تحويل / صرافة)
            if (meta.kind === 'wallet_deposit' && meta.walletId) {
                const isLBP = meta.currency === 'LBP';
                await conn.query(
                    'UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                    [isLBP ? meta.amount : 0, !isLBP ? meta.amount : 0, meta.walletId, shopId]
                );
                if (meta.ledgerId) {
                    await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                }
            } else if (meta.kind === 'wallet_withdrawal' && meta.walletId) {
                const isLBP = meta.currency === 'LBP';
                await conn.query(
                    'UPDATE sources SET balance_lbp = balance_lbp + ?, balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?',
                    [isLBP ? meta.amount : 0, !isLBP ? meta.amount : 0, meta.walletId, shopId]
                );
                if (meta.ledgerId) {
                    await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.ledgerId]);
                }
            } else if ((meta.kind === 'wallet_transfer' || meta.kind === 'fx_exchange') && meta.fromWalletId) {
                const isFromLBP = meta.fromCurrency === 'LBP';
                const isToLBP = meta.toCurrency === 'LBP';
                await conn.query(
                    'UPDATE sources SET balance_lbp = balance_lbp + ?, balance_usd = balance_usd + ? WHERE id = ? AND shop_id = ?',
                    [isFromLBP ? meta.fromAmount : 0, !isFromLBP ? meta.fromAmount : 0, meta.fromWalletId, shopId]
                );
                await conn.query(
                    'UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                    [isToLBP ? meta.toAmount : 0, !isToLBP ? meta.toAmount : 0, meta.toWalletId, shopId]
                );
                if (meta.outLedgerId) {
                    await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.outLedgerId]);
                }
                if (meta.inLedgerId) {
                    await conn.query('DELETE FROM source_ledger WHERE shop_id = ? AND id = ?', [shopId, meta.inLedgerId]);
                }
            }

            await conn.query('DELETE FROM sales_history WHERE id = ? AND shop_id = ?', [opId, shopId]);
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('Rollback error:', err);
        res.status(500).json({ message: 'فشل التراجع عن العملية' });
    } finally {
        conn.release();
    }
});

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

router.post('/expense', async (req, res) => {
    const shopId = req.shopId;
    const { title, amount, currency, sourceWalletId, notes } = req.body;
    const expId = `exp_${Date.now()}`;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const numAmt = parseFloat(amount) || 0;
        const curr = currency === 'LBP' ? 'LBP' : 'USD';
        const isLBP = curr === 'LBP';

        await conn.query(
            'INSERT INTO expenses (id, shop_id, title, amount, currency, source_wallet_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [expId, shopId, title, numAmt, curr, sourceWalletId || null, notes || '']
        );

        let ledgerId = null;
        let walletName = 'صندوق عام';

        if (sourceWalletId) {
            const [wRows] = await conn.query('SELECT name FROM sources WHERE id = ? AND shop_id = ?', [sourceWalletId, shopId]);
            if (wRows[0]?.name) walletName = wRows[0].name;

            await conn.query(
                'UPDATE sources SET balance_lbp = GREATEST(0, balance_lbp - ?), balance_usd = GREATEST(0, balance_usd - ?) WHERE id = ? AND shop_id = ?',
                [isLBP ? numAmt : 0, !isLBP ? numAmt : 0, sourceWalletId, shopId]
            );
            ledgerId = `tx_exp_${Date.now()}`;
            await conn.query(
                `INSERT INTO source_ledger (id, shop_id, source_id, type, item_name, amount, currency, balance_after_usd, balance_after_lbp)
         VALUES (?, ?, ?, 'withdrawal', ?, ?, ?,
           (SELECT balance_usd FROM sources WHERE id = ?),
           (SELECT balance_lbp FROM sources WHERE id = ?)
         )`,
                [ledgerId, shopId, sourceWalletId, `مصروف: ${title}`, numAmt, curr, sourceWalletId, sourceWalletId]
            );
        }

        const explanation = sourceWalletId
            ? `تم تسجيل مصروف "${title}" بقيمة ${numAmt.toLocaleString()} ${curr} وخُصم من محفظة "${walletName}"${notes ? ` (${notes})` : ''}.`
            : `تم تسجيل مصروف عام "${title}" بقيمة ${numAmt.toLocaleString()} ${curr}${notes ? ` (${notes})` : ''}.`;

        const meta = {
            kind: 'expense',
            expId,
            sourceWalletId: sourceWalletId || null,
            amount: numAmt,
            currency: curr,
            ledgerId
        };

        await conn.query(
            `INSERT INTO sales_history (id, shop_id, type, title, item_name, selling_price, currency, cost_usd, profit_usd, customer_name, is_debt, payment_type, notes, explanation, meta_json)
       VALUES (?, ?, 'expense', ?, ?, ?, ?, 0, 0, ?, 0, 'cash', ?, ?, ?)`,
            [
                `op_exp_${Date.now()}`, shopId,
                `مصروف: ${title}`,
                `مصروف: ${title}`,
                numAmt, curr, walletName, notes || '', explanation, JSON.stringify(meta)
            ]
        );

        await conn.commit();
        res.status(201).json({ success: true, id: expId });
    } catch (err) {
        await conn.rollback();
        console.error('Expense error:', err);
        res.status(500).json({ message: 'فشل تسجيل المصروف' });
    } finally {
        conn.release();
    }
});

module.exports = router;