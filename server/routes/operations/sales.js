const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { settleBoxDebts } = require('./helpers');

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
            if (req.body.alfaSynced === true) {
                explanation += ' ✅ تمت مزامنة المشترك مع موقع Alfa Self-Care تلقائياً.';
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

module.exports = router;
