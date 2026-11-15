import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Building2, CheckCircle2 } from 'lucide-react';
import { USHARE_ACTIVATION_SHORTCODE, parseUserSlot } from '../../utils/whatsappHelper';
import WhatsAppActivationButton from './WhatsAppActivationButton';

export default function LineUserSaleModal({
    targetUserSlot, // 1 | 2 | 3 | 'admin'
    formData,
    line,
    customers = [],
    onUpdateFormData,
    onUpdateLine,
    onRecordSaleFromLine,
    alfaSyncOn = false,
    brandConfig,
    onClose
}) {
    const [savedInfo, setSavedInfo] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState(null);
    const isUserAdmin = targetUserSlot === 'admin';

    // الخانة قد تكون مملوءة سابقاً (مشترك مستورَد من Alfa برقمه فقط كاسم، بانتظار تسمية وقرار تسجيل بيعة)
    const existingSlotText = !isUserAdmin ? formData?.[`user${targetUserSlot}`] : '';
    const existingSub = existingSlotText
        ? parseUserSlot(existingSlotText, customers, line?.[`user${targetUserSlot}Phone`])
        : null;
    // اسم مكوَّن من رقم فقط = لم يُسمَّ بعد، فنترك حقل الاسم فارغاً ليكتب المالك الاسم الحقيقي
    const isImportedUnnamed = Boolean(existingSub && /^\d{6,8}$/.test(existingSub.name.trim()));

    const [userSaleForm, setUserSaleForm] = useState({
        customerType: 'customers',
        name: isUserAdmin ? (formData.adminName || '') : (isImportedUnnamed ? '' : (existingSub?.name || '')),
        phone: isUserAdmin ? (formData.adminPhone || '') : (existingSub?.phone || ''),
        address: isUserAdmin ? (formData.adminAddress || '') : '',
        gb: isUserAdmin ? (formData.adminGB || '22') : (existingSub?.quotaGB || '22'),
        price: isUserAdmin ? (formData.adminPrice || '') : '',
        currency: 'USD',
        paymentType: 'cash', // 'cash' | 'partial' | 'debt'
        partialPaidAmount: '',
        // تسجيل العملية في سجل المبيعات: مفعّل افتراضياً؛ يُعطَّل لمشترك مسجَّل ومدفوع مسبقاً فلا يُكرَّر القيد المالي
        recordSale: true
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

    const handleConfirmUserSale = async (e) => {
        e.preventDefault();
        if (syncing || !userSaleForm.name.trim()) return;

        // مزامنة Alfa تنطبق على مستخدمي الخط المسكر فقط (وليس الأدمن)
        const willSyncAlfa = Boolean(alfaSyncOn && !isUserAdmin && line);
        if (willSyncAlfa && !userSaleForm.phone.trim()) {
            setSyncError('رقم هاتف المشترك مطلوب للمزامنة مع Alfa');
            return;
        }

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

            if (line && onUpdateLine) {
                // السيرفر ينفذ المزامنة على Alfa أولاً ولا يكتب MySQL إن فشلت
                setSyncing(true);
                setSyncError(null);
                const ok = await onUpdateLine(line.id, (prev) => ({
                    ...prev,
                    [slotKey]: userText,
                    [`${slotKey}Phone`]: userSaleForm.phone.trim(),
                    ...(willSyncAlfa ? { alfaSync: { action: 'add', phone: userSaleForm.phone.trim(), quotaGB: userSaleForm.gb } } : {}),
                    skipAlfaSync: !willSyncAlfa
                }));
                setSyncing(false);
                if (ok === false) {
                    setSyncError('فشل حفظ المشترك أو مزامنته مع Alfa — لم يتم تسجيل أي عملية. راجع رسالة الخطأ وأعد المحاولة.');
                    return; // لا نسجل البيع ولا نغلق النافذة
                }
            }
            onUpdateFormData(prev => ({ ...prev, [slotKey]: userText }));
        }

        if (onRecordSaleFromLine && userSaleForm.recordSale && rawSaleTotal > 0) {
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
                lockedLineId: line ? line.id : null,
                alfaSynced: willSyncAlfa
            });
        }

        // الخط المسكر: نبقي النافذة مفتوحة لعرض زر إرسال طريقة التفعيل (1323) عبر واتساب
        if (line && !isUserAdmin && line.type !== 'open') {
            setSavedInfo({
                subscriberName: userSaleForm.name.trim(),
                subscriberPhone: userSaleForm.phone.trim(),
                quotaGB: userSaleForm.gb,
                lockedLineNumber: line.phoneNumber || line.number || formData.phoneNumber || ''
            });
            return;
        }

        onClose();
    };

    if (savedInfo) {
        return createPortal(
            <div className="modal-overlay">
                <div className="modal-center" style={{ maxWidth: '370px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        <CheckCircle2 size={44} color="var(--green)" />
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--green)' }}>تم تسجيل المشترك بنجاح</h3>

                        <div style={{ width: '100%', background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', fontSize: '12px', lineHeight: 1.9 }}>
                            <div>المشترك: <b>{savedInfo.subscriberName}</b>{savedInfo.quotaGB ? ` (${savedInfo.quotaGB} GB)` : ''}</div>
                            <div>رقم الخط المسكر: <b dir="ltr">{savedInfo.lockedLineNumber}</b></div>
                            <div>يرسل المشترك SMS إلى: <b>{USHARE_ACTIVATION_SHORTCODE}</b></div>
                        </div>

                        <div style={{ width: '100%' }}>
                            <WhatsAppActivationButton
                                variant="full"
                                subscriberName={savedInfo.subscriberName}
                                subscriberPhone={savedInfo.subscriberPhone}
                                quotaGB={savedInfo.quotaGB}
                                lockedLineNumber={savedInfo.lockedLineNumber}
                                shopName={brandConfig?.name}
                            />
                        </div>

                        <button type="button" className="btn-primary" onClick={onClose} style={{ width: '100%', height: '40px' }}>
                            تم / إغلاق
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-center" style={{ maxWidth: '370px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                        {isUserAdmin
                            ? 'تخصيص حصة الأدمن'
                            : isImportedUnnamed
                                ? `تسمية مشترك Alfa #${targetUserSlot}`
                                : `تخصيص حصة مستخدم #${targetUserSlot}`}
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

                    {isImportedUnnamed && (
                        <div style={{ fontSize: '10px', color: 'var(--orange-primary)', fontWeight: 'bold', background: 'var(--bg-card-sub)', padding: '6px 8px', borderRadius: '8px', lineHeight: 1.7 }}>
                            هذا المشترك وارد من Alfa برقمه فقط (الرقم: {existingSub?.phone || '—'}، الحصة: {existingSub?.quotaGB || '—'} GB). أدخل اسم الزبون الحقيقي.
                        </div>
                    )}

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

                    <div style={{ display: 'grid', gridTemplateColumns: userSaleForm.recordSale ? '1fr 1fr' : '1fr', gap: '6px' }}>
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
                        {userSaleForm.recordSale && (
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
                        )}
                    </div>

                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 'bold', background: 'var(--bg-card-sub)', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <span>تسجيل كعملية بيع في سجل المبيعات (Sales History)</span>
                        <input
                            type="checkbox"
                            checked={userSaleForm.recordSale}
                            onChange={e => setUserSaleForm(prev => ({ ...prev, recordSale: e.target.checked }))}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--orange-primary)' }}
                        />
                    </label>
                    {!userSaleForm.recordSale && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                            لمشترك فعّال ومدفوع مسبقاً قبل إضافة الخط إلى النظام: يُحفظ الاسم والحصة فقط، بدون أي قيد مالي جديد.
                        </div>
                    )}

                    {userSaleForm.recordSale && (
                        <>
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
                                            required
                                            placeholder="المبلغ المدفوع كاش..."
                                            className="tz-input"
                                            style={{ height: '34px', fontSize: '11px', flex: 1 }}
                                            value={userSaleForm.partialPaidAmount}
                                            onChange={e => setUserSaleForm({ ...userSaleForm, partialPaidAmount: e.target.value })}
                                        />
                                        <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 'bold' }}>
                                            المتبقي كدين: {remainingDebtAmount.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {line && !isUserAdmin && line.type !== 'open' && ['user1', 'user2', 'user3'].some(k => formData?.[k]) && (
                        <div style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>المشتركون الحاليون على الخط:</span>
                            {['user1', 'user2', 'user3'].map((key) => {
                                const sub = parseUserSlot(formData?.[key], customers, line?.[`${key}Phone`]);
                                if (!sub) return null;
                                return (
                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                                        <span style={{ fontWeight: 'bold' }}>{sub.name}{sub.quotaGB ? ` (${sub.quotaGB} GB)` : ''}</span>
                                        <WhatsAppActivationButton
                                            label={`طريقة التفعيل (${USHARE_ACTIVATION_SHORTCODE})`}
                                            subscriberName={sub.name}
                                            subscriberPhone={sub.phone}
                                            quotaGB={sub.quotaGB}
                                            lockedLineNumber={line.phoneNumber || line.number || formData?.phoneNumber}
                                            shopName={brandConfig?.name}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {alfaSyncOn && !isUserAdmin && (
                        <div style={{ fontSize: '10px', color: 'var(--orange-primary)', fontWeight: 'bold', background: 'var(--bg-card-sub)', padding: '6px 8px', borderRadius: '8px' }}>
                            ستتم إضافة هذا الرقم تلقائياً على موقع Alfa (رقم الهاتف مطلوب) قبل تسجيل العملية.
                        </div>
                    )}
                    {syncError && (
                        <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 'bold' }}>{syncError}</div>
                    )}

                    <button type="submit" disabled={syncing} className="btn-primary" style={{ marginTop: '4px', height: '42px', fontSize: '13px' }}>
                        {syncing
                            ? 'جارٍ المزامنة مع Alfa...'
                            : userSaleForm.recordSale
                                ? 'تثبيت الحصة وتسجيل العملية'
                                : 'حفظ الاسم والحصة بدون تسجيل بيعة'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}