import React, { useState } from 'react';
import { formatDateTime } from '../utils/dateFormatter';
import { openPrintableReceipt } from '../utils/receiptPrinter';
import {
  X,
  ArrowLeftRight,
  Receipt,
  Lock,
  Printer,
  MessageCircle
} from 'lucide-react';

export default function QuickToolsModal({
  isOpen,
  onClose,
  exchangeRate = 89500,
  sims = [],
  onTransferBalance,
  onAddExpense,
  expenses = [],
  sources = [],
  salesHistory = [],
  brandConfig
}) {
  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer' | 'expense' | 'closeout'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fromSimId, setFromSimId] = useState('');
  const [toSimId, setToSimId] = useState('');
  const [transferCredits, setTransferCredits] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [transferError, setTransferError] = useState('');

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState('LBP');
  const [expenseWalletId, setExpenseWalletId] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  if (!isOpen) return null;

  const shopPhone = brandConfig?.phone || '78877026';

  const getSimBalance = (sim) => {
    if (!sim) return 0;
    if (sim.batches && Array.isArray(sim.batches) && sim.batches.length > 0) {
      return sim.batches.reduce((sum, b) => sum + (parseFloat(b.remainingUSD) || 0), 0);
    }
    return parseFloat(sim.balance) || 0;
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setTransferError('');
    setTransferSuccess('');

    if (!fromSimId || !toSimId) {
      setTransferError('يرجى تحديد الشريحة المرسلة والمستقبلة!');
      return;
    }
    if (fromSimId === toSimId) {
      setTransferError('لا يمكنك التحويل لنفس الشريحة!');
      return;
    }

    const credits = parseFloat(transferCredits) || 0;
    if (credits <= 0) {
      setTransferError('يرجى إدخال قيمة تحويل صالحة!');
      return;
    }

    const sourceSim = sims.find(s => s.id === fromSimId);
    const sourceBalance = getSimBalance(sourceSim);
    const tax = sourceSim?.operator === 'alfa' ? 0.14 : 0.16;
    const totalDeduction = credits + tax;

    if (totalDeduction > sourceBalance) {
      setTransferError(`الرصيد غير كافٍ! المطلوب مع الضريبة $${totalDeduction.toFixed(2)} بينما المتوفر $${sourceBalance.toFixed(2)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      if (onTransferBalance) {
        await onTransferBalance(fromSimId, toSimId, credits);
      }
      setTransferSuccess(`تمت المناقلة بنجاح! تم تحويل $${credits} وخصم $${tax} ضريبة.`);
      setTransferCredits('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount || isSubmitting) return;

    const numAmount = parseFloat(expenseAmount) || 0;
    if (numAmount <= 0) return;

    if (expenseWalletId) {
      const targetWallet = sources.find(s => s.id === expenseWalletId);
      if (targetWallet) {
        const avail = expenseCurrency === 'LBP'
          ? parseFloat(targetWallet.balanceLBP || 0)
          : parseFloat(targetWallet.balanceUSD ?? targetWallet.balance ?? 0);
        if (numAmount > avail) {
          alert(`رصيد المحفظة (${avail.toLocaleString()} ${expenseCurrency}) لا يكفي لخصم هذا المصروف!`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      if (onAddExpense) {
        await onAddExpense({
          title: expenseTitle.trim(),
          amount: numAmount,
          currency: expenseCurrency,
          sourceWalletId: expenseWalletId || null,
          notes: expenseNotes.trim()
        });
      }
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = salesHistory.filter(s => {
    const dStr = s.date || s.createdAt || s.created_at || '';
    return dStr.toString().startsWith(todayStr);
  });

  const todayExpenses = expenses.filter(exp => {
    const dStr = exp.date || exp.createdAt || exp.created_at || '';
    return dStr.toString().startsWith(todayStr);
  });

  let totalSalesUSD = 0;
  let totalProfitsUSD = 0;
  todaySales.forEach(item => {
    const sale = parseFloat(item.sellingPrice) || 0;
    const isLBP = item.currency === 'LBP';
    const saleUSD = isLBP ? sale / exchangeRate : sale;
    const costUSD = parseFloat(item.costUSD) || 0;
    const profit = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, saleUSD - costUSD);
    totalSalesUSD += saleUSD;
    totalProfitsUSD += profit;
  });

  const totalTodayExpensesUSD = todayExpenses.reduce((sum, e) => {
    const a = parseFloat(e.amount) || 0;
    return sum + (e.currency === 'LBP' ? a / exchangeRate : a);
  }, 0);

  const totalWalletsUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0)), 0);
  const totalWalletsLBP = sources.reduce((sum, s) => sum + (parseFloat(s.balanceLBP || 0)), 0);
  const netDailyCashUSD = totalProfitsUSD - totalTodayExpensesUSD;

  const printCloseoutInvoice = () => {
    const items = todaySales.map(item => {
      const priceFormatted = item.currency === 'LBP'
        ? `${Math.round(parseFloat(item.sellingPrice)).toLocaleString()} L.L`
        : `$${parseFloat(item.sellingPrice).toFixed(2)}`;
      return {
        name: item.itemName || item.simName || item.title || 'عملية بيع',
        sub: `${item.customerName || 'عام'} • ${formatDateTime(item.date || item.createdAt || Date.now())}`,
        price: priceFormatted
      };
    });

    openPrintableReceipt({
      title: 'تقرير إقفال الصندوق اليومي',
      customerName: 'الإدارة والمالية الداخلية',
      customerPhone: shopPhone,
      dateStr: formatDateTime(new Date()),
      items,
      totals: {
        subTotal: `$${totalSalesUSD.toFixed(2)}`,
        debts: totalTodayExpensesUSD > 0 ? `-$${totalTodayExpensesUSD.toFixed(2)} (مصاريف اليوم)` : null,
        profit: `+$${totalProfitsUSD.toFixed(2)} (صافي أرباح اليوم)`,
        grandTotal: `$${netDailyCashUSD.toFixed(2)} (صافي الربح بعد المصروف)`
      },
      notes: `السيولة بالمحافظ: $${totalWalletsUSD.toFixed(2)} | ${Math.round(totalWalletsLBP).toLocaleString()} ل.ل • عدد العمليات: ${todaySales.length}`,
      accentColor: '#10B981',
      shopName: brandConfig?.name,
      shopSubtitle: brandConfig?.subtitle,
      shopPhone: brandConfig?.phone,
      shopLogo: brandConfig?.logo
    });
  };

  const sendWhatsAppReport = () => {
    const text = `📊 *تقرير إقفال الصندوق اليومي - ${brandConfig?.name || 'ZOLFA TECH'}*
📅 التاريخ: ${new Date().toLocaleDateString('ar-LB')}
📞 هاتف المحل: ${shopPhone}
---------------------------
🔹 عدد العمليات: ${todaySales.length}
💵 مبيعات اليوم: $${totalSalesUSD.toFixed(2)}
🔻 مصاريف اليوم: -$${totalTodayExpensesUSD.toFixed(2)}
📈 صافي الأرباح المحققة: +$${totalProfitsUSD.toFixed(2)}
⚖️ الصافي بعد خصم المصاريف: $${netDailyCashUSD.toFixed(2)}
💼 السيولة المتوفرة: $${totalWalletsUSD.toFixed(2)} | ${Math.round(totalWalletsLBP).toLocaleString()} ل.ل
---------------------------
تم الإقفال بنجاح ✅`;

    const cleanPhone = shopPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone.startsWith('961') ? cleanPhone : '961' + cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-center" style={{ maxWidth: '520px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
            الأدوات والعمليات المساعدة
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* أزرار التبويب */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card-sub)', padding: '4px', borderRadius: '12px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'transfer' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'transfer' ? '#fff' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <ArrowLeftRight size={13} />
            <span>مناقلة شرائح</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'expense' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'expense' ? '#fff' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Receipt size={13} />
            <span>مصاريف يومية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('closeout')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'closeout' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'closeout' ? '#fff' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Lock size={13} />
            <span>إقفال الصندوق</span>
          </button>
        </div>

        {/* 1. مناقلة الشرائح */}
        {activeTab === 'transfer' && (
          <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>من الشريحة (المرسلة):</label>
              <select className="tz-select" value={fromSimId} onChange={e => setFromSimId(e.target.value)} required>
                <option value="">-- اختر الشريحة المصدر --</option>
                {sims.map(sim => (
                  <option key={sim.id} value={sim.id}>{sim.name} ({sim.number}) - متوفر: ${getSimBalance(sim).toFixed(2)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>إلى الشريحة (المستقبلة):</label>
              <select className="tz-select" value={toSimId} onChange={e => setToSimId(e.target.value)} required>
                <option value="">-- اختر الشريحة الهدف --</option>
                {sims.map(sim => (
                  <option key={sim.id} value={sim.id}>{sim.name} ({sim.number}) - متوفر: ${getSimBalance(sim).toFixed(2)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>قيمة الرصيد المراد تحويله ($):</label>
              <input type="number" step="any" placeholder="مثال: 5 أو 10" className="tz-input" value={transferCredits} onChange={e => setTransferCredits(e.target.value)} required />
            </div>

            {transferError && <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: 'bold' }}>{transferError}</div>}
            {transferSuccess && <div style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 'bold' }}>{transferSuccess}</div>}

            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '6px', opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'جاري التحويل...' : 'تأكيد تحويل الرصيد'}
            </button>
          </form>
        )}

        {/* 2. المصاريف */}
        {activeTab === 'expense' && (
          <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="البيان (كهرباء، ضيافة، إيجار...)" className="tz-input" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} required />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <input type="number" step="any" placeholder="المبلغ" className="tz-input" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required />
              <select className="tz-select" value={expenseCurrency} onChange={e => setExpenseCurrency(e.target.value)}>
                <option value="LBP">ل.ل</option>
                <option value="USD">$</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>خصم من محفظة (اختياري):</label>
              <select className="tz-select" value={expenseWalletId} onChange={e => setExpenseWalletId(e.target.value)}>
                <option value="">-- تسجيل مصروف عام بدون خصم محفظة --</option>
                {sources.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} (${parseFloat(w.balanceUSD ?? w.balance ?? 0).toFixed(2)} | {Math.round(parseFloat(w.balanceLBP || 0)).toLocaleString()} ل.ل)
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '6px', opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'جاري الحفظ...' : 'تسجيل المصروف'}
            </button>

            {expenses.length > 0 && (
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>آخر المصاريف:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {expenses.slice(0, 5).map((exp, i) => (
                    <div key={exp.id || i} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card-sub)', padding: '6px 8px', borderRadius: '8px', fontSize: '11px' }}>
                      <span>{exp.title}</span>
                      <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>-{parseFloat(exp.amount).toLocaleString()} {exp.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* 3. إقفال الصندوق */}
        {activeTab === 'closeout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ background: 'var(--bg-card-sub)', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>عمليات مبيعات اليوم:</span>
                <span style={{ fontWeight: 'bold' }}>{todaySales.length} عملية</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>إجمالي مبيعات اليوم:</span>
                <span style={{ fontWeight: 'bold' }}>${totalSalesUSD.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>مصاريف اليوم المشطوبة:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--red)' }}>-${totalTodayExpensesUSD.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>صافي أرباح اليوم:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--green)' }}>+${totalProfitsUSD.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>صافي الربح بعد المصروف:</span>
                <span style={{ fontWeight: '900', color: 'var(--orange-primary)' }}>${netDailyCashUSD.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                <span>السيولة بالمحافظ:</span>
                <span><b>${totalWalletsUSD.toFixed(2)}</b> • <b>{Math.round(totalWalletsLBP).toLocaleString()} ل.ل</b></span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={printCloseoutInvoice}
                className="btn-primary"
                style={{ padding: '10px', fontSize: '12px', height: '42px' }}
              >
                <Printer size={15} />
                <span>طباعة الفاتورة (PDF)</span>
              </button>

              <button
                type="button"
                onClick={sendWhatsAppReport}
                style={{
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MessageCircle size={15} />
                <span>إرسال عبر واتساب</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('تمت مطابقة وإقفال الصندوق اليومي بنجاح!');
                onClose();
              }}
              style={{
                background: 'var(--bg-card-sub)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                borderRadius: '12px',
                padding: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              إغلاق النافذة
            </button>
          </div>
        )}

      </div>
    </div>
  );
}