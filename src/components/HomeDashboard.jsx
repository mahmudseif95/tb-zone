import React, { useState } from 'react';
import {
  TrendingUp,
  Wallet,
  DollarSign,
  AlertCircle,
  Edit2,
  Check,
  X
} from 'lucide-react';

export default function HomeDashboard({
  sources = [],
  salesHistory = [],
  lines = [],
  debts = [],
  exchangeRate = 89500,
  onNavigate,
  onUpdateSourceBalance
}) {
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [tempBalanceUSD, setTempBalanceUSD] = useState('');
  const [tempBalanceLBP, setTempBalanceLBP] = useState('');

  // 1. احتساب السيولة النقدية الفعلية للعملتين بشكل مستقل (بدون تحويل افتراضي)
  const totalActualUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0) || 0), 0);
  const totalActualLBP = sources.reduce((sum, s) => sum + (parseFloat(s.balanceLBP || 0) || 0), 0);

  // 2. احتساب إجمالي الديون غير المسددة
  const totalUnpaidDebtsUSD = debts
    .filter(d => !d.paid)
    .reduce((sum, d) => {
      const val = parseFloat(d.amount) || 0;
      return sum + (d.currency === 'LBP' ? val / exchangeRate : val);
    }, 0);

  // 3. احتساب صافي أرباح اليوم الفورية
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = salesHistory.filter(s => s.date && s.date.startsWith(todayStr));

  let todayProfitsUSD = 0;
  todaySales.forEach(item => {
    if (item.profitUSD !== undefined) {
      todayProfitsUSD += parseFloat(item.profitUSD) || 0;
    } else {
      const sale = parseFloat(item.sellingPrice) || 0;
      const isLBP = item.currency === 'LBP';
      const saleUSD = isLBP ? sale / exchangeRate : sale;
      const costUSD = parseFloat(item.costUSD) || 0;
      todayProfitsUSD += Math.max(0, saleUSD - costUSD);
    }
  });

  const handleStartEdit = (source) => {
    setEditingSourceId(source.id);
    setTempBalanceUSD((source.balanceUSD ?? source.balance ?? 0).toString());
    setTempBalanceLBP((source.balanceLBP || 0).toString());
  };

  const handleSaveBalance = (sourceId) => {
    const valUSD = parseFloat(tempBalanceUSD) || 0;
    const valLBP = parseFloat(tempBalanceLBP) || 0;
    if (onUpdateSourceBalance) {
      onUpdateSourceBalance(sourceId, valUSD, valLBP);
    }
    setEditingSourceId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      {/* بطاقة إجمالي السيولة النقدية بالعملتين المستقلتين */}
      <div className="tz-card" style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px' }}>
          إجمالي السيولة النقدية المتوفرة
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>رصيد الدولار الكاش ($)</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--orange-primary)', marginTop: '4px' }}>
              ${totalActualUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>رصيد الليرة الكاش (LBP)</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)', marginTop: '6px' }}>
              {Math.round(totalActualLBP).toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--orange-primary)' }}>ل.ل</span>
            </div>
          </div>
        </div>
      </div>

      {/* بطاقتي الأرباح والديون */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div
          onClick={() => onNavigate && onNavigate('analytics')}
          className="tz-card"
          style={{ padding: '14px', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold' }}>
            <TrendingUp size={14} color="var(--green)" />
            <span>أرباح اليوم</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--green)', marginTop: '4px' }}>
            +${todayProfitsUSD.toFixed(2)}
          </div>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('debts')}
          className="tz-card"
          style={{ padding: '14px', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold' }}>
            <AlertCircle size={14} color="var(--red)" />
            <span>الديون الغير مسددة</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--red)', marginTop: '4px' }}>
            ${totalUnpaidDebtsUSD.toFixed(2)}
          </div>
        </div>
      </div>

      {/* أرصدة الصناديق النشطة مع إمكانية تعديل الدولار واللبناني معاً */}
      <div className="tz-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: '900', fontSize: '14px' }}>أرصدة الصناديق </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sources.length} صناديق</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sources.map(src => {
            const isEditing = editingSourceId === src.id;
            const balUSD = parseFloat(src.balanceUSD ?? src.balance ?? 0);
            const balLBP = parseFloat(src.balanceLBP || 0);

            return (
              <div
                key={src.id}
                style={{
                  background: 'var(--bg-card-sub)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: '800', fontSize: '13px' }}>{src.name}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>$:</span>
                          <input
                            type="number"
                            step="any"
                            value={tempBalanceUSD}
                            onChange={e => setTempBalanceUSD(e.target.value)}
                            className="tz-input"
                            style={{ width: '85px', height: '28px', padding: '2px 4px', fontSize: '12px', fontWeight: '900' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LBP:</span>
                          <input
                            type="number"
                            step="any"
                            value={tempBalanceLBP}
                            onChange={e => setTempBalanceLBP(e.target.value)}
                            className="tz-input"
                            style={{ width: '85px', height: '28px', padding: '2px 4px', fontSize: '12px', fontWeight: '900' }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveBalance(src.id)}
                        style={{ background: 'var(--orange-primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}
                        title="حفظ"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingSourceId(null)}
                        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}
                        title="إلغاء"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleStartEdit(src)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      title="اضغط لتعديل رصيد الدولار أو الليرة"
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '900', fontSize: '15px', color: 'var(--orange-primary)' }}>
                          ${balUSD.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-main)' }}>
                          {Math.round(balLBP).toLocaleString()} ل.ل
                        </div>
                      </div>
                      <Edit2 size={13} color="var(--text-muted)" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}