import React, { useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Printer } from 'lucide-react';
import DonutChart from './DonutChart';
import { openPrintableReceipt } from '../utils/receiptPrinter';
import { formatDateTime } from '../utils/dateFormatter';

export default function Analytics({
  salesHistory = [],
  sources = [],
  debts = [],
  brandConfig = {},
  exchangeRate = 89500
}) {
  const [period, setPeriod] = useState('weekly'); // 'daily' | 'weekly' | 'monthly' | 'yearly'

  const toUSD = (amount, currency) => {
    const val = parseFloat(amount) || 0;
    return currency === 'LBP' ? val / exchangeRate : val;
  };

  const getLocalDateKey = (d) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const now = new Date();

  // حساب نطاق الأسبوع الحالي (من بداية يوم الاثنين 00:00 إلى نهاية الأحد 23:59)
  const getWeekRange = () => {
    const dayOfWeek = now.getDay(); // 0: أحد، 1: اثنين ...
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  // 1. فلترة المبيعات بدقة طبقاً للفترة المختارة
  const filteredSales = salesHistory.filter(item => {
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

  // حساب الإجماليات للفترة المحددة
  let totalSalesUSD = 0;
  let totalProfitsUSD = 0;

  filteredSales.forEach((item) => {
    const saleInUSD = toUSD(item.sellingPrice, item.currency);
    const profitInUSD = item.profitUSD !== undefined
      ? parseFloat(item.profitUSD) || 0
      : Math.max(0, saleInUSD - (parseFloat(item.costUSD) || 0));

    totalSalesUSD += saleInUSD;
    totalProfitsUSD += profitInUSD;
  });

  // فصل ديون الزبائن عن رأس مال المحافظ المعلق
  const unpaidCustomerDebtsUSD = debts
    .filter(d => !d.paid && d.category !== 'boxes')
    .reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);

  const unpaidBoxDebtsUSD = debts
    .filter(d => !d.paid && d.category === 'boxes')
    .reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);

  const totalWalletsUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0)), 0);

  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // 1. مخطط اليومي: يبدأ من اليمين بـ صباحاً ➔ ظهراً ➔ عصراً ➔ مساءً
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

  // 2. مخطط الأسبوعي: يبدأ بالعامود الأول من اليمين (الاثنين ➔ الثلاثاء ➔ الأربعاء ➔ الخميس ➔ الجمعة ➔ السبت ➔ الأحد)
  const getWeeklyData = () => {
    const { monday } = getWeekRange();

    // مصفوفة الأيام مرتبة من الاثنين إلى الأحد
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

    // Recharts ترسم إحداثيات المصفوفة من اليسار إلى اليمين
    // لذلك نقوم بعكسها حتى يصبح "الاثنين" في أقصى اليمين (أول عامود) و"الأحد" في أقصى اليسار
    return [...daysFromMonToSun].reverse();
  };

  // 3. مخطط الشهري: يبدأ من اليمين بـ أسبوع 1 ➔ أسبوع 2 ➔ أسبوع 3 ➔ أسبوع 4
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

  // 4. مخطط السنوي: يبدأ من اليمين بـ ك2 (كانون 2) وصولاً لـ ك1 (كانون 1) باليسار
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
      const saleInUSD = toUSD(s.sellingPrice, s.currency);
      const profitInUSD = s.profitUSD !== undefined
        ? parseFloat(s.profitUSD) || 0
        : Math.max(0, saleInUSD - (parseFloat(s.costUSD) || 0));

      const profitLabel = profitInUSD > 0
        ? `ربح: +$${profitInUSD.toFixed(2)}`
        : 'استرداد تكلفة / سداد رأس مال';

      return {
        name: s.itemName || s.title || s.operator?.toUpperCase() || 'عملية بيع',
        sub: `${s.customerName || 'عام'} • ${formatDateTime(s.date || Date.now())}`,
        price: `$${saleInUSD.toFixed(2)} (${profitLabel})`
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
        subTotal: `$${totalSalesUSD.toFixed(2)} (${Math.round(totalSalesUSD * exchangeRate).toLocaleString()} ل.ل)`,
        profit: `+$${totalProfitsUSD.toFixed(2)} (صافي ربح محقق)`,
        debts: `$${unpaidCustomerDebtsUSD.toFixed(2)} (ديون الزبائن القائمة)`,
        boxDebts: unpaidBoxDebtsUSD > 0 ? `$${unpaidBoxDebtsUSD.toFixed(2)} (رأس مال كروت معلق)` : null,
        grandTotal: `$${totalWalletsUSD.toFixed(2)} (سيولة الصناديق المتوفرة)`
      },
      notes: `سعر الصرف المعتمد: $1 = ${exchangeRate.toLocaleString()} ل.ل • عدد الحركات: ${filteredSales.length}`,
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

        {/* فلاتر الفترات الأربع: يومي، أسبوعي، شهري، سنوي */}
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

        {/* كروت الإجماليات للفترة المحددة */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي المبيعات المحصلة</div>
            <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px', color: 'var(--text-main)' }}>
              ${totalSalesUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              ≈ {Math.round(totalSalesUSD * exchangeRate).toLocaleString()} ل.ل
            </div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>صافي الربح </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--green)', marginTop: '4px' }}>
              +${totalProfitsUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--green)' }}>
              ≈ +{Math.round(totalProfitsUSD * exchangeRate).toLocaleString()} ل.ل
            </div>
          </div>
        </div>

        {/* ملخص الديون المفصل */}
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

        {/* المخطط البياني للأرباح */}
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

        {/* تفاصيل العمليات الخاصة بالفترة المحددة */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '8px' }}>
            العمليات المندرجة بالجرد ({filteredSales.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {filteredSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                لا توجد عمليات مسجلة في هذه الفترة
              </div>
            ) : (
              filteredSales.slice(0, 15).map((s, idx) => {
                const profitVal = s.profitUSD !== undefined ? parseFloat(s.profitUSD) : 0;
                return (
                  <div key={idx} style={{ background: 'var(--bg-main)', padding: '8px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{s.customerName || 'عام'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({s.itemName || s.title})</span>
                      </div>
                      <div style={{ fontSize: '10px', color: profitVal > 0 ? 'var(--green)' : 'var(--orange-primary)', fontWeight: 'bold', marginTop: '2px' }}>
                        {profitVal > 0 ? `صافي ربح: +$${profitVal.toFixed(2)}` : 'سداد تكلفة / رأس مال للمحفظة'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '900', color: 'var(--text-main)' }}>
                        {parseFloat(s.sellingPrice).toLocaleString()} {s.currency === 'LBP' ? 'ل.ل' : '$'}
                      </div>
                    </div>
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