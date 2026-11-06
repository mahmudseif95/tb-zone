import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Phone,
  MapPin,
  Printer,
  Trash2,
  X,
  Edit2,
  MessageCircle,
  FileText,
  DollarSign,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { formatDateTime, formatDateOnly } from '../utils/dateFormatter';
import { openPrintableReceipt } from '../utils/receiptPrinter';

export default function Customers({
  customers = [],
  salesHistory = [],
  debts = [],
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  brandConfig,
  exchangeRate = 89500
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // ملف الزبون الشامل المحدد للعرض
  const [viewingCustomer, setViewingCustomer] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const currentShopPhone = brandConfig?.phone || '78877026';
  const currentShopName = brandConfig?.name || 'TB ZONE';
  const currentShopSubtitle = brandConfig?.subtitle || 'TELECOM & CARDS';

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // قفل سكرول الخلفية عند فتح المودال لمنع التشويه
  useEffect(() => {
    if (viewingCustomer || showAddModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [viewingCustomer, showAddModal]);

  // بحث فوري مرن بالاسم أو رقم الهاتف من أول حرف
  const filteredCustomers = customers.filter(c => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    if (!cleanSearch) return true;
    const matchName = c.name?.toLowerCase().includes(cleanSearch);
    const matchPhone = c.phone && c.phone.includes(cleanSearch);
    return matchName || matchPhone;
  });

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (cust) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone || '');
    setAddress(cust.address || '');
    setShowAddModal(true);
  };

  const handleSaveCustomer = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCustomer) {
      onUpdateCustomer(editingCustomer.id, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim()
      });
    } else {
      onAddCustomer({
        id: Date.now().toString(),
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        createdAt: new Date().toISOString()
      });
    }

    setName('');
    setPhone('');
    setAddress('');
    setShowAddModal(false);
    setEditingCustomer(null);
  };

  // استخراج مشتريات الزبون
  const getCustomerTransactions = (customerName) => {
    if (!customerName) return [];
    return salesHistory.filter(s => s.customerName?.toLowerCase().trim() === customerName.toLowerCase().trim());
  };

  // استخراج ديون الزبون
  const getCustomerDebts = (customerName) => {
    if (!customerName) return [];
    return debts.filter(d => d.name?.toLowerCase().trim() === customerName.toLowerCase().trim());
  };

  const toUSD = (amount, currency) => {
    const val = parseFloat(amount) || 0;
    return currency === 'LBP' ? val / exchangeRate : val;
  };

  // طباعة كشف حساب الزبون بنظام الفواتير الموحد والفاخر
  const triggerDirectPrint = (cust) => {
    const txs = getCustomerTransactions(cust.name);
    const custDebts = getCustomerDebts(cust.name);

    let grandTotalUSD = 0;
    const unpaidDebtUSD = custDebts.filter(d => !d.paid).reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);

    const items = txs.map(t => {
      const itemUSD = toUSD(t.sellingPrice, t.currency);
      grandTotalUSD += itemUSD;

      let displayName = t.itemName || t.simName || t.title || 'عملية بيع';
      const priceFormatted = t.currency === 'LBP'
        ? `${Math.round(parseFloat(t.sellingPrice)).toLocaleString()} L.L`
        : `$${parseFloat(t.sellingPrice).toFixed(2)}`;

      return {
        name: displayName,
        sub: formatDateTime(t.date || Date.now()),
        price: priceFormatted
      };
    });

    openPrintableReceipt({
      title: `كشف حساب زبون - ${cust.name}`,
      customerName: cust.name,
      customerPhone: cust.phone || 'غير مسجل',
      dateStr: formatDateTime(new Date()),
      items: items,
      totals: {
        subTotal: `$${grandTotalUSD.toFixed(2)} (≈ ${Math.round(grandTotalUSD * exchangeRate).toLocaleString()} L.L)`,
        debts: unpaidDebtUSD > 0 ? `$${unpaidDebtUSD.toFixed(2)}` : null,
        grandTotal: `$${(grandTotalUSD + unpaidDebtUSD).toFixed(2)}`
      },
      notes: 'كشف حساب • شكراً لثقتكم',
      accentColor: '#FF7A00',
      shopName: brandConfig?.name,
      shopSubtitle: brandConfig?.subtitle,
      shopPhone: brandConfig?.phone,
      shopLogo: brandConfig?.logo
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      {/* بطاقة البحث وإضافة زبون */}
      <div className="tz-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={18} color="var(--orange-primary)" />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900' }}>دليل ملفات الزبائن </h2>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{customers.length} مسجل</span>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn-primary"
          style={{ width: '100%', height: '42px', borderRadius: '12px', fontSize: '13px' }}
        >
          <Plus size={16} />
          <span>فتح ملف زبون جديد</span>
        </button>

        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', right: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="ابحث باسم الزبون أو الهاتف..."
            className="tz-input"
            style={{ paddingRight: '36px', height: '40px', fontSize: '13px' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* بطاقات الزبائن */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredCustomers.length === 0 ? (
          <div className="tz-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
            لا يوجد زبائن مطابقين للبحث.
          </div>
        ) : (
          filteredCustomers.map(cust => {
            const txs = getCustomerTransactions(cust.name);
            const custDebts = getCustomerDebts(cust.name);

            const totalSalesUSD = txs.reduce((sum, t) => sum + toUSD(t.sellingPrice, t.currency), 0);
            const totalCostUSD = txs.reduce((sum, t) => sum + (parseFloat(t.costUSD) || 0), 0);
            const netProfitUSD = Math.max(0, totalSalesUSD - totalCostUSD);
            const unpaidDebtUSD = custDebts.filter(d => !d.paid).reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);

            return (
              <div
                key={cust.id}
                className="tz-card"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', position: 'relative', cursor: 'pointer' }}
                onClick={() => setViewingCustomer(cust)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>{cust.name}</span>
                      {unpaidDebtUSD > 0 && (
                        <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--red)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                          عليه دين: ${unpaidDebtUSD.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {cust.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={11} color="var(--orange-primary)" /> {cust.phone}</span>}
                      {cust.address && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} color="var(--orange-primary)" /> {cust.address}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => triggerDirectPrint(cust)}
                      style={{
                        background: 'rgba(255, 122, 0, 0.12)',
                        border: '1px solid var(--orange-primary)',
                        color: 'var(--orange-primary)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}
                      title="طباعة كشف الحساب"
                    >
                      <Printer size={13} />
                      <span>طباعة</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === cust.id ? null : cust.id);
                      }}
                      style={{
                        background: 'var(--bg-card-sub)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '6px',
                        color: 'var(--text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>

                    {activeMenuId === cust.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '44px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                          minWidth: '160px',
                          zIndex: 100,
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          onClick={() => {
                            setActiveMenuId(null);
                            handleOpenEdit(cust);
                          }}
                          style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                        >
                          <Edit2 size={13} color="var(--orange-primary)" />
                          <span>تعديل بيانات الزبون</span>
                        </div>

                        <div
                          onClick={() => {
                            const msg = `مرحباً ${cust.name}، معك ${currentShopName}.`;
                            window.open(`https://wa.me/${cust.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                            setActiveMenuId(null);
                          }}
                          style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                        >
                          <MessageCircle size={13} color="#25D366" />
                          <span>واتساب</span>
                        </div>

                        <div
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف الزبون ${cust.name}؟`)) {
                              onDeleteCustomer(cust.id);
                            }
                            setActiveMenuId(null);
                          }}
                          style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--red)' }}
                        >
                          <Trash2 size={13} />
                          <span>حذف الزبون</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-card-sub)',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <span>المشتريات: <b>${totalSalesUSD.toFixed(2)}</b> ({txs.length} حركة)</span>
                  <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>صافي ربحك: <b>+${netProfitUSD.toFixed(2)}</b></span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* نافذة ملف الزبون الشامل عبر Portal */}
      {viewingCustomer && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '16px',
            direction: 'rtl'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '24px',
              padding: '18px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '4px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                  ملف الزبون: {viewingCustomer.name}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {viewingCustomer.phone ? `هاتف: ${viewingCustomer.phone}` : 'بدون هاتف مسجل'} {viewingCustomer.address ? `• ${viewingCustomer.address}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                style={{
                  background: 'var(--bg-card-sub)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ملخص أرقام ملف الزبون */}
            {(() => {
              const txs = getCustomerTransactions(viewingCustomer.name);
              const custDebts = getCustomerDebts(viewingCustomer.name);
              const totalSalesUSD = txs.reduce((sum, t) => sum + toUSD(t.sellingPrice, t.currency), 0);
              const unpaidDebtUSD = custDebts.filter(d => !d.paid).reduce((sum, d) => sum + toUSD(d.amount, d.currency), 0);
              const netProfitUSD = txs.reduce((sum, t) => {
                const saleUSD = toUSD(t.sellingPrice, t.currency);
                const p = t.profitUSD !== undefined ? parseFloat(t.profitUSD) : Math.max(0, saleUSD - (parseFloat(t.costUSD) || 0));
                return sum + p;
              }, 0);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>إجمالي المشتريات</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px', color: 'var(--text-main)' }}>
                        ${totalSalesUSD.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>صافي أرباحك</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px', color: 'var(--green)' }}>
                        +${netProfitUSD.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>الدين القائم</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px', color: unpaidDebtUSD > 0 ? 'var(--red)' : 'var(--green)' }}>
                        ${unpaidDebtUSD.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* سجل المشتريات التاريخية */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>سجل المشتريات والعمليات ({txs.length}):</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {txs.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>لا توجد عمليات مسجلة</div>
                      ) : (
                        txs.map((t, idx) => (
                          <div key={idx} style={{ background: 'var(--bg-card-sub)', padding: '8px 10px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', border: '1px solid var(--border-color)' }}>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{t.itemName || t.title || 'عملية بيع'}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>
                                {formatDateTime(t.date || Date.now())}
                              </div>
                            </div>
                            <div style={{ fontWeight: '900', color: 'var(--text-main)' }}>
                              {parseFloat(t.sellingPrice).toLocaleString()} {t.currency === 'LBP' ? 'ل.ل' : '$'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* سجل الديون المرتبطة بالزبون */}
                  {custDebts.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--red)', display: 'block', marginBottom: '6px' }}>
                        سجل الديون والذمم ({custDebts.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                        {custDebts.map(d => (
                          <div key={d.id} style={{ background: 'var(--bg-card-sub)', padding: '8px 10px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderLeft: d.paid ? '3px solid var(--green)' : '3px solid var(--red)' }}>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{d.notes || 'دين مسجل'}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>
                                Due: {d.dueDate ? formatDateOnly(d.dueDate) : 'Not specified'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: '900', color: d.paid ? 'var(--green)' : 'var(--red)' }}>
                                {parseFloat(d.amount).toLocaleString()} {d.currency === 'LBP' ? 'ل.ل' : '$'}
                              </div>
                              <span style={{ fontSize: '9px', color: d.paid ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>
                                {d.paid ? 'مسدد بالكامل' : 'غير مسدد'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => triggerDirectPrint(viewingCustomer)}
                      className="btn-primary"
                      style={{ flex: 1, height: '40px', fontSize: '12px' }}
                    >
                      <Printer size={15} />
                      <span>طباعة كشف الحساب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingCustomer(null)}
                      style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', padding: '0 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* نافذة إضافة وتعديل ملف الزبون عبر Portal */}
      {showAddModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '16px',
            direction: 'rtl'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '24px',
              padding: '18px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {editingCustomer ? 'تعديل بيانات ملف الزبون' : 'فتح ملف زبون جديد'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingCustomer(null); }}
                style={{
                  background: 'var(--bg-card-sub)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>اسم الزبون الكامل:</label>
                <input
                  type="text"
                  required
                  placeholder="اسم الزبون..."
                  className="tz-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رقم الهاتف:</label>
                <input
                  type="tel"
                  placeholder="رقم الهاتف..."
                  className="tz-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>العنوان أو المنطقة:</label>
                <input
                  type="text"
                  placeholder="العنوان..."
                  className="tz-input"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '6px', height: '44px' }}>
                {editingCustomer ? 'حفظ التعديلات' : 'تثبيت وفتح الملف'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}