import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Building2,
  CheckCircle2,
  Smartphone,
  MapPin,
  Phone
} from 'lucide-react';

export default function SalesModal({
  isOpen,
  onClose,
  transactionData = {},
  onConfirm,
  customers = []
}) {
  const [customerType, setCustomerType] = useState('customers'); // 'customers' | 'merchants'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentType, setPaymentType] = useState('cash'); // 'cash' | 'partial' | 'debt'
  const [partialPaidAmount, setPartialPaidAmount] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setCustomerType('customers');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setPaymentType('cash');
      setPartialPaidAmount('');
      setCustomerSuggestions([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const rawSellingPrice = parseFloat(transactionData.sellingPrice) || 0;
  const currency = transactionData.currency || 'USD';

  const handleCustomerSearch = (query) => {
    setCustomerName(query);
    if (!query.trim()) {
      setCustomerSuggestions([]);
      return;
    }
    const clean = query.toLowerCase().trim();
    const matches = customers.filter(c =>
      c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean))
    );
    setCustomerSuggestions(matches);
  };

  const handleSelectCustomer = (c) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.address || '');
    setCustomerSuggestions([]);
  };

  const remainingDebtAmount = paymentType === 'debt'
    ? rawSellingPrice
    : paymentType === 'partial'
      ? Math.max(0, rawSellingPrice - (parseFloat(partialPaidAmount) || 0))
      : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('يرجى كتابة اسم الزبون أو التاجر!');
      return;
    }

    onConfirm({
      ...transactionData,
      customerType,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      paymentType,
      paidAmount: paymentType === 'cash' ? rawSellingPrice : (parseFloat(partialPaidAmount) || 0),
      remainingDebt: remainingDebtAmount,
      isDebt: remainingDebtAmount > 0
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-center" style={{ maxHeight: '88vh', overflowY: 'auto' }}>

        {/* رأس النافذة مع زر X الحصري للإغلاق */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>
              تأكيد عملية المبيع
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {transactionData.itemName || transactionData.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* اختيار نوع العميل */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCustomerType('customers')}
              style={{
                padding: '10px',
                borderRadius: '12px',
                border: customerType === 'customers' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                background: customerType === 'customers' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                color: customerType === 'customers' ? 'var(--orange-primary)' : 'var(--text-main)',
                fontSize: '12px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <User size={15} />
              <span>زبون عادي</span>
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('merchants')}
              style={{
                padding: '10px',
                borderRadius: '12px',
                border: customerType === 'merchants' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                background: customerType === 'merchants' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                color: customerType === 'merchants' ? 'var(--orange-primary)' : 'var(--text-main)',
                fontSize: '12px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Building2 size={15} />
              <span>تاجر / محل</span>
            </button>
          </div>

          {/* حقل اسم العميل مع البحث التنبؤي من أول حرف */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              {customerType === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم الزبون:'}
            </label>
            <input
              type="text"
              required
              placeholder="اكتب الاسم للبحث من أول حرف..."
              className="tz-input"
              value={customerName}
              onChange={e => handleCustomerSearch(e.target.value)}
              autoFocus
              autoComplete="off"
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
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                marginTop: '4px'
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>الهاتف:</label>
              <input
                type="tel"
                placeholder="رقم الهاتف..."
                className="tz-input"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>العنوان:</label>
              <input
                type="text"
                placeholder="العنوان..."
                className="tz-input"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
              />
            </div>
          </div>

          {/* خيارات الدفع */}
          <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>طريقة الدفع:</span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {rawSellingPrice.toLocaleString()} {currency === 'LBP' ? 'ل.ل' : '$'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setPaymentType('cash')}
                style={{
                  padding: '8px',
                  borderRadius: '10px',
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
                  padding: '8px',
                  borderRadius: '10px',
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
                  padding: '8px',
                  borderRadius: '10px',
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
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="any"
                  placeholder="المدفوع كاش..."
                  className="tz-input"
                  style={{ height: '38px', fontSize: '12px', flex: 1 }}
                  value={partialPaidAmount}
                  onChange={e => setPartialPaidAmount(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 'bold' }}>
                  المتبقي: {remainingDebtAmount.toLocaleString()}
                </span>
              </div>
            )}

            {paymentType === 'debt' && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--red)', fontWeight: 'bold', textAlign: 'center' }}>
                سيتم ترحيل كامل المبلغ ({rawSellingPrice.toLocaleString()} {currency === 'LBP' ? 'ل.ل' : '$'}) إلى سجل الديون.
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" style={{ height: '46px', marginTop: '6px' }}>
            <CheckCircle2 size={18} />
            <span>تأكيد المبيع وخصم الرصيد فوراً</span>
          </button>
        </form>
      </div>
    </div>
  );
}