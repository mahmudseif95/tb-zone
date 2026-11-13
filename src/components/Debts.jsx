import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime } from '../utils/dateFormatter';
import { api } from '../services/api';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  X,
  Users,
  Briefcase,
  ArrowLeftRight,
  History,
  Layers,
  RefreshCw
} from 'lucide-react';

export default function Debts({
  exchangeRate = 89500,
  debts = [],
  sources = [],
  onUpdateDebts,
  onRecordDebtSale,
  onUpdateSourceBalance,
  onRefreshData
}) {
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'customers' | 'merchants' | 'boxes'
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | 'partial' | 'history'
  const [editingDebt, setEditingDebt] = useState(null);
  const [selectedDebtForHistory, setSelectedDebtForHistory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [partialPayment, setPartialPayment] = useState('');

  const saveToStorage = (updated) => {
    if (onUpdateDebts) onUpdateDebts(updated);
  };

  const handleOpenAdd = () => {
    setName(activeCategory === 'boxes' ? (sources[0]?.name || '') : '');
    setPhone('');
    setAmount('');
    setCurrency('USD');
    setNotes('');
    setSourceWalletId(sources[0]?.id || '');
    setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setActiveModal('add');
  };

  const handleOpenEdit = (debt) => {
    setEditingDebt(debt);
    setName(debt.name);
    setPhone(debt.phone || '');
    setAmount(debt.amount.toString());
    setCurrency(debt.currency || 'USD');
    setDueDate(debt.dueDate ? debt.dueDate.split('T')[0] : '');
    setNotes(debt.notes || '');
    setActiveModal('edit');
  };

  const handleOpenPartial = (debt) => {
    setEditingDebt(debt);
    setPartialPayment('');
    setActiveModal('partial');
  };

  const handleOpenHistory = (debt) => {
    setSelectedDebtForHistory(debt);
    setActiveModal('history');
  };

  // إضافة أو تعديل ذمة مباشرة في MySQL
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !amount || isSubmitting) return;

    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) return;

    const targetCat = activeCategory === 'all' ? 'customers' : activeCategory;

    try {
      setIsSubmitting(true);

      if (activeModal === 'add') {
        if (targetCat === 'boxes' && !sourceWalletId) {
          alert('يرجى اختيار المحفظة / الصندوق أولاً!');
          return;
        }

        await api.addDebt({
          category: targetCat,
          name: name.trim(),
          phone: phone.trim(),
          amount: numAmount,
          currency,
          dueDate: dueDate || null,
          notes: notes.trim(),
          sourceWalletId: targetCat === 'boxes' ? sourceWalletId : null
        });

        if (onRefreshData) {
          await onRefreshData();
        }
      } else if (activeModal === 'edit' && editingDebt) {
        await api.updateDebt(editingDebt.id, {
          name: name.trim(),
          amount: numAmount,
          currency,
          dueDate: dueDate || null,
          notes: notes.trim()
        });

        if (onRefreshData) {
          await onRefreshData();
        }
      }

      setActiveModal(null);
    } catch (err) {
      console.error('Error saving debt:', err);
      alert('حدث خطأ أثناء حفظ البيانات في السيرفر: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // سداد دفعة جزئية مع الحفاظ على عملة الدين والصندوق حصراً
  const handleApplyPartial = async (e) => {
    e.preventDefault();
    const paidVal = parseFloat(partialPayment) || 0;
    if (paidVal <= 0 || !editingDebt || isSubmitting) return;

    try {
      setIsSubmitting(true);

      await api.payDebt({
        debtId: editingDebt.id,
        amount: paidVal,
        notes: 'تسديد دفعة على الحساب'
      });

      if (onRefreshData) {
        await onRefreshData();
      }

      setActiveModal(null);
    } catch (err) {
      console.error('Error applying partial payment:', err);
      alert('فشل تسجيل الدفعة في السيرفر: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // تسديد كامل الذمة أو إعادة فتحها
  const handleTogglePaid = async (debt) => {
    if (isSubmitting) return;
    const isNowPaid = !debt.paid;

    if (isNowPaid) {
      if (!window.confirm(`هل تريد تثبيت سداد كامل الذمة (${parseFloat(debt.amount).toLocaleString()} ${debt.currency})؟`)) {
        return;
      }

      try {
        setIsSubmitting(true);
        await api.payDebt({
          debtId: debt.id,
          amount: parseFloat(debt.amount) || 0,
          notes: 'تم تسديد كامل الذمة'
        });

        if (onRefreshData) {
          await onRefreshData();
        }
      } catch (err) {
        console.error('Error paying full debt:', err);
        alert('فشل تسديد الذمة في السيرفر: ' + (err.message || ''));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const payEntry = {
        id: `pay_${Date.now()}`,
        date: new Date().toISOString(),
        type: 'reopen',
        amount: debt.amount,
        currency: debt.currency,
        remainingAfter: debt.amount,
        notes: 'إعادة فتح الدين'
      };

      const updated = debts.map(d => d.id === debt.id ? {
        ...d,
        paid: false,
        history: [...(d.history || []), payEntry]
      } : d);

      saveToStorage(updated);
    }
  };

  // حذف سجل الدين نهائياً من قاعدة البيانات
  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا السجل نهائياً من قاعدة البيانات؟')) return;

    try {
      setIsSubmitting(true);
      await api.deleteDebt(id);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      console.error('Error deleting debt:', err);
      alert('فشل حذف السجل من السيرفر: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDebtsList = activeCategory === 'all'
    ? debts
    : debts.filter(d => (d.category || 'customers') === activeCategory);

  const unpaidDebts = currentDebtsList.filter(d => !d.paid);

  const totalUnpaidUSDOnly = unpaidDebts
    .filter(d => (d.currency || 'USD') === 'USD')
    .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  const totalUnpaidLBPOnly = unpaidDebts
    .filter(d => d.currency === 'LBP')
    .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      {/* التبويب الشامل والتبويبات الفردية */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          style={{
            background: activeCategory === 'all' ? 'var(--orange-primary)' : 'var(--bg-card)',
            color: activeCategory === 'all' ? '#fff' : 'var(--text-main)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '14px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '900',
            cursor: 'pointer'
          }}
        >
          <Layers size={18} />
          <span>إجمالي كافة الديون (شامل الزبائن، التجار، والصناديق)</span>
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveCategory('customers')}
            style={{
              background: activeCategory === 'customers' ? 'var(--orange-primary)' : 'var(--bg-card)',
              color: activeCategory === 'customers' ? '#fff' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '10px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Users size={15} />
            <span style={{ fontSize: '11px', fontWeight: '900' }}>ديون الزبائن</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('merchants')}
            style={{
              background: activeCategory === 'merchants' ? 'var(--orange-primary)' : 'var(--bg-card)',
              color: activeCategory === 'merchants' ? '#fff' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '10px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Briefcase size={15} />
            <span style={{ fontSize: '11px', fontWeight: '900' }}>ديون التجار</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('boxes')}
            style={{
              background: activeCategory === 'boxes' ? 'var(--orange-primary)' : 'var(--bg-card)',
              color: activeCategory === 'boxes' ? '#fff' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '10px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeftRight size={15} />
            <span style={{ fontSize: '11px', fontWeight: '900' }}>ديون الصناديق</span>
          </button>
        </div>
      </div>

      {/* بطاقة العنوان والمجموع مفصولة بالعملة */}
      <div className="tz-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={18} color="var(--orange-primary)" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>
              {activeCategory === 'all' ? 'دفتر الديون العام' : activeCategory === 'customers' ? 'دفتر ديون الزبائن' : activeCategory === 'merchants' ? 'ذمم ومستحقات التجار' : 'معلقات واستلاف الصناديق والمحافظ'}
            </h2>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span>
              دولار: <b style={{ color: 'var(--red)', fontSize: '13px' }}>${totalUnpaidUSDOnly.toFixed(2)}</b>
            </span>
            {totalUnpaidLBPOnly > 0 && (
              <span>
                • ليرة: <b style={{ color: 'var(--orange-primary)', fontSize: '12px' }}>{totalUnpaidLBPOnly.toLocaleString()} ل.ل</b>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px', flexShrink: 0 }}
        >
          <Plus size={14} /> تسجيل دين جديد
        </button>
      </div>

      {/* قائمة الديون */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {currentDebtsList.length === 0 ? (
          <div className="tz-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            لا توجد سجلات مسجلة تحت هذا القسم.
          </div>
        ) : (
          currentDebtsList.map(debt => {
            const isBoxDebt = debt.category === 'boxes';
            const origAmt = parseFloat(debt.originalAmount) || parseFloat(debt.amount) || 0;
            const currentRemAmt = parseFloat(debt.amount) || 0;
            const repaidAmt = Math.max(0, parseFloat((origAmt - currentRemAmt).toFixed(2)));
            const currLabel = debt.currency === 'LBP' ? 'ل.ل' : '$';

            return (
              <div
                key={debt.id}
                className="tz-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px 14px',
                  borderLeft: debt.paid ? '4px solid var(--green)' : '4px solid var(--red)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div
                      onClick={() => handleOpenHistory(debt)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      title="اضغط لعرض كشف الحساب المتسلسل"
                    >
                      <span style={{ fontSize: '15px', fontWeight: '900', textDecoration: debt.paid ? 'line-through' : 'none', color: isBoxDebt ? 'var(--orange-primary)' : 'var(--text-main)' }}>
                        {debt.name}
                      </span>
                      <History size={13} color="var(--orange-primary)" />
                      {debt.paid && (
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                          تم السداد بالكامل
                        </span>
                      )}
                      {activeCategory === 'all' && (
                        <span style={{ fontSize: '9px', background: 'var(--bg-card-sub)', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          {debt.category === 'merchants' ? 'تاجر' : isBoxDebt ? 'صندوق' : 'زبون'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      استحقاق: {debt.dueDate ? debt.dueDate.split('T')[0] : 'غير محدد'} {debt.notes ? `• ${debt.notes}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: debt.paid ? 'var(--green)' : 'var(--red)' }}>
                        {currentRemAmt.toLocaleString()} {currLabel}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        {debt.paid ? 'مسدد' : 'متبقي قائم'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!debt.paid && (
                        <button
                          onClick={() => handleOpenPartial(debt)}
                          style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--orange-primary)', color: 'var(--orange-primary)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                          title="قبض أو سداد دفعة جزئية"
                        >
                          دفعة
                        </button>
                      )}

                      <button
                        onClick={() => handleTogglePaid(debt)}
                        style={{
                          background: debt.paid ? 'var(--green)' : 'var(--bg-card-sub)',
                          color: debt.paid ? '#fff' : 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '6px',
                          cursor: 'pointer'
                        }}
                        title={debt.paid ? 'إعادة فتح الذمة' : 'تحديد كمسدد كامل'}
                      >
                        <CheckCircle2 size={15} />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(debt)}
                        style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--orange-primary)', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                        title="تعديل"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => handleDelete(debt.id)}
                        style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--red)', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {(isBoxDebt || repaidAmt > 0) && (
                  <div style={{ background: 'var(--bg-main)', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', border: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      الأصل: <b>{origAmt.toLocaleString()} {currLabel}</b>
                    </span>
                    <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>
                      المسدد: {repaidAmt.toLocaleString()} {currLabel}
                    </span>
                    <span style={{ color: debt.paid ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>
                      الباقي: {currentRemAmt.toLocaleString()} {currLabel}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* المودال المركزي لإضافة وتعديل الذمة */}
      {(activeModal === 'add' || activeModal === 'edit') && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {activeModal === 'add'
                  ? (activeCategory === 'boxes' ? 'تسجيل استلاف / سحب من صندوق' : activeCategory === 'merchants' ? 'إضافة ذمة تاجر' : 'إضافة ذمة زبون')
                  : 'تعديل البيانات'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeCategory === 'boxes' && activeModal === 'add' ? (
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المحفظة / الصندوق المسحوب منه:</label>
                  <select
                    className="tz-select"
                    style={{ height: '42px', fontWeight: 'bold' }}
                    value={sourceWalletId}
                    onChange={e => {
                      setSourceWalletId(e.target.value);
                      const sel = sources.find(s => s.id === e.target.value);
                      if (sel) setName(sel.name);
                    }}
                  >
                    {sources.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — (${parseFloat(s.balanceUSD ?? s.balance ?? 0).toLocaleString()} | {parseFloat(s.balanceLBP || 0).toLocaleString()} ل.ل)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {activeCategory === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم الزبون / الجهة:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اكتب الاسم..."
                    className="tz-input"
                    style={{ height: '40px' }}
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المستلف / الدين:</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="المبلغ"
                    className="tz-input"
                    style={{ height: '40px', fontWeight: 'bold' }}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                  <select
                    className="tz-select"
                    style={{ height: '40px', fontWeight: 'bold' }}
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    <option value="USD">دولار ($)</option>
                    <option value="LBP">ليرة (LBP)</option>
                  </select>
                </div>
              </div>

              {activeCategory === 'boxes' && activeModal === 'add' && (
                <div style={{ fontSize: '10px', color: 'var(--orange-primary)', background: 'rgba(255, 122, 0, 0.08)', padding: '6px 10px', borderRadius: '8px' }}>
                  * سيُخصم المبلغ من رصيد <b>{currency === 'LBP' ? 'الليرة اللبنانية (LBP)' : 'الدولار ($)'}</b> للصندوق ويُعاد إليه عند السداد بنفس العملة.
                </div>
              )}

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>بيان / سبب السحب:</label>
                <input
                  type="text"
                  placeholder="سبب السحب / ملاحظات..."
                  className="tz-input"
                  style={{ height: '40px' }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>تاريخ موعد الإرجاع:</label>
                <input
                  type="date"
                  className="tz-input"
                  style={{ height: '40px' }}
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{ marginTop: '6px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isSubmitting ? 0.6 : 1 }}
              >
                {isSubmitting ? <RefreshCw size={16} className="spin-icon" /> : null}
                <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتسجيل الذمة'}</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* مودال دفع دفعة جزئية */}
      {activeModal === 'partial' && editingDebt && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>قبض / سداد دفعة: {editingDebt.name}</h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPartial} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                المستحق القائم: <b>{parseFloat(editingDebt.amount).toLocaleString()} {editingDebt.currency === 'LBP' ? 'ل.ل' : '$'}</b>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  المبلغ المدفوع ({editingDebt.currency === 'LBP' ? 'ليرة لبنانية' : 'دولار $'}):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="المبلغ المدفوع..."
                  className="tz-input"
                  style={{ height: '40px', fontWeight: 'bold' }}
                  value={partialPayment}
                  onChange={e => setPartialPayment(e.target.value)}
                  autoFocus
                />
              </div>

              {editingDebt.category === 'boxes' && (
                <div style={{ fontSize: '10px', color: 'var(--green)', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: '8px' }}>
                  * ستُضاف هذه الدفعة مباشرة إلى رصيد <b>{editingDebt.currency === 'LBP' ? 'الليرة اللبنانية' : 'الدولار'}</b> في الصندوق.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isSubmitting ? 0.6 : 1 }}
              >
                {isSubmitting ? <RefreshCw size={16} className="spin-icon" /> : null}
                <span>{isSubmitting ? 'جاري التسجيل...' : 'تسجيل الدفعة وتنزيلها'}</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* مودال كشف الحساب المتسلسل */}
      {activeModal === 'history' && selectedDebtForHistory && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '390px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                  كشف حساب: {selectedDebtForHistory.name}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  الرصيد المتبقي: <b>{parseFloat(selectedDebtForHistory.amount).toLocaleString()} {selectedDebtForHistory.currency === 'LBP' ? 'ل.ل' : '$'}</b>
                </span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', flex: 1, marginTop: '8px' }}>
              {(!selectedDebtForHistory.history || selectedDebtForHistory.history.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  لا توجد حركات مسجلة في كشف الحساب بعد.
                </div>
              ) : (
                selectedDebtForHistory.history.map((h, i) => {
                  const hCurr = h.currency === 'LBP' ? 'ل.ل' : '$';
                  return (
                    <div
                      key={h.id || i}
                      style={{
                        background: 'var(--bg-card-sub)',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{h.notes}</span>
                        <span style={{
                          fontWeight: '900',
                          fontSize: '13px',
                          color: h.type === 'debt' ? 'var(--orange-primary)' : 'var(--green)'
                        }}>
                          {h.type === 'debt' ? `+ ${parseFloat(h.amount).toLocaleString()}` : `- ${parseFloat(h.amount).toLocaleString()}`} {hCurr}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>{formatDateTime(h.date)}</span>
                        {h.remainingAfter !== undefined && (
                          <span>الباقي: <b>{parseFloat(h.remainingAfter).toLocaleString()} {hCurr}</b></span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-primary"
              style={{ marginTop: '10px', height: '40px', fontSize: '12px' }}
            >
              إغلاق كشف الحساب
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}