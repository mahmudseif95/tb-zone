import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';

export default function DonutChart({ sources = [] }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [chartCurrency, setChartCurrency] = useState('USD'); // 'USD' | 'LBP'

  const colors = ['#FF7A00', '#FFA043', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4'];

  // استخراج وتنسيق بيانات المحافظ بحسب العملة المختارة للرسم
  const chartData = sources
    .map((s, index) => {
      const usdVal = parseFloat(s.balanceUSD ?? s.balance ?? 0) || 0;
      const lbpVal = parseFloat(s.balanceLBP || 0) || 0;
      const chartValue = chartCurrency === 'USD' ? usdVal : lbpVal;

      return {
        id: s.id,
        name: s.name,
        usdVal,
        lbpVal,
        value: chartValue,
        color: colors[index % colors.length]
      };
    })
    .filter(item => item.value > 0);

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  const totalAllUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0) || 0), 0);
  const totalAllLBP = sources.reduce((sum, s) => sum + (parseFloat(s.balanceLBP || 0) || 0), 0);

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: 'drop-shadow(0 4px 10px rgba(255, 122, 0, 0.4))' }}
        />
      </g>
    );
  };

  const currentDisplay = activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1.5px solid var(--border-color)',
      borderRadius: '20px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
      direction: 'rtl'
    }}>
      {/* رأس المخطط مع أزرار التبديل بين الدولار والليرة */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--text-main)' }}>
            توزيع السيولة النقدية
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>أرصدة فعلية بالمحافظ</span>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-card-sub)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => { setChartCurrency('USD'); setActiveIndex(null); }}
            style={{
              background: chartCurrency === 'USD' ? 'var(--orange-primary)' : 'transparent',
              color: chartCurrency === 'USD' ? '#fff' : 'var(--text-main)',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            دولار ($)
          </button>
          <button
            type="button"
            onClick={() => { setChartCurrency('LBP'); setActiveIndex(null); }}
            style={{
              background: chartCurrency === 'LBP' ? 'var(--orange-primary)' : 'transparent',
              color: chartCurrency === 'LBP' ? '#fff' : 'var(--text-main)',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            ليرة (LBP)
          </button>
        </div>
      </div>

      {/* قسم الرسم البياني الدائري */}
      {chartData.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          لا توجد أرصدة متوفرة حالياً بـ {chartCurrency === 'USD' ? 'الدولار' : 'الليرة'} لعرض المخطط.
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={88}
                paddingAngle={4}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            width: '140px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
              {currentDisplay ? currentDisplay.name : `إجمالي ${chartCurrency === 'USD' ? 'الدولار' : 'الليرة'}`}
            </div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: currentDisplay ? currentDisplay.color : 'var(--text-main)', marginTop: '2px' }}>
              {chartCurrency === 'USD'
                ? `$${(currentDisplay ? currentDisplay.usdVal : totalAllUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `${Math.round(currentDisplay ? currentDisplay.lbpVal : totalAllLBP).toLocaleString()} ل.ل`}
            </div>
          </div>
        </div>
      )}

      {/* القائمة التفصيلية التي تظهر الدولار والليرة معاً لكل محفظة */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {sources.map((s, idx) => {
          const usdVal = parseFloat(s.balanceUSD ?? s.balance ?? 0) || 0;
          const lbpVal = parseFloat(s.balanceLBP || 0) || 0;
          const isSelected = activeIndex === idx;
          const color = colors[idx % colors.length];

          const currentValForRatio = chartCurrency === 'USD' ? usdVal : lbpVal;
          const percentage = totalValue > 0 ? ((currentValForRatio / totalValue) * 100).toFixed(1) : '0';

          return (
            <div
              key={s.id || idx}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '12px',
                background: isSelected ? 'var(--bg-card-sub)' : 'var(--bg-main)',
                border: isSelected ? `1.5px solid ${color}` : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: isSelected ? 'var(--text-main)' : 'var(--text-main)' }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    نسبة التوزيع: {percentage}%
                  </span>
                </div>
              </div>

              {/* إظهار رصيدي المحفظة معاً */}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                  ${usdVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>
                  {Math.round(lbpVal).toLocaleString()} ل.ل
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}