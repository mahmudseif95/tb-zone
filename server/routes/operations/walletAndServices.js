const express = require('express');
const router = express.Router();
const pool = require('../../db');

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
