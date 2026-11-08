import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Plus, Trash2, Edit3, ArrowRight, AlertTriangle, X, Gift, Users, ChevronDown, ChevronUp, Search, Layers } from 'lucide-react';

export default function RechargeHub({
  sims = [],
  lockedLines = [],
  onAddSimBatch,
  onUpdateSim,
  onDeleteSim,
  onExecuteMultiSale,
  onExecuteAlfaGiftSale,
  exchangeRate = 89500,
  onUpdateExchangeRate
}) {
  const [operator, setOperator] = useState('alfa');
  const [selectedSimId, setSelectedSimId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [cart, setCart] = useState({});
  const [currency, setCurrency] = useState('LBP');
  const [sellingPrice, setSellingPrice] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('sell');

  // باقات ALFA GIFT
  const ALFA_GIFT_TIERS = [
    { label: '1 GB ➔ $3.5', gb: '1', price: '3.5' },
    { label: '3 GB ➔ $6.9', gb: '3', price: '6.9' },
    { label: '7 GB ➔ $9.0', gb: '7', price: '9' },
    { label: '22 GB ➔ $14.5', gb: '22', price: '14.5' },
    { label: '44 GB ➔ $21.0', gb: '44', price: '21' },
    { label: '77 GB ➔ $31.0', gb: '77', price: '31' },
    { label: 'أخرى (مخصص)...', gb: 'custom', price: '' }
  ];

  const [isGiftOpen, setIsGiftOpen] = useState(false);
  const [giftSourceType, setGiftSourceType] = useState('closed_line'); // 'closed_line' | 'sim'
  const [selectedGiftPackage, setSelectedGiftPackage] = useState('77');
  const [giftCostDeduction, setGiftCostDeduction] = useState('31');
  const [giftTotalGB, setGiftTotalGB] = useState('77');
  const [selectedLockedLineId, setSelectedLockedLineId] = useState('');
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  const [isLineSearchOpen, setIsLineSearchOpen] = useState(false);

  const [giftRecipients, setGiftRecipients] = useState([
    { name: '', phone: '', gb: '22', price: '', currency: 'USD' }
  ]);

  const [simModalOpen, setSimModalOpen] = useState(false);
  const [editingSimId, setEditingSimId] = useState(null);
  const [simName, setSimName] = useState('');
  const [simNumber, setSimNumber] = useState('');
  const [purchasedCredits, setPurchasedCredits] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costCurrency, setCostCurrency] = useState('LBP');

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [targetSimForBatch, setTargetSimForBatch] = useState(null);
  const [newBatchCredits, setNewBatchCredits] = useState('');
  const [newBatchCost, setNewBatchCost] = useState('');
  const [newBatchCurrency, setNewBatchCurrency] = useState('LBP');

  const alfaTiers = [0.5, 1, 1.5, 2, 2.5, 3];
  const mtcTiers = [1, 2, 3];
  const currentTiers = operator === 'alfa' ? alfaTiers : mtcTiers;
  const taxPerMsg = operator === 'alfa' ? 0.14 : 0.16;

  const availableSims = sims.filter(s => s.operator === operator);
  const activeSim = sims.find(s => s.id === selectedSimId);

  const getSimTotalBalance = (sim) => {
    if (!sim) return 0;
    if (sim.batches && sim.batches.length > 0) {
      return sim.batches.reduce((sum, b) => sum + (parseFloat(b.remainingUSD) || 0), 0);
    }
    return parseFloat(sim.balance) || 0;
  };

  const activeBatch = activeSim?.batches?.find(b => b.id === selectedBatchId);
  const availableBalanceForSale = activeBatch
    ? parseFloat(activeBatch.remainingUSD)
    : getSimTotalBalance(activeSim);

  const updateQuantity = (tier, delta) => {
    setCart(prev => {
      const current = prev[tier] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) delete updated[tier];
      else updated[tier] = next;
      return updated;
    });
  };

  const totalItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalCreditsAmount = Object.entries(cart).reduce((sum, [tier, qty]) => sum + (parseFloat(tier) * qty), 0);
  const totalTaxAmount = parseFloat((totalItemsCount * taxPerMsg).toFixed(2));
  const totalRawDeduction = parseFloat((totalCreditsAmount + totalTaxAmount).toFixed(2));

  const isBalanceExceeded = activeSim && totalRawDeduction > availableBalanceForSale;

  const handleGiftPackageSelect = (packageValue) => {
    setSelectedGiftPackage(packageValue);
    if (packageValue === 'custom') {
      setGiftTotalGB('');
      setGiftCostDeduction('');
    } else {
      const match = ALFA_GIFT_TIERS.find(t => t.gb === packageValue);
      if (match) {
        setGiftTotalGB(match.gb);
        setGiftCostDeduction(match.price);
      }
    }
  };

  // تصفية الخطوط المسكرة للبحث السريع
  const lockedLinesOnly = lockedLines.filter(l => (l.type || 'locked') === 'locked');
  const filteredLockedLines = lockedLinesOnly.filter(line => {
    const q = lineSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const slotStr = (line.slotNumber || '').toString();
    const phoneStr = (line.phoneNumber || line.number || '').toString();
    return slotStr.includes(q) || phoneStr.includes(q);
  });

  const selectedLineObj = lockedLines.find(l => l.id === selectedLockedLineId);

  const handleSelectLineFromSearch = (line) => {
    setSelectedLockedLineId(line.id);
    setLineSearchQuery('');
    setIsLineSearchOpen(false);

    const existingUsers = [];
    ['user1', 'user2', 'user3'].forEach(key => {
      if (line[key]) {
        const raw = line[key];
        const namePart = raw.split('(')[0].trim();
        const gbMatch = raw.match(/\(([^)]+)\)/);
        const gbPart = gbMatch ? gbMatch[1].replace(/[^0-9.]/g, '') : '22';
        existingUsers.push({
          name: namePart,
          phone: '',
          gb: gbPart,
          price: '',
          currency: 'USD'
        });
      }
    });

    if (existingUsers.length > 0) {
      setGiftRecipients(existingUsers);
    } else {
      setGiftRecipients([{ name: '', phone: '', gb: '22', price: '', currency: 'USD' }]);
    }
  };

  const handleAddRecipient = () => {
    if (giftRecipients.length < 3) {
      setGiftRecipients([...giftRecipients, { name: '', phone: '', gb: '22', price: '', currency: 'USD' }]);
    }
  };

  const handleUpdateRecipient = (index, field, value) => {
    const updated = [...giftRecipients];
    updated[index][field] = value;
    setGiftRecipients(updated);
  };

  const handleRemoveRecipient = (index) => {
    if (giftRecipients.length > 1) {
      setGiftRecipients(giftRecipients.filter((_, i) => i !== index));
    }
  };

  const maxGB = parseFloat(giftTotalGB) || 0;

  // تنفيذ عملية Alfa Gift
  const handleExecuteAlfaGift = (e) => {
    e.preventDefault();

    if (!selectedLockedLineId) {
      alert('يرجى اختيار الخط المسكر المربوط بالخدمة أولاً!');
      return;
    }

    const deductUSD = parseFloat(giftCostDeduction) || 0;

    if (giftSourceType === 'closed_line') {
      const lineBal = parseFloat(selectedLineObj?.balanceUSD || selectedLineObj?.balance || 0);
      if (deductUSD > lineBal) {
        alert(`رصيد الخط المسكر المتاح ($${lineBal.toFixed(2)}) لا يكفي لخصم تكلفة الخدمة ($${deductUSD})!`);
        return;
      }
    } else {
      if (!selectedSimId) {
        alert('يرجى اختيار الشريحة المسحوب منها الرصيد!');
        return;
      }
      if (deductUSD > availableBalanceForSale) {
        alert(`رصيد الشريحة المتبقي ($${availableBalanceForSale.toFixed(2)}) لا يكفي لخصم $${deductUSD}!`);
        return;
      }
    }

    const validRecipients = giftRecipients.filter(r => r.name.trim() !== '');
    if (validRecipients.length === 0) {
      alert('يرجى إدخال اسم مستفيد واحد على الأقل مع حصته وسعره!');
      return;
    }

    onExecuteAlfaGiftSale({
      simId: giftSourceType === 'sim' ? selectedSimId : null,
      selectedBatchId: giftSourceType === 'sim' ? selectedBatchId : null,
      deductUSD: deductUSD,
      lockedLineId: selectedLockedLineId,
      totalGB: maxGB,
      recipients: validRecipients,
      exchangeRate: exchangeRate
    });

    setGiftRecipients([{ name: '', phone: '', gb: '22', price: '', currency: 'USD' }]);
    setIsGiftOpen(false);
  };

  const handleCheckout = (e) => {
    e.preventDefault();
    if (!selectedSimId) {
      alert('يرجى اختيار الشريحة أولاً!');
      return;
    }
    if (totalItemsCount === 0) {
      alert('السلة فارغة!');
      return;
    }

    if (isBalanceExceeded) {
      alert(`الرصيد المطلوب مع الضريبة ($${totalRawDeduction}) أكبر من الرصيد المتوفر ($${availableBalanceForSale.toFixed(2)})!`);
      return;
    }

    let unitCostUSD = 0;
    if (activeBatch) {
      const batchCostUSD = activeBatch.costCurrency === 'LBP' ? (activeBatch.costPrice / exchangeRate) : activeBatch.costPrice;
      unitCostUSD = batchCostUSD / (activeBatch.amountUSD || 1);
    } else if (activeSim && (activeSim.initialBalance || activeSim.balance)) {
      const simCostUSD = activeSim.costCurrency === 'LBP' ? (activeSim.cost / exchangeRate) : activeSim.cost;
      unitCostUSD = simCostUSD / (activeSim.initialBalance || activeSim.balance || 1);
    }
    const totalCostUSD = parseFloat((unitCostUSD * totalCreditsAmount).toFixed(2));
    const itemFullTitle = `رصيد ${operator?.toUpperCase()} ($${totalCreditsAmount})`;

    onExecuteMultiSale({
      operator,
      simId: selectedSimId,
      simName: activeSim.name,
      itemName: itemFullTitle,
      title: itemFullTitle,
      selectedBatchId,
      cart,
      totalCredits: totalCreditsAmount,
      totalCount: totalItemsCount,
      taxPerItem: taxPerMsg,
      totalTax: totalTaxAmount,
      totalDeduction: totalRawDeduction,
      currency,
      sellingPrice: parseFloat(sellingPrice) || 0,
      costUSD: totalCostUSD,
      exchangeRate
    });

    setCart({});
    setSellingPrice('');
  };

  const openSimModal = (sim = null) => {
    if (sim) {
      setEditingSimId(sim.id);
      setSimName(sim.name);
      setSimNumber(sim.number);
      setPurchasedCredits((sim.balance || 0).toString());
      setCostAmount((sim.cost || 0).toString());
      setCostCurrency(sim.costCurrency || 'LBP');
    } else {
      setEditingSimId(null);
      setSimName('');
      setSimNumber('');
      setPurchasedCredits('');
      setCostAmount('');
      setCostCurrency('LBP');
    }
    setSimModalOpen(true);
  };

  const handleSaveSim = (e) => {
    e.preventDefault();
    if (!simName || !purchasedCredits || !costAmount) return;

    const creditsNum = parseFloat(purchasedCredits) || 0;
    const costNum = parseFloat(costAmount) || 0;

    if (editingSimId) {
      onUpdateSim(editingSimId, {
        name: simName,
        number: simNumber,
        balance: creditsNum,
        cost: costNum,
        costCurrency
      });
    } else {
      const initialBatch = {
        id: `batch_${Date.now()}`,
        label: 'دفعة افتتاحية',
        amountUSD: creditsNum,
        remainingUSD: creditsNum,
        costPrice: costNum,
        costCurrency: costCurrency,
        date: new Date().toISOString()
      };

      onAddSimBatch({
        id: Date.now().toString(),
        name: simName,
        number: simNumber,
        operator,
        balance: creditsNum,
        initialBalance: creditsNum,
        cost: costNum,
        costCurrency,
        batches: [initialBatch],
        date: new Date().toISOString().split('T')[0]
      });
    }

    setSimModalOpen(false);
  };

  const handleSaveNewBatch = (e) => {
    e.preventDefault();
    if (!targetSimForBatch || !newBatchCredits || !newBatchCost) return;

    const amount = parseFloat(newBatchCredits) || 0;
    const cost = parseFloat(newBatchCost) || 0;

    const newBatch = {
      id: `batch_${Date.now()}`,
      label: `دفعة #${(targetSimForBatch.batches?.length || 0) + 1}`,
      amountUSD: amount,
      remainingUSD: amount,
      costPrice: cost,
      costCurrency: newBatchCurrency,
      date: new Date().toISOString()
    };

    const currentBatches = targetSimForBatch.batches || [];
    const updatedBatches = [...currentBatches, newBatch];
    const newTotalBalance = updatedBatches.reduce((sum, b) => sum + (parseFloat(b.remainingUSD) || 0), 0);

    onUpdateSim(targetSimForBatch.id, {
      balance: parseFloat(newTotalBalance.toFixed(2)),
      batches: updatedBatches
    });

    setBatchModalOpen(false);
    setNewBatchCredits('');
    setNewBatchCost('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      {/* شريط الإعدادات والتبديل */}
      <div className="tz-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>سعر الصرف العام للسيستم:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <input
              type="number"
              className="tz-input"
              value={exchangeRate}
              onChange={(e) => onUpdateExchangeRate && onUpdateExchangeRate(parseFloat(e.target.value) || 0)}
              style={{ width: '130px', padding: '6px 10px', fontSize: '14px', fontWeight: 'bold' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>ل.ل</span>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('sell')}
            style={{
              background: activeSubTab === 'sell' ? 'var(--orange-primary)' : 'transparent',
              color: activeSubTab === 'sell' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            بيع رصيد
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('stock')}
            style={{
              background: activeSubTab === 'stock' ? 'var(--orange-primary)' : 'transparent',
              color: activeSubTab === 'stock' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            إدارة الخطوط
          </button>
        </div>
      </div>

      {activeSubTab === 'sell' ? (
        <div className="tz-card">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            {['alfa', 'mtc'].map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => { setOperator(op); setCart({}); setSelectedSimId(''); setSelectedBatchId(''); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '16px',
                  border: operator === op ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                  background: operator === op ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-input)',
                  color: operator === op ? 'var(--orange-primary)' : 'var(--text-main)',
                  fontWeight: '900',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                {op === 'alfa' ? 'ALFA' : 'TOUCH'}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              الشريحة التي سيُخصم منها الرصيد:
            </label>
            <select
              className="tz-select"
              value={selectedSimId}
              onChange={(e) => {
                setSelectedSimId(e.target.value);
                setSelectedBatchId('');
              }}
            >
              <option value="">اختر الشريحة</option>
              {availableSims.map((sim) => (
                <option key={sim.id} value={sim.id}>
                  {sim.name} ({sim.number}) : ${getSimTotalBalance(sim).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {activeSim && activeSim.batches && activeSim.batches.length > 1 && (
            <div style={{ marginBottom: '14px', background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '4px', display: 'block' }}>
                تحديد دفعة معينة للخصم (اختياري):
              </label>
              <select
                className="tz-select"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                <option value="">-- الخصم من الرصيد العام (تلقائي) --</option>
                {activeSim.batches.filter(b => b.remainingUSD > 0).map((b, idx) => (
                  <option key={b.id} value={b.id}>
                    {b.label || `دفعة #${idx + 1}`}: متبقي ${b.remainingUSD} (شراء: {b.costPrice} {b.costCurrency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* الفئات الستة الكلاسيكية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {currentTiers.map((tier) => {
              const qty = cart[tier] || 0;
              return (
                <div
                  key={tier}
                  style={{
                    background: qty > 0 ? 'rgba(255, 122, 0, 0.12)' : 'var(--bg-input)',
                    border: qty > 0 ? '1px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '10px 8px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>${tier}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0' }}>رصيد</div>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(tier, -1)}
                      style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', minWidth: '16px' }}>{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(tier, 1)}
                      style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--orange-primary)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {isBalanceExceeded && (
            <div style={{
              background: 'rgba(255, 77, 77, 0.15)',
              border: '2px solid var(--red)',
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-main)'
            }}>
              <AlertTriangle size={24} color="var(--red)" />
              <div>
                <div style={{ fontWeight: '900', color: 'var(--red)', fontSize: '14px' }}>
                  يا خيي ما بيمشي الحال هيك!
                </div>
                <div style={{ fontSize: '12px', color: 'var(--red)' }}>
                  المطلوب خصمه مع الضريبة هو <b>${totalRawDeduction}</b> بينما الرصيد المتوفر فقط <b>${availableBalanceForSale.toFixed(2)}</b>!
                </div>
              </div>
            </div>
          )}

          {totalItemsCount > 0 && (
            <div style={{ background: 'var(--bg-card-sub)', borderRadius: '16px', padding: '14px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>عدد القطع (الرسائل):</span>
                <span style={{ fontWeight: 'bold' }}>{totalItemsCount} حبة</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>ضريبة الرسائل (${taxPerMsg} لكل حبة):</span>
                <span style={{ fontWeight: 'bold', color: 'var(--red)' }}>-${totalTaxAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <span>مجموع ما سيُسحب من الشريحة:</span>
                <span style={{ color: 'var(--orange-primary)' }}>${totalRawDeduction} رصيد</span>
              </div>
            </div>
          )}

          {/* قسم الدفع والسعر لبيع الرصيد العادي */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>العملة:</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCurrency('LBP')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: currency === 'LBP' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: currency === 'LBP' ? 'rgba(255, 122, 0, 0.2)' : 'var(--bg-input)',
                    color: currency === 'LBP' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontWeight: '900',
                    fontSize: '12px'
                  }}
                >
                  (LBP)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: currency === 'USD' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: currency === 'USD' ? 'rgba(255, 122, 0, 0.2)' : 'var(--bg-input)',
                    color: currency === 'USD' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontWeight: '900',
                    fontSize: '12px'
                  }}
                >
                  ($)
                </button>
              </div>
            </div>

            <div style={{ flex: 1.2 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>سعر البيع ({currency === 'LBP' ? 'ل.ل' : '$'}):</label>
              <input
                type="number"
                step="any"
                className="tz-input"
                placeholder="السعر الإجمالي..."
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                style={{ marginTop: '4px', fontWeight: 'bold' }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={totalItemsCount === 0 || !selectedSimId || isBalanceExceeded}
            className="btn-action-full"
            style={{
              opacity: (totalItemsCount === 0 || !selectedSimId || isBalanceExceeded) ? 0.4 : 1,
              cursor: (totalItemsCount === 0 || !selectedSimId || isBalanceExceeded) ? 'not-allowed' : 'pointer',
              marginBottom: '16px'
            }}
          >
            <span>تم يا طيب</span>
            <div className="btn-circle"><ArrowRight size={18} /></div>
          </button>

          {/* بطاقة ALFA GIFT الذكية */}
          {operator === 'alfa' && (
            <div style={{
              background: 'var(--bg-card-sub)',
              border: '2px solid var(--orange-primary)',
              borderRadius: '16px',
              padding: '12px 14px'
            }}>
              <div
                onClick={() => setIsGiftOpen(!isGiftOpen)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gift size={20} color="var(--orange-primary)" />
                  <span style={{ fontWeight: '900', fontSize: '16px', color: 'var(--orange-primary)' }}>
                    ALFA GIFT
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {giftTotalGB && (
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--green)' }}>
                      باقة: {giftTotalGB} GB
                    </span>
                  )}
                  {isGiftOpen ? <ChevronUp size={20} color="var(--orange-primary)" /> : <ChevronDown size={20} color="var(--orange-primary)" />}
                </div>
              </div>

              {isGiftOpen && (
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      مكان خصم تكلفة الخدمة:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setGiftSourceType('closed_line')}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: giftSourceType === 'closed_line' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                          background: giftSourceType === 'closed_line' ? 'var(--orange-subtle)' : 'transparent',
                          color: giftSourceType === 'closed_line' ? 'var(--orange-primary)' : 'inherit',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        من رصيد الخط المسكر
                      </button>

                      <button
                        type="button"
                        onClick={() => setGiftSourceType('sim')}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: giftSourceType === 'sim' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                          background: giftSourceType === 'sim' ? 'var(--orange-subtle)' : 'transparent',
                          color: giftSourceType === 'sim' ? 'var(--orange-primary)' : 'inherit',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        سحب من الشريحة الأساسية
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      اختر باقة ALFA GIFT (الجيجا والتكلفة الرسمية):
                    </label>
                    <select
                      className="tz-select"
                      dir="ltr"
                      style={{ textAlign: 'left', fontWeight: 'bold' }}
                      value={selectedGiftPackage}
                      onChange={(e) => handleGiftPackageSelect(e.target.value)}
                    >
                      {ALFA_GIFT_TIERS.map((tier, idx) => (
                        <option key={idx} value={tier.gb}>
                          {tier.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {giftSourceType === 'closed_line' ? 'خصم من رصيد الخط ($):' : 'سحب من الشريحة ($):'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="tz-input"
                        value={giftCostDeduction}
                        onChange={(e) => setGiftCostDeduction(e.target.value)}
                        placeholder="المبلغ ($)..."
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>حجم الباقة الإجمالي (GB):</label>
                      <input
                        type="text"
                        className="tz-input"
                        value={giftTotalGB}
                        onChange={(e) => setGiftTotalGB(e.target.value)}
                        placeholder="الحجم (GB)..."
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px', position: 'relative' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      الخط المسكر المفتوح منه الخدمة:
                    </label>

                    <div
                      onClick={() => setIsLineSearchOpen(!isLineSearchOpen)}
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
                      <span style={{ fontSize: '13px', fontWeight: selectedLineObj ? 'bold' : 'normal', color: selectedLineObj ? 'var(--orange-primary)' : 'var(--text-muted)' }}>
                        {selectedLineObj ? `خط #${selectedLineObj.slotNumber}: ${selectedLineObj.phoneNumber || selectedLineObj.number} (متوفر: $${selectedLineObj.balanceUSD || selectedLineObj.balance || 0})` : '-- ابحث أو اختر الخط المسكر --'}
                      </span>
                      <ChevronDown size={16} color="var(--text-muted)" />
                    </div>

                    {isLineSearchOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1.5px solid var(--orange-primary)',
                        borderRadius: '14px',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                        zIndex: 200,
                        marginTop: '4px',
                        padding: '8px',
                        maxHeight: '220px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: '8px', padding: '0 8px', border: '1px solid var(--border-color)' }}>
                          <Search size={14} color="var(--text-muted)" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="ابحث برقم الخط (مثال: 1) أو الهاتف..."
                            className="tz-input"
                            style={{ border: 'none', height: '34px', fontSize: '11px', background: 'transparent' }}
                            value={lineSearchQuery}
                            onChange={(e) => setLineSearchQuery(e.target.value)}
                          />
                        </div>

                        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {filteredLockedLines.length === 0 ? (
                            <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                              لا يوجد خط يطابق البحث
                            </div>
                          ) : (
                            filteredLockedLines.map((line, idx) => (
                              <div
                                key={line.id}
                                onClick={() => handleSelectLineFromSearch(line)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: selectedLockedLineId === line.id ? 'var(--orange-glow)' : 'var(--bg-card-sub)',
                                  color: selectedLockedLineId === line.id ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                <span>خط #{line.slotNumber || idx + 1}</span>
                                <span style={{ direction: 'ltr' }}>{line.phoneNumber || line.number} (رصيد: ${line.balanceUSD || line.balance || 0})</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {giftRecipients.map((rec, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>المستفيد #{idx + 1}</span>
                          {idx > 0 && (
                            <button type="button" onClick={() => handleRemoveRecipient(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '10px' }}>
                              إلغاء
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="اسم الزبون..."
                            className="tz-input"
                            value={rec.name}
                            onChange={(e) => handleUpdateRecipient(idx, 'name', e.target.value)}
                          />
                          <input
                            type="tel"
                            placeholder="رقم الهاتف..."
                            className="tz-input"
                            value={rec.phone}
                            onChange={(e) => handleUpdateRecipient(idx, 'phone', e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                          <input
                            type="number"
                            placeholder="الـ GB..."
                            className="tz-input"
                            value={rec.gb}
                            onChange={(e) => handleUpdateRecipient(idx, 'gb', e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="السعر..."
                            className="tz-input"
                            value={rec.price}
                            onChange={(e) => handleUpdateRecipient(idx, 'price', e.target.value)}
                          />
                          <select
                            className="tz-select"
                            value={rec.currency}
                            onChange={(e) => handleUpdateRecipient(idx, 'currency', e.target.value)}
                          >
                            <option value="USD">$</option>
                            <option value="LBP">ل.ل</option>
                          </select>
                        </div>
                      </div>
                    ))}

                    {giftRecipients.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddRecipient}
                        style={{
                          background: 'rgba(255, 122, 0, 0.1)',
                          border: '1px dashed var(--orange-primary)',
                          color: 'var(--orange-primary)',
                          padding: '6px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        + إضافة مستفيد آخر (حتى 3)
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteAlfaGift}
                    disabled={!selectedLockedLineId || (giftSourceType === 'sim' && !selectedSimId)}
                    className="btn-primary"
                    style={{ height: '42px', fontSize: '13px' }}
                  >
                    فوت عليي
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        /* مخزن الشرائح والدفعات */
        <div className="tz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>مخزن الشرائح والدفعات</span>
            <button
              type="button"
              onClick={() => openSimModal()}
              style={{
                background: 'rgba(255,122,0,0.15)',
                border: '1px solid var(--orange-primary)',
                color: 'var(--orange-primary)',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              + شروة جديدة
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sims.map(sim => {
              const currentTotalBal = getSimTotalBalance(sim);
              const batchesCount = sim.batches ? sim.batches.length : 1;

              return (
                <div key={sim.id} className="tz-item-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <div style={{ fontWeight: '900', fontSize: '16px' }}>{sim.name} ({sim.operator?.toUpperCase()})</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        الرقم: {sim.number} • الدفعات: {batchesCount}
                      </div>
                    </div>

                    <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#00E676' }}>
                          ${currentTotalBal.toFixed(2)}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رصيد متبقي</span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => { setTargetSimForBatch(sim); setBatchModalOpen(true); }}
                          style={{ background: 'rgba(255,122,0,0.15)', border: 'none', color: 'var(--orange-primary)', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                          title="إضافة دفعة رصيد"
                        >
                          + دفعة
                        </button>
                        <button
                          type="button"
                          onClick={() => openSimModal(sim)}
                          style={{ background: 'rgba(255,122,0,0.15)', border: 'none', color: 'var(--orange-primary)', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm('هل تريد حذف هذه الشريحة نهائياً؟')) onDeleteSim(sim.id); }}
                          style={{ background: 'rgba(255,77,77,0.15)', border: 'none', color: 'var(--red)', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {sim.batches && sim.batches.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '2px' }}>
                        دفعات الشريحة المسجلة:
                      </div>
                      {sim.batches.map((b, i) => (
                        <div
                          key={b.id || i}
                          style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px'
                          }}
                        >
                          <span style={{ fontWeight: '900', color: 'var(--text-main)' }}>
                            {b.label || `دفعة #${i + 1}`}
                          </span>
                          <span style={{ color: 'var(--green)', fontWeight: '900' }}>
                            متبقي: ${b.remainingUSD}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            (شراء: {b.costPrice} {b.costCurrency})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* مودال الشريحة (مسنتر ومحمي بواسطة createPortal) */}
      {simModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {editingSimId ? 'تعديل بيانات الشريحة ورصيدها' : 'إضافة شروة شريحة جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setSimModalOpen(false)}
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

            <form onSubmit={handleSaveSim} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <input
                  type="text"
                  placeholder="اسم الشريحة (مثال: شريحة ألفا جملة 1)..."
                  className="tz-input"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="رقم الهاتف..."
                  className="tz-input"
                  value={simNumber}
                  onChange={e => setSimNumber(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>الرصيد المتاح ($):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="الرصيد..."
                    className="tz-input"
                    value={purchasedCredits}
                    onChange={e => setPurchasedCredits(e.target.value)}
                    required
                    style={{ marginTop: '4px', fontWeight: 'bold' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>تكلفة الشراء:</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="التكلفة..."
                    className="tz-input"
                    value={costAmount}
                    onChange={e => setCostAmount(e.target.value)}
                    required
                    style={{ marginTop: '4px', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>عملة التكلفة:</span>
                <button
                  type="button"
                  onClick={() => setCostCurrency('LBP')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: costCurrency === 'LBP' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: costCurrency === 'LBP' ? 'var(--orange-subtle)' : 'var(--bg-card-sub)',
                    color: costCurrency === 'LBP' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ليرة لبنانية
                </button>
                <button
                  type="button"
                  onClick={() => setCostCurrency('USD')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: costCurrency === 'USD' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: costCurrency === 'USD' ? 'var(--orange-subtle)' : 'var(--bg-card-sub)',
                    color: costCurrency === 'USD' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  دولار كاش
                </button>
              </div>

              <button type="submit" className="btn-primary" style={{ height: '44px', marginTop: '6px' }}>
                <span>{editingSimId ? 'حفظ التعديلات' : 'إضافة الشريحة'}</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* مودال الدفعة (مسنتر ومحمي بواسطة createPortal) */}
      {batchModalOpen && targetSimForBatch && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                إضافة دفعة رصيد إلى: {targetSimForBatch.name}
              </h3>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
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

            <form onSubmit={handleSaveNewBatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>كمية الدولار للدفعة الجديدة ($):</label>
                <input
                  type="number"
                  step="any"
                  placeholder="مثال: 100 أو 150..."
                  className="tz-input"
                  value={newBatchCredits}
                  onChange={e => setNewBatchCredits(e.target.value)}
                  required
                  style={{ marginTop: '4px', fontWeight: 'bold' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>سعر شراء وتكلفة هذه الدفعة:</label>
                <input
                  type="number"
                  step="any"
                  placeholder="التكلفة..."
                  className="tz-input"
                  value={newBatchCost}
                  onChange={e => setNewBatchCost(e.target.value)}
                  required
                  style={{ marginTop: '4px', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>عملة التكلفة:</span>
                <button
                  type="button"
                  onClick={() => setNewBatchCurrency('LBP')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: newBatchCurrency === 'LBP' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: newBatchCurrency === 'LBP' ? 'var(--orange-subtle)' : 'var(--bg-card-sub)',
                    color: newBatchCurrency === 'LBP' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ليرة لبنانية
                </button>
                <button
                  type="button"
                  onClick={() => setNewBatchCurrency('USD')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: newBatchCurrency === 'USD' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: newBatchCurrency === 'USD' ? 'var(--orange-subtle)' : 'var(--bg-card-sub)',
                    color: newBatchCurrency === 'USD' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  دولار كاش
                </button>
              </div>

              <button type="submit" className="btn-primary" style={{ height: '44px', marginTop: '6px' }}>
                <span>تثبيت الدفعة في الخط</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}