/**
 * نظام طباعة ومشاركة الفواتير والتقارير الفخمة للموبايل
 * مربوط تلقائياً وديناميكياً بهوية المتجر من الإعدادات
 */
export function openPrintableReceipt({
  title = 'فاتورة مبيعات',
  customerName = '',
  customerPhone = '',
  dateStr = '',
  items = [],
  totals = {},
  notes = '',
  accentColor = '#FF7A00',
  shopName,
  shopSubtitle,
  shopPhone,
  shopLogo
}) {
  // 1. قراءة بيانات الهوية ديناميكياً من الإعدادات المحفوظة
  let brand = {};
  try {
    const raw = localStorage.getItem('tb_brand_config');
    if (raw) brand = JSON.parse(raw);
  } catch (err) {
    brand = {};
  }

  // استخدام البيانات المدخلة في الإعدادات بدون أي قيم افتراضية ثابتة
  const finalShopName = shopName || brand.name || '';
  const finalSubtitle = shopSubtitle !== undefined ? shopSubtitle : (brand.subtitle || '');
  const finalPhone = shopPhone !== undefined ? shopPhone : (brand.phone || '');
  const finalLogo = shopLogo !== undefined ? shopLogo : (brand.logo || '');
  const currentYear = new Date().getFullYear();

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) من إعدادات المتصفح لعرض وطباعة الفاتورة!');
    return;
  }

  const itemsHtml = items.length === 0
    ? `<tr><td colspan="3" style="padding: 14px; text-align: center; color: #64748b;">لا توجد عمليات مسجلة</td></tr>`
    : items.map(item => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #1e293b;">${item.name}</td>
        <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 11px; direction: ltr;">${item.sub || ''}</td>
        <td style="padding: 10px 8px; text-align: left; font-weight: 900; color: #0f172a;">${item.price}</td>
      </tr>
    `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - ${finalShopName}</title>
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { margin: 0; padding: 12px; background: #f8fafc; color: #0f172a; }
        .wrapper { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
        
        /* شريط الأدوات العلوي للموبايل */
        .mobile-bar {
          background: #0f172a;
          padding: 12px 14px;
          display: flex;
          gap: 6px;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .btn-action {
          border: none;
          border-radius: 10px;
          padding: 8px 10px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .btn-print { background: ${accentColor}; color: #fff; flex: 1.4; }
        .btn-copy { background: #3b82f6; color: #fff; flex: 1; }
        .btn-share { background: #22c55e; color: #fff; flex: 1.1; }
        .btn-close { background: #334155; color: #fff; }

        .invoice-body { padding: 20px; }
        .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 14px; margin-bottom: 14px; }
        .shop-logo { max-height: 65px; max-width: 140px; object-fit: contain; border-radius: 10px; margin-bottom: 8px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 900; color: ${accentColor}; letter-spacing: 0.5px; }
        .header p { margin: 3px 0; font-size: 11px; color: #64748b; font-weight: 600; }

        .client-card { background: #f1f5f9; padding: 10px 14px; border-radius: 12px; font-size: 12px; margin-bottom: 14px; }
        .client-card div { margin-bottom: 3px; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 8px; font-weight: 800; color: #475569; }

        .totals-card { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 12px; font-size: 13px; display: flex; flex-direction: column; gap: 8px; }
        .total-row { display: flex; justify-content: space-between; align-items: center; }
        
        .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 14px; margin-top: 18px; }

        /* إخفاء شريط الأدوات نهائياً عند الطباعة الحقيقية أو الحفظ كـ PDF */
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; padding: 0; }
          .wrapper { border: none; box-shadow: none; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        
        <!-- أزرار التحكم في أعلى الصفحة للموبايل -->
        <div class="mobile-bar no-print">
          <button class="btn-action btn-print" onclick="executePrint()">
            <span>🖨️ طباعة / PDF</span>
          </button>
          <button class="btn-action btn-copy" id="btn-copy-el" onclick="copyInvoiceText()">
            <span>📋 نسخ</span>
          </button>
          <button class="btn-action btn-share" onclick="shareViaWhatsApp()">
            <span>📲 واتساب</span>
          </button>
          <button class="btn-action btn-close" onclick="window.close()">
            <span>✕ رجوع</span>
          </button>
        </div>

        <div class="invoice-body" id="invoice-printable-content">
          <div class="header">
            ${finalLogo ? `<div><img src="${finalLogo}" alt="Logo" class="shop-logo" /></div>` : ''}
            ${finalShopName ? `<h1>${finalShopName}</h1>` : ''}
            ${finalSubtitle ? `<p>${finalSubtitle}</p>` : ''}
            <p>
              ${finalPhone ? `<span>هاتف: ${finalPhone}</span>` : ''}
              ${finalPhone && dateStr ? ` • ` : ''}
              ${dateStr ? `<span dir="ltr" style="display: inline-block;">${dateStr}</span>` : ''}
            </p>
          </div>

          ${customerName ? `
            <div class="client-card">
              <div><strong>الجهة / العميل:</strong> ${customerName}</div>
              ${customerPhone ? `<div><strong>رقم الهاتف:</strong> ${customerPhone}</div>` : ''}
              <div><strong>نوع التقرير / المعاملة:</strong> ${title}</div>
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="text-align: right;">البيان</th>
                <th style="text-align: center;">التفاصيل / التاريخ</th>
                <th style="text-align: left;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals-card">
            ${totals.subTotal ? `
              <div class="total-row">
                <span style="color: #64748b;">حجم المبيعات:</span>
                <strong>${totals.subTotal}</strong>
              </div>
            ` : ''}
            ${totals.profit ? `
              <div class="total-row" style="color: #10b981; font-weight: 800;">
                <span>صافي الأرباح المحققة:</span>
                <span>${totals.profit}</span>
              </div>
            ` : ''}
            ${totals.debts ? `
              <div class="total-row" style="color: #ef4444; font-weight: 800;">
                <span>إجمالي الديون القائمة:</span>
                <span>${totals.debts}</span>
              </div>
            ` : ''}
            <div class="total-row" style="border-top: 1.5px solid #cbd5e1; padding-top: 8px; font-size: 15px; font-weight: 900; color: ${accentColor};">
              <span>المجموع النهائي / السيولة:</span>
              <span>${totals.grandTotal || '$0.00'}</span>
            </div>
          </div>

          ${notes ? `<p style="font-size: 11px; color: #64748b; margin-top: 12px; text-align: center;">${notes}</p>` : ''}

          <div class="footer">
            <div>معتمد رسمياً من ${finalShopName || 'إدارة المتجر'}</div>
            <div style="margin-top: 4px; direction: ltr;">By <strong>Zolfa Tech Est</strong> • © ${currentYear}</div>
          </div>
        </div>

      </div>

      <script>
        function executePrint() {
          window.focus();
          setTimeout(function() {
            window.print();
          }, 150);
        }

        function copyInvoiceText() {
          var content = document.getElementById('invoice-printable-content').innerText;
          navigator.clipboard.writeText(content).then(function() {
            var btn = document.getElementById('btn-copy-el');
            if (btn) btn.innerHTML = '<span>✓ تم النسخ</span>';
            setTimeout(function() {
              if (btn) btn.innerHTML = '<span>📋 نسخ</span>';
            }, 2000);
          }).catch(function() {
            alert('تم نسخ تفاصيل الفاتورة');
          });
        }

        function shareViaWhatsApp() {
          var titleStr = '${finalShopName ? finalShopName + "\\n" : ""}';
          var text = encodeURIComponent(titleStr + 'فاتورة / تقرير: ${title}\\nالعميل: ${customerName || "عام"}\\nالمجموع: ${totals.grandTotal || ""}\\nتاريخ: ${dateStr}');
          window.open('https://wa.me/?text=' + text, '_blank');
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}