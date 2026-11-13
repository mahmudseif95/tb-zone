import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Building2 } from 'lucide-react';

export default function LineUserSaleModal({
    targetUserSlot, // 1 | 2 | 3 | 'admin'
    formData,
    line,
    customers = [],
    onUpdateFormData,
    onUpdateLine,
    onRecordSaleFromLine,
    onClose
}) {
    const isUserAdmin = targetUserSlot === 'admin';

    const [userSaleForm, setUserSaleForm] = useState({
        customerType: 'customers',
        name: isUserAdmin ? (formData.adminName || '') : '',
        phone: isUserAdmin ? (formData.adminPhone || '') : '',
        address: isUserAdmin ? (formData.adminAddress || '') : '',
        gb: isUserAdmin ? (formData.adminGB || '22') : '22',
        price: isUserAdmin ? (formData.adminPrice || '') : '',
        currency: 'USD',
        paymentType: 'cash', // 'cash' | 'partial' | 'debt'
        partialPaidAmount: ''
    });

    const [customerSuggestions, setCustomerSuggestions] = useState([]);

    const handleCustomerSearch = (query) => {
        setUserSaleForm(prev => ({ ...prev, name: query }));
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
        setUserSaleForm(prev => ({
            ...prev,
            name: c.name,
            phone: c.phone || '',
            address: c.address || ''
        }));
        setCustomerSuggestions([]);
    };

    const rawSaleTotal = parseFloat(userSaleForm.price) || 0;
    const paidAmountVal = userSaleForm.paymentType === 'cash'
        ? rawSaleTotal
        : userSaleForm.paymentType === 'partial'
            ? Math.min(rawSaleTotal, parseFloat(userSaleForm.partialPaidAmount) || 0)
            : 0;

    const remainingDebtAmount = Math.max(0, parseFloat((rawSaleTotal - paidAmountVal).toFixed(2)));

    const handleConfirmUserSale = (e) => {
        e.preventDefault();
        if (!userSaleForm.name.trim()) return;

        const userText = `${userSaleForm.name.trim()} (${userSaleForm.gb} GB)`;

        if (isUserAdmin) {
            onUpdateFormData(prev => ({
                ...prev,
                adminName: userSaleForm.name.trim(),
                adminPhone: userSaleForm.phone.trim(),
                adminAddress: userSaleForm.address.trim(),
                adminGB: userSaleForm.gb,
                adminPrice: userSaleForm.price
            }));

            if (line && onUpdateLine) {
                onUpdateLine(line.id, (prev) => ({
                    ...prev,
                    adminName: userSaleForm.name.trim(),
                    adminPhone: userSaleForm.phone.trim(),
                    adminAddress: userSaleForm.address.trim(),
                    adminGB: userSaleForm.gb,
                    adminPrice: userSaleForm.price
                }));
            }
        } else {
            const slotKey = `user${targetUserSlot}`;
            onUpdateFormData(prev => ({ ...prev, [slotKey]: userText }));

            if (line && onUpdateLine) {
                onUpdateLine(line.id, (prev) => ({
                    ...prev,
                    [slotKey]: userText
                }));
            }
        }

        if (onRecordSaleFromLine && rawSaleTotal > 0) {
            const isPartialOrDebt = remainingDebtAmount > 0;

            onRecordSaleFromLine({
                title: isUserAdmin ? `حصة أدمن #${formData.slotNumber}` : `حصة مستخدم #${formData.slotNumber}`,
                itemName: isUserAdmin
                    ? `حصة أدمن (${userSaleForm.gb} GB #${formData.slotNumber} - ${formData.phoneNumber})`
                    : `UShare (${userSaleForm.gb} GB #${formData.slotNumber} - ${formData.phoneNumber})`,
                sellingPrice: rawSaleTotal,
                currency: userSaleForm.currency,
                gb: userSaleForm.gb,
                customerType: userSaleForm.customerType,
                customerName: userSaleForm.name.trim(),
                customerPhone: userSaleForm.phone.trim(),
                customerAddress: userSaleForm.address.trim(),
                paymentType: userSaleForm.paymentType,
                paidAmount: paidAmountVal,
                remainingDebt: remainingDebtAmount,
                isDebt: isPartialOrDebt,
                targetLineId: line ? line.id : null,
                lockedLineId: line ? line.id : null
            });
        }

        onClose();
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-center" style={{ maxWidth: '370px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                        {isUserAdmin ? 'تخصيص حصة الأدمن' : `تخصيص حصة مستخدم #${targetUserSlot}`}
                    </h3>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleConfirmUserSale} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => setUserSaleForm(prev => ({ ...prev, customerType: 'customers' }))}
                            style={{
                                padding: '8px',
                                borderRadius: '10px',
                                border: userSaleForm.customerType === 'customers' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: userSaleForm.customerType === 'customers' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                                color: userSaleForm.customerType === 'customers' ? 'var(--orange-primary)' : 'var(--text-main)',
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
                            onClick={() => setUserSaleForm(prev => ({ ...prev, customerType: 'merchants' }))}
                            style={{
                                padding: '8px',
                                borderRadius: '10px',
                                border: userSaleForm.customerType === 'merchants' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: userSaleForm.customerType === 'merchants' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                                color: userSaleForm.customerType === 'merchants' ? 'var(--orange-primary)' : 'var(--text-main)',
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
                            {userSaleForm.customerType === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم العميل / الزبون:'}
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="ابحث بالاسم أو الرقم..."
                            className="tz-input"
                            style={{ height: '38px', marginTop: '2px' }}
                            value={userSaleForm.name}
                            onChange={e => handleCustomerSearch(e.target.value)}
                            autoComplete="off"
                            autoFocus
                        />

                        {customerSuggestions.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'var(--bg-card)',
                                border: '1.5px solid var(--orange-primary)',
                                borderRadius: '10px',
                                zIndex: 10000001,
                                maxHeight: '140px',
                                overflowY: 'auto',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                marginTop: '2px'
                            }}>
                                {customerSuggestions.map(cust => (
                                    <div
                                        key={cust.id}
                                        onClick={() => handleSelectCustomer(cust)}
                                        style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
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
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الهاتف:</label>
                            <input
                                type="tel"
                                placeholder="رقم الهاتف..."
                                className="tz-input"
                                style={{ height: '36px' }}
                                value={userSaleForm.phone}
                                onChange={e => setUserSaleForm({ ...userSaleForm, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العنوان / المنطقة:</label>
                            <input
                                type="text"
                                placeholder="المنطقة..."
                                className="tz-input"
                                style={{ height: '36px' }}
                                value={userSaleForm.address}
                                onChange={e => setUserSaleForm({ ...userSaleForm, address: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>حجم الحصة (GB):</label>
                            <input
                                type="number"
                                step="any"
                                required
                                placeholder="22"
                                className="tz-input"
                                style={{ height: '36px', fontWeight: 'bold' }}
                                value={userSaleForm.gb}
                                onChange={e => setUserSaleForm({ ...userSaleForm, gb: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر المبيع:</label>
                            <input
                                type="number"
                                step="any"
                                required
                                placeholder="السعر..."
                                className="tz-input"
                                style={{ height: '36px', fontWeight: 'bold', color: 'var(--orange-primary)' }}
                                value={userSaleForm.price}
                                onChange={e => setUserSaleForm({ ...userSaleForm, price: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => setUserSaleForm(prev => ({ ...prev, currency: 'USD' }))}
                            style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: userSaleForm.currency === 'USD' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: userSaleForm.currency === 'USD' ? 'var(--orange-subtle)' : 'transparent',
                                color: userSaleForm.currency === 'USD' ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            دولار ($)
                        </button>
                        <button
                            type="button"
                            onClick={() => setUserSaleForm(prev => ({ ...prev, currency: 'LBP' }))}
                            style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: userSaleForm.currency === 'LBP' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: userSaleForm.currency === 'LBP' ? 'var(--orange-subtle)' : 'transparent',
                                color: userSaleForm.currency === 'LBP' ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ليرة (LBP)
                        </button>
                    </div>

                    <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>طريقة الدفع:</span>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                المطلوب: {rawSaleTotal.toLocaleString()} {userSaleForm.currency === 'LBP' ? 'ل.ل' : '$'}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            <button
                                type="button"
                                onClick={() => setUserSaleForm(prev => ({ ...prev, paymentType: 'cash' }))}
                                style={{
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    border: userSaleForm.paymentType === 'cash' ? '1.5px solid var(--green)' : '1px solid var(--border-color)',
                                    background: userSaleForm.paymentType === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                    color: userSaleForm.paymentType === 'cash' ? 'var(--green)' : 'var(--text-main)',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                كاش نقداً
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserSaleForm(prev => ({ ...prev, paymentType: 'partial' }))}
                                style={{
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    border: userSaleForm.paymentType === 'partial' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                    background: userSaleForm.paymentType === 'partial' ? 'rgba(255, 122, 0, 0.15)' : 'transparent',
                                    color: userSaleForm.paymentType === 'partial' ? 'var(--orange-primary)' : 'var(--text-main)',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                دفع جزئي
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserSaleForm(prev => ({ ...prev, paymentType: 'debt' }))}
                                style={{
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    border: userSaleForm.paymentType === 'debt' ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                                    background: userSaleForm.paymentType === 'debt' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                    color: userSaleForm.paymentType === 'debt' ? 'var(--red)' : 'var(--text-main)',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                آجل (دين)
                            </button>
                        </div>

                        {userSaleForm.paymentType === 'partial' && (
                            <div style={{ marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="المبلغ المدفوع كاش..."
                                    className="tz-input"
                                    style={{ height: '34px', fontSize: '11px', flex: 1 }}
                                    value={userSaleForm.partialPaidAmount}
                                    onChange={e => setUserSaleForm({ ...userSaleForm, partialPaidAmount: e.target.value })}
                                    required
                                />
                                <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 'bold' }}>
                                    المتبقي كدين: {remainingDebtAmount.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: '4px', height: '42px', fontSize: '13px' }}>
                        تثبيت الحصة وتسجيل العملية
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}