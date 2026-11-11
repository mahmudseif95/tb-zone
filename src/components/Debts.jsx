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
  Clock,
  Wallet
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

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [partialPayment, setPartialPayment] = useState('');

  const saveToStorage = (updated) => {
    onUpdateDebts(updated);
  };

  const handleOpenAdd = () => {
    setName(activeCategory === 'boxes' ? (sources[0]?.name || '') : '');
    setAmount('');
    setCostPrice('');
    setCurrency('USD');
    setNotes('');
    setSourceWalletId(sources[0]?.id || '');
    setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setActiveModal('add');
  };

  const handleOpenEdit = (debt) => {
    setEditingDebt(debt);
    setName(debt.name);
    setAmount(debt.amount.toString());
    setCurrency(debt.currency || 'USD');
    setDueDate(debt.dueDate || '');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    const numAmount = parseFloat(amount) || 0;
    const numCost = parseFloat(costPrice) || 0;
    const targetCat = activeCategory === 'all' ? 'customers' : activeCategory;

    if (activeModal === 'add') {
      const initialEntry = {
        id: `tx_${Date.now()}`,
        date: new Date().toISOString(),
        type: 'debt',
        amount: numAmount,
        currency: currency,
        notes: notes || (targetCat === 'boxes' ? `سحب من صندوق ${name}` : 'تسجيل ذمة جديدة')
      };

      const newDebt = {
        id: Date.now().toString(),
        category: targetCat,
        name: name.trim(),
        amount: numAmount,
        originalAmount: numAmount,
        currency,
        dueDate,
        paid: false,
        sourceWalletId: targetCat === 'boxes' ? sourceWalletId : null,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        history: [initialEntry]
      };

      if (targetCat === 'boxes' && sourceWalletId && onUpdateSourceBalance) {
        const src = sources.find(s => s.id === sourceWalletId);
        if (src) {
          const deductVal = currency === 'LBP' ? (numAmount / exchangeRate) : numAmount;
          onUpdateSourceBalance(sourceWalletId, Math.max(0, parseFloat(src.balance || 0) - deductVal));
        }
      }

      if (onRecordDebtSale && targetCat === 'customers') {
        const saleUSD = currency === 'LBP' ? (numAmount / exchangeRate) : numAmount;
        const costUSD = currency === 'LBP' ? (numCost / exchangeRate) : numCost;

        onRecordDebtSale({
          title: `دين: ${name.trim()}`,
          itemName: `تسجيل دين (${notes || 'بضاعة/خدمة'})`,
          sellingPrice: numAmount,
          currency: currency,
          costUSD: costUSD,
          customerName: name.trim(),
          isDebt: true,
          date: new Date().toISOString()
        });
      }

      saveToStorage([newDebt, ...debts]);
    } else if (activeModal === 'edit' && editingDebt) {
      const updated = debts.map(d => d.id === editingDebt.id ? {
        ...d,
        name: name.trim(),
        amount: numAmount,
        currency,
        dueDate,
        notes: notes.trim()
      } : d);
      saveToStorage(updated);
    }

    setActiveModal(null);
  };

  // سداد دفعة جزئية وربطها بالسيرفر
  const handleApplyPartial = async (e) => {
    e.preventDefault();
    const paidVal = parseFloat(partialPayment) || 0;
    if (paidVal <= 0 || !editingDebt) return;

    try {
      await api.payDebt({
        debtId: editingDebt.id,
        amount: paidVal,
        currency: editingDebt.currency || 'USD',
        notes: 'تسديد دفعة على الحساب',
        walletId: editingDebt.sourceWalletId || null
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      console.error('Error applying partial payment:', err);
      // تحديث محلي احتياطي في حال عدم الاتصال
      const currentAmt = parseFloat(editingDebt.amount) || 0;
      const remaining = Math.max(0, currentAmt - paidVal);

      if (editingDebt.category === 'boxes' && editingDebt.sourceWalletId && onUpdateSourceBalance) {
        const src = sources.find(s => s.id === editingDebt.sourceWalletId);
        if (src) {
          const addVal = editingDebt.currency === 'LBP' ? (paidVal / exchangeRate) : paidVal;
          onUpdateSourceBalance(editingDebt.sourceWalletId, parseFloat(src.balance || 0) + addVal);
        }
      }

      const paymentEntry = {
        id: `pay_${Date.now()}`,
        date: new Date().toISOString(),
        type: 'payment',
        amount: paidVal,
        currency: editingDebt.currency,
        remainingAfter: remaining,
        notes: 'تسديد دفعة على الحساب'
      };

      const updated = debts.map(d => {
        if (d.id === editingDebt.id) {
          return {
            ...d,
            amount: parseFloat(remaining.toFixed(2)),
            paid: remaining <= 0.01,
            history: [...(d.history || []), paymentEntry]
          };
        }
        return d;
      });

      saveToStorage(updated);
    }

    setActiveModal(null);
  };

  // سداد كامل أو إعادة فتح الذمة مع السيرفر
  const handleTogglePaid = async (debt) => {
    const isNowPaid = !debt.paid;

    if (isNowPaid) {
      try {
        await api.payDebt({
          debtId: debt.id,
          amount: debt.amount,
          currency: debt.currency || 'USD',
          notes: 'تم تسديد كامل الذمة',
          walletId: debt.sourceWalletId || null
        });

        if (onRefreshData) {
          await onRefreshData();
          return;
        }
      } catch (err) {
        console.error('Error paying full debt:', err);
      }
    }

    if (isNowPaid && debt.category === 'boxes' && debt.sourceWalletId && onUpdateSourceBalance) {
      const src = sources.find(s => s.id === debt.sourceWalletId);
      if (src) {
        const addVal = debt.currency === 'LBP' ? (parseFloat(debt.amount) / exchangeRate) : parseFloat(debt.amount);
        onUpdateSourceBalance(debt.sourceWalletId, parseFloat(src.balance || 0) + addVal);
      }
    }

    const payEntry = {
      id: `pay_${Date.now()}`,
      date: new Date().toISOString(),
      type: isNowPaid ? 'full_payment' : 'reopen',
      amount: debt.amount,
      currency: debt.currency,
      remainingAfter: isNowPaid ? 0 : debt.amount,
      notes: isNowPaid ? 'تم تسديد كامل الذمة' : 'إعادة فتح الدين'
    };

    const updated = debts.map(d => d.id === debt.id ? {
      ...d,
      paid: isNowPaid,
      history: [...(d.history || []), payEntry]
    } : d);

    saveToStorage(updated);
  };

  const handleDelete = (id) => {
    if (window.confirm('هل تريد حذف هذا السجل نهائياً؟')) {
      saveToStorage(debts.filter(d => d.id !== id));
    }
  };

  const currentDebtsList = activeCategory === 'all'
    ? debts
    : debts.filter(d => (d.category || 'customers') === activeCategory);

  const totalUnpaidUSD = currentDebtsList.filter(d => !d.paid).reduce((sum, d) => {
    const val = parseFloat(d.amount) || 0;
    return sum + (d.currency === 'LBP' ? val / exchangeRate : val);
  }, 0);

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
          <span>إجمالي كافة الديون  (شامل الزبائن، التجار، والصناديق)</span>
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

      {/* بطاقة العنوان والمجموع */}
      <div className="tz-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={18} color="var(--orange-primary)" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>
              {activeCategory === 'all' ? 'دفتر الديون العام' : activeCategory === 'customers' ? 'دفتر ديون الزبائن' : activeCategory === 'merchants' ? 'ذمم ومستحقات التجار' : 'معلقات واستلاف الصناديق والمحافظ'}
            </h2>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            إجمالي الديون: <b style={{ color: 'var(--red)', fontSize: '13px' }}>${totalUnpaidUSD.toFixed(2)}</b>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
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
                      استحقاق: {debt.dueDate || 'غير محدد'} {debt.notes ? `• ${debt.notes}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: debt.paid ? 'var(--green)' : 'var(--red)' }}>
                        {currentRemAmt.toLocaleString()} {debt.currency === 'LBP' ? 'ل.ل' : '$'}
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
                      الأصل: <b>{origAmt.toLocaleString()} {debt.currency}</b>
                    </span>
                    <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>
                      المسدد: {repaidAmt.toLocaleString()} {debt.currency}
                    </span>
                    <span style={{ color: debt.paid ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>
                      الباقي: {currentRemAmt.toLocaleString()} {debt.currency}
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
              {activeCategory === 'boxes' ? (
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المحفظة / الصندوق المسحوب منه:</label>
                  <select
                    className="tz-select"
                    style={{ height: '40px' }}
                    value={sourceWalletId}
                    onChange={e => {
                      setSourceWalletId(e.target.value);
                      const sel = sources.find(s => s.id === e.target.value);
                      if (sel) setName(sel.name);
                    }}
                  >
                    {sources.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (رصيد: ${s.balanceUSD || s.balance || 0})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {activeCategory === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم الزبون:'}
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
                    style={{ height: '40px' }}
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    <option value="USD">دولار ($)</option>
                    <option value="LBP">ليرة (LBP)</option>
                  </select>
                </div>
              </div>

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

              <button type="submit" className="btn-primary" style={{ marginTop: '6px', height: '44px' }}>
                حفظ وتسجيل الذمة
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>قبض دفعة من: {editingDebt.name}</h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPartial} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                المستحق القائم: <b>{editingDebt.amount} {editingDebt.currency}</b>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>المبلغ المقبوض ({editingDebt.currency}):</label>
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

              <button type="submit" className="btn-primary" style={{ height: '44px' }}>
                تسجيل الدفعة وتنزيلها
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
                  الرصيد المتبقي: <b>{selectedDebtForHistory.amount} {selectedDebtForHistory.currency}</b>
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
                selectedDebtForHistory.history.map((h, i) => (
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
                        {h.type === 'debt' ? `+ ${h.amount}` : `- ${h.amount}`} {h.currency}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span>{formatDateTime(h.date)}</span>
                      {h.remainingAfter !== undefined && (
                        <span>الباقي: <b>{h.remainingAfter} {h.currency}</b></span>
                      )}
                    </div>
                  </div>
                ))
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