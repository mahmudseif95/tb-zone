import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import {
    X,
    CheckCircle2,
    User,
    Building2,
    Search,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';

const CUSTOM_CARD_TIERS = {
    ALFA: [
        { id: 'alfa_3_03', credit: 3.03, costUSD: 3.59, costLBP: 321015, days: 13, label: '$3.03 (صلاحية 13 يوم)' },
        { id: 'alfa_4_50', credit: 4.50, costUSD: 5.22, costLBP: 467053, days: 17, label: '$4.50 (صلاحية 17 يوم)' },
        { id: 'alfa_7_58', credit: 7.58, costUSD: 8.64, costLBP: 773035, days: 35, label: '$7.58 (صلاحية 35 يوم)' },
        { id: 'alfa_10_00', credit: 10.00, costUSD: 11.33, costLBP: 1013450, days: 35, label: '$10.00 (صلاحية 35 يوم)' },
        { id: 'alfa_15_15', credit: 15.15, costUSD: 17.50, costLBP: 1525077, days: 65, label: '$15.15 (صلاحية 65 يوم)' },
        { id: 'alfa_22_73', credit: 22.73, costUSD: 25.46, costLBP: 2278112, days: 95, label: '$22.73 (صلاحية 95 يوم)' },
        { id: 'alfa_year', credit: 77.28, costUSD: 86.50, costLBP: 7697382, days: 365, label: 'كارت سنة $77.28 (365 يوم)' }
    ],
    TOUCH: [
        { id: 'touch_3_03', credit: 3.03, costUSD: 3.59, costLBP: 321015, days: 7, label: '$3.03 (صلاحية 7 أيام)' },
        { id: 'touch_4_50', credit: 4.50, costUSD: 5.22, costLBP: 467053, days: 14, label: '$4.50 Magic Start (14 يوم)' },
        { id: 'touch_7_58', credit: 7.58, costUSD: 8.64, costLBP: 773035, days: 30, label: '$7.58 (صلاحية 30 يوم)' },
        { id: 'touch_10_00', credit: 10.00, costUSD: 11.33, costLBP: 1013450, days: 30, label: '$10.00 (صلاحية 30 يوم)' },
        { id: 'touch_17_00', credit: 17.00, costUSD: 19.50, costLBP: 1745250, days: 60, label: '$17.00 (صلاحية 60 يوم)' },
        { id: 'touch_22_73', credit: 22.73, costUSD: 25.46, costLBP: 2278112, days: 95, label: '$22.73 (صلاحية 95 يوم)' },
        { id: 'touch_45_45', credit: 45.45, costUSD: 50.80, costLBP: 4546600, days: 180, label: '$45.45 (صلاحية 180 يوم)' },
        { id: 'touch_year', credit: 77.28, costUSD: 86.01, costLBP: 7697895, days: 365, label: 'كارت سنة $77.28 (365 يوم)' }
    ]
};

// حساب أيام الصلاحية المتبقية فعلياً على الخط
const getLineRemainingDays = (line) => {
    if (!line) return 0;
    const total = parseInt(line.validityDays || 0, 10);
    if (!line.validityStartDate) return total;
    const start = new Date(line.validityStartDate);
    if (isNaN(start.getTime())) return total;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const elapsed = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));
    return Math.max(0, total - elapsed);
};

export default function WalletTxModal({
    wallet,
    sources = [],
    customers = [],
    lines = [],
    sims = [],
    exchangeRate = 89500,
    onRecordWalletTx,
    onRefreshData,
    onSwitchToDaysYear,
    onClose
}) {
    const otherWallets = sources.filter(s => s.id !== wallet.id);
    const defaultTier = CUSTOM_CARD_TIERS.ALFA.find(t => t.id === 'alfa_22_73') || CUSTOM_CARD_TIERS.ALFA[5];

    const [step, setStep] = useState('tx'); // 'tx' | 'customer_step'
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [txForm, setTxForm] = useState({
        type: 'deposit',
        amount: '',
        currency: 'USD',
        targetWalletId: otherWallets[0]?.id || '',
        fxRate: exchangeRate.toString(),
        costPrice: '',
        costCurrency: 'USD',
        itemName: '',
        notes: '',

        cardOperator: 'ALFA',
        selectedTierId: defaultTier.id,
        cardCostUSD: defaultTier.costUSD.toString(),
        cardCostLBP: defaultTier.costLBP.toString(),
        cardPayCurrency: 'USD',
        cardDestination: 'locked', // 'locked' | 'open_admin' | 'sim' | 'direct'
        targetClosedLineId: '',
        targetSimId: '',
        lineSearchQuery: '',
        isLineSearchOpen: false,

        adminSelectMode: 'new', // 'new' | 'existing_line'
        targetOpenLineId: '',
        adminName: '',
        adminPhone: '',
        adminAddress: '',
        adminGB: '22',
        adminPrice: '',
        adminLinePhone: '',

        directPhone: '',
        directCustomerName: '',
        directSellingPrice: '',
        directSellingCurrency: 'USD'
    });

    const [customerType, setCustomerType] = useState('customers');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [paymentType, setPaymentType] = useState('cash');
    const [partialPaidAmount, setPartialPaidAmount] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [adminCustomerSuggestions, setAdminCustomerSuggestions] = useState([]);

    const lockedLinesOnly = lines.filter(l => (l.type || 'locked') === 'locked');
    const openLinesOnly = lines.filter(l => l.type === 'open');
    const operatorSims = sims.filter(s => (s.operator || '').toLowerCase() === txForm.cardOperator.toLowerCase());

    const filteredClosedLines = lockedLinesOnly.filter(line => {
        const q = (txForm.lineSearchQuery || '').toLowerCase().trim();
        if (!q) return true;
        const slotStr = (line.slotNumber || '').toString();
        const phoneStr = (line.phoneNumber || line.number || '').toString();
        return slotStr.includes(q) || phoneStr.includes(q);
    });

    const selectedClosedLineObj = lines.find(l => l.id === txForm.targetClosedLineId);
    const selectedOpenLineObj = lines.find(l => l.id === txForm.targetOpenLineId);

    // حساب فائض الأيام عن سقف الـ 365 يوماً للخط المختار
    const activeCardTiers = CUSTOM_CARD_TIERS[txForm.cardOperator] || CUSTOM_CARD_TIERS.ALFA;
    const selectedTierObj = activeCardTiers.find(t => t.id === txForm.selectedTierId) || activeCardTiers[5];
    const targetValidityLine =
        txForm.cardDestination === 'locked'
            ? selectedClosedLineObj
            : (txForm.cardDestination === 'open_admin' && txForm.adminSelectMode === 'existing_line'
                ? selectedOpenLineObj
                : null);

    const currentLineDays = targetValidityLine ? getLineRemainingDays(targetValidityLine) : 0;
    const projectedTotalDays = currentLineDays + (selectedTierObj?.days || 0);
    const wastedValidityDays = targetValidityLine && projectedTotalDays > 365 ? projectedTotalDays - 365 : 0;
    const maxAllowedDaysToAdd = Math.max(0, 365 - currentLineDays);

    const handleCardTierChange = (tierId, operator) => {
        const tiers = CUSTOM_CARD_TIERS[operator] || CUSTOM_CARD_TIERS.ALFA;
        const tier = tiers.find(t => t.id === tierId) || tiers[0];
        setTxForm(prev => ({
            ...prev,
            selectedTierId: tierId,
            cardCostUSD: tier.costUSD.toString(),
            cardCostLBP: tier.costLBP.toString()
        }));
    };

    const handleAdminCustomerSearch = (query) => {
        setTxForm(prev => ({ ...prev, adminName: query }));
        if (!query.trim()) {
            setAdminCustomerSuggestions([]);
            return;
        }
        const clean = query.toLowerCase().trim();
        setAdminCustomerSuggestions(
            customers.filter(c => c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean)))
        );
    };

    const handleSelectAdminCustomer = (c) => {
        setTxForm(prev => ({
            ...prev,
            adminName: c.name,
            adminPhone: c.phone || prev.adminPhone,
            adminAddress: c.address || prev.adminAddress
        }));
        setAdminCustomerSuggestions([]);
    };

    const handleInitialTxSubmit = async (e) => {
        e.preventDefault();
        if (!wallet || isSubmitting) return;

        const curUSD = parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0);
        const curLBP = parseFloat(wallet.balanceLBP || 0);
        const amt = parseFloat(txForm.amount) || 0;

        // 1. تحويل بين المحافظ
        if (txForm.type === 'transfer') {
            if (amt <= 0) return alert('يرجى إدخال مبلغ صالح للتحويل!');
            if (!txForm.targetWalletId) return alert('يرجى اختيار المحفظة المستقبلة!');
            if (txForm.currency === 'USD' && amt > curUSD) return alert('رصيد الدولار غير كافٍ لإتمام التحويل!');
            if (txForm.currency === 'LBP' && amt > curLBP) return alert('رصيد الليرة غير كافٍ لإتمام التحويل!');

            const targetW = sources.find(s => s.id === txForm.targetWalletId);
            const targetName = targetW ? targetW.name : 'محفظة أخرى';

            try {
                setIsSubmitting(true);
                await api.walletTransfer({
                    fromWalletId: wallet.id,
                    toWalletId: txForm.targetWalletId,
                    amount: amt,
                    currency: txForm.currency,
                    convertedAmount: amt,
                    toCurrency: txForm.currency,
                    notes: txForm.notes || `تحويل من ${wallet.name} إلى ${targetName}`
                });
                if (onRefreshData) await onRefreshData();
                alert(`تم تحويل ${amt.toLocaleString()} ${txForm.currency} بنجاح من "${wallet.name}" إلى "${targetName}"!`);
                onClose();
            } catch (err) {
                alert('فشل تنفيذ التحويل في السيرفر: ' + err.message);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // 2. صرافة وتصريف عملة FX
        if (txForm.type === 'exchange') {
            if (amt <= 0) return alert('يرجى إدخال مبلغ صالح للتصريف!');
            const rate = parseFloat(txForm.fxRate) || exchangeRate;

            if (txForm.currency === 'USD' && amt > curUSD) return alert('رصيد الدولار لا يكفي للتصريف!');
            if (txForm.currency === 'LBP' && amt > curLBP) return alert('رصيد الليرة لا يكفي للتصريف!');

            const isFromUSD = txForm.currency === 'USD';
            const convertedAmount = isFromUSD ? Math.round(amt * rate) : parseFloat((amt / rate).toFixed(2));
            const toCurrency = isFromUSD ? 'LBP' : 'USD';

            try {
                setIsSubmitting(true);
                await api.walletTransfer({
                    fromWalletId: wallet.id,
                    toWalletId: wallet.id,
                    amount: amt,
                    currency: txForm.currency,
                    convertedAmount,
                    toCurrency,
                    notes: `صرافة داخلية بسعر ${rate.toLocaleString()} (${amt.toLocaleString()} ${txForm.currency} ➔ ${convertedAmount.toLocaleString()} ${toCurrency})`
                });
                if (onRefreshData) await onRefreshData();
                alert(`تمت عملية الصرافة بنجاح! خُصم ${amt.toLocaleString()} ${txForm.currency} وأُضيف ${convertedAmount.toLocaleString()} ${toCurrency}.`);
                onClose();
            } catch (err) {
                alert('فشل تنفيذ الصرافة في السيرفر: ' + err.message);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // 3. شراء كارت موحد مع فحص سقف الـ 365 يوماً
        if (txForm.type === 'buy_card') {
            const currentTier = selectedTierObj;

            const finalCostUSD = parseFloat(txForm.cardCostUSD) || currentTier.costUSD;
            const finalCostLBP = parseFloat(txForm.cardCostLBP) || currentTier.costLBP;
            const isPayLBP = txForm.cardPayCurrency === 'LBP';
            const deductAmount = isPayLBP ? finalCostLBP : finalCostUSD;

            if (!isPayLBP && curUSD < finalCostUSD) {
                return alert(`رصيد الدولار في المحفظة غير كافٍ! المطلوب: $${finalCostUSD.toFixed(2)}، المتوفر: $${curUSD.toFixed(2)}`);
            }
            if (isPayLBP && curLBP < finalCostLBP) {
                return alert(`رصيد الليرة في المحفظة غير كافٍ! المطلوب: ${finalCostLBP.toLocaleString()} ل.ل، المتوفر: ${Math.round(curLBP).toLocaleString()} ل.ل`);
            }

            if (txForm.cardDestination === 'locked' && !selectedClosedLineObj) {
                return alert('يرجى تحديد الخط المسكر المستهدف للشحن!');
            }
            if (txForm.cardDestination === 'open_admin') {
                if (txForm.adminSelectMode === 'new' && !txForm.adminName.trim()) {
                    return alert('يرجى إدخال اسم الأدمن المسؤول عن الخط المفتوح!');
                }
                if (txForm.adminSelectMode === 'existing_line' && !selectedOpenLineObj) {
                    return alert('يرجى اختيار خط الأدمن القائم للشحن!');
                }
            }
            if (txForm.cardDestination === 'sim' && !txForm.targetSimId) {
                return alert('يرجى اختيار الشريحة الأساسية المستهدفة للشحن!');
            }
            if (txForm.cardDestination === 'direct' && !txForm.directPhone.trim()) {
                return alert('يرجى إدخال رقم الهاتف المراد شحن الكارت له مباشرة!');
            }

            // تنبيه صارم إذا تجاوز مجموع أيام الصلاحية سقف الـ 365 يوماً
            if (wastedValidityDays > 0) {
                const proceed = window.confirm(
                    `⚠️ تنبيه سقف الصلاحية (365 يوم)!\n\n` +
                    `هذا الخط يملك حالياً (${currentLineDays} يوم) صلاحية، وإضافة كارت (${currentTier.days} يوم) ستجعل المجموع (${projectedTotalDays} يوم).\n` +
                    `بما أن الحد الأقصى للصلاحية هو 365 يوماً فقط، سيضيع عليك (${wastedValidityDays} يوم) على الفاضي!\n\n` +
                    `• اضغط (Cancel / إلغاء) لاختيار خط آخر أو فئة كارت أصغر.\n` +
                    `• اضغط (OK / موافق) للمتابعة وتثبيت الصلاحية على 365 يوماً.`
                );
                if (!proceed) return;
            }

            const creditToAdd = currentTier.credit;
            const daysToAdd = currentTier.days;

            try {
                setIsSubmitting(true);
                await api.buyCard({
                    walletId: wallet.id,
                    operator: txForm.cardOperator,
                    credit: creditToAdd,
                    days: daysToAdd,
                    deductAmount,
                    payCurrency: txForm.cardPayCurrency,
                    destination: txForm.cardDestination,
                    targetLineId:
                        txForm.cardDestination === 'locked'
                            ? selectedClosedLineObj.id
                            : (txForm.cardDestination === 'open_admin' && txForm.adminSelectMode === 'existing_line'
                                ? selectedOpenLineObj.id
                                : null),
                    targetSimId: txForm.cardDestination === 'sim' ? txForm.targetSimId : null,
                    adminSelectMode: txForm.adminSelectMode,
                    adminName: txForm.adminName,
                    adminPhone: txForm.adminPhone,
                    adminAddress: txForm.adminAddress,
                    adminGB: txForm.adminGB,
                    adminPrice: txForm.adminPrice,
                    adminLinePhone: txForm.adminLinePhone,
                    directPhone: txForm.directPhone,
                    directCustomerName: txForm.directCustomerName,
                    directSellingPrice: parseFloat(txForm.directSellingPrice) || 0,
                    directSellingCurrency: txForm.directSellingCurrency,
                    exchangeRate
                });

                if (onRefreshData) await onRefreshData();
                alert(`تم شراء وتوجيه كارت ${txForm.cardOperator} ($${creditToAdd}) بنجاح وتسجيل العملية في السجل العام!`);
                onClose();
            } catch (err) {
                alert('حدث خطأ أثناء تنفيذ شراء الكارت: ' + err.message);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (amt <= 0) return alert('يرجى إدخال مبلغ صالح!');

        if (txForm.type === 'withdrawal') {
            if (txForm.currency === 'USD' && amt > curUSD) return alert('رصيد الدولار غير كافٍ!');
            if (txForm.currency === 'LBP' && amt > curLBP) return alert('رصيد الليرة غير كافٍ!');
        }

        if (txForm.type === 'sale') {
            setCustomerType('customers');
            setCustomerName('');
            setCustomerPhone('');
            setCustomerAddress('');
            setPaymentType('cash');
            setPartialPaidAmount('');
            setCustomerSuggestions([]);
            setStep('customer_step');
        } else {
            try {
                setIsSubmitting(true);
                await onRecordWalletTx(wallet.id, {
                    type: txForm.type,
                    amount: amt,
                    currency: txForm.currency,
                    itemName: txForm.itemName || (txForm.type === 'deposit' ? `إيداع نقدي (${txForm.currency})` : `سحب نقدي (${txForm.currency})`),
                    customerName: 'حركة مباشرة',
                    notes: txForm.notes || ''
                });
                onClose();
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleCustomerSearch = (query) => {
        setCustomerName(query);
        if (!query.trim()) {
            setCustomerSuggestions([]);
            return;
        }
        const clean = query.toLowerCase().trim();
        setCustomerSuggestions(
            customers.filter(c => c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean)))
        );
    };

    const handleSelectCustomer = (c) => {
        setCustomerName(c.name);
        setCustomerPhone(c.phone || '');
        setCustomerAddress(c.address || '');
        setCustomerSuggestions([]);
    };

    const rawSaleTotal = parseFloat(txForm.amount) || 0;
    const remainingDebtAmount = paymentType === 'debt'
        ? rawSaleTotal
        : paymentType === 'partial'
            ? Math.max(0, rawSaleTotal - (parseFloat(partialPaidAmount) || 0))
            : 0;

    const handleFinalSaleConfirm = async (e) => {
        e.preventDefault();
        if (!customerName.trim() || isSubmitting) {
            if (!customerName.trim()) alert('يرجى كتابة اسم العميل!');
            return;
        }

        const saleInUSD = txForm.currency === 'LBP' ? (rawSaleTotal / exchangeRate) : rawSaleTotal;
        let costUSD = 0;
        if (txForm.costPrice && parseFloat(txForm.costPrice) > 0) {
            const rawCost = parseFloat(txForm.costPrice);
            costUSD = txForm.costCurrency === 'LBP' ? (rawCost / exchangeRate) : rawCost;
        }
        const netProfitUSD = Math.max(0, saleInUSD - costUSD);

        try {
            setIsSubmitting(true);
            await onRecordWalletTx(wallet.id, {
                type: 'sale',
                amount: rawSaleTotal,
                sellingPrice: rawSaleTotal,
                currency: txForm.currency,
                costUSD: parseFloat(costUSD.toFixed(2)),
                profitUSD: parseFloat(netProfitUSD.toFixed(2)),
                itemName: txForm.itemName || 'عملية بيع عامة',
                customerType,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                customerAddress: customerAddress.trim(),
                paymentType,
                paidAmount: paymentType === 'cash' ? rawSaleTotal : (parseFloat(partialPaidAmount) || 0),
                remainingDebt: remainingDebtAmount,
                isDebt: remainingDebtAmount > 0,
                notes: txForm.notes || '',
                date: new Date().toISOString()
            });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    if (step === 'customer_step') {
        return createPortal(
            <div className="modal-overlay">
                <div className="modal-center" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>بيانات العميل وطريقة الدفع</h3>
                            <span style={{ fontSize: '11px', color: 'var(--orange-primary)' }}>
                                المبيع: {rawSaleTotal.toLocaleString()} {txForm.currency === 'LBP' ? 'ل.ل' : '$'}
                            </span>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                    </div>

                    <form onSubmit={handleFinalSaleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setCustomerType('customers')}
                                style={{
                                    padding: '8px',
                                    borderRadius: '10px',
                                    border: customerType === 'customers' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                    background: customerType === 'customers' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                                    color: customerType === 'customers' ? 'var(--orange-primary)' : 'var(--text-main)',
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                }}
                            >
                                <User size={13} />
                                <span>زبون عادي</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCustomerType('merchants')}
                                style={{
                                    padding: '8px',
                                    borderRadius: '10px',
                                    border: customerType === 'merchants' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                    background: customerType === 'merchants' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                                    color: customerType === 'merchants' ? 'var(--orange-primary)' : 'var(--text-main)',
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Building2 size={13} />
                                <span>تاجر / محل</span>
                            </button>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {customerType === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم الزبون:'}
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="ابحث بالاسم أو الرقم..."
                                className="tz-input"
                                value={customerName}
                                onChange={e => handleCustomerSearch(e.target.value)}
                                autoFocus
                                autoComplete="off"
                                style={{ marginTop: '2px' }}
                            />

                            {customerSuggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--bg-card)',
                                    border: '1.5px solid var(--orange-primary)',
                                    borderRadius: '12px',
                                    zIndex: 110,
                                    maxHeight: '140px',
                                    overflowY: 'auto',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                    marginTop: '2px'
                                }}>
                                    {customerSuggestions.map(cust => (
                                        <div
                                            key={cust.id}
                                            onClick={() => handleSelectCustomer(cust)}
                                            style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}
                                        >
                                            <span style={{ fontWeight: 'bold' }}>{cust.name}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{cust.phone}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رقم الهاتف:</label>
                                <input
                                    type="tel"
                                    placeholder="الهاتف..."
                                    className="tz-input"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    style={{ marginTop: '2px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>العنوان / المنطقة:</label>
                                <input
                                    type="text"
                                    placeholder="العنوان..."
                                    className="tz-input"
                                    value={customerAddress}
                                    onChange={e => setCustomerAddress(e.target.value)}
                                    style={{ marginTop: '2px' }}
                                />
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>طريقة الدفع:</span>
                                <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                    المبلغ: {rawSaleTotal.toLocaleString()} {txForm.currency === 'LBP' ? 'ل.ل' : '$'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setPaymentType('cash')}
                                    style={{
                                        padding: '6px 4px',
                                        borderRadius: '8px',
                                        border: paymentType === 'cash' ? '1.5px solid var(--green)' : '1px solid var(--border-color)',
                                        background: paymentType === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                        color: paymentType === 'cash' ? 'var(--green)' : 'var(--text-main)',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    كاش نقداً
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentType('partial')}
                                    style={{
                                        padding: '6px 4px',
                                        borderRadius: '8px',
                                        border: paymentType === 'partial' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                        background: paymentType === 'partial' ? 'rgba(255, 122, 0, 0.15)' : 'transparent',
                                        color: paymentType === 'partial' ? 'var(--orange-primary)' : 'var(--text-main)',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    دفع جزئي
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentType('debt')}
                                    style={{
                                        padding: '6px 4px',
                                        borderRadius: '8px',
                                        border: paymentType === 'debt' ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                                        background: paymentType === 'debt' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                        color: paymentType === 'debt' ? 'var(--red)' : 'var(--text-main)',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    آجل (دين)
                                </button>
                            </div>

                            {paymentType === 'partial' && (
                                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="المبلغ المدفوع كاش..."
                                        className="tz-input"
                                        style={{ height: '36px', fontSize: '11px', flex: 1 }}
                                        value={partialPaidAmount}
                                        onChange={e => setPartialPaidAmount(e.target.value)}
                                        required
                                    />
                                    <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 'bold' }}>
                                        المتبقي كدين: {remainingDebtAmount.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary"
                            style={{ marginTop: '6px', height: '44px', opacity: isSubmitting ? 0.6 : 1 }}
                        >
                            <CheckCircle2 size={16} />
                            <span>{isSubmitting ? 'جاري التسجيل...' : 'تأكيد وتسجيل العملية'}</span>
                        </button>
                    </form>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-center" style={{ maxWidth: '420px', maxHeight: '88vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>حركة على: {wallet.name}</h3>
                        <div style={{ fontSize: '11px', color: 'var(--orange-primary)', fontWeight: 'bold' }}>
                            متوفر: ${parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0).toFixed(2)} • {Math.round(parseFloat(wallet.balanceLBP || 0)).toLocaleString()} ل.ل
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <form onSubmit={handleInitialTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>نوع المعاملة:</label>
                        <select
                            className="tz-select"
                            value={txForm.type}
                            onChange={e => {
                                const newType = e.target.value;
                                if (newType === 'days_year') {
                                    onSwitchToDaysYear();
                                    return;
                                }
                                const defTier = CUSTOM_CARD_TIERS.ALFA.find(t => t.id === 'alfa_22_73') || CUSTOM_CARD_TIERS.ALFA[5];
                                setTxForm({
                                    ...txForm,
                                    type: newType,
                                    currency: newType === 'exchange' ? 'LBP' : txForm.currency,
                                    amount: '',
                                    selectedTierId: defTier.id,
                                    cardCostUSD: defTier.costUSD.toString(),
                                    cardCostLBP: defTier.costLBP.toString()
                                });
                            }}
                        >
                            <option value="deposit">📥 إيداع مباشر في المحفظة (+)</option>
                            <option value="withdrawal">📤 سحب مباشر من المحفظة (-)</option>
                            <option value="transfer">🔄 تحويل كاش إلى محفظة أخرى</option>
                            <option value="exchange">💱 صرافة وتصريف عملة (FX)</option>
                            <option value="buy_card">📱 شراء كارت</option>
                            <option value="sale">⚡ عملية بيع عامة (+)</option>
                            <option value="days_year">⚡ شراء وبيع سنة أيام Alfa</option>
                        </select>
                    </div>

                    {/* 1. إيداع أو سحب مباشر */}
                    {(txForm.type === 'deposit' || txForm.type === 'withdrawal') && (
                        <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المراد {txForm.type === 'deposit' ? 'إيداعه' : 'سحبه'}:</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="0.00"
                                        className="tz-input"
                                        value={txForm.amount}
                                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                                    <select
                                        className="tz-select"
                                        value={txForm.currency}
                                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                                        style={{ marginTop: '2px' }}
                                    >
                                        <option value="USD">دولار ($)</option>
                                        <option value="LBP">ليرة (LBP)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>البيان / ملاحظة (اختياري):</label>
                                <input
                                    type="text"
                                    placeholder="مثال: تغذية صندوق من زبون / سحب شخصي..."
                                    className="tz-input"
                                    value={txForm.notes}
                                    onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* 2. تحويل بين المحافظ */}
                    {txForm.type === 'transfer' && (
                        <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>تحويل إلى محفظة:</label>
                                <select
                                    className="tz-select"
                                    value={txForm.targetWalletId}
                                    onChange={e => setTxForm({ ...txForm, targetWalletId: e.target.value })}
                                    required
                                >
                                    {otherWallets.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.name} (رصيدها: ${w.balanceUSD || 0} • {Math.round(w.balanceLBP || 0).toLocaleString()} ل.ل)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المراد تحويله:</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="0.00"
                                        className="tz-input"
                                        value={txForm.amount}
                                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                                    <select
                                        className="tz-select"
                                        value={txForm.currency}
                                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                                        style={{ marginTop: '2px' }}
                                    >
                                        <option value="USD">دولار ($)</option>
                                        <option value="LBP">ليرة (LBP)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ملاحظات التحويل:</label>
                                <input
                                    type="text"
                                    placeholder="بيان حركة التحويل..."
                                    className="tz-input"
                                    value={txForm.notes}
                                    onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* 3. صرافة وتصريف عملة FX */}
                    {txForm.type === 'exchange' && (
                        <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--green)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '6px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المراد تصريفه (البيع):</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="المبلغ"
                                        className="tz-input"
                                        value={txForm.amount}
                                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة المصروفة:</label>
                                    <select
                                        className="tz-select"
                                        value={txForm.currency}
                                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                                        style={{ marginTop: '2px' }}
                                    >
                                        <option value="USD">دولار (بيع $ وقبض L.L)</option>
                                        <option value="LBP">ليرة (بيع L.L وقبض $)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر الصرف المعتمد للعملية:</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    className="tz-input"
                                    value={txForm.fxRate}
                                    onChange={e => setTxForm({ ...txForm, fxRate: e.target.value })}
                                    style={{ marginTop: '2px', fontWeight: 'bold' }}
                                />
                            </div>

                            {(() => {
                                const amtVal = parseFloat(txForm.amount) || 0;
                                const r = parseFloat(txForm.fxRate) || exchangeRate;
                                const resultText = txForm.currency === 'USD'
                                    ? `ستقبض بالمقابل: ${Math.round(amtVal * r).toLocaleString()} ل.ل`
                                    : `ستقبض بالمقابل: $${(r > 0 ? (amtVal / r) : 0).toFixed(2)}`;

                                return (
                                    <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '10px', border: '1px dashed var(--border-color)', fontSize: '11px', color: 'var(--green)', fontWeight: 'bold' }}>
                                        {resultText}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* 4. شراء كارت */}
                    {txForm.type === 'buy_card' && (
                        <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>الشبكة:</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                    {['ALFA', 'TOUCH'].map(op => (
                                        <button
                                            key={op}
                                            type="button"
                                            className="tz-input"
                                            style={{
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                borderColor: txForm.cardOperator === op ? 'var(--orange-primary)' : 'var(--border-color)',
                                                background: txForm.cardOperator === op ? 'var(--orange-subtle)' : 'transparent',
                                                color: txForm.cardOperator === op ? 'var(--orange-primary)' : 'inherit'
                                            }}
                                            onClick={() => {
                                                const defTierId = op === 'ALFA' ? 'alfa_22_73' : 'touch_22_73';
                                                setTxForm(prev => ({ ...prev, cardOperator: op, targetSimId: '' }));
                                                handleCardTierChange(defTierId, op);
                                            }}
                                        >
                                            {op === 'ALFA' ? 'ألفا (Alfa)' : 'تاتش (Touch)'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>فئة الكارت:</label>
                                <select
                                    className="tz-select"
                                    style={{ marginTop: '4px', fontWeight: 'bold' }}
                                    value={txForm.selectedTierId}
                                    onChange={e => handleCardTierChange(e.target.value, txForm.cardOperator)}
                                >
                                    {(CUSTOM_CARD_TIERS[txForm.cardOperator] || CUSTOM_CARD_TIERS.ALFA).map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>خصم التكلفة من رصيد:</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        type="button"
                                        className="tz-input"
                                        style={{
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            borderColor: txForm.cardPayCurrency === 'USD' ? 'var(--orange-primary)' : 'var(--border-color)',
                                            background: txForm.cardPayCurrency === 'USD' ? 'var(--orange-subtle)' : 'transparent',
                                            color: txForm.cardPayCurrency === 'USD' ? 'var(--orange-primary)' : 'inherit'
                                        }}
                                        onClick={() => setTxForm({ ...txForm, cardPayCurrency: 'USD' })}
                                    >
                                        رصيد الدولار ($)
                                    </button>
                                    <button
                                        type="button"
                                        className="tz-input"
                                        style={{
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            borderColor: txForm.cardPayCurrency === 'LBP' ? 'var(--orange-primary)' : 'var(--border-color)',
                                            background: txForm.cardPayCurrency === 'LBP' ? 'var(--orange-subtle)' : 'transparent',
                                            color: txForm.cardPayCurrency === 'LBP' ? 'var(--orange-primary)' : 'inherit'
                                        }}
                                        onClick={() => setTxForm({ ...txForm, cardPayCurrency: 'LBP' })}
                                    >
                                        رصيد الليرة (LBP)
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px dashed var(--orange-primary)' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)', display: 'block', marginBottom: '6px' }}>
                                    تكلفة الشراء الفعلية ({txForm.cardPayCurrency === 'USD' ? 'بالدولار $' : 'بالليرة اللبنانية LBP'}):
                                </label>
                                {txForm.cardPayCurrency === 'USD' ? (
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        style={{ fontWeight: 'bold', color: 'var(--orange-primary)', height: '42px', fontSize: '14px' }}
                                        value={txForm.cardCostUSD}
                                        onChange={e => setTxForm(prev => ({ ...prev, cardCostUSD: e.target.value }))}
                                    />
                                ) : (
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        style={{ fontWeight: 'bold', height: '42px', fontSize: '14px' }}
                                        value={txForm.cardCostLBP}
                                        onChange={e => setTxForm(prev => ({ ...prev, cardCostLBP: e.target.value }))}
                                    />
                                )}
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                    وجهة الكارت المشحون:
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    <button
                                        type="button"
                                        className="tz-input"
                                        style={{
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            padding: '0 6px',
                                            borderColor: txForm.cardDestination === 'locked' ? 'var(--orange-primary)' : 'var(--border-color)',
                                            background: txForm.cardDestination === 'locked' ? 'var(--orange-subtle)' : 'transparent',
                                            color: txForm.cardDestination === 'locked' ? 'var(--orange-primary)' : 'inherit'
                                        }}
                                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'locked' }))}
                                    >
                                        🔒 خط مسكر
                                    </button>
                                    <button
                                        type="button"
                                        className="tz-input"
                                        style={{
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            padding: '0 6px',
                                            borderColor: txForm.cardDestination === 'open_admin' ? 'var(--orange-primary)' : 'var(--border-color)',
                                            background: txForm.cardDestination === 'open_admin' ? 'var(--orange-subtle)' : 'transparent',
                                            color: txForm.cardDestination === 'open_admin' ? 'var(--orange-primary)' : 'inherit'
                                        }}
                                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'open_admin' }))}
                                    >
                                        👑 خط أدمن
                                    </button>
                                    <button
                                        type="button"
                                        className="tz-input"
                                        style={{
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            padding: '0 6px',
                                            borderColor: txForm.cardDestination === 'sim' ? 'var(--orange-primary)' : 'var(--border-color)',
                                            background: txForm.cardDestination === 'sim' ? 'var(--orange-subtle)' : 'transparent',
                                            color: txForm.cardDestination === 'sim' ? 'var(--orange-primary)' : 'inherit'
                                        }}
                                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'sim' }))}
                                    >
                                        📱 شريحة أساسية (SIM)
                                    </button>
                                    <button
                                        type="button"
                                        className="tz-input"
                                        style={{
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            padding: '0 6px',
                                            borderColor: txForm.cardDestination === 'direct' ? 'var(--orange-primary)' : 'var(--border-color)',
                                            background: txForm.cardDestination === 'direct' ? 'var(--orange-subtle)' : 'transparent',
                                            color: txForm.cardDestination === 'direct' ? 'var(--orange-primary)' : 'inherit'
                                        }}
                                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'direct' }))}
                                    >
                                        ⚡ رقم مباشر
                                    </button>
                                </div>
                            </div>

                            {txForm.cardDestination === 'locked' && (
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                        الخط المسكر المستهدف للشحن:
                                    </label>

                                    <div
                                        onClick={() => setTxForm(prev => ({ ...prev, isLineSearchOpen: !prev.isLineSearchOpen }))}
                                        style={{
                                            background: 'var(--bg-input)',
                                            border: '1.5px solid var(--border-color)',
                                            borderRadius: '12px',
                                            padding: '10px 14px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span style={{ fontSize: '12px', fontWeight: selectedClosedLineObj ? 'bold' : 'normal', color: selectedClosedLineObj ? 'var(--orange-primary)' : 'var(--text-muted)' }}>
                                            {selectedClosedLineObj
                                                ? `خط #${selectedClosedLineObj.slotNumber}: ${selectedClosedLineObj.phoneNumber || selectedClosedLineObj.number} (رصيده: $${selectedClosedLineObj.balanceUSD || selectedClosedLineObj.balance || 0} • صلاحية: ${getLineRemainingDays(selectedClosedLineObj)} يوم)`
                                                : '-- ابحث أو اختر الخط المسكر --'}
                                        </span>
                                    </div>

                                    {txForm.isLineSearchOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'var(--bg-card)',
                                            border: '1.5px solid var(--orange-primary)',
                                            borderRadius: '14px',
                                            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                                            zIndex: 300,
                                            marginTop: '4px',
                                            padding: '8px',
                                            maxHeight: '200px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: '8px', padding: '0 8px', border: '1px solid var(--border-color)' }}>
                                                <Search size={14} color="var(--text-muted)" />
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="ابحث برقم الخط أو الهاتف..."
                                                    className="tz-input"
                                                    style={{ border: 'none', height: '34px', fontSize: '11px', background: 'transparent' }}
                                                    value={txForm.lineSearchQuery}
                                                    onChange={(e) => setTxForm(prev => ({ ...prev, lineSearchQuery: e.target.value }))}
                                                />
                                            </div>

                                            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {filteredClosedLines.length === 0 ? (
                                                    <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                        لا يوجد خط مسكر مطابق للبحث
                                                    </div>
                                                ) : (
                                                    filteredClosedLines.map((line) => {
                                                        const remD = getLineRemainingDays(line);
                                                        return (
                                                            <div
                                                                key={line.id}
                                                                onClick={() => setTxForm(prev => ({
                                                                    ...prev,
                                                                    targetClosedLineId: line.id,
                                                                    isLineSearchOpen: false,
                                                                    lineSearchQuery: ''
                                                                }))}
                                                                style={{
                                                                    padding: '8px 10px',
                                                                    borderRadius: '8px',
                                                                    background: txForm.targetClosedLineId === line.id ? 'var(--orange-glow)' : 'var(--bg-card-sub)',
                                                                    color: txForm.targetClosedLineId === line.id ? '#fff' : 'var(--text-main)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    fontSize: '11px',
                                                                    fontWeight: 'bold'
                                                                }}
                                                            >
                                                                <span>خط #{line.slotNumber} ({remD} يوم)</span>
                                                                <span style={{ direction: 'ltr' }}>{line.phoneNumber || line.number}</span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {txForm.cardDestination === 'open_admin' && (
                                <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setTxForm(prev => ({ ...prev, adminSelectMode: 'new' }))}
                                            style={{
                                                padding: '6px',
                                                borderRadius: '8px',
                                                border: txForm.adminSelectMode === 'new' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                                background: txForm.adminSelectMode === 'new' ? 'var(--orange-subtle)' : 'transparent',
                                                color: txForm.adminSelectMode === 'new' ? 'var(--orange-primary)' : 'inherit',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            + فتح أدمن جديد
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTxForm(prev => ({ ...prev, adminSelectMode: 'existing_line' }))}
                                            style={{
                                                padding: '6px',
                                                borderRadius: '8px',
                                                border: txForm.adminSelectMode === 'existing_line' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                                background: txForm.adminSelectMode === 'existing_line' ? 'var(--orange-subtle)' : 'transparent',
                                                color: txForm.adminSelectMode === 'existing_line' ? 'var(--orange-primary)' : 'inherit',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            شحن أدمن قائم ({openLinesOnly.length})
                                        </button>
                                    </div>

                                    {txForm.adminSelectMode === 'new' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم الأدمن (مع البحث بالدليل):</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="اسم الأدمن..."
                                                    className="tz-input"
                                                    style={{ height: '36px', fontSize: '11px' }}
                                                    value={txForm.adminName}
                                                    onChange={e => handleAdminCustomerSearch(e.target.value)}
                                                    autoComplete="off"
                                                />

                                                {adminCustomerSuggestions.length > 0 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        background: 'var(--bg-card)',
                                                        border: '1px solid var(--orange-primary)',
                                                        borderRadius: '10px',
                                                        zIndex: 310,
                                                        maxHeight: '120px',
                                                        overflowY: 'auto',
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                                        marginTop: '2px'
                                                    }}>
                                                        {adminCustomerSuggestions.map(cust => (
                                                            <div
                                                                key={cust.id}
                                                                onClick={() => handleSelectAdminCustomer(cust)}
                                                                style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
                                                            >
                                                                <span style={{ fontWeight: 'bold' }}>{cust.name}</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>{cust.phone}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                <div>
                                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>هاتف الأدمن:</label>
                                                    <input
                                                        type="tel"
                                                        placeholder="رقم الهاتف..."
                                                        className="tz-input"
                                                        style={{ height: '36px', fontSize: '11px' }}
                                                        value={txForm.adminPhone}
                                                        onChange={e => setTxForm({ ...txForm, adminPhone: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الشريحة/الخط:</label>
                                                    <input
                                                        type="tel"
                                                        placeholder="رقم الخط..."
                                                        className="tz-input"
                                                        style={{ height: '36px', fontSize: '11px' }}
                                                        value={txForm.adminLinePhone}
                                                        onChange={e => setTxForm({ ...txForm, adminLinePhone: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اختر خط الأدمن المفتوح القائم:</label>
                                            <select
                                                className="tz-select"
                                                style={{ height: '38px', fontSize: '12px' }}
                                                value={txForm.targetOpenLineId}
                                                onChange={e => setTxForm({ ...txForm, targetOpenLineId: e.target.value })}
                                            >
                                                <option value="">-- اختر خط الأدمن --</option>
                                                {openLinesOnly.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        أدمن #{l.slotNumber}: {l.adminName || l.user1 || 'الرئيسي'} ({l.phoneNumber || l.number}) — صلاحية: {getLineRemainingDays(l)} يوم
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* بطاقة تنبيه سقف الـ 365 يوماً */}
                            {wastedValidityDays > 0 && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.14)',
                                    border: '1.5px solid var(--red)',
                                    borderRadius: '12px',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    fontSize: '11px',
                                    color: 'var(--red)',
                                    lineHeight: '1.5'
                                }}>
                                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontWeight: '900', marginBottom: '2px' }}>
                                            تنبيه: هذا الخط مقفول على سقف 365 يوم!
                                        </div>
                                        <div>
                                            الخط يملك حالياً <b>{currentLineDays} يوم</b> صلاحية (الحد الأقصى للإضافة هو <b>{maxAllowedDaysToAdd} يوم</b> فقط).
                                            إضافة كارت <b>{selectedTierObj?.days} يوم</b> ستُضيّع عليك <b>{wastedValidityDays} يوم</b> صلاحية على الفاضي!
                                        </div>
                                    </div>
                                </div>
                            )}

                            {txForm.cardDestination === 'sim' && (
                                <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                        اختر الشريحة الأساسية ({txForm.cardOperator}):
                                    </label>
                                    <select
                                        className="tz-select"
                                        style={{ height: '38px', fontSize: '12px', fontWeight: 'bold' }}
                                        value={txForm.targetSimId}
                                        onChange={e => setTxForm(prev => ({ ...prev, targetSimId: e.target.value }))}
                                    >
                                        <option value="">-- اختر الشريحة --</option>
                                        {operatorSims.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} {s.number ? `(${s.number})` : ''} — رصيدها: ${parseFloat(s.balance || 0).toFixed(2)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {txForm.cardDestination === 'direct' && (
                                <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الهاتف المشحون:</label>
                                            <input
                                                type="tel"
                                                required
                                                placeholder="70xxxxxx"
                                                className="tz-input"
                                                style={{ height: '36px', fontSize: '12px', fontWeight: 'bold' }}
                                                value={txForm.directPhone}
                                                onChange={e => setTxForm({ ...txForm, directPhone: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم الزبون:</label>
                                            <input
                                                type="text"
                                                placeholder="اسم الزبون..."
                                                className="tz-input"
                                                style={{ height: '36px', fontSize: '11px' }}
                                                value={txForm.directCustomerName}
                                                onChange={e => setTxForm({ ...txForm, directCustomerName: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر البيع للزبون (اختياري):</label>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="سعر المبيع..."
                                                className="tz-input"
                                                style={{ height: '36px', fontSize: '11px', fontWeight: 'bold' }}
                                                value={txForm.directSellingPrice}
                                                onChange={e => setTxForm({ ...txForm, directSellingPrice: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>عملة البيع:</label>
                                            <select
                                                className="tz-select"
                                                style={{ height: '36px', fontSize: '11px' }}
                                                value={txForm.directSellingCurrency}
                                                onChange={e => setTxForm({ ...txForm, directSellingCurrency: e.target.value })}
                                            >
                                                <option value="USD">دولار ($)</option>
                                                <option value="LBP">ليرة (LBP)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 5. عملية بيع عامة */}
                    {txForm.type === 'sale' && (
                        <>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>سعر البيع للزبون:</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="0.00"
                                        className="tz-input"
                                        value={txForm.amount}
                                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                        style={{ fontWeight: 'bold', color: 'var(--orange-primary)' }}
                                    />
                                    <select
                                        className="tz-select"
                                        value={txForm.currency}
                                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                                    >
                                        <option value="USD">دولار ($)</option>
                                        <option value="LBP">ليرة (LBP)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--red)', display: 'block', marginBottom: '4px' }}>
                                    سعر التكلفة عليك (رأس المال):
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        className="tz-input"
                                        value={txForm.costPrice}
                                        onChange={e => setTxForm({ ...txForm, costPrice: e.target.value })}
                                        style={{ fontWeight: 'bold' }}
                                    />
                                    <select
                                        className="tz-select"
                                        value={txForm.costCurrency}
                                        onChange={e => setTxForm({ ...txForm, costCurrency: e.target.value })}
                                    >
                                        <option value="USD">$ دولار</option>
                                        <option value="LBP">ليرة LBP</option>
                                    </select>
                                </div>

                                {(() => {
                                    const saleRaw = parseFloat(txForm.amount) || 0;
                                    const saleUSD = txForm.currency === 'LBP' ? (saleRaw / exchangeRate) : saleRaw;
                                    const costRaw = parseFloat(txForm.costPrice) || 0;
                                    const costUSD = txForm.costCurrency === 'LBP' ? (costRaw / exchangeRate) : costRaw;
                                    const netProfit = saleUSD - costUSD;

                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>صافي ربحك التقديري:</span>
                                            <b style={{ color: netProfit >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '13px' }}>
                                                {netProfit >= 0 ? `+ $${netProfit.toFixed(2)}` : `- $${Math.abs(netProfit).toFixed(2)}`}
                                            </b>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>السلعة / الخدمة:</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: كارت تشريج / شاحن 20W / صيانة..."
                                    className="tz-input"
                                    value={txForm.itemName}
                                    onChange={e => setTxForm({ ...txForm, itemName: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary"
                        style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isSubmitting ? 0.6 : 1 }}
                    >
                        {isSubmitting ? <RefreshCw size={15} className="spin-icon" /> : null}
                        <span>
                            {isSubmitting
                                ? 'جاري التنفيذ...'
                                : txForm.type === 'buy_card'
                                    ? 'تأكيد شراء الكارت وتنفيذ العملية'
                                    : txForm.type === 'sale'
                                        ? 'متابعة لبيانات العميل وخيارات الدفع ←'
                                        : 'تأكيد تنفيذ العملية'}
                        </span>
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}