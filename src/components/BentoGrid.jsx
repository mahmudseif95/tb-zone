import React from 'react';

export default function BentoGrid({ sources = [], lines = [], debts = [] }) {
  // حساب مجموع أرصدة المحافظ
  const totalBalance = sources.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0).toFixed(2);
  
  // حساب عدد الخطوط المقفلة والمفتوحة
  const lockedLinesCount = lines.filter(l => (l.type || 'locked') === 'locked').length;
  const openLinesCount = lines.filter(l => l.type === 'open').length;

  // حساب عدد الديون غير المسددة
  const unpaidDebtsCount = debts.filter(d => !d.paid).length;

  // رصيد Whish الأساسي كمثال
  const whishSource = sources.find(s => s.name?.toLowerCase().includes('whish')) || sources[0];

  return (
    <div className="bento-container" style={{ marginBottom: '20px' }}>
      
      {/* الخلية الكبيرة الرئيسية (2x2): إجمالي السيولة */}
      <article className="bento-tile tile-2x2">
        <div>
          <span className="tile-tag">الميزة الرئيسية</span>
          <h2 className="tile-title" style={{ fontSize: '22px' }}>إجمالي السيولة النقدية</h2>
          <p className="tile-desc">مراقبة دقيقة وفورية لحركة المحافظ، الأرصدة، والمبيعات.</p>
        </div>
        <div className="tile-stat" style={{ color: 'var(--orange-primary)' }}>
          ${totalBalance}
        </div>
      </article>

      {/* خلية (1x1): الخطوط المقفلة */}
      <article className="bento-tile">
        <div>
          <span className="tile-tag">الخطوط المقفلة</span>
          <h3 className="tile-title">خطوط مغلقة</h3>
        </div>
        <div className="tile-stat">{lockedLinesCount}</div>
      </article>

      {/* خلية (1x1): الخطوط المفتوحة */}
      <article className="bento-tile">
        <div>
          <span className="tile-tag">الخطوط المفتوحة</span>
          <h3 className="tile-title">Admin + 3</h3>
        </div>
        <div className="tile-stat">{openLinesCount}</div>
      </article>

      {/* خلية عريضة (2x1): حالة النظام والترخيص */}
      <article className="bento-tile tile-2x1">
        <div>
          <span className="tile-tag">حالة الأمان</span>
          <h3 className="tile-title">نظام محمي ومرخص</h3>
          <p className="tile-desc">مرتبط بمعرف الجهاز المشفر System ID.</p>
        </div>
        <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 'bold', color: 'var(--green)' }}>
          ● نشط ومحمي
        </div>
      </article>

      {/* خلية عمودية (1x2): الديون غير المسددة */}
      <article className="bento-tile tile-1x2">
        <div>
          <span className="tile-tag">الديون</span>
          <h3 className="tile-title">غير مسددة</h3>
          <p className="tile-desc">سجلات بانتظار التحصيل.</p>
        </div>
        <div className="tile-stat" style={{ color: 'var(--red)' }}>
          {unpaidDebtsCount}
        </div>
      </article>

      {/* خلية (1x1): رصيد صندوق Whish */}
      <article className="bento-tile">
        <div>
          <span className="tile-tag">الصندوق</span>
          <h3 className="tile-title">{whishSource?.name || 'Whish Cash'}</h3>
        </div>
        <div className="tile-stat">${whishSource?.balance || '0.00'}</div>
      </article>

    </div>
  );
}