// أدوات مشتركة بين وحدات عمليات المتجر (مستخرجة من server/routes/operations.js دون أي تغيير في المنطق)

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

module.exports = { formatDateOnly, settleBoxDebts };
