import React, { useRef } from 'react';
import { Printer, Download, X, CheckCircle, Phone, Calendar, Store, FileText } from 'lucide-react';

export default function InvoiceModal({ 
  isOpen, 
  onClose, 
  invoiceData, // تفاصيل العملية
  brandConfig, // اسم المحل، اللوغو، والتفاصيل
  shopPhone = '03-123456' // رقم هاتف صاحب المحل
}) {
  const printAreaRef = useRef(null);

  if (!isOpen || !invoiceData) return null;

  const handlePrint = () => {
    window.print();
  };

  const {
    invoiceType = 'وصل عملية', // "جرد مالي", "كشف حساب زبون", "شحن رصيد", "عملية بيع"
    invoiceNumber = `INV-${Date.now().toString().slice(-6)}`,
    date = new Date().toLocaleString('ar-LB'),
    customerName,
    customerPhone,
    items = [], // قائمة العناصر أو التفاصيل: [{ title, desc, qty, price, total }]
    totalAmountUSD,
    totalAmountLBP,
    paidAmount,
    remainingAmount,
    notes
  } = invoiceData;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-center" 
        style={{ maxWidth: '480px', padding: '20px', background: '#FFFFFF', color: '#0F172A' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* أزرار التحكم العلوية (لا تظهر عند الطباعة) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: 'linear-gradient(135deg, #FF8800 0%, #FF5500 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer size={15} /> طباعة / حفظ PDF
            </button>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* جسم الفاتورة الرسمي للطباعة والعرض */}
        <div id="printable-invoice" ref={printAreaRef} style={{ direction: 'rtl', fontFamily: 'sans-serif' }}>
          
          {/* ترويسة المحل وصاحب العمل */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #CBD5E1', paddingBottom: '14px', marginBottom: '14px' }}>
            {brandConfig?.logo && (
              <img src={brandConfig.logo} alt="Logo" style={{ height: '45px', marginBottom: '6px', objectFit: 'contain' }} />
            )}
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>
              {brandConfig?.name || 'ZOLFA TECH'}
            </h2>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontWeight: '600' }}>
              {brandConfig?.subtitle || 'نظام الاتصالات والمحاسبة'}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '11px', color: '#334155' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={12} color="#EA580C" /> {shopPhone}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} color="#EA580C" /> {date}
              </span>
            </div>
          </div>

          {/* نوع الفاتورة والرمز */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>نوع المستند</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#EA580C' }}>{invoiceType}</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>رقم الإيصال</span>
              <span style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>#{invoiceNumber}</span>
            </div>
          </div>

          {/* معلومات الزبون إن وجدت */}
          {(customerName || customerPhone) && (
            <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>الزبون:</strong> {customerName || 'عام'}</span>
                {customerPhone && <span><strong>الهاتف:</strong> {customerPhone}</span>}
              </div>
            </div>
          )}

          {/* جدول بنود وتفاصيل العملية */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                <th style={{ padding: '8px', textAlign: 'right' }}>البيان / تفاصيل الخدمة</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>الكمية</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>القيمة</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ fontWeight: 'bold', color: '#0F172A' }}>{item.title}</div>
                      {item.desc && <div style={{ fontSize: '10px', color: '#64748B' }}>{item.desc}</div>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#334155' }}>{item.qty || 1}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', color: '#0F172A' }}>
                      {item.total}
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td colSpan="3" style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                    عملية نقدية مباشرة
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ملخص الحساب والإجمالي */}
          <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {totalAmountUSD !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#475569' }}>المبلغ الإجمالي بالدولار:</span>
                <span style={{ fontWeight: '800', color: '#0F172A' }}>${parseFloat(totalAmountUSD).toFixed(2)}</span>
              </div>
            )}

            {totalAmountLBP !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#475569' }}>المبلغ بالليرة اللبنانية:</span>
                <span style={{ fontWeight: '800', color: '#0F172A' }}>{Math.round(totalAmountLBP).toLocaleString()} ل.ل</span>
              </div>
            )}

            {paidAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#059669', borderTop: '1px dashed #E2E8F0', paddingTop: '4px' }}>
                <span>المدفوع:</span>
                <span style={{ fontWeight: 'bold' }}>{paidAmount}</span>
              </div>
            )}

            {remainingAmount !== undefined && parseFloat(remainingAmount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#DC2626' }}>
                <span>المتبقي (دين بذمة الزبون):</span>
                <span style={{ fontWeight: 'bold' }}>{remainingAmount}</span>
              </div>
            )}
          </div>

          {/* ملاحظات وتذييل الفاتورة */}
          {notes && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#64748B', fontStyle: 'italic', textAlign: 'center' }}>
              * {notes}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed #CBD5E1', paddingTop: '10px', fontSize: '11px', color: '#64748B' }}>
            شكراً لتعاملكم معنا • نتمنى لكم يوماً سعيداً
          </div>
        </div>

      </div>
    </div>
  );
}