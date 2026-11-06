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
  const [period, setPeriod] = useState('weekly'); // 'weekly' | 'monthly'

  // 1. حساب إجمالي المبيعات والأرباح الفعلية
  let totalSalesUSD = 0;
  let totalProfitsUSD = 0;

  salesHistory.forEach((item) => {
    const sale = parseFloat(item.sellingPrice) || 0;
    const isLBP = item.currency === 'LBP';
    const saleInUSD = isLBP ? sale / exchangeRate : sale;
    const profitInUSD = item.profitUSD !== undefined
      ? parseFloat(item.profitUSD) || 0
      : Math.max(0, saleInUSD - (parseFloat(item.costUSD) || 0));

    totalSalesUSD += saleInUSD;
    totalProfitsUSD += profitInUSD;
  });

  // حساب إجمالي الديون القائمة
  const totalDebtsUSD = debts.filter(d => !d.paid).reduce((sum, d) => {
    const amt = parseFloat(d.amount) || 0;
    return sum + (d.currency === 'LBP' ? amt / exchangeRate : amt);
  }, 0);

  // حساب إجمالي سيولة الصناديق والمحافظ
  const totalWalletsUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0)), 0);

  // 2. تجميع الأرباح اليومية الفعلية بناءً على التواريخ المسجلة في العمليات
  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const getDynamicWeeklyData = () => {
    const last7Days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dayName = arabicDays[d.getDay()];

      last7Days.push({
        dateKey,
        name: dayName,
        profit: 0
      });
    }

    salesHistory.forEach((item) => {
      if (!item.date) return;
      const itemDateKey = item.date.split('T')[0];
      const targetDay = last7Days.find((d) => d.dateKey === itemDateKey);

      if (targetDay) {
        const sale = parseFloat(item.sellingPrice) || 0;
        const isLBP = item.currency === 'LBP';
        const saleInUSD = isLBP ? sale / exchangeRate : sale;
        const profit = item.profitUSD !== undefined
          ? parseFloat(item.profitUSD) || 0
          : Math.max(0, saleInUSD - (parseFloat(item.costUSD) || 0));

        targetDay.profit = parseFloat((targetDay.profit + profit).toFixed(2));
      }
    });

    return last7Days;
  };

  const getDynamicMonthlyData = () => {
    const weeks = [
      { name: 'الأسبوع 1', profit: 0 },
      { name: 'الأسبوع 2', profit: 0 },
      { name: 'الأسبوع 3', profit: 0 },
      { name: 'الأسبوع 4', profit: 0 }
    ];

    const now = new Date();
    salesHistory.forEach((item) => {
      if (!item.date) return;
      const diffDays = Math.floor((now - new Date(item.date)) / (1000 * 60 * 60 * 24));
      const sale = parseFloat(item.sellingPrice) || 0;
      const isLBP = item.currency === 'LBP';
      const saleInUSD = isLBP ? sale / exchangeRate : sale;
      const profit = item.profitUSD !== undefined
        ? parseFloat(item.profitUSD) || 0
        : Math.max(0, saleInUSD - (parseFloat(item.costUSD) || 0));

      if (diffDays >= 0 && diffDays < 7) weeks[3].profit += profit;
      else if (diffDays >= 7 && diffDays < 14) weeks[2].profit += profit;
      else if (diffDays >= 14 && diffDays < 21) weeks[1].profit += profit;
      else if (diffDays >= 21 && diffDays < 28) weeks[0].profit += profit;
    });

    return weeks.map(w => ({ ...w, profit: parseFloat(w.profit.toFixed(2)) }));
  };

  const chartData = period === 'monthly' ? getDynamicMonthlyData() : getDynamicWeeklyData();

  // تصدير التقرير المالي الملون والمربوط بديناميكية الهوية
  const handleExportSummary = () => {
    const items = salesHistory.map(s => {
      const sale = parseFloat(s.sellingPrice) || 0;
      const isLBP = s.currency === 'LBP';
      const saleInUSD = isLBP ? sale / exchangeRate : sale;
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
      title: `تقرير الجرد المالي الشامل (${period === 'monthly' ? 'شهري' : 'أسبوعي'})`,
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
      notes: `سعر الصرف المعتمد بالجرد: $1 = ${exchangeRate.toLocaleString()} ل.ل • عدد الحركات: ${salesHistory.length}`,
      accentColor: '#FF7A00'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', direction: 'rtl' }}>

      {/* بطاقة التقرير والمبيعات الرئيسية */}
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

        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {[
            { id: 'weekly', label: 'أسبوعي (أيام فعلية)' },
            { id: 'monthly', label: 'شهري (أسابيع)' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: '10px',
                border: period === p.id ? '1px solid var(--orange-primary)' : '1px solid var(--border-color)',
                background: period === p.id ? 'var(--orange-primary)' : 'var(--bg-input)',
                color: period === p.id ? '#ffffff' : 'var(--text-main)',
                fontSize: '11px',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* المبيعات وصافي الأرباح الفعلية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي المبيعات الفعلي</div>
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

        {/* المخطط البياني المربوط بالتواريخ الفعلية */}
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

        {/* سجل العمليات الأخيرة */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '8px' }}>
            آخر العمليات المسجلة بالجرد ({salesHistory.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
            {salesHistory.slice(0, 8).map((s, idx) => (
              <div key={idx} style={{ background: 'var(--bg-main)', padding: '8px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{s.customerName}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginRight: '6px' }}>({s.operator?.toUpperCase() || s.itemName || 'رصيد'})</span>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {parseFloat(s.sellingPrice).toLocaleString()} {s.currency === 'LBP' ? 'ل.ل' : '$'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* مخطط توزيع السيولة الحقيقي */}
      <DonutChart sources={sources} />

    </div>
  );
}