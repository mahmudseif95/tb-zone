import React, { useState } from 'react';
import { Zap, ShieldCheck } from 'lucide-react';

export default function QuickDeduct({ onInitiateSale, sources = [] }) {
  const [operator, setOperator] = useState('alfa');
  // حماية من خطأ القراءة إذا كانت sources فارغة في أول لحظة
  const defaultSourceId = sources.length > 0 ? sources[0].id : 'whish1';
  const [selectedSource, setSelectedSource] = useState(defaultSourceId);

  const alfaTiers = [0.5, 1, 1.5, 2, 2.5, 3];
  const mtcTiers = [1, 2, 3];

  const handleSelectTier = (amount) => {
    const tax = operator === 'alfa' ? 0.14 : 0.16;
    const cost = parseFloat((amount + tax).toFixed(2));
    const defaultPrice = parseFloat((amount * 1.15 + tax).toFixed(2));

    onInitiateSale({
      title: `تحويل رصيد ${operator === 'alfa' ? 'ألفا' : 'تاتش'} ($${amount})`,
      cost: cost,
      salePrice: defaultPrice,
      operator,
      sourceId: selectedSource || defaultSourceId
    });
  };

  return (
    <div className="tz-card" style={{ border: '1px solid var(--border-orange)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(255, 106, 0, 0.15)',
            padding: '8px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap color="var(--orange-primary)" size={22} />
          </div>
          <div>
            <span style={{ fontWeight: '800', fontSize: '17px', color: '#fff' }}>تحويل الرصيد السريع</span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>خصم مباشر وحساب تلقائي للضريبة</div>
          </div>
        </div>
      </div>

      {/* اختيار الشبكة مع تأثير برتقالي واضح */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        {['alfa', 'mtc'].map((op) => {
          const isActive = operator === op;
          return (
            <button
              key={op}
              type="button"
              onClick={() => setOperator(op)}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '16px',
                border: isActive ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                background: isActive ? 'rgba(255, 106, 0, 0.15)' : 'var(--bg-input)',
                color: isActive ? 'var(--orange-primary)' : '#fff',
                fontWeight: '800',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.25s'
              }}
            >
              {op === 'alfa' ? 'ألفا (Alfa)' : 'تاتش (Touch)'}
            </button>
          );
        })}
      </div>

      {/* تحديد الصندوق للعملية */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
          محفظة السحب المعتمدة:
        </label>
        <select
          className="tz-select"
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
        >
          {sources.map(s => (
            <option key={s.id} value={s.id}>{s.name} (متوفر: ${s.balance.toFixed(2)})</option>
          ))}
        </select>
      </div>

      {/* أزرار الفئات السريعة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {(operator === 'alfa' ? alfaTiers : mtcTiers).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => handleSelectTier(tier)}
            className="btn-primary"
            style={{
              padding: '18px 6px',
              fontSize: '22px',
              borderRadius: '18px',
              fontWeight: '900'
            }}
          >
            ${tier}
          </button>
        ))}
      </div>
    </div>
  );
}