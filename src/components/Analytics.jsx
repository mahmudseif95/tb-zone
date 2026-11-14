import React, { useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Printer } from 'lucide-react';
import DonutChart from './DonutChart';
import { openPrintableReceipt } from '../utils/receiptPrinter';
import { formatDateTime } from '../utils/dateFormatter';

const NON_SALE_TYPES = new Set([
  'card_purchase',
  'wallet_deposit',
  'wallet_withdrawal',
  'wallet_transfer',
  'fx_exchange',
  'debt_create',
  'debt_payment',
  'expense',
  'sim_transfer',
  'sim_topup',
  'source_adjust'
]);

export default function Analytics({
  salesHistory = [],
  sources = [],
  debts = [],
  brandConfig = {},
  exchangeRate = 89500
}) {
  const [period, setPeriod] = useState('weekly');

  const toUSD = (amount, currency) => {
    const val = parseFloat(amount) || 0;
    return currency === 'LBP' ? val / exchangeRate : val;
  };

  const getLocalDateKey = (d) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const now = new Date();

  const getWeekRange = () => {
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const periodOps = salesHistory.filter(item => {
    if (!item.date) return false;
    const itemDate = new Date(item.date);
    if (isNaN(itemDate.getTime())) return false;

    if (period === 'daily') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (period === 'weekly') {
      const { monday, sunday } = getWeekRange();
      return itemDate >= monday && itemDate <= sunday;
    }
    if (period === 'monthly') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    if (period === 'yearly') {
      return itemDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const filteredSales = periodOps.filter(item => !NON_SALE_TYPES.has(item.type));
  const cardPurchases = periodOps.filter(item => item.type === 'card_purchase');
  const periodExpensesUSD = periodOps
    .filter(item => item.type === 'expense')
    .reduce((sum, e) => sum + toUSD(e.sellingPrice, e.currency), 0);

  let totalSalesUSDOnly = 0;
  let totalSalesLBPOnly = 0;
  let totalSalesCombinedUSD = 0;
  let totalProfitsUSD = 0;

  filteredSales.forEach((item) => {
    const rawPrice = parseFloat(item.sellingPrice) || 0;
    const isLBP = item.currency === 'LBP';
    const saleInUSD = toUSD(rawPrice, item.currency);
    const profitInUSD = item.profitUSD !== undefined
      ? parseFloat(item.profitUSD) || 0
      : Math.max(0, saleInUSD - (parseFloat(item.costUSD) || 0));

    if (isLBP) {
      totalSalesLBPOnly += rawPrice;
    } else {
      totalSalesUSDOnly += rawPrice;
    }
    totalSalesCombinedUSD += saleInUSD;
    totalProfitsUSD += profitInUSD;
  });

  const unpaidCustomerDebtsUSD = debts
    .filter(d => !d.paid && d.category !== 'boxes')
    .reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);

  const unpaidBoxDebtsUSD = debts
    .filter(d => !d.paid && d.category === 'boxes')
    .reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);

  const totalWalletsUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0)), 0);

  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const getDailyData = () => {
    const hoursSlots = [
      { name: 'مساءً', profit: 0, minHour: 20, maxHour: 24 },
      { name: 'عصراً', profit: 0, minHour: 16, maxHour: 20 },
      { name: 'ظهراً', profit: 0, minHour: 12, maxHour: 16 },
      { name: 'صباحاً', profit: 0, minHour: 0, maxHour: 12 }
    ];

    filteredSales.forEach(item => {
      const d = new Date(item.date);
      const h = d.getHours();
      const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
      const slot = hoursSlots.find(s => h >= s.minHour && h < s.maxHour);
      if (slot) slot.profit = parseFloat((slot.profit + p).toFixed(2));
    });

    return hoursSlots;
  };

  const getWeeklyData = () => {
    const { monday } = getWeekRange();
    const daysFromMonToSun = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      daysFromMonToSun.push({
        dateKey: getLocalDateKey(d),
        name: arabicDays[d.getDay()],
        fullName: `${arabicDays[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`,
        profit: 0
      });
    }

    filteredSales.forEach(item => {
      const itemD = new Date(item.date);
      const key = getLocalDateKey(itemD);
      const target = daysFromMonToSun.find(d => d.dateKey === key);
      if (target) {
        const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
        target.profit = parseFloat((target.profit + p).toFixed(2));
      }
    });

    return [...daysFromMonToSun].reverse();
  };

  const getMonthlyData = () => {
    const weeks = [
      { name: 'أسبوع 4', profit: 0 },
      { name: 'أسبوع 3', profit: 0 },
      { name: 'أسبوع 2', profit: 0 },
      { name: 'أسبوع 1', profit: 0 }
    ];

    filteredSales.forEach(item => {
      const dayOfMonth = new Date(item.date).getDate();
      const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
      if (dayOfMonth <= 7) weeks[3].profit += p;
      else if (dayOfMonth <= 14) weeks[2].profit += p;
      else if (dayOfMonth <= 21) weeks[1].profit += p;
      else weeks[0].profit += p;
    });

    return weeks.map(w => ({ ...w, profit: parseFloat(w.profit.toFixed(2)) }));
  };

  const getYearlyData = () => {
    const monthConfig = [
      { mIdx: 11, name: 'ك1', fullName: 'كانون الأول (12)', profit: 0 },
      { mIdx: 10, name: 'ت2', fullName: 'تشرين الثاني (11)', profit: 0 },
      { mIdx: 9, name: 'ت1', fullName: 'تشرين الأول (10)', profit: 0 },
      { mIdx: 8, name: 'أيلول', fullName: 'أيلول (9)', profit: 0 },
      { mIdx: 7, name: 'آب', fullName: 'آب (8)', profit: 0 },
      { mIdx: 6, name: 'تموز', fullName: 'تموز (7)', profit: 0 },
      { mIdx: 5, name: 'حزيران', fullName: 'حزيران (6)', profit: 0 },
      { mIdx: 4, name: 'أيار', fullName: 'أيار (5)', profit: 0 },
      { mIdx: 3, name: 'نيسان', fullName: 'نيسان (4)', profit: 0 },
      { mIdx: 2, name: 'آذار', fullName: 'آذار (3)', profit: 0 },
      { mIdx: 1, name: 'شباط', fullName: 'شباط (2)', profit: 0 },
      { mIdx: 0, name: 'ك2', fullName: 'كانون الثاني (1)', profit: 0 }
    ];

    filteredSales.forEach(item => {
      const m = new Date(item.date).getMonth();
      const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
      const target = monthConfig.find(slot => slot.mIdx === m);
      if (target) {
        target.profit = parseFloat((target.profit + p).toFixed(2));
      }
    });

    return monthConfig;
  };

  const chartData = period === 'daily'
    ? getDailyData()
    : period === 'weekly'
      ? getWeeklyData()
      : period === 'monthly'
        ? getMonthlyData()
        : getYearlyData();

  const handleExportSummary = () => {
    const periodTitles = {
      daily: 'اليومي',
      weekly: 'الأسبوعي',
      monthly: 'الشهري',
      yearly: 'السنوي'
    };

    const items = filteredSales.map(s => {
      const rawPrice = parseFloat(s.sellingPrice) || 0;
      const isLBP = s.currency === 'LBP';
      const nativePriceLabel = isLBP
        ? `${Math.round(rawPrice).toLocaleString()} ل.ل`
        : `$${rawPrice.toFixed(2)}`;

      const saleInUSD = toUSD(rawPrice, s.currency);
      const profitInUSD = s.profitUSD !== undefined
        ? parseFloat(s.profitUSD) || 0
        : Math.max(0, saleInUSD - (parseFloat(s.costUSD) || 0));

      const profitLabel = profitInUSD > 0
        ? `ربح: +$${profitInUSD.toFixed(2)}`
        : 'استرداد تكلفة / رأس مال';

      return {
        name: s.itemName || s.title || s.operator?.toUpperCase() || 'عملية بيع',
        sub: `${s.customerName || 'عام'} • ${formatDateTime(s.date || Date.now())}`,
        price: `${nativePriceLabel} (${profitLabel})`
      };
    });

    openPrintableReceipt({
      title: `تقرير الجرد المالي الشامل (${periodTitles[period] || 'العام'})`,
      shopName: brandConfig.name,
      shopSubtitle: brandConfig.subtitle,
      shopPhone: brandConfig.phone,
      shopLogo: brandConfig.logo,
      customerName: 'إدارة النظام والمالية',
      dateStr: formatDateTime(new Date()),
      items: items,
      totals: {
        subTotal: `$${totalSalesUSDOnly.toFixed(2)} + ${Math.round(totalSalesLBPOnly).toLocaleString()} ل.ل (الإجمالي المعادل: $${totalSalesCombinedUSD.toFixed(2)})`,
        profit: `+$${totalProfitsUSD.toFixed(2)} (صافي ربح محقق) • مصاريف الفترة: $${periodExpensesUSD.toFixed(2)}`,
        debts: `$${unpaidCustomerDebtsUSD.toFixed(2)} (ديون الزبائن القائمة)`,
        grandTotal: `$${totalWalletsUSD.toFixed(2)} (سيولة الصناديق المتوفرة)`
      },
      notes: `سعر الصرف المعتمد: $1 = ${exchangeRate.toLocaleString()} ل.ل • عدد عمليات البيع: ${filteredSales.length} • كروت مشتراة: ${cardPurchases.length}`,
      accentColor: '#FF7A00'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', direction: 'rtl' }}>

      <div className="tz-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp color="var(--orange-primary)" size={22} />
            <span style={{ fontWeight: '800', fontSize: '18px', color: 'var(--text-main)' }}>الجرد والتقارير المالية</span>
          </div>
          <button
            type="button"
            onClick={handleExportSummary}
            style={{
              background: 'rgba(255,122,0,0.15)',
              border: '1px solid var(--orange-primary)',
              color: 'var(--orange-primary)',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Printer size={14} /> طباعة تقرير الجرد
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
          {[
            { id: 'daily', label: 'يومي' },
            { id: 'weekly', label: 'أسبوعي' },
            { id: 'monthly', label: 'شهري' },
            { id: 'yearly', label: 'سنوي' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '8px 4px',
                borderRadius: '10px',
                border: period === p.id ? '1px solid var(--orange-primary)' : '1px solid var(--border-color)',
                background: period === p.id ? 'var(--orange-primary)' : 'var(--bg-input)',
                color: period === p.id ? '#ffffff' : 'var(--text-main)',
                fontSize: '12px',
                fontWeight: '900',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي المبيعات (حسب العملة)</div>
            <div style={{ fontSize: '16px', fontWeight: '900', marginTop: '4px', color: 'var(--text-main)' }}>
              ${totalSalesUSDOnly.toFixed(2)}
            </div>
            {totalSalesLBPOnly > 0 && (
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--orange-primary)', marginTop: '2px' }}>
                + {Math.round(totalSalesLBPOnly).toLocaleString()} ل.ل
              </div>
            )}
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
              المعادل الإجمالي: ${totalSalesCombinedUSD.toFixed(2)}
            </div>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>صافي الربح المحقق</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--green)', marginTop: '4px' }}>
              +${totalProfitsUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--green)' }}>
              ≈ +{Math.round(totalProfitsUSD * exchangeRate).toLocaleString()} ل.ل
            </div>
            {periodExpensesUSD > 0 && (
              <div style={{ fontSize: '9px', color: 'var(--red)', marginTop: '2px' }}>
                مصاريف الفترة: -${periodExpensesUSD.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--bg-card-sub)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ديون الزبائن:</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: unpaidCustomerDebtsUSD > 0 ? 'var(--red)' : 'var(--text-main)' }}>
              ${unpaidCustomerDebtsUSD.toFixed(2)}
            </span>
          </div>

          <div style={{ background: 'var(--bg-card-sub)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رأس مال كروت معلق:</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: unpaidBoxDebtsUSD > 0 ? 'var(--orange-primary)' : 'var(--green)' }}>
              ${unpaidBoxDebtsUSD.toFixed(2)}
            </span>
          </div>
        </div>

        <div style={{ height: '170px', width: '100%', marginBottom: '14px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} interval={0} tickLine={false} />
              <Tooltip
                formatter={(val) => [`$${parseFloat(val || 0).toFixed(2)}`, 'صافي الربح']}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0] && payload[0].payload && payload[0].payload.fullName) {
                    return payload[0].payload.fullName;
                  }
                  return label;
                }}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontWeight: 'bold',
                  direction: 'rtl'
                }}
              />
              <Bar dataKey="profit" fill="var(--orange-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>
              مبيعات الفترة ({filteredSales.length}):
            </span>
            {cardPurchases.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                كروت مشتراة من المحافظ: <b>{cardPurchases.length}</b>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
            {filteredSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                لا توجد مبيعات مسجلة في هذه الفترة
              </div>
            ) : (
              filteredSales.map((s, idx) => {
                const rawPrice = parseFloat(s.sellingPrice) || 0;
                const isLBP = s.currency === 'LBP';
                const profitVal = s.profitUSD !== undefined ? parseFloat(s.profitUSD) : 0;

                return (
                  <div key={s.id || idx} style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{s.customerName || 'عام'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginRight: '6px' }}>({s.itemName || s.title})</span>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '900', color: isLBP ? 'var(--orange-primary)' : 'var(--text-main)' }}>
                          {isLBP ? `${Math.round(rawPrice).toLocaleString()} ل.ل` : `$${rawPrice.toFixed(2)}`}
                        </div>
                        {isLBP && (
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                            ≈ ${(rawPrice / exchangeRate).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '10px', color: profitVal > 0 ? 'var(--green)' : 'var(--orange-primary)', fontWeight: 'bold' }}>
                      {profitVal > 0
                        ? `صافي ربح محقق: +$${profitVal.toFixed(2)}`
                        : 'سداد تكلفة / استرداد رأس مال الكارت للمحفظة'}
                    </div>

                    {s.explanation && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {s.explanation}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <DonutChart sources={sources} />

    </div>
  );
}