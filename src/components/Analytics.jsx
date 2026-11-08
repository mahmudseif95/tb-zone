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

  // 1. فلترة المبيعات بدقة طبقاً للفترة المختارة
  const now = new Date();
  const filteredSales = salesHistory.filter(item => {
    if (!item.date) return false;
    const itemDate = new Date(item.date);
    if (isNaN(itemDate.getTime())) return false;

    if (period === 'daily') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (period === 'weekly') {
      const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7;
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

  const totalDebtsUSD = debts.filter(d => !d.paid).reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);
  const totalWalletsUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0)), 0);

  // 2. تجميع بيانات الرسم البياني حسب الفترة
  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const arabicMonths = ['كانون 2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين 1', 'تشرين 2', 'كانون 1'];

  // مخطط اليومي (موزع على ساعات اليوم)
  const getDailyData = () => {
    const hoursSlots = [
      { name: 'صباحاً', profit: 0, minHour: 0, maxHour: 12 },
      { name: 'ظهراً', profit: 0, minHour: 12, maxHour: 16 },
      { name: 'عصراً', profit: 0, minHour: 16, maxHour: 20 },
      { name: 'مساءً', profit: 0, minHour: 20, maxHour: 24 }
    ];

    filteredSales.forEach(item => {
      const d = new Date(item.date);
      const h = d.getHours();
      const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
      const slot = hoursSlots.find(s => h >= s.minHour && h < s.maxHour);
      if (slot) slot.profit = parseFloat((slot.profit + p).toFixed(2));
    });

    return hoursSlots.map(s => ({ name: s.name, profit: s.profit }));
  };

  // مخطط الأسبوعي (آخر 7 أيام)
  const getWeeklyData = () => {
    const daysList = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      daysList.push({
        dateKey: d.toISOString().split('T')[0],
        name: arabicDays[d.getDay()],
        profit: 0
      });
    }

    filteredSales.forEach(item => {
      const key = item.date.split('T')[0];
      const target = daysList.find(d => d.dateKey === key);
      if (target) {
        const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
        target.profit = parseFloat((target.profit + p).toFixed(2));
      }
    });

    return daysList;
  };

  // مخطط الشهري (4 أسابيع)
  const getMonthlyData = () => {
    const weeks = [
      { name: 'أسبوع 1', profit: 0 },
      { name: 'أسبوع 2', profit: 0 },
      { name: 'أسبوع 3', profit: 0 },
      { name: 'أسبوع 4', profit: 0 }
    ];

    filteredSales.forEach(item => {
      const dayOfMonth = new Date(item.date).getDate();
      const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
      if (dayOfMonth <= 7) weeks[0].profit += p;
      else if (dayOfMonth <= 14) weeks[1].profit += p;
      else if (dayOfMonth <= 21) weeks[2].profit += p;
      else weeks[3].profit += p;
    });

    return weeks.map(w => ({ ...w, profit: parseFloat(w.profit.toFixed(2)) }));
  };

  // مخطط السنوي (12 شهراً)
  const getYearlyData = () => {
    const months = arabicMonths.map(m => ({ name: m, profit: 0 }));

    filteredSales.forEach(item => {
      const mIdx = new Date(item.date).getMonth();
      const p = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, toUSD(item.sellingPrice, item.currency) - (parseFloat(item.costUSD) || 0));
      if (months[mIdx]) {
        months[mIdx].profit = parseFloat((months[mIdx].profit + p).toFixed(2));
      }
    });

    return months;
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

      return {
        name: s.itemName || s.title || s.operator?.toUpperCase() || 'عملية بيع',
        sub: `${s.customerName || 'عام'} • ${formatDateTime(s.date || Date.now())}`,
        price: `$${saleInUSD.toFixed(2)} (ربح: +$${profitInUSD.toFixed(2)})`
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
        debts: `$${totalDebtsUSD.toFixed(2)} (${debts.filter(d => !d.paid).length} ذمة غير مسددة)`,
        grandTotal: `$${totalWalletsUSD.toFixed(2)} (سيولة الصناديق الحالية)`
      },
      notes: `سعر الصرف المعتمد بالجرد: $1 = ${exchangeRate.toLocaleString()} ل.ل • عدد الحركات في التقرير: ${filteredSales.length}`,
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

        {/* فلاتر الفترات الأربعة الصريحة: يومي، أسبوعي، شهري، سنوي */}
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
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي المبيعات</div>
            <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px', color: 'var(--text-main)' }}>
              ${totalSalesUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              ≈ {Math.round(totalSalesUSD * exchangeRate).toLocaleString()} ل.ل
            </div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>صافي الربح الحقيقي</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--green)', marginTop: '4px' }}>
              +${totalProfitsUSD.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--green)' }}>
              ≈ +{Math.round(totalProfitsUSD * exchangeRate).toLocaleString()} ل.ل
            </div>
          </div>
        </div>

        {/* المخطط البياني المتفاعل مع كل فترة */}
        <div style={{ height: '170px', width: '100%', marginBottom: '14px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
              <Tooltip
                formatter={(val) => [`$${parseFloat(val || 0).toFixed(2)}`, 'صافي الربح']}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontWeight: 'bold'
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
            {filteredSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                لا توجد عمليات مسجلة في هذه الفترة
              </div>
            ) : (
              filteredSales.slice(0, 10).map((s, idx) => (
                <div key={idx} style={{ background: 'var(--bg-main)', padding: '8px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{s.customerName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginRight: '6px' }}>({s.operator?.toUpperCase() || s.itemName || 'رصيد'})</span>
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {parseFloat(s.sellingPrice).toLocaleString()} {s.currency === 'LBP' ? 'ل.ل' : '$'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DonutChart sources={sources} />

    </div>
  );
}