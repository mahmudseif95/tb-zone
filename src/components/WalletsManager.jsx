import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime } from '../utils/dateFormatter';
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  History,
  X,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
  Smartphone,
  Search,
  ArrowRightLeft,
  RefreshCw
} from 'lucide-react';

// فئات الكروت الرسمية مع الأسعار المعتمدة بالدولار والليرة اللبنانية
const CUSTOM_CARD_TIERS = {
  ALFA: [
    { id: 'alfa_3_03', credit: 3.03, costUSD: 3.59, costLBP: 321015, days: 7, label: '$3.03' },
    { id: 'alfa_4_50', credit: 4.50, costUSD: 5.22, costLBP: 467053, days: 10, label: '$4.50' },
    { id: 'alfa_7_58', credit: 7.58, costUSD: 8.64, costLBP: 773035, days: 17, label: '$7.58' },
    { id: 'alfa_10_00', credit: 10.00, costUSD: 11.33, costLBP: 1013450, days: 23, label: '$10.00' },
    { id: 'alfa_15_15', credit: 15.15, costUSD: 17.50, costLBP: 1525077, days: 35, label: '$15.15' },
    { id: 'alfa_22_73', credit: 22.73, costUSD: 25.46, costLBP: 2278112, days: 95, label: '$22.73 (صلاحية 95 يوم)' },
    { id: 'alfa_year', credit: 68.19, costUSD: 86.50, costLBP: 7697382, days: 365, label: 'كارت سنة (365 يوم)' }
  ],
  TOUCH: [
    { id: 'touch_3_03', credit: 3.03, costUSD: 3.59, costLBP: 321015, days: 7, label: '$3.03' },
    { id: 'touch_4_50', credit: 4.50, costUSD: 5.22, costLBP: 467053, days: 10, label: '$4.50' },
    { id: 'touch_7_58', credit: 7.58, costUSD: 8.64, costLBP: 773035, days: 17, label: '$7.58' },
    { id: 'touch_10_00', credit: 10.00, costUSD: 11.33, costLBP: 1013450, days: 23, label: '$10.00' },
    { id: 'touch_15_15', credit: 15.15, costUSD: 17.50, costLBP: 1525077, days: 35, label: '$15.15' },
    { id: 'touch_22_73', credit: 22.73, costUSD: 25.46, costLBP: 2278112, days: 95, label: '$22.73 (صلاحية 95 يوم)' },
    { id: 'touch_year', credit: 68.19, costUSD: 86.50, costLBP: 7697382, days: 365, label: 'كارت سنة (365 يوم)' }
  ]
};

export default function WalletsManager({
  sources = [],
  customers = [],
  sims = [],
  lines = [],
  onAddSource,
  onUpdateSource,
  onDeleteSource,
  onRecordWalletTx,
  onUpdateLines,
  onAddDebt,
  exchangeRate = 89500
}) {
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [modalType, setModalType] = useState(null); // 'add' | 'edit' | 'tx' | 'customer_step' | 'ledger' | 'delete_warning'

  const [editName, setEditName] = useState('');
  const [editUSD, setEditUSD] = useState('');
  const [editLBP, setEditLBP] = useState('');

  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletInitialUSD, setNewWalletInitialUSD] = useState('');
  const [newWalletInitialLBP, setNewWalletInitialLBP] = useState('');

  // استمارة العمليات
  const [txForm, setTxForm] = useState({
    type: 'deposit', // 'deposit' | 'withdrawal' | 'transfer' | 'exchange' | 'sale' | 'buy_card' | 'days_year'
    amount: '',
    currency: 'USD',
    targetWalletId: '',
    fxRate: exchangeRate.toString(),
    costPrice: '',
    costCurrency: 'USD',
    itemName: '',
    notes: '',
    daysWalletDeduct: '86.5',
    daysReturnUSD: '73.5',
    daysCostLBP: '93500',
    daysTargetSimId: '',
    cardOperator: 'ALFA',
    selectedTierId: 'alfa_22_73',
    targetClosedLineId: '',
    cardPayCurrency: 'USD',
    lineSearchQuery: '',
    isLineSearchOpen: false
  });

  const [customerType, setCustomerType] = useState('customers');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [partialPaidAmount, setPartialPaidAmount] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newWalletName) return;
    onAddSource(
      newWalletName,
      parseFloat(newWalletInitialUSD) || 0,
      parseFloat(newWalletInitialLBP) || 0
    );
    setNewWalletName('');
    setNewWalletInitialUSD('');
    setNewWalletInitialLBP('');
    setModalType(null);
  };

  const handleStartRename = (wallet) => {
    setSelectedWallet(wallet);
    setEditName(wallet.name);
    setEditUSD((wallet.balanceUSD ?? wallet.balance ?? 0).toString());
    setEditLBP((wallet.balanceLBP || 0).toString());
    setModalType('edit');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!selectedWallet || !editName.trim()) return;
    onUpdateSource(selectedWallet.id, {
      name: editName.trim(),
      balanceUSD: parseFloat(editUSD) || 0,
      balance: parseFloat(editUSD) || 0,
      balanceLBP: parseFloat(editLBP) || 0
    });
    setSelectedWallet(null);
    setModalType(null);
  };

  const handleDeleteClick = (wallet) => {
    setSelectedWallet(wallet);
    const balUSD = parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0);
    const balLBP = parseFloat(wallet.balanceLBP || 0);
    if (balUSD > 0 || balLBP > 0) {
      setModalType('delete_warning');
    } else {
      if (window.confirm(`هل أنت متأكد من حذف محفظة "${wallet.name}"؟`)) {
        onDeleteSource(wallet.id);
      }
    }
  };

  const openTxModal = (wallet) => {
    setSelectedWallet(wallet);
    const otherWallets = sources.filter(s => s.id !== wallet.id);
    setTxForm({
      type: 'deposit',
      amount: '',
      currency: 'USD',
      targetWalletId: otherWallets[0]?.id || '',
      fxRate: exchangeRate.toString(),
      costPrice: '',
      costCurrency: 'USD',
      itemName: '',
      notes: '',
      daysWalletDeduct: '86.5',
      daysReturnUSD: '73.5',
      daysCostLBP: '93500',
      daysTargetSimId: sims[0]?.id || '',
      cardOperator: 'ALFA',
      selectedTierId: 'alfa_22_73',
      targetClosedLineId: '',
      cardPayCurrency: 'USD',
      lineSearchQuery: '',
      isLineSearchOpen: false
    });
    setModalType('tx');
  };

  const lockedLinesOnly = lines.filter(l => (l.type || 'locked') === 'locked');
  const filteredClosedLines = lockedLinesOnly.filter(line => {
    const q = (txForm.lineSearchQuery || '').toLowerCase().trim();
    if (!q) return true;
    const slotStr = (line.slotNumber || '').toString();
    const phoneStr = (line.phoneNumber || line.number || '').toString();
    return slotStr.includes(q) || phoneStr.includes(q);
  });

  const selectedClosedLineObj = lines.find(l => l.id === txForm.targetClosedLineId);

  const handleInitialTxSubmit = (e) => {
    e.preventDefault();
    if (!selectedWallet) return;

    const curUSD = parseFloat(selectedWallet.balanceUSD ?? selectedWallet.balance ?? 0);
    const curLBP = parseFloat(selectedWallet.balanceLBP || 0);
    const amt = parseFloat(txForm.amount) || 0;

    // 1. تحويل بين المحافظ (Wallet Transfer)
    if (txForm.type === 'transfer') {
      if (amt <= 0) {
        alert('يرجى إدخال مبلغ صالح للتحويل!');
        return;
      }
      if (!txForm.targetWalletId) {
        alert('يرجى اختيار المحفظة المستقبلة!');
        return;
      }
      if (txForm.currency === 'USD' && amt > curUSD) {
        alert('رصيد الدولار غير كافٍ لإتمام التحويل!');
        return;
      }
      if (txForm.currency === 'LBP' && amt > curLBP) {
        alert('رصيد الليرة غير كافٍ لإتمام التحويل!');
        return;
      }

      const targetW = sources.find(s => s.id === txForm.targetWalletId);
      const targetName = targetW ? targetW.name : 'محفظة أخرى';

      onRecordWalletTx(selectedWallet.id, {
        type: 'withdrawal',
        amount: amt,
        currency: txForm.currency,
        itemName: `تحويل إلى ${targetName}`,
        customerName: 'تحويل داخلي',
        notes: txForm.notes || `تحويل إلى محفظة ${targetName}`
      });

      onRecordWalletTx(txForm.targetWalletId, {
        type: 'deposit',
        amount: amt,
        currency: txForm.currency,
        itemName: `استلام تحويل من ${selectedWallet.name}`,
        customerName: 'تحويل داخلي',
        notes: txForm.notes || `مستلم من ${selectedWallet.name}`
      });

      alert(`تم تحويل ${amt.toLocaleString()} ${txForm.currency} بنجاح من "${selectedWallet.name}" إلى "${targetName}"!`);
      setModalType(null);
      return;
    }

    // 2. صرافة وتصريف عملة (FX)
    if (txForm.type === 'exchange') {
      if (amt <= 0) {
        alert('يرجى إدخال مبلغ صالح للتصريف!');
        return;
      }
      const rate = parseFloat(txForm.fxRate) || exchangeRate;

      if (txForm.currency === 'USD') {
        if (amt > curUSD) {
          alert('رصيد الدولار لا يكفي للتصريف!');
          return;
        }
        const convertedLBP = Math.round(amt * rate);

        onRecordWalletTx(selectedWallet.id, {
          type: 'withdrawal',
          amount: amt,
          currency: 'USD',
          itemName: `صرافة: بيع $${amt}`,
          notes: `تصريف بسعر ${rate.toLocaleString()}`
        });

        onRecordWalletTx(selectedWallet.id, {
          type: 'deposit',
          amount: convertedLBP,
          currency: 'LBP',
          itemName: `صرافة: قبض ${convertedLBP.toLocaleString()} ل.ل`,
          notes: `مقابل تصريف $${amt}`
        });

        alert(`تمت عملية الصرافة بنجاح! خُصم $${amt} وأُضيف ${convertedLBP.toLocaleString()} ل.ل إلى المحفظة.`);
      } else {
        if (amt > curLBP) {
          alert('رصيد الليرة لا يكفي للتصريف!');
          return;
        }
        const convertedUSD = parseFloat((amt / rate).toFixed(2));

        onRecordWalletTx(selectedWallet.id, {
          type: 'withdrawal',
          amount: amt,
          currency: 'LBP',
          itemName: `صرافة: بيع ${amt.toLocaleString()} ل.ل`,
          notes: `تصريف بسعر ${rate.toLocaleString()}`
        });

        onRecordWalletTx(selectedWallet.id, {
          type: 'deposit',
          amount: convertedUSD,
          currency: 'USD',
          itemName: `صرافة: قبض $${convertedUSD}`,
          notes: `مقابل تصريف ${amt.toLocaleString()} ل.ل`
        });

        alert(`تمت عملية الصرافة بنجاح! خُصم ${amt.toLocaleString()} ل.ل وأُضيف $${convertedUSD} إلى المحفظة.`);
      }

      setModalType(null);
      return;
    }

    // 3. شراء كارت لخط مسكر
    if (txForm.type === 'buy_card') {
      const activeTiers = CUSTOM_CARD_TIERS[txForm.cardOperator] || CUSTOM_CARD_TIERS.ALFA;
      const currentTier = activeTiers.find(t => t.id === txForm.selectedTierId) || activeTiers[5];

      const costUSD = currentTier.costUSD;
      const costLBP = currentTier.costLBP;

      if (txForm.cardPayCurrency === 'USD') {
        if (curUSD < costUSD) {
          alert(`رصيد الدولار في المحفظة غير كافٍ! المطلوب: $${costUSD.toFixed(2)}، المتوفر: $${curUSD.toFixed(2)}`);
          return;
        }
      } else {
        if (curLBP < costLBP) {
          alert(`رصيد الليرة في المحفظة غير كافٍ! المطلوب: ${costLBP.toLocaleString()} ل.ل، المتوفر: ${Math.round(curLBP).toLocaleString()} ل.ل`);
          return;
        }
      }

      if (!selectedClosedLineObj) {
        alert('يرجى تحديد الخط المسكر المستهدف!');
        return;
      }

      const creditToAdd = currentTier.credit;
      const daysToAdd = currentTier.days;

      onRecordWalletTx(selectedWallet.id, {
        type: 'withdrawal',
        amount: txForm.cardPayCurrency === 'USD' ? costUSD : costLBP,
        currency: txForm.cardPayCurrency,
        itemName: `شراء كارت ${txForm.cardOperator} (${creditToAdd}$) لخط مسكر #${selectedClosedLineObj.slotNumber}`,
        customerName: 'تغذية خط مسكر',
        costUSD: costUSD,
        profitUSD: 0,
        notes: `كارت ${creditToAdd}$ • تمديد ${daysToAdd} يوم • التكلفة: ${txForm.cardPayCurrency === 'USD' ? '$' + costUSD : costLBP.toLocaleString() + ' ل.ل'}`
      });

      if (onUpdateLines) {
        onUpdateLines(prevLines => prevLines.map(l => {
          if (l.id === selectedClosedLineObj.id) {
            const currentBal = parseFloat(l.balanceUSD || l.balance || 0);
            const newBal = parseFloat((currentBal + creditToAdd).toFixed(2));
            const currentDays = parseInt(l.validityDays || 0, 10);
            return {
              ...l,
              balanceUSD: newBal.toString(),
              balance: newBal,
              validityDays: (currentDays + daysToAdd).toString(),
              validityStartDate: new Date().toISOString()
            };
          }
          return l;
        }));
      }

      if (onAddDebt) {
        onAddDebt({
          id: `debt_box_${Date.now()}`,
          category: 'boxes',
          name: selectedWallet.name,
          amount: costUSD,
          originalAmount: costUSD,
          currency: 'USD',
          sourceWalletId: selectedWallet.id,
          targetLineId: selectedClosedLineObj.id,
          targetLineSlot: selectedClosedLineObj.slotNumber,
          targetPhoneNumber: selectedClosedLineObj.phoneNumber || selectedClosedLineObj.number,
          cardCredit: creditToAdd,
          cardCost: costUSD,
          paidCurrency: txForm.cardPayCurrency,
          isTelecomRecharge: true,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          paid: false,
          notes: `تكلفة كارت ${txForm.cardOperator} (${creditToAdd}$) لخط #${selectedClosedLineObj.slotNumber}`,
          createdAt: new Date().toISOString(),
          history: [{
            id: `tx_${Date.now()}`,
            date: new Date().toISOString(),
            type: 'debt',
            amount: costUSD,
            currency: 'USD',
            notes: `استلاف تكلفة كارت لخط #${selectedClosedLineObj.slotNumber}`
          }]
        });
      }

      alert('تمت العملية بنجاح وتسجيل الرصيد بالخط والدين بالصناديق!');
      setModalType(null);
      return;
    }

    // 4. سنة أيام Alfa
    if (txForm.type === 'days_year') {
      const deductVal = parseFloat(txForm.daysWalletDeduct) || 0;
      if (curUSD < deductVal) {
        alert(`رصيد الدولار بالمحفظة غير كافٍ!`);
        return;
      }
      if (!txForm.daysTargetSimId) {
        alert('يرجى اختيار الشريحة المستهدفة!');
        return;
      }
      setCustomerType('customers');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setPaymentType('cash');
      setPartialPaidAmount('');
      setCustomerSuggestions([]);
      setModalType('customer_step');
      return;
    }

    if (amt <= 0) {
      alert('يرجى إدخال مبلغ صالح!');
      return;
    }

    if (txForm.type === 'withdrawal') {
      if (txForm.currency === 'USD' && amt > curUSD) {
        alert('رصيد الدولار غير كافٍ!');
        return;
      }
      if (txForm.currency === 'LBP' && amt > curLBP) {
        alert('رصيد الليرة غير كافٍ!');
        return;
      }
    }

    if (txForm.type === 'sale') {
      setCustomerType('customers');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setPaymentType('cash');
      setPartialPaidAmount('');
      setCustomerSuggestions([]);
      setModalType('customer_step');
    } else {
      onRecordWalletTx(selectedWallet.id, {
        type: txForm.type,
        amount: amt,
        currency: txForm.currency,
        itemName: txForm.itemName || (txForm.type === 'deposit' ? `إيداع نقدي (${txForm.currency})` : `سحب نقدي (${txForm.currency})`),
        customerName: 'حركة مباشرة',
        notes: txForm.notes || ''
      });
      setModalType(null);
    }
  };

  const handleCustomerSearch = (query) => {
    setCustomerName(query);
    if (!query.trim()) {
      setCustomerSuggestions([]);
      return;
    }
    const clean = query.toLowerCase().trim();
    const matches = customers.filter(c =>
      c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean))
    );
    setCustomerSuggestions(matches);
  };

  const handleSelectCustomer = (c) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.address || '');
    setCustomerSuggestions([]);
  };

  const rawSaleTotal = parseFloat(txForm.amount) || 0;
  const remainingDebtAmount = paymentType === 'debt'
    ? rawSaleTotal
    : paymentType === 'partial'
      ? Math.max(0, rawSaleTotal - (parseFloat(partialPaidAmount) || 0))
      : 0;

  const handleFinalSaleConfirm = (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('يرجى كتابة اسم العميل!');
      return;
    }

    const rawSale = parseFloat(txForm.amount) || 0;
    const saleInUSD = txForm.currency === 'LBP' ? (rawSale / exchangeRate) : rawSale;

    if (txForm.type === 'days_year') {
      const deductFromWallet = parseFloat(txForm.daysWalletDeduct) || 86.5;
      const returnCreditUSD = parseFloat(txForm.daysReturnUSD) || 73.5;
      const costOfReturnBatch = parseFloat(txForm.daysCostLBP) || 93500;
      const netCostUSD = Math.max(0, deductFromWallet - returnCreditUSD);
      const netProfitUSD = Math.max(0, saleInUSD - netCostUSD);

      onRecordWalletTx(selectedWallet.id, {
        type: 'sale',
        isDaysYear: true,
        targetSimId: txForm.daysTargetSimId,
        returnCreditUSD: returnCreditUSD,
        costLBP: costOfReturnBatch,
        amount: rawSale,
        sellingPrice: rawSale,
        currency: txForm.currency,
        costUSD: parseFloat(netCostUSD.toFixed(2)),
        profitUSD: parseFloat(netProfitUSD.toFixed(2)),
        walletDeduction: deductFromWallet,
        itemName: `سنة أيام Alfa (+${returnCreditUSD}$)`,
        customerType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentType,
        paidAmount: paymentType === 'cash' ? rawSale : (parseFloat(partialPaidAmount) || 0),
        remainingDebt: remainingDebtAmount,
        isDebt: remainingDebtAmount > 0,
        notes: txForm.notes || '',
        date: new Date().toISOString()
      });
    } else {
      let costUSD = 0;
      if (txForm.costPrice && parseFloat(txForm.costPrice) > 0) {
        const rawCost = parseFloat(txForm.costPrice);
        costUSD = txForm.costCurrency === 'LBP' ? (rawCost / exchangeRate) : rawCost;
      }
      const netProfitUSD = Math.max(0, saleInUSD - costUSD);

      onRecordWalletTx(selectedWallet.id, {
        type: 'sale',
        amount: rawSale,
        sellingPrice: rawSale,
        currency: txForm.currency,
        costUSD: parseFloat(costUSD.toFixed(2)),
        profitUSD: parseFloat(netProfitUSD.toFixed(2)),
        itemName: txForm.itemName || 'عملية بيع عامة',
        customerType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentType,
        paidAmount: paymentType === 'cash' ? rawSale : (parseFloat(partialPaidAmount) || 0),
        remainingDebt: remainingDebtAmount,
        isDebt: remainingDebtAmount > 0,
        notes: txForm.notes || '',
        date: new Date().toISOString()
      });
    }

    setModalType(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>المحافظ وصناديق السيولة</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>أرصدة مزدوجة، تحويل فوري، وصرافة داخلية</span>
        </div>
        <button
          onClick={() => setModalType('add')}
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
        >
          <Plus size={14} /> إضافة محفظة
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
        {sources.map(wallet => {
          const balUSD = parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0);
          const balLBP = parseFloat(wallet.balanceLBP || 0);

          return (
            <div key={wallet.id} className="tz-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', fontSize: '14px' }}>{wallet.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleStartRename(wallet)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    title="تعديل بيانات ورصيد المحفظة"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(wallet)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}
                    title="حذف المحفظة"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الدولار:</span>
                  <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                    ${balUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الليرة:</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {Math.round(balLBP).toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--orange-primary)' }}>ل.ل</span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => openTxModal(wallet)}
                  className="btn-primary"
                  style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '10px' }}
                >
                  حركة مالية
                </button>

                <button
                  onClick={() => { setSelectedWallet(wallet); setModalType('ledger'); }}
                  style={{
                    background: 'var(--bg-card-sub)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  title="كشف حساب المعاملات"
                >
                  <History size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* مودال إنشاء محفظة */}
      {modalType === 'add' && createPortal(
        <div className="modal-overlay">
          <div className="modal-center">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>إضافة محفظة مالية جديدة</h3>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="اسم المحفظة (Whish Cash / TopUp / درج الكاش)"
                required
                className="tz-input"
                value={newWalletName}
                onChange={e => setNewWalletName(e.target.value)}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رصيد افتتاحي ($):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className="tz-input"
                    value={newWalletInitialUSD}
                    onChange={e => setNewWalletInitialUSD(e.target.value)}
                    style={{ marginTop: '2px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رصيد افتتاحي (ل.ل):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    className="tz-input"
                    value={newWalletInitialLBP}
                    onChange={e => setNewWalletInitialLBP(e.target.value)}
                    style={{ marginTop: '2px' }}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '6px' }}>إنشاء المحفظة</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* مودال تعديل المحفظة */}
      {modalType === 'edit' && selectedWallet && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>تعديل بيانات المحفظة ورصيدها</h3>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>اسم المحفظة:</label>
                <input
                  type="text"
                  required
                  className="tz-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                  style={{ marginTop: '2px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الدولار ($):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="tz-input"
                    value={editUSD}
                    onChange={e => setEditUSD(e.target.value)}
                    style={{ marginTop: '2px', fontWeight: 'bold', color: 'var(--orange-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الليرة (LBP):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="tz-input"
                    value={editLBP}
                    onChange={e => setEditLBP(e.target.value)}
                    style={{ marginTop: '2px', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '6px' }}>حفظ التعديل المباشر</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* تحذير الحذف */}
      {modalType === 'delete_warning' && selectedWallet && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '360px', textAlign: 'center', padding: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <AlertTriangle size={26} color="var(--red)" />
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '900' }}>لا يمكن حذف المحفظة</h4>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              المحفظة <b>"{selectedWallet.name}"</b> تحتوي على رصيد قائم. يجب تصفير الأرصدة أولاً قبل الحذف!
            </p>
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="btn-primary"
              style={{ height: '38px', fontSize: '12px' }}
            >
              حسناً، فهمت
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* مودال حركة مالية متكامل (إيداع، سحب، تحويل، صرافة FX، وشراء كارت بالعملة المحددة) */}
      {modalType === 'tx' && selectedWallet && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '420px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>حركة على: {selectedWallet.name}</h3>
                <div style={{ fontSize: '11px', color: 'var(--orange-primary)', fontWeight: 'bold' }}>
                  متوفر: ${parseFloat(selectedWallet.balanceUSD ?? selectedWallet.balance ?? 0).toFixed(2)} • {Math.round(parseFloat(selectedWallet.balanceLBP || 0)).toLocaleString()} ل.ل
                </div>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleInitialTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>نوع المعاملة:</label>
                <select
                  className="tz-select"
                  value={txForm.type}
                  onChange={e => {
                    const newType = e.target.value;
                    setTxForm({
                      ...txForm,
                      type: newType,
                      currency: (newType === 'days_year' || newType === 'exchange') ? 'LBP' : txForm.currency,
                      amount: newType === 'days_year' ? '1000000' : '',
                      selectedTierId: 'alfa_22_73'
                    });
                  }}
                >
                  <option value="deposit">📥 إيداع مباشر في المحفظة (+)</option>
                  <option value="withdrawal">📤 سحب مباشر من المحفظة (-)</option>
                  <option value="transfer">🔄 تحويل كاش إلى محفظة أخرى</option>
                  <option value="exchange">💱 صرافة وتصريف عملة (FX)</option>
                  <option value="buy_card">📱 شراء كارت</option>
                  <option value="sale">⚡ عملية بيع عامة (+)</option>
                  <option value="days_year">⚡ شراء وبيع سنة أيام Alfa</option>
                </select>
              </div>

              {/* قسم الإيداع والسحب المباشر */}
              {(txForm.type === 'deposit' || txForm.type === 'withdrawal') && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المراد {txForm.type === 'deposit' ? 'إيداعه' : 'سحبه'}:</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        className="tz-input"
                        value={txForm.amount}
                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                      <select
                        className="tz-select"
                        value={txForm.currency}
                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                        style={{ marginTop: '2px' }}
                      >
                        <option value="USD">دولار ($)</option>
                        <option value="LBP">ليرة (LBP)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>البيان / ملاحظة (اختياري):</label>
                    <input
                      type="text"
                      placeholder="مثال: تغذية صندوق من زبون / سحب شخصي..."
                      className="tz-input"
                      value={txForm.notes}
                      onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* قسم التحويل بين المحافظ */}
              {txForm.type === 'transfer' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>تحويل إلى محفظة:</label>
                    <select
                      className="tz-select"
                      value={txForm.targetWalletId}
                      onChange={e => setTxForm({ ...txForm, targetWalletId: e.target.value })}
                      required
                    >
                      {sources.filter(s => s.id !== selectedWallet.id).map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} (رصيدها: ${w.balanceUSD || 0} • {Math.round(w.balanceLBP || 0).toLocaleString()} ل.ل)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المراد تحويله:</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        className="tz-input"
                        value={txForm.amount}
                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                      <select
                        className="tz-select"
                        value={txForm.currency}
                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                        style={{ marginTop: '2px' }}
                      >
                        <option value="USD">دولار ($)</option>
                        <option value="LBP">ليرة (LBP)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ملاحظات التحويل:</label>
                    <input
                      type="text"
                      placeholder="بيان حركة التحويل..."
                      className="tz-input"
                      value={txForm.notes}
                      onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* قسم الصرافة والتصريف الداخلي FX */}
              {txForm.type === 'exchange' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--green)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>المبلغ المراد تصريفه (البيع):</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="المبلغ"
                        className="tz-input"
                        value={txForm.amount}
                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة المصروفة:</label>
                      <select
                        className="tz-select"
                        value={txForm.currency}
                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                        style={{ marginTop: '2px' }}
                      >
                        <option value="USD">دولار (بيع $ وقبض L.L)</option>
                        <option value="LBP">ليرة (بيع L.L وقبض $)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر الصرف المعتمد للعملية:</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="tz-input"
                      value={txForm.fxRate}
                      onChange={e => setTxForm({ ...txForm, fxRate: e.target.value })}
                      style={{ marginTop: '2px', fontWeight: 'bold' }}
                    />
                  </div>

                  {/* حساب المعاينة الحية */}
                  {(() => {
                    const amtVal = parseFloat(txForm.amount) || 0;
                    const r = parseFloat(txForm.fxRate) || exchangeRate;
                    const resultText = txForm.currency === 'USD'
                      ? `ستقبض بالمقابل: ${Math.round(amtVal * r).toLocaleString()} ل.ل`
                      : `ستقبض بالمقابل: $${(r > 0 ? (amtVal / r) : 0).toFixed(2)}`;

                    return (
                      <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '10px', border: '1px dashed var(--border-color)', fontSize: '11px', color: 'var(--green)', fontWeight: 'bold' }}>
                        {resultText}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* قسم شراء الكارت مع أسعار الدولار والليرة المعتمدة */}
              {txForm.type === 'buy_card' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>الشبكة:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      {['ALFA', 'TOUCH'].map(op => (
                        <button
                          key={op}
                          type="button"
                          className="tz-input"
                          style={{
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderColor: txForm.cardOperator === op ? 'var(--orange-primary)' : 'var(--border-color)',
                            background: txForm.cardOperator === op ? 'var(--orange-subtle)' : 'transparent',
                            color: txForm.cardOperator === op ? 'var(--orange-primary)' : 'inherit'
                          }}
                          onClick={() => {
                            const defaultTierId = op === 'ALFA' ? 'alfa_22_73' : 'touch_22_73';
                            setTxForm({
                              ...txForm,
                              cardOperator: op,
                              selectedTierId: defaultTierId
                            });
                          }}
                        >
                          {op === 'ALFA' ? 'ألفا (Alfa)' : 'تاتش (Touch)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>خصم التكلفة من رصيد:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          borderColor: txForm.cardPayCurrency === 'USD' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.cardPayCurrency === 'USD' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.cardPayCurrency === 'USD' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm({ ...txForm, cardPayCurrency: 'USD' })}
                      >
                        رصيد الدولار ($)
                      </button>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          borderColor: txForm.cardPayCurrency === 'LBP' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.cardPayCurrency === 'LBP' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.cardPayCurrency === 'LBP' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm({ ...txForm, cardPayCurrency: 'LBP' })}
                      >
                        رصيد الليرة (LBP)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>فئة الكارت والتكلفة المعتمدة:</label>
                    <select
                      className="tz-select"
                      style={{ marginTop: '4px', fontWeight: 'bold' }}
                      value={txForm.selectedTierId}
                      onChange={e => setTxForm({ ...txForm, selectedTierId: e.target.value })}
                    >
                      {(CUSTOM_CARD_TIERS[txForm.cardOperator] || CUSTOM_CARD_TIERS.ALFA).map(t => (
                        <option key={t.id} value={t.id}>
                          {txForm.cardPayCurrency === 'USD'
                            ? `${t.label} (تكلفة $${t.costUSD.toFixed(2)} - ${t.days} يوم)`
                            : `${t.label} (تكلفة ${t.costLBP.toLocaleString()} ل.ل - ${t.days} يوم)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      الخط المسكر المستهدف للشحن:
                    </label>

                    <div
                      onClick={() => setTxForm(prev => ({ ...prev, isLineSearchOpen: !prev.isLineSearchOpen }))}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: selectedClosedLineObj ? 'bold' : 'normal', color: selectedClosedLineObj ? 'var(--orange-primary)' : 'var(--text-muted)' }}>
                        {selectedClosedLineObj
                          ? `خط #${selectedClosedLineObj.slotNumber}: ${selectedClosedLineObj.phoneNumber || selectedClosedLineObj.number} (رصيده: $${selectedClosedLineObj.balanceUSD || selectedClosedLineObj.balance || 0})`
                          : '-- ابحث أو اختر الخط المسكر --'}
                      </span>
                    </div>

                    {txForm.isLineSearchOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1.5px solid var(--orange-primary)',
                        borderRadius: '14px',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                        zIndex: 300,
                        marginTop: '4px',
                        padding: '8px',
                        maxHeight: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: '8px', padding: '0 8px', border: '1px solid var(--border-color)' }}>
                          <Search size={14} color="var(--text-muted)" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="ابحث برقم الخط أو الهاتف..."
                            className="tz-input"
                            style={{ border: 'none', height: '34px', fontSize: '11px', background: 'transparent' }}
                            value={txForm.lineSearchQuery}
                            onChange={(e) => setTxForm(prev => ({ ...prev, lineSearchQuery: e.target.value }))}
                          />
                        </div>

                        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {filteredClosedLines.length === 0 ? (
                            <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                              لا يوجد خط مسكر مطابق للبحث
                            </div>
                          ) : (
                            filteredClosedLines.map((line) => (
                              <div
                                key={line.id}
                                onClick={() => {
                                  setTxForm(prev => ({
                                    ...prev,
                                    targetClosedLineId: line.id,
                                    isLineSearchOpen: false,
                                    lineSearchQuery: ''
                                  }));
                                }}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: txForm.targetClosedLineId === line.id ? 'var(--orange-glow)' : 'var(--bg-card-sub)',
                                  color: txForm.targetClosedLineId === line.id ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                <span>خط #{line.slotNumber}</span>
                                <span style={{ direction: 'ltr' }}>{line.phoneNumber || line.number}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* قسم سنة أيام Alfa */}
              {txForm.type === 'days_year' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>يخصم من المحفظة ($):</label>
                      <input
                        type="number"
                        step="any"
                        required
                        className="tz-input"
                        value={txForm.daysWalletDeduct}
                        onChange={e => setTxForm({ ...txForm, daysWalletDeduct: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>يرجع للشريحة رصيد ($):</label>
                      <input
                        type="number"
                        step="any"
                        required
                        className="tz-input"
                        value={txForm.daysReturnUSD}
                        onChange={e => setTxForm({ ...txForm, daysReturnUSD: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>تكلفة الدفعة على الخط (LBP):</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="tz-input"
                      value={txForm.daysCostLBP}
                      onChange={e => setTxForm({ ...txForm, daysCostLBP: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اختر شريحة Alfa لشحن الرصيد:</label>
                    <select
                      className="tz-select"
                      value={txForm.daysTargetSimId}
                      onChange={e => setTxForm({ ...txForm, daysTargetSimId: e.target.value })}
                      required
                    >
                      <option value="">-- اختر الشريحة --</option>
                      {sims.map(sim => (
                        <option key={sim.id} value={sim.id}>
                          {sim.name} ({sim.number}) - رصيدها: ${sim.balance}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>
                      سعر البيع للزبون:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px', marginTop: '2px' }}>
                      <input
                        type="number"
                        step="any"
                        required
                        className="tz-input"
                        value={txForm.amount}
                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                      />
                      <select
                        className="tz-select"
                        value={txForm.currency}
                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                      >
                        <option value="LBP">ليرة (LBP)</option>
                        <option value="USD">دولار ($)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* قسم المبيع العام */}
              {txForm.type === 'sale' && (
                <>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>سعر البيع للزبون:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        className="tz-input"
                        value={txForm.amount}
                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                        style={{ fontWeight: 'bold', color: 'var(--orange-primary)' }}
                      />
                      <select
                        className="tz-select"
                        value={txForm.currency}
                        onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                      >
                        <option value="USD">دولار ($)</option>
                        <option value="LBP">ليرة (LBP)</option>
                      </select>
                    </div>
                  </div>

                  {/* حقل التكلفة لحساب الربح الحقيقي */}
                  <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--red)', display: 'block', marginBottom: '4px' }}>
                      سعر التكلفة عليك (رأس المال):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="tz-input"
                        value={txForm.costPrice}
                        onChange={e => setTxForm({ ...txForm, costPrice: e.target.value })}
                        style={{ fontWeight: 'bold' }}
                      />
                      <select
                        className="tz-select"
                        value={txForm.costCurrency}
                        onChange={e => setTxForm({ ...txForm, costCurrency: e.target.value })}
                      >
                        <option value="USD">$ دولار</option>
                        <option value="LBP">ليرة LBP</option>
                      </select>
                    </div>

                    {/* معاينة صافي الربح مباشرة */}
                    {(() => {
                      const saleRaw = parseFloat(txForm.amount) || 0;
                      const saleUSD = txForm.currency === 'LBP' ? (saleRaw / exchangeRate) : saleRaw;
                      const costRaw = parseFloat(txForm.costPrice) || 0;
                      const costUSD = txForm.costCurrency === 'LBP' ? (costRaw / exchangeRate) : costRaw;
                      const netProfit = saleUSD - costUSD;

                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>صافي ربحك التقديري:</span>
                          <b style={{ color: netProfit >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '13px' }}>
                            {netProfit >= 0 ? `+ $${netProfit.toFixed(2)}` : `- $${Math.abs(netProfit).toFixed(2)}`}
                          </b>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>السلعة / الخدمة:</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: كارت تشريج / شاحن 20W / صيانة..."
                      className="tz-input"
                      value={txForm.itemName}
                      onChange={e => setTxForm({ ...txForm, itemName: e.target.value })}
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn-primary" style={{ marginTop: '6px' }}>
                {txForm.type === 'buy_card'
                  ? 'تأكيد شراء الكارت وتغذية الخط فوراً'
                  : (txForm.type === 'sale' || txForm.type === 'days_year')
                    ? 'متابعة لبيانات العميل وخيارات الدفع ←'
                    : 'تأكيد تنفيذ العملية'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* مودال العميل وطريقة الدفع */}
      {modalType === 'customer_step' && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>بيانات العميل وطريقة الدفع</h3>
                <span style={{ fontSize: '11px', color: 'var(--orange-primary)' }}>
                  المبيع: {parseFloat(txForm.amount).toLocaleString()} {txForm.currency === 'LBP' ? 'ل.ل' : '$'}
                </span>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleFinalSaleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCustomerType('customers')}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: customerType === 'customers' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: customerType === 'customers' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                    color: customerType === 'customers' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <User size={13} />
                  <span>زبون عادي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('merchants')}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: customerType === 'merchants' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: customerType === 'merchants' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                    color: customerType === 'merchants' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Building2 size={13} />
                  <span>تاجر / محل</span>
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {customerType === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم الزبون:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ابحث بالاسم أو الرقم..."
                  className="tz-input"
                  value={customerName}
                  onChange={e => handleCustomerSearch(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  style={{ marginTop: '2px' }}
                />

                {customerSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--orange-primary)',
                    borderRadius: '12px',
                    zIndex: 110,
                    maxHeight: '140px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    marginTop: '2px'
                  }}>
                    {customerSuggestions.map(cust => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}
                      >
                        <span style={{ fontWeight: 'bold' }}>{cust.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{cust.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رقم الهاتف:</label>
                  <input
                    type="tel"
                    placeholder="الهاتف..."
                    className="tz-input"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    style={{ marginTop: '2px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>العنوان / المنطقة:</label>
                  <input
                    type="text"
                    placeholder="العنوان..."
                    className="tz-input"
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                    style={{ marginTop: '2px' }}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>طريقة الدفع:</span>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                    المبلغ: {rawSaleTotal.toLocaleString()} {txForm.currency === 'LBP' ? 'ل.ل' : '$'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentType('cash')}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: paymentType === 'cash' ? '1.5px solid var(--green)' : '1px solid var(--border-color)',
                      background: paymentType === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: paymentType === 'cash' ? 'var(--green)' : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    كاش نقداً
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('partial')}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: paymentType === 'partial' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                      background: paymentType === 'partial' ? 'rgba(255, 122, 0, 0.15)' : 'transparent',
                      color: paymentType === 'partial' ? 'var(--orange-primary)' : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    دفع جزئي
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('debt')}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: paymentType === 'debt' ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                      background: paymentType === 'debt' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      color: paymentType === 'debt' ? 'var(--red)' : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    آجل (دين)
                  </button>
                </div>

                {paymentType === 'partial' && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="any"
                      placeholder="المبلغ المدفوع كاش..."
                      className="tz-input"
                      style={{ height: '36px', fontSize: '11px', flex: 1 }}
                      value={partialPaidAmount}
                      onChange={e => setPartialPaidAmount(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 'bold' }}>
                      المتبقي كدين: {remainingDebtAmount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '6px', height: '44px' }}>
                <CheckCircle2 size={16} />
                <span>تأكيد وتسجيل العملية</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* كشف الحساب */}
      {modalType === 'ledger' && selectedWallet && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '440px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>كشف حساب: {selectedWallet.name}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  الرصيد: ${parseFloat(selectedWallet.balanceUSD ?? selectedWallet.balance ?? 0).toFixed(2)} • {Math.round(parseFloat(selectedWallet.balanceLBP || 0)).toLocaleString()} ل.ل
                </span>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
              {(!selectedWallet.ledger || selectedWallet.ledger.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  لا توجد حركات مسجلة على هذه المحفظة بعد.
                </div>
              ) : (
                selectedWallet.ledger.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-card-sub)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '13px' }}>{item.itemName}</span>
                      <span style={{ color: item.type === 'deposit' ? 'var(--green)' : 'var(--red)', fontWeight: '900' }}>
                        {item.type === 'deposit' ? '+' : '-'}
                        {item.currency === 'LBP' ? `${Math.round(item.amount).toLocaleString()} ل.ل` : `$${parseFloat(item.walletDeduction || item.amount).toFixed(2)}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>{item.customerName || 'حركة داخلية'}</span>
                      {item.balanceAfterUSD !== undefined && (
                        <span style={{ color: 'var(--orange-primary)', fontWeight: 'bold' }}>
                          بعد الحركة: ${parseFloat(item.balanceAfterUSD).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'left' }}>
                      {formatDateTime(item.date)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalType(null)}
              className="btn-primary"
              style={{ marginTop: '12px', height: '38px', fontSize: '12px' }}
            >
              إغلاق
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}