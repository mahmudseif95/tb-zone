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
  RefreshCw,
  UserCheck,
  Zap,
  Lock
} from 'lucide-react';

// فئات الكروت الرسمية والأسعار الافتراضية المعتمدة
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

  // استمارة العمليات الشاملة
  const [txForm, setTxForm] = useState({
    type: 'deposit',
    amount: '',
    currency: 'USD',
    targetWalletId: '',
    fxRate: exchangeRate.toString(),
    costPrice: '',
    costCurrency: 'USD',
    itemName: '',
    notes: '',

    // سنة أيام Alfa مع تبديل العملة تلقائياً
    daysFxRate: exchangeRate.toString(),
    daysDeductCurrency: 'LBP', // الافتراضي ليرة لبنانية
    daysWalletDeductUSD: '86.5',
    daysWalletDeductLBP: Math.round(86.5 * exchangeRate).toString(),
    daysReturnUSD: '73.5',
    daysCostLBP: '93500',
    daysTargetSimId: '',

    // شراء كارت
    cardOperator: 'ALFA',
    selectedTierId: 'alfa_22_73',
    cardCostUSD: '25.46',
    cardCostLBP: '2278112',
    cardPayCurrency: 'USD',
    cardDestination: 'locked', // 'locked' | 'open_admin' | 'direct'
    targetClosedLineId: '',
    lineSearchQuery: '',
    isLineSearchOpen: false,

    // أدمن مفتوح
    adminSelectMode: 'new', // 'new' | 'existing_line'
    targetOpenLineId: '',
    adminName: '',
    adminPhone: '',
    adminAddress: '',
    adminGB: '22',
    adminPrice: '',
    adminLinePhone: '',

    // شحن مباشر لرقم
    directPhone: '',
    directCustomerName: '',
    directSellingPrice: '',
    directSellingCurrency: 'USD'
  });

  const [customerType, setCustomerType] = useState('customers');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [partialPaidAmount, setPartialPaidAmount] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [adminCustomerSuggestions, setAdminCustomerSuggestions] = useState([]);

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
    const defaultTier = CUSTOM_CARD_TIERS.ALFA.find(t => t.id === 'alfa_22_73') || CUSTOM_CARD_TIERS.ALFA[5];

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
      daysFxRate: exchangeRate.toString(),
      daysDeductCurrency: 'LBP',
      daysWalletDeductUSD: '86.5',
      daysWalletDeductLBP: Math.round(86.5 * exchangeRate).toString(),
      daysReturnUSD: '73.5',
      daysCostLBP: '93500',
      daysTargetSimId: sims[0]?.id || '',
      cardOperator: 'ALFA',
      selectedTierId: defaultTier.id,
      cardCostUSD: defaultTier.costUSD.toString(),
      cardCostLBP: defaultTier.costLBP.toString(),
      cardPayCurrency: 'USD',
      cardDestination: 'locked',
      targetClosedLineId: '',
      lineSearchQuery: '',
      isLineSearchOpen: false,
      adminSelectMode: 'new',
      targetOpenLineId: '',
      adminName: '',
      adminPhone: '',
      adminAddress: '',
      adminGB: '22',
      adminPrice: '',
      adminLinePhone: '',
      directPhone: '',
      directCustomerName: '',
      directSellingPrice: '',
      directSellingCurrency: 'USD'
    });
    setModalType('tx');
  };

  const lockedLinesOnly = lines.filter(l => (l.type || 'locked') === 'locked');
  const openLinesOnly = lines.filter(l => l.type === 'open');

  const filteredClosedLines = lockedLinesOnly.filter(line => {
    const q = (txForm.lineSearchQuery || '').toLowerCase().trim();
    if (!q) return true;
    const slotStr = (line.slotNumber || '').toString();
    const phoneStr = (line.phoneNumber || line.number || '').toString();
    return slotStr.includes(q) || phoneStr.includes(q);
  });

  const selectedClosedLineObj = lines.find(l => l.id === txForm.targetClosedLineId);
  const selectedOpenLineObj = lines.find(l => l.id === txForm.targetOpenLineId);

  const handleCardTierChange = (tierId, operator) => {
    const tiers = CUSTOM_CARD_TIERS[operator] || CUSTOM_CARD_TIERS.ALFA;
    const tier = tiers.find(t => t.id === tierId) || tiers[0];
    setTxForm(prev => ({
      ...prev,
      selectedTierId: tierId,
      cardCostUSD: tier.costUSD.toString(),
      cardCostLBP: tier.costLBP.toString()
    }));
  };

  const handleAdminCustomerSearch = (query) => {
    setTxForm(prev => ({ ...prev, adminName: query }));
    if (!query.trim()) {
      setAdminCustomerSuggestions([]);
      return;
    }
    const clean = query.toLowerCase().trim();
    const matches = customers.filter(c =>
      c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean))
    );
    setAdminCustomerSuggestions(matches);
  };

  const handleSelectAdminCustomer = (c) => {
    setTxForm(prev => ({
      ...prev,
      adminName: c.name,
      adminPhone: c.phone || prev.adminPhone,
      adminAddress: c.address || prev.adminAddress
    }));
    setAdminCustomerSuggestions([]);
  };

  const handleInitialTxSubmit = (e) => {
    e.preventDefault();
    if (!selectedWallet) return;

    const curUSD = parseFloat(selectedWallet.balanceUSD ?? selectedWallet.balance ?? 0);
    const curLBP = parseFloat(selectedWallet.balanceLBP || 0);
    const amt = parseFloat(txForm.amount) || 0;

    // 1. تحويل بين المحافظ
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

    // 2. صرافة وتصريف عملة FX
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

    // 3. شراء كارت (مع الوجهات الثلاثة)
    if (txForm.type === 'buy_card') {
      const activeTiers = CUSTOM_CARD_TIERS[txForm.cardOperator] || CUSTOM_CARD_TIERS.ALFA;
      const currentTier = activeTiers.find(t => t.id === txForm.selectedTierId) || activeTiers[5];

      const finalCostUSD = parseFloat(txForm.cardCostUSD) || currentTier.costUSD;
      const finalCostLBP = parseFloat(txForm.cardCostLBP) || currentTier.costLBP;
      const deductAmount = txForm.cardPayCurrency === 'USD' ? finalCostUSD : finalCostLBP;

      if (txForm.cardPayCurrency === 'USD') {
        if (curUSD < finalCostUSD) {
          alert(`رصيد الدولار في المحفظة غير كافٍ! المطلوب: $${finalCostUSD.toFixed(2)}، المتوفر: $${curUSD.toFixed(2)}`);
          return;
        }
      } else {
        if (curLBP < finalCostLBP) {
          alert(`رصيد الليرة في المحفظة غير كافٍ! المطلوب: ${finalCostLBP.toLocaleString()} ل.ل، المتوفر: ${Math.round(curLBP).toLocaleString()} ل.ل`);
          return;
        }
      }

      const creditToAdd = currentTier.credit;
      const daysToAdd = currentTier.days;

      if (txForm.cardDestination === 'locked') {
        if (!selectedClosedLineObj) {
          alert('يرجى تحديد الخط المسكر المستهدف للشحن!');
          return;
        }

        onRecordWalletTx(selectedWallet.id, {
          type: 'withdrawal',
          amount: deductAmount,
          currency: txForm.cardPayCurrency,
          itemName: `شراء كارت ${txForm.cardOperator} (${creditToAdd}$) لخط مسكر #${selectedClosedLineObj.slotNumber}`,
          customerName: 'تغذية خط مسكر',
          costUSD: finalCostUSD,
          profitUSD: 0,
          notes: `كارت ${creditToAdd}$ • تمديد ${daysToAdd} يوم • التكلفة: ${txForm.cardPayCurrency === 'USD' ? '$' + finalCostUSD : finalCostLBP.toLocaleString() + ' ل.ل'}`
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
            amount: finalCostUSD,
            originalAmount: finalCostUSD,
            currency: 'USD',
            sourceWalletId: selectedWallet.id,
            targetLineId: selectedClosedLineObj.id,
            targetLineSlot: selectedClosedLineObj.slotNumber,
            targetPhoneNumber: selectedClosedLineObj.phoneNumber || selectedClosedLineObj.number,
            cardCredit: creditToAdd,
            cardCost: finalCostUSD,
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
              amount: finalCostUSD,
              currency: 'USD',
              notes: `استلاف تكلفة كارت لخط #${selectedClosedLineObj.slotNumber}`
            }]
          });
        }

        alert('تمت العملية بنجاح وتسجيل الرصيد بالخط ودين الصندوق بالمحفظة!');
        setModalType(null);
        return;
      }

      if (txForm.cardDestination === 'open_admin') {
        if (txForm.adminSelectMode === 'new') {
          if (!txForm.adminName.trim()) {
            alert('يرجى إدخال اسم الأدمن المسؤول عن الخط المفتوح!');
            return;
          }

          const nextSlot = (openLinesOnly.length > 0
            ? Math.max(...openLinesOnly.map(l => Number(l.slotNumber) || 0)) + 1
            : 1).toString();
          const newOpenLineId = `open_line_${Date.now()}`;
          const linePhone = (txForm.adminLinePhone || txForm.adminPhone || '').trim();

          const newOpenLine = {
            id: newOpenLineId,
            type: 'open',
            slotNumber: nextSlot,
            phoneNumber: linePhone,
            number: linePhone,
            validityDays: daysToAdd,
            validityStartDate: new Date().toISOString(),
            hasService: true,
            serviceStartDate: new Date().toISOString().split('T')[0],
            balanceUSD: creditToAdd,
            adminName: txForm.adminName.trim(),
            adminPhone: txForm.adminPhone.trim(),
            adminAddress: txForm.adminAddress.trim(),
            adminGB: txForm.adminGB || '22',
            adminPrice: txForm.adminPrice || '',
            user1: '',
            user2: '',
            user3: '',
            notes: `شحن كارت ${txForm.cardOperator} (${creditToAdd}$) من محفظة ${selectedWallet.name}`
          };

          if (onUpdateLines) {
            onUpdateLines(prev => [...prev, newOpenLine]);
          }

          onRecordWalletTx(selectedWallet.id, {
            type: 'withdrawal',
            amount: deductAmount,
            currency: txForm.cardPayCurrency,
            itemName: `شراء كارت ${txForm.cardOperator} (${creditToAdd}$) لخط أدمن جديد #${nextSlot} (${txForm.adminName})`,
            customerName: txForm.adminName.trim(),
            costUSD: finalCostUSD,
            profitUSD: 0,
            notes: `كارت ${creditToAdd}$ • تمديد ${daysToAdd} يوم • التكلفة: ${txForm.cardPayCurrency === 'USD' ? '$' + finalCostUSD : finalCostLBP.toLocaleString() + ' ل.ل'}`
          });

          if (onAddDebt) {
            onAddDebt({
              id: `debt_box_${Date.now()}`,
              category: 'boxes',
              name: selectedWallet.name,
              amount: finalCostUSD,
              originalAmount: finalCostUSD,
              currency: 'USD',
              sourceWalletId: selectedWallet.id,
              targetLineId: newOpenLineId,
              targetLineSlot: nextSlot,
              targetPhoneNumber: linePhone,
              cardCredit: creditToAdd,
              cardCost: finalCostUSD,
              paidCurrency: txForm.cardPayCurrency,
              isTelecomRecharge: true,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              paid: false,
              notes: `تكلفة كارت ${txForm.cardOperator} (${creditToAdd}$) لخط أدمن #${nextSlot} (${txForm.adminName})`,
              createdAt: new Date().toISOString(),
              history: [{
                id: `tx_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'debt',
                amount: finalCostUSD,
                currency: 'USD',
                notes: `استلاف تكلفة كارت لخط أدمن #${nextSlot}`
              }]
            });
          }

          alert(`تم إنشاء خط أدمن مفتوح جديد #${nextSlot} (${txForm.adminName}) وتسجيل رصيد الكارت ودين المحفظة بنجاح!`);
          setModalType(null);
          return;
        } else {
          if (!selectedOpenLineObj) {
            alert('يرجى اختيار خط الأدمن القائم للشحن!');
            return;
          }

          onRecordWalletTx(selectedWallet.id, {
            type: 'withdrawal',
            amount: deductAmount,
            currency: txForm.cardPayCurrency,
            itemName: `شراء كارت ${txForm.cardOperator} (${creditToAdd}$) لخط أدمن قائم #${selectedOpenLineObj.slotNumber}`,
            customerName: selectedOpenLineObj.adminName || 'أدمن مفتوح',
            costUSD: finalCostUSD,
            profitUSD: 0,
            notes: `كارت ${creditToAdd}$ • تمديد ${daysToAdd} يوم`
          });

          if (onUpdateLines) {
            onUpdateLines(prev => prev.map(l => {
              if (l.id === selectedOpenLineObj.id) {
                const curBal = parseFloat(l.balanceUSD || l.balance || 0);
                const curDays = parseInt(l.validityDays || 0, 10);
                return {
                  ...l,
                  balanceUSD: (curBal + creditToAdd).toFixed(2),
                  balance: curBal + creditToAdd,
                  validityDays: (curDays + daysToAdd).toString(),
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
              amount: finalCostUSD,
              originalAmount: finalCostUSD,
              currency: 'USD',
              sourceWalletId: selectedWallet.id,
              targetLineId: selectedOpenLineObj.id,
              targetLineSlot: selectedOpenLineObj.slotNumber,
              targetPhoneNumber: selectedOpenLineObj.phoneNumber || selectedOpenLineObj.number,
              cardCredit: creditToAdd,
              cardCost: finalCostUSD,
              paidCurrency: txForm.cardPayCurrency,
              isTelecomRecharge: true,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              paid: false,
              notes: `تكلفة كارت ${txForm.cardOperator} (${creditToAdd}$) لخط أدمن #${selectedOpenLineObj.slotNumber}`,
              createdAt: new Date().toISOString(),
              history: [{
                id: `tx_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'debt',
                amount: finalCostUSD,
                currency: 'USD',
                notes: `استلاف تكلفة كارت لخط أدمن #${selectedOpenLineObj.slotNumber}`
              }]
            });
          }

          alert(`تم شحن خط الأدمن #${selectedOpenLineObj.slotNumber} وتسجيل دين الصندوق بنجاح!`);
          setModalType(null);
          return;
        }
      }

      if (txForm.cardDestination === 'direct') {
        if (!txForm.directPhone.trim()) {
          alert('يرجى إدخال رقم الهاتف المراد شحن الكارت له مباشرة!');
          return;
        }

        const rawSell = parseFloat(txForm.directSellingPrice) || 0;
        const sellPriceUSD = txForm.directSellingCurrency === 'LBP' ? (rawSell / exchangeRate) : rawSell;
        const profitVal = rawSell > 0 ? Math.max(0, sellPriceUSD - finalCostUSD) : 0;

        onRecordWalletTx(selectedWallet.id, {
          type: 'withdrawal',
          amount: deductAmount,
          currency: txForm.cardPayCurrency,
          itemName: `شراء كارت مباشر ${txForm.cardOperator} (${creditToAdd}$) للرقم ${txForm.directPhone}`,
          customerName: txForm.directCustomerName.trim() || 'رقم مباشر',
          costUSD: finalCostUSD,
          profitUSD: 0,
          notes: `شحن مباشر للرقم ${txForm.directPhone}`
        });

        if (rawSell > 0) {
          onRecordWalletTx(selectedWallet.id, {
            type: 'sale',
            amount: rawSell,
            sellingPrice: rawSell,
            currency: txForm.directSellingCurrency,
            costUSD: finalCostUSD,
            profitUSD: parseFloat(profitVal.toFixed(2)),
            itemName: `مبيع كارت ${txForm.cardOperator} (${creditToAdd}$) للرقم ${txForm.directPhone}`,
            customerName: txForm.directCustomerName.trim() || 'زبون كارت مباشر',
            customerPhone: txForm.directPhone.trim(),
            paymentType: 'cash',
            notes: `شحن مباشر للرقم ${txForm.directPhone}`,
            date: new Date().toISOString()
          });
        }

        alert(`تم شحن الكارت للرقم ${txForm.directPhone} بنجاح وتسجيل المعاملة!`);
        setModalType(null);
        return;
      }
    }

    // 4. سنة أيام Alfa مع فحص الرصيد حسب العملة المختارة
    if (txForm.type === 'days_year') {
      const isDeductLBP = txForm.daysDeductCurrency === 'LBP';
      const r = parseFloat(txForm.daysFxRate) || exchangeRate;
      const deductUSD = parseFloat(txForm.daysWalletDeductUSD) || 86.5;
      const deductLBP = parseFloat(txForm.daysWalletDeductLBP) || Math.round(deductUSD * r);

      if (isDeductLBP) {
        if (curLBP < deductLBP) {
          alert(`رصيد الليرة بالمحفظة غير كافٍ! المطلوب: ${deductLBP.toLocaleString()} ل.ل، بينما المتوفر: ${Math.round(curLBP).toLocaleString()} ل.ل`);
          return;
        }
      } else {
        if (curUSD < deductUSD) {
          alert(`رصيد الدولار بالمحفظة غير كافٍ! المطلوب: $${deductUSD}، بينما المتوفر: $${curUSD.toFixed(2)}`);
          return;
        }
      }

      if (!txForm.daysTargetSimId) {
        alert('يرجى اختيار الشريحة المستهدفة لاستلام رصيد المردود!');
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

    const opRate = parseFloat(txForm.daysFxRate) || exchangeRate;
    const rawSale = parseFloat(txForm.amount) || 0;
    const saleInUSD = txForm.currency === 'LBP' ? (rawSale / opRate) : rawSale;

    if (txForm.type === 'days_year') {
      const isDeductLBP = txForm.daysDeductCurrency === 'LBP';
      const deductUSD = parseFloat(txForm.daysWalletDeductUSD) || 86.5;
      const deductLBP = parseFloat(txForm.daysWalletDeductLBP) || Math.round(deductUSD * opRate);

      const finalDeductAmount = isDeductLBP ? deductLBP : deductUSD;
      const deductUSDValue = isDeductLBP ? (deductLBP / opRate) : deductUSD;

      const returnCreditUSD = parseFloat(txForm.daysReturnUSD) || 73.5;
      const costOfReturnBatch = parseFloat(txForm.daysCostLBP) || 93500;
      const netCostUSD = Math.max(0, deductUSDValue - returnCreditUSD);
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
        walletDeduction: finalDeductAmount,
        walletDeductCurrency: isDeductLBP ? 'LBP' : 'USD',
        itemName: `سنة أيام Alfa (+${returnCreditUSD}$)`,
        customerType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentType,
        paidAmount: paymentType === 'cash' ? rawSale : (parseFloat(partialPaidAmount) || 0),
        remainingDebt: remainingDebtAmount,
        isDebt: remainingDebtAmount > 0,
        notes: txForm.notes || `سعر الصرف: ${opRate.toLocaleString()} • خصم المحفظة: ${isDeductLBP ? deductLBP.toLocaleString() + ' LBP' : '$' + deductUSD}`,
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

      {/* مودال حركة مالية متكامل */}
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
                    const defaultTier = CUSTOM_CARD_TIERS.ALFA.find(t => t.id === 'alfa_22_73') || CUSTOM_CARD_TIERS.ALFA[5];
                    setTxForm({
                      ...txForm,
                      type: newType,
                      currency: (newType === 'days_year' || newType === 'exchange') ? 'LBP' : txForm.currency,
                      amount: newType === 'days_year' ? '1000000' : '',
                      selectedTierId: defaultTier.id,
                      cardCostUSD: defaultTier.costUSD.toString(),
                      cardCostLBP: defaultTier.costLBP.toString()
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

              {/* قسم شراء الكارت المطور */}
              {txForm.type === 'buy_card' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* اختيار الشبكة */}
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
                            setTxForm(prev => ({ ...prev, cardOperator: op }));
                            handleCardTierChange(defaultTierId, op);
                          }}
                        >
                          {op === 'ALFA' ? 'ألفا (Alfa)' : 'تاتش (Touch)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* اختيار فئة الكارت */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>فئة الكارت:</label>
                    <select
                      className="tz-select"
                      style={{ marginTop: '4px', fontWeight: 'bold' }}
                      value={txForm.selectedTierId}
                      onChange={e => handleCardTierChange(e.target.value, txForm.cardOperator)}
                    >
                      {(CUSTOM_CARD_TIERS[txForm.cardOperator] || CUSTOM_CARD_TIERS.ALFA).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.label} (صلاحية {t.days} يوم)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* عملة الخصم من المحفظة */}
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

                  {/* خانة التكلفة بالعملة المختارة فقط */}
                  <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px dashed var(--orange-primary)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)', display: 'block', marginBottom: '6px' }}>
                      تكلفة الشراء الفعلية ({txForm.cardPayCurrency === 'USD' ? 'بالدولار $' : 'بالليرة اللبنانية LBP'} - قابلة للتعديل):
                    </label>
                    {txForm.cardPayCurrency === 'USD' ? (
                      <div>
                        <input
                          type="number"
                          step="any"
                          required
                          className="tz-input"
                          style={{ fontWeight: 'bold', color: 'var(--orange-primary)', height: '42px', fontSize: '14px' }}
                          value={txForm.cardCostUSD}
                          onChange={e => setTxForm(prev => ({ ...prev, cardCostUSD: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <div>
                        <input
                          type="number"
                          step="any"
                          required
                          className="tz-input"
                          style={{ fontWeight: 'bold', height: '42px', fontSize: '14px' }}
                          value={txForm.cardCostLBP}
                          onChange={e => setTxForm(prev => ({ ...prev, cardCostLBP: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  {/* أزرار اختيار وجهة الكارت */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      وجهة الكارت المشحون:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '0 4px',
                          borderColor: txForm.cardDestination === 'locked' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.cardDestination === 'locked' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.cardDestination === 'locked' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'locked' }))}
                      >
                        🔒 خط مسكر
                      </button>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '0 4px',
                          borderColor: txForm.cardDestination === 'open_admin' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.cardDestination === 'open_admin' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.cardDestination === 'open_admin' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'open_admin' }))}
                      >
                        👑 خط أدمن
                      </button>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '0 4px',
                          borderColor: txForm.cardDestination === 'direct' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.cardDestination === 'direct' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.cardDestination === 'direct' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm(prev => ({ ...prev, cardDestination: 'direct' }))}
                      >
                        ⚡ رقم مباشر
                      </button>
                    </div>
                  </div>

                  {/* 1. تفاصيل الوجهة: خط مسكر */}
                  {txForm.cardDestination === 'locked' && (
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
                  )}

                  {/* 2. تفاصيل الوجهة: خط أدمن مفتوح */}
                  {txForm.cardDestination === 'open_admin' && (
                    <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setTxForm(prev => ({ ...prev, adminSelectMode: 'new' }))}
                          style={{
                            padding: '6px',
                            borderRadius: '8px',
                            border: txForm.adminSelectMode === 'new' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                            background: txForm.adminSelectMode === 'new' ? 'var(--orange-subtle)' : 'transparent',
                            color: txForm.adminSelectMode === 'new' ? 'var(--orange-primary)' : 'inherit',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          + فتح أدمن جديد
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxForm(prev => ({ ...prev, adminSelectMode: 'existing_line' }))}
                          style={{
                            padding: '6px',
                            borderRadius: '8px',
                            border: txForm.adminSelectMode === 'existing_line' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                            background: txForm.adminSelectMode === 'existing_line' ? 'var(--orange-subtle)' : 'transparent',
                            color: txForm.adminSelectMode === 'existing_line' ? 'var(--orange-primary)' : 'inherit',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          شحن أدمن قائم ({openLinesOnly.length})
                        </button>
                      </div>

                      {txForm.adminSelectMode === 'new' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم الأدمن (مع البحث بالدليل):</label>
                            <input
                              type="text"
                              required
                              placeholder="اسم الأدمن..."
                              className="tz-input"
                              style={{ height: '36px', fontSize: '11px' }}
                              value={txForm.adminName}
                              onChange={e => handleAdminCustomerSearch(e.target.value)}
                              autoComplete="off"
                            />

                            {adminCustomerSuggestions.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--orange-primary)',
                                borderRadius: '10px',
                                zIndex: 310,
                                maxHeight: '120px',
                                overflowY: 'auto',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                marginTop: '2px'
                              }}>
                                {adminCustomerSuggestions.map(cust => (
                                  <div
                                    key={cust.id}
                                    onClick={() => handleSelectAdminCustomer(cust)}
                                    style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
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
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>هاتف الأدمن:</label>
                              <input
                                type="tel"
                                placeholder="رقم الهاتف..."
                                className="tz-input"
                                style={{ height: '36px', fontSize: '11px' }}
                                value={txForm.adminPhone}
                                onChange={e => setTxForm({ ...txForm, adminPhone: e.target.value })}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الشريحة/الخط:</label>
                              <input
                                type="tel"
                                placeholder="رقم الخط..."
                                className="tz-input"
                                style={{ height: '36px', fontSize: '11px' }}
                                value={txForm.adminLinePhone}
                                onChange={e => setTxForm({ ...txForm, adminLinePhone: e.target.value })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '6px' }}>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>حصة الأدمن:</label>
                              <input
                                type="number"
                                placeholder="22 GB"
                                className="tz-input"
                                style={{ height: '36px', fontSize: '11px', fontWeight: 'bold' }}
                                value={txForm.adminGB}
                                onChange={e => setTxForm({ ...txForm, adminGB: e.target.value })}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>السعر منه ($):</label>
                              <input
                                type="number"
                                placeholder="السعر..."
                                className="tz-input"
                                style={{ height: '36px', fontSize: '11px' }}
                                value={txForm.adminPrice}
                                onChange={e => setTxForm({ ...txForm, adminPrice: e.target.value })}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العنوان / المنطقة:</label>
                              <input
                                type="text"
                                placeholder="المنطقة..."
                                className="tz-input"
                                style={{ height: '36px', fontSize: '11px' }}
                                value={txForm.adminAddress}
                                onChange={e => setTxForm({ ...txForm, adminAddress: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اختر خط الأدمن المفتوح القائم:</label>
                          <select
                            className="tz-select"
                            style={{ height: '38px', fontSize: '12px' }}
                            value={txForm.targetOpenLineId}
                            onChange={e => setTxForm({ ...txForm, targetOpenLineId: e.target.value })}
                          >
                            <option value="">-- اختر خط الأدمن --</option>
                            {openLinesOnly.map(l => (
                              <option key={l.id} value={l.id}>
                                أدمن #{l.slotNumber}: {l.adminName || 'الرئيسي'} ({l.phoneNumber || l.number})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. تفاصيل الوجهة: شحن مباشر لرقم */}
                  {txForm.cardDestination === 'direct' && (
                    <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الهاتف المشحون:</label>
                          <input
                            type="tel"
                            required
                            placeholder="70xxxxxx"
                            className="tz-input"
                            style={{ height: '36px', fontSize: '12px', fontWeight: 'bold' }}
                            value={txForm.directPhone}
                            onChange={e => setTxForm({ ...txForm, directPhone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم الزبون:</label>
                          <input
                            type="text"
                            placeholder="اسم الزبون..."
                            className="tz-input"
                            style={{ height: '36px', fontSize: '11px' }}
                            value={txForm.directCustomerName}
                            onChange={e => setTxForm({ ...txForm, directCustomerName: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر البيع للزبون (اختياري):</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="سعر المبيع..."
                            className="tz-input"
                            style={{ height: '36px', fontSize: '11px', fontWeight: 'bold' }}
                            value={txForm.directSellingPrice}
                            onChange={e => setTxForm({ ...txForm, directSellingPrice: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>عملة البيع:</label>
                          <select
                            className="tz-select"
                            style={{ height: '36px', fontSize: '11px' }}
                            value={txForm.directSellingCurrency}
                            onChange={e => setTxForm({ ...txForm, directSellingCurrency: e.target.value })}
                          >
                            <option value="USD">دولار ($)</option>
                            <option value="LBP">ليرة (LBP)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* قسم سنة أيام Alfa المطور بالتبديل بين الدولار والليرة والتعديل الحر */}
              {txForm.type === 'days_year' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--orange-primary)', fontWeight: 'bold' }}>سعر الصرف المعتمد لهذه العملية (LBP):</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="tz-input"
                      style={{ fontWeight: 'bold', marginTop: '2px', height: '40px' }}
                      value={txForm.daysFxRate}
                      onChange={e => {
                        const newRate = parseFloat(e.target.value) || 0;
                        setTxForm(prev => {
                          const usdVal = parseFloat(prev.daysWalletDeductUSD) || 86.5;
                          return {
                            ...prev,
                            daysFxRate: e.target.value,
                            daysWalletDeductLBP: newRate > 0 ? Math.round(usdVal * newRate).toString() : prev.daysWalletDeductLBP
                          };
                        });
                      }}
                    />
                  </div>

                  {/* تبديل عملة الخصم من المحفظة: ليرة أو دولار */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>خصم تكلفة سنة الأيام من المحفظة:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          borderColor: txForm.daysDeductCurrency === 'LBP' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.daysDeductCurrency === 'LBP' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.daysDeductCurrency === 'LBP' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm(prev => ({ ...prev, daysDeductCurrency: 'LBP' }))}
                      >
                        رصيد الليرة (LBP)
                      </button>
                      <button
                        type="button"
                        className="tz-input"
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          borderColor: txForm.daysDeductCurrency === 'USD' ? 'var(--orange-primary)' : 'var(--border-color)',
                          background: txForm.daysDeductCurrency === 'USD' ? 'var(--orange-subtle)' : 'transparent',
                          color: txForm.daysDeductCurrency === 'USD' ? 'var(--orange-primary)' : 'inherit'
                        }}
                        onClick={() => setTxForm(prev => ({ ...prev, daysDeductCurrency: 'USD' }))}
                      >
                        رصيد الدولار ($)
                      </button>
                    </div>
                  </div>

                  {/* خانة الخصم بحسب العملة المختارة مع إمكانية التعديل، وخانة رصيد المردود للشريحة */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {txForm.daysDeductCurrency === 'LBP' ? 'يخصم من المحفظة (LBP):' : 'يخصم من المحفظة ($):'}
                      </label>
                      {txForm.daysDeductCurrency === 'LBP' ? (
                        <input
                          type="number"
                          step="any"
                          required
                          className="tz-input"
                          style={{ fontWeight: 'bold', marginTop: '2px' }}
                          value={txForm.daysWalletDeductLBP}
                          onChange={e => {
                            const lbpVal = e.target.value;
                            const num = parseFloat(lbpVal) || 0;
                            const r = parseFloat(txForm.daysFxRate) || exchangeRate;
                            setTxForm(prev => ({
                              ...prev,
                              daysWalletDeductLBP: lbpVal,
                              daysWalletDeductUSD: r > 0 ? (num / r).toFixed(2) : prev.daysWalletDeductUSD
                            }));
                          }}
                        />
                      ) : (
                        <input
                          type="number"
                          step="any"
                          required
                          className="tz-input"
                          style={{ fontWeight: 'bold', color: 'var(--orange-primary)', marginTop: '2px' }}
                          value={txForm.daysWalletDeductUSD}
                          onChange={e => {
                            const usdVal = e.target.value;
                            const num = parseFloat(usdVal) || 0;
                            const r = parseFloat(txForm.daysFxRate) || exchangeRate;
                            setTxForm(prev => ({
                              ...prev,
                              daysWalletDeductUSD: usdVal,
                              daysWalletDeductLBP: Math.round(num * r).toString()
                            }));
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>يرجع للشريحة رصيد ($):</label>
                      <input
                        type="number"
                        step="any"
                        required
                        className="tz-input"
                        style={{ marginTop: '2px', fontWeight: 'bold' }}
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
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اختر شريحة Alfa لشحن الرصيد المردود:</label>
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
                  ? 'تأكيد شراء الكارت وتنفيذ العملية'
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