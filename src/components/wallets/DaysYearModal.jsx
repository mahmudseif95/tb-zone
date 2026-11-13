import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    CheckCircle2,
    User,
    Building2,
    ArrowRight
} from 'lucide-react';

export default function DaysYearModal({
    wallet,
    sims = [],
    customers = [],
    exchangeRate = 89500,
    onRecordWalletTx,
    onSwitchToGeneralTx,
    onClose
}) {
    const [step, setStep] = useState('details'); // 'details' | 'customer_step'
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [deductCurrency, setDeductCurrency] = useState('LBP'); // 'LBP' | 'USD'
    const [walletDeductLBP, setWalletDeductLBP] = useState('7697382');
    const [walletDeductUSD, setWalletDeductUSD] = useState('86.5');
    const [returnUSD, setReturnUSD] = useState('73.5');
    const [costLBP, setCostLBP] = useState('93500');
    const [targetSimId, setTargetSimId] = useState(sims[0]?.id || '');
    const [sellAmount, setSellAmount] = useState('1000000');
    const [sellCurrency, setSellCurrency] = useState('LBP');
    const [notes, setNotes] = useState('');

    const [customerType, setCustomerType] = useState('customers');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [paymentType, setPaymentType] = useState('cash');
    const [partialPaidAmount, setPartialPaidAmount] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState([]);

    const handleNextStep = (e) => {
        e.preventDefault();
        const curUSD = parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0);
        const curLBP = parseFloat(wallet.balanceLBP || 0);
        const isDeductLBP = deductCurrency === 'LBP';
        const deductVal = isDeductLBP ? (parseFloat(walletDeductLBP) || 0) : (parseFloat(walletDeductUSD) || 0);

        if (deductVal <= 0) return alert('يرجى إدخال المبلغ المخصوم من المحفظة!');
        if (isDeductLBP && curLBP < deductVal) {
            return alert(`رصيد الليرة بالمحفظة غير كافٍ! المطلوب: ${deductVal.toLocaleString()} ل.ل، المتوفر: ${Math.round(curLBP).toLocaleString()} ل.ل`);
        }
        if (!isDeductLBP && curUSD < deductVal) {
            return alert(`رصيد الدولار بالمحفظة غير كافٍ! المطلوب: $${deductVal}، المتوفر: $${curUSD.toFixed(2)}`);
        }
        if (!targetSimId) return alert('يرجى اختيار الشريحة المستهدفة لاستلام رصيد المردود!');
        if ((parseFloat(sellAmount) || 0) <= 0) return alert('يرجى إدخال سعر البيع للزبون!');

        setStep('customer_step');
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

    const rawSaleTotal = parseFloat(sellAmount) || 0;
    const remainingDebtAmount = paymentType === 'debt'
        ? rawSaleTotal
        : paymentType === 'partial'
            ? Math.max(0, rawSaleTotal - (parseFloat(partialPaidAmount) || 0))
            : 0;

    const handleConfirm = async (e) => {
        e.preventDefault();
        if (!customerName.trim() || isSubmitting) {
            if (!customerName.trim()) alert('يرجى كتابة اسم العميل!');
            return;
        }

        const isDeductLBP = deductCurrency === 'LBP';
        const finalDeductAmount = isDeductLBP
            ? (parseFloat(walletDeductLBP) || 0)
            : (parseFloat(walletDeductUSD) || 0);
        const returnCreditUSD = parseFloat(returnUSD) || 73.5;

        try {
            setIsSubmitting(true);
            await onRecordWalletTx(wallet.id, {
                type: 'sale',
                isDaysYear: true,
                daysFxRate: exchangeRate,
                targetSimId,
                returnCreditUSD,
                costLBP: parseFloat(costLBP) || 93500,
                amount: rawSaleTotal,
                sellingPrice: rawSaleTotal,
                currency: sellCurrency,
                walletDeduction: finalDeductAmount,
                walletDeductCurrency: isDeductLBP ? 'LBP' : 'USD',
                itemName: `سنة أيام Alfa (+${returnCreditUSD}$)`,
                customerType,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                customerAddress: customerAddress.trim(),
                paymentType,
                paidAmount: paymentType === 'cash' ? rawSaleTotal : (parseFloat(partialPaidAmount) || 0),
                remainingDebt: remainingDebtAmount,
                isDebt: remainingDebtAmount > 0,
                notes: notes.trim() || `خصم المحفظة: ${finalDeductAmount.toLocaleString()} ${isDeductLBP ? 'LBP' : 'USD'}`,
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
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>بيانات مشتري سنة الأيام</h3>
                            <span style={{ fontSize: '11px', color: 'var(--orange-primary)' }}>
                                سعر البيع: {rawSaleTotal.toLocaleString()} {sellCurrency === 'LBP' ? 'ل.ل' : '$'}
                            </span>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                    </div>

                    <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                                    المبلغ: {rawSaleTotal.toLocaleString()} {sellCurrency === 'LBP' ? 'ل.ل' : '$'}
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

                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setStep('details')}
                                style={{
                                    padding: '0 14px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-card-sub)',
                                    color: 'var(--text-main)',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                رجوع
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary"
                                style={{ flex: 1, height: '44px', opacity: isSubmitting ? 0.6 : 1 }}
                            >
                                <CheckCircle2 size={16} />
                                <span>{isSubmitting ? 'جاري التسجيل...' : 'تأكيد دورة سنة الأيام'}</span>
                            </button>
                        </div>
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
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                            ⚡ شراء وبيع سنة أيام Alfa
                        </h3>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            المحفظة: <b>{wallet.name}</b> • ليرة بليرة / دولار بدولار
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {onSwitchToGeneralTx && (
                            <button
                                type="button"
                                onClick={onSwitchToGeneralTx}
                                style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                                <ArrowRight size={12} />
                                <span>باقي الحركات</span>
                            </button>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                </div>

                <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>خصم تكلفة سنة الأيام من رصيد:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    className="tz-input"
                                    style={{
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        borderColor: deductCurrency === 'LBP' ? 'var(--orange-primary)' : 'var(--border-color)',
                                        background: deductCurrency === 'LBP' ? 'var(--orange-subtle)' : 'transparent',
                                        color: deductCurrency === 'LBP' ? 'var(--orange-primary)' : 'inherit'
                                    }}
                                    onClick={() => setDeductCurrency('LBP')}
                                >
                                    رصيد الليرة (LBP)
                                </button>
                                <button
                                    type="button"
                                    className="tz-input"
                                    style={{
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        borderColor: deductCurrency === 'USD' ? 'var(--orange-primary)' : 'var(--border-color)',
                                        background: deductCurrency === 'USD' ? 'var(--orange-subtle)' : 'transparent',
                                        color: deductCurrency === 'USD' ? 'var(--orange-primary)' : 'inherit'
                                    }}
                                    onClick={() => setDeductCurrency('USD')}
                                >
                                    رصيد الدولار ($)
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    {deductCurrency === 'LBP' ? 'يخصم ويُسترد (LBP):' : 'يخصم ويُسترد ($):'}
                                </label>
                                {deductCurrency === 'LBP' ? (
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        style={{ fontWeight: 'bold', marginTop: '2px' }}
                                        value={walletDeductLBP}
                                        onChange={e => setWalletDeductLBP(e.target.value)}
                                    />
                                ) : (
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        style={{ fontWeight: 'bold', color: 'var(--orange-primary)', marginTop: '2px' }}
                                        value={walletDeductUSD}
                                        onChange={e => setWalletDeductUSD(e.target.value)}
                                    />
                                )}
                            </div>

                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>يرجع للشريحة رصيد ($):</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    className="tz-input"
                                    style={{ marginTop: '2px', fontWeight: 'bold' }}
                                    value={returnUSD}
                                    onChange={e => setReturnUSD(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>تكلفة الدفعة على الخط (LBP):</label>
                            <input
                                type="number"
                                step="any"
                                required
                                className="tz-input"
                                value={costLBP}
                                onChange={e => setCostLBP(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اختر شريحة Alfa لشحن الرصيد المردود:</label>
                            <select
                                className="tz-select"
                                value={targetSimId}
                                onChange={e => setTargetSimId(e.target.value)}
                                required
                            >
                                <option value="">-- اختر الشريحة --</option>
                                {sims.map(sim => (
                                    <option key={sim.id} value={sim.id}>
                                        {sim.name} ({sim.number}) - رصيدها: ${sim.balance}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>
                                سعر بيع الأيام للزبون:
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px', marginTop: '2px' }}>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    className="tz-input"
                                    value={sellAmount}
                                    onChange={e => setSellAmount(e.target.value)}
                                />
                                <select
                                    className="tz-select"
                                    value={sellCurrency}
                                    onChange={e => setSellCurrency(e.target.value)}
                                >
                                    <option value="LBP">ليرة (LBP)</option>
                                    <option value="USD">دولار ($)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: '6px' }}>
                        متابعة لبيانات العميل وخيارات الدفع ←
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}