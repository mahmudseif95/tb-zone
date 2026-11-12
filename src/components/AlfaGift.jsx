import React, { useState } from 'react';
import {
    Gift,
    Share2,
    ChevronDown,
    Search,
    Plus,
    Trash2,
    User,
    Users,
    RefreshCw,
    CheckCircle2
} from 'lucide-react';

export default function AlfaGift({
    sims = [],
    lockedLines = [],
    customers = [],
    onExecuteAlfaGiftSale,
    exchangeRate = 89500
}) {
    const ALFA_GIFT_TIERS = [
        { label: '77 GB ➔ $31.0', gb: '77', price: '31' },
        { label: '44 GB ➔ $21.0', gb: '44', price: '21' },
        { label: '22 GB ➔ $14.5', gb: '22', price: '14.5' },
        { label: '7 GB ➔ $9.0', gb: '7', price: '9' },
        { label: '3 GB ➔ $6.9', gb: '3', price: '6.9' },
        { label: '1 GB ➔ $3.5', gb: '1', price: '3.5' },
        { label: 'أخرى (مخصص)...', gb: 'custom', price: '' }
    ];

    // 'direct_gift' = Alfa Gift لمشتري واحد | 'ushare' = يوشير توزيع حتى 3 مستفيدين
    const [serviceMode, setServiceMode] = useState('direct_gift');
    const [giftSourceType, setGiftSourceType] = useState('sim'); // 'sim' | 'closed_line'
    const [giftSimId, setGiftSimId] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedGiftPackage, setSelectedGiftPackage] = useState('77');
    const [giftCostDeduction, setGiftCostDeduction] = useState('31');
    const [giftTotalGB, setGiftTotalGB] = useState('77');

    const [selectedLockedLineId, setSelectedLockedLineId] = useState('');
    const [lineSearchQuery, setLineSearchQuery] = useState('');
    const [isLineSearchOpen, setIsLineSearchOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // حقول المشتري الواحد (Alfa Gift مباشر)
    const [buyerName, setBuyerName] = useState('');
    const [buyerPhone, setBuyerPhone] = useState('');
    const [buyerPrice, setBuyerPrice] = useState('');
    const [buyerCurrency, setBuyerCurrency] = useState('USD');
    const [buyerIsDebt, setBuyerIsDebt] = useState(false);

    // حقول المستفيدين المتعددين (U-Share)
    const [giftRecipients, setGiftRecipients] = useState([
        { name: '', phone: '', gb: '22', price: '', currency: 'USD', isDebt: false }
    ]);

    const handleSwitchMode = (newMode) => {
        setServiceMode(newMode);
        if (newMode === 'direct_gift') {
            setGiftSourceType('sim');
        } else {
            setGiftSourceType('closed_line');
        }
    };

    const getSimTotalBalance = (sim) => {
        if (!sim) return 0;
        if (sim.batches && sim.batches.length > 0) {
            return sim.batches.reduce((sum, b) => sum + (parseFloat(b.remainingUSD) || 0), 0);
        }
        return parseFloat(sim.balance) || 0;
    };

    const selectedSimObj = sims.find(s => s.id === giftSimId);
    const activeSimBatches = selectedSimObj?.batches?.filter(b => parseFloat(b.remainingUSD) > 0) || [];

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

        if (serviceMode === 'ushare') {
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
                        currency: 'USD',
                        isDebt: false
                    });
                }
            });

            if (existingUsers.length > 0) {
                setGiftRecipients(existingUsers);
            } else {
                setGiftRecipients([{ name: '', phone: '', gb: '22', price: '', currency: 'USD', isDebt: false }]);
            }
        }
    };

    const handleAddRecipient = () => {
        if (giftRecipients.length < 3) {
            setGiftRecipients([...giftRecipients, { name: '', phone: '', gb: '22', price: '', currency: 'USD', isDebt: false }]);
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
    const deductUSD = parseFloat(giftCostDeduction) || 0;

    // حسابات المعاينة المباشرة للربح والتوزيع
    const allocatedGB = giftRecipients.reduce((sum, r) => sum + (parseFloat(r.gb) || 0), 0);
    const directSaleUSD = buyerCurrency === 'LBP'
        ? ((parseFloat(buyerPrice) || 0) / exchangeRate)
        : (parseFloat(buyerPrice) || 0);
    const directProfitUSD = directSaleUSD - deductUSD;

    const ushareTotalSaleUSD = giftRecipients.reduce((sum, r) => {
        const val = parseFloat(r.price) || 0;
        return sum + (r.currency === 'LBP' ? val / exchangeRate : val);
    }, 0);

    const handleExecute = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (deductUSD <= 0) {
            alert('يرجى تحديد تكلفة الرصيد المخصوم بالدولار!');
            return;
        }

        if (giftSourceType === 'closed_line') {
            if (!selectedLockedLineId) {
                alert('يرجى اختيار الخط المسكر أولاً!');
                return;
            }
            const lineBal = parseFloat(selectedLineObj?.balanceUSD || selectedLineObj?.balance || 0);
            if (deductUSD > lineBal) {
                alert(`رصيد الخط المسكر المتاح ($${lineBal.toFixed(2)}) لا يكفي لخصم $${deductUSD}!`);
                return;
            }
        } else {
            if (!giftSimId) {
                alert('يرجى اختيار شريحة ألفا التي سيتم السحب منها!');
                return;
            }
            if (selectedBatchId) {
                const batchObj = activeSimBatches.find(b => b.id === selectedBatchId);
                const batchBal = parseFloat(batchObj?.remainingUSD) || 0;
                if (deductUSD > batchBal) {
                    alert(`رصيد الدفعة المختارة ($${batchBal.toFixed(2)}) لا يكفي لخصم $${deductUSD}!`);
                    return;
                }
            } else {
                const simBal = getSimTotalBalance(selectedSimObj);
                if (deductUSD > simBal) {
                    alert(`رصيد الشريحة المتبقي ($${simBal.toFixed(2)}) لا يكفي لخصم $${deductUSD}!`);
                    return;
                }
            }
        }

        let finalRecipients = [];

        if (serviceMode === 'direct_gift') {
            const priceNum = parseFloat(buyerPrice) || 0;
            if (priceNum <= 0) {
                alert('يرجى إدخال سعر المبيع للزبون!');
                return;
            }
            if (buyerIsDebt && !buyerName.trim()) {
                alert('يرجى إدخال اسم الزبون لتسجيل الدين في الدفتر!');
                return;
            }
            finalRecipients = [
                {
                    name: buyerName.trim() || 'عام',
                    phone: buyerPhone.trim(),
                    gb: maxGB,
                    price: priceNum,
                    currency: buyerCurrency,
                    isDebt: buyerIsDebt
                }
            ];
        } else {
            const validRecipients = giftRecipients.filter(r => r.name.trim() !== '');
            if (validRecipients.length === 0) {
                alert('يرجى إدخال اسم مستفيد واحد على الأقل مع حصته وسعره!');
                return;
            }
            finalRecipients = validRecipients.map(r => ({
                ...r,
                name: r.name.trim(),
                phone: (r.phone || '').trim(),
                price: parseFloat(r.price) || 0
            }));
        }

        try {
            setIsSubmitting(true);
            await onExecuteAlfaGiftSale({
                mode: serviceMode,
                simId: giftSourceType === 'sim' ? giftSimId : null,
                selectedBatchId: giftSourceType === 'sim' && selectedBatchId ? selectedBatchId : null,
                deductUSD,
                lockedLineId: giftSourceType === 'closed_line' ? selectedLockedLineId : null,
                totalGB: maxGB,
                recipients: finalRecipients,
                exchangeRate
            });

            // تصفير حقول المشتري بعد نجاح العملية
            setBuyerName('');
            setBuyerPhone('');
            setBuyerPrice('');
            setBuyerIsDebt(false);
            setGiftRecipients([{ name: '', phone: '', gb: '22', price: '', currency: 'USD', isDebt: false }]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isGiftSubmitDisabled =
        isSubmitting || (giftSourceType === 'closed_line' ? !selectedLockedLineId : !giftSimId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>
            <div className="tz-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* عنوان الصفحة والهيدر */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255, 122, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {serviceMode === 'direct_gift' ? (
                                <Gift size={24} color="var(--orange-primary)" />
                            ) : (
                                <Share2 size={24} color="var(--orange-primary)" />
                            )}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                {serviceMode === 'direct_gift' ? 'ALFA GIFT (مباشر)' : 'U-SHARE (توزيع يوشير)'}
                            </h2>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {serviceMode === 'direct_gift'
                                    ? 'إرسال باقة كاملة لمشتري واحد (كاش أو دين)'
                                    : 'توزيع الباقة على حتى 3 مشتركين وربطها بالخط'}
                            </span>
                        </div>
                    </div>

                    {giftTotalGB && (
                        <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--green)', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '8px' }}>
                            {giftTotalGB} GB
                        </span>
                    )}
                </div>

                {/* التبديل بين Alfa Gift (مشتري واحد) و U-Share (3 مستفيدين) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-card-sub)', padding: '5px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('direct_gift')}
                        style={{
                            padding: '10px 8px',
                            borderRadius: '10px',
                            border: 'none',
                            background: serviceMode === 'direct_gift' ? 'var(--orange-primary)' : 'transparent',
                            color: serviceMode === 'direct_gift' ? '#fff' : 'var(--text-main)',
                            fontSize: '12px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <User size={15} />
                        <span>Alfa Gift (مشتري واحد)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSwitchMode('ushare')}
                        style={{
                            padding: '10px 8px',
                            borderRadius: '10px',
                            border: 'none',
                            background: serviceMode === 'ushare' ? 'var(--orange-primary)' : 'transparent',
                            color: serviceMode === 'ushare' ? '#fff' : 'var(--text-main)',
                            fontSize: '12px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <Users size={15} />
                        <span>U-Share (توزيع 3 مستفيدين)</span>
                    </button>
                </div>

                {/* 1. اختيار مصدر خصم الرصيد */}
                <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                        مصدر سحب الرصيد:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setGiftSourceType('sim')}
                            style={{
                                padding: '11px',
                                borderRadius: '12px',
                                border: giftSourceType === 'sim' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: giftSourceType === 'sim' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-input)',
                                color: giftSourceType === 'sim' ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '12px',
                                fontWeight: '900',
                                cursor: 'pointer'
                            }}
                        >
                            من الشريحة الأساسية (SIM)
                        </button>

                        <button
                            type="button"
                            onClick={() => setGiftSourceType('closed_line')}
                            style={{
                                padding: '11px',
                                borderRadius: '12px',
                                border: giftSourceType === 'closed_line' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: giftSourceType === 'closed_line' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-input)',
                                color: giftSourceType === 'closed_line' ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '12px',
                                fontWeight: '900',
                                cursor: 'pointer'
                            }}
                        >
                            من رصيد الخط المسكر
                        </button>
                    </div>
                </div>

                {/* 2. اختيار الباقة والتكلفة */}
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                            اختر الباقة:
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                الرصيد المخصوم ($):
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="tz-input"
                                value={giftCostDeduction}
                                onChange={(e) => setGiftCostDeduction(e.target.value)}
                                placeholder="31"
                                style={{ fontWeight: 'bold', color: 'var(--orange-primary)', height: '40px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>حجم الباقة (GB):</label>
                            <input
                                type="text"
                                className="tz-input"
                                value={giftTotalGB}
                                onChange={(e) => setGiftTotalGB(e.target.value)}
                                placeholder="77"
                                style={{ fontWeight: 'bold', height: '40px' }}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. تحديد الشريحة أو الخط المسكر */}
                {giftSourceType === 'sim' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '4px', display: 'block' }}>
                                اختر شريحة Alfa:
                            </label>
                            <select
                                className="tz-select"
                                value={giftSimId}
                                onChange={(e) => {
                                    setGiftSimId(e.target.value);
                                    setSelectedBatchId('');
                                }}
                                style={{ fontWeight: 'bold', height: '44px' }}
                            >
                                <option value="">-- اختر شريحة الرصيد --</option>
                                {sims.filter(s => s.operator === 'alfa').map(sim => (
                                    <option key={sim.id} value={sim.id}>
                                        {sim.name} {sim.number ? `(${sim.number})` : ''} - رصيدها: ${getSimTotalBalance(sim).toFixed(2)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {activeSimBatches.length > 1 && (
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                    اختر دفعة الرصيد (اختياري):
                                </label>
                                <select
                                    className="tz-select"
                                    value={selectedBatchId}
                                    onChange={(e) => setSelectedBatchId(e.target.value)}
                                    style={{ height: '38px', fontSize: '12px' }}
                                >
                                    <option value="">تلقائي (من الدفعة الأقدم أولاً)</option>
                                    {activeSimBatches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.label} — متبقي: ${parseFloat(b.remainingUSD).toFixed(2)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ position: 'relative' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '4px', display: 'block' }}>
                            الخط المسكر المصدر:
                        </label>

                        <div
                            onClick={() => setIsLineSearchOpen(!isLineSearchOpen)}
                            style={{
                                background: 'var(--bg-input)',
                                border: '1.5px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ fontSize: '13px', fontWeight: selectedLineObj ? 'bold' : 'normal', color: selectedLineObj ? 'var(--orange-primary)' : 'var(--text-muted)' }}>
                                {selectedLineObj
                                    ? `خط #${selectedLineObj.slotNumber}: ${selectedLineObj.phoneNumber || selectedLineObj.number} (متوفر: $${selectedLineObj.balanceUSD || selectedLineObj.balance || 0})`
                                    : '-- ابحث أو اختر الخط المسكر --'}
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
                                boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
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
                                        placeholder="ابحث برقم الخط أو الهاتف..."
                                        className="tz-input"
                                        style={{ border: 'none', height: '36px', fontSize: '12px', background: 'transparent' }}
                                        value={lineSearchQuery}
                                        onChange={(e) => setLineSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredLockedLines.length === 0 ? (
                                        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            لا يوجد خط يطابق البحث
                                        </div>
                                    ) : (
                                        filteredLockedLines.map((line, idx) => (
                                            <div
                                                key={line.id}
                                                onClick={() => handleSelectLineFromSearch(line)}
                                                style={{
                                                    padding: '10px 12px',
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
                )}

                {/* 4A. قسم المشتري الواحد (Alfa Gift مباشر) */}
                {serviceMode === 'direct_gift' ? (
                    <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', border: '1.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                بيانات المشتري (باقة {giftTotalGB || '0'} GB كاملة)
                            </span>

                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: buyerIsDebt ? 'var(--red)' : 'var(--green)',
                                fontWeight: '900',
                                background: buyerIsDebt ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                padding: '4px 10px',
                                borderRadius: '8px'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={buyerIsDebt}
                                    onChange={(e) => setBuyerIsDebt(e.target.checked)}
                                    style={{ accentColor: 'var(--red)', width: '15px', height: '15px' }}
                                />
                                <span>{buyerIsDebt ? 'آجل (دين)' : 'مدفوع كاش'}</span>
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    اسم الزبون {buyerIsDebt ? '*' : '(اختياري للكاش)'}:
                                </label>
                                <input
                                    type="text"
                                    list="alfa-gift-customers-list"
                                    placeholder={buyerIsDebt ? 'اسم الزبون المدين...' : 'عام / اسم الزبون...'}
                                    className="tz-input"
                                    style={{ height: '40px' }}
                                    value={buyerName}
                                    onChange={(e) => setBuyerName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم المرسل إليه:</label>
                                <input
                                    type="tel"
                                    placeholder="70 / 71 / 76 / 81..."
                                    className="tz-input"
                                    style={{ height: '40px' }}
                                    value={buyerPhone}
                                    onChange={(e) => setBuyerPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر المبيع للزبون:</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="مثال: 35"
                                    className="tz-input"
                                    style={{ height: '42px', fontWeight: '900', fontSize: '15px', color: 'var(--orange-primary)' }}
                                    value={buyerPrice}
                                    onChange={(e) => setBuyerPrice(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                                <select
                                    className="tz-select"
                                    style={{ height: '42px', fontWeight: 'bold' }}
                                    value={buyerCurrency}
                                    onChange={(e) => setBuyerCurrency(e.target.value)}
                                >
                                    <option value="USD">دولار ($)</option>
                                    <option value="LBP">ليرة (LBP)</option>
                                </select>
                            </div>
                        </div>

                        {parseFloat(buyerPrice) > 0 && (
                            <div style={{
                                background: 'var(--bg-card-sub)',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '11px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    الخصم من الشريحة: <b>${deductUSD.toFixed(2)}</b>
                                </span>
                                <span style={{ color: directProfitUSD >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: '900' }}>
                                    الربح الصافي: {directProfitUSD >= 0 ? `+$${directProfitUSD.toFixed(2)}` : `-$${Math.abs(directProfitUSD).toFixed(2)}`}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    /* 4B. قسم المستفيدين وتوزيع الحصص (U-Share) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                المستفيدون وتوزيع الحصص (حتى 3 مشتركين):
                            </label>
                            {maxGB > 0 && (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: allocatedGB > maxGB ? 'var(--red)' : 'var(--orange-primary)'
                                }}>
                                    الموزع: {allocatedGB} / {maxGB} GB
                                </span>
                            )}
                        </div>

                        {giftRecipients.map((rec, idx) => (
                            <div key={idx} style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--orange-primary)' }}>المستفيد #{idx + 1}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', color: rec.isDebt ? 'var(--red)' : 'var(--green)', fontWeight: 'bold' }}>
                                            <input
                                                type="checkbox"
                                                checked={rec.isDebt}
                                                onChange={(e) => handleUpdateRecipient(idx, 'isDebt', e.target.checked)}
                                                style={{ accentColor: 'var(--red)', width: '16px', height: '16px' }}
                                            />
                                            <span>{rec.isDebt ? 'آجل (دين)' : 'كاش'}</span>
                                        </label>
                                        {idx > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRecipient(idx)}
                                                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}
                                            >
                                                <Trash2 size={13} />
                                                <span>حذف</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                                    <input
                                        type="text"
                                        list="alfa-gift-customers-list"
                                        placeholder="اسم المشترك..."
                                        className="tz-input"
                                        style={{ height: '38px' }}
                                        value={rec.name}
                                        onChange={(e) => handleUpdateRecipient(idx, 'name', e.target.value)}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="رقم الهاتف..."
                                        className="tz-input"
                                        style={{ height: '38px' }}
                                        value={rec.phone}
                                        onChange={(e) => handleUpdateRecipient(idx, 'phone', e.target.value)}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>الحصة (GB):</label>
                                        <input
                                            type="number"
                                            step="any"
                                            placeholder="22"
                                            className="tz-input"
                                            style={{ height: '38px', fontWeight: 'bold' }}
                                            value={rec.gb}
                                            onChange={(e) => handleUpdateRecipient(idx, 'gb', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر المبيع:</label>
                                        <input
                                            type="number"
                                            step="any"
                                            placeholder="السعر..."
                                            className="tz-input"
                                            style={{ height: '38px', fontWeight: 'bold', color: 'var(--orange-primary)' }}
                                            value={rec.price}
                                            onChange={(e) => handleUpdateRecipient(idx, 'price', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العملة:</label>
                                        <select
                                            className="tz-select"
                                            style={{ height: '38px', fontWeight: 'bold' }}
                                            value={rec.currency}
                                            onChange={(e) => handleUpdateRecipient(idx, 'currency', e.target.value)}
                                        >
                                            <option value="USD">دولار ($)</option>
                                            <option value="LBP">ليرة (LBP)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {giftRecipients.length < 3 && (
                            <button
                                type="button"
                                onClick={handleAddRecipient}
                                style={{
                                    background: 'rgba(255, 122, 0, 0.1)',
                                    border: '1.5px dashed var(--orange-primary)',
                                    color: 'var(--orange-primary)',
                                    padding: '10px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Plus size={16} />
                                <span>إضافة مستفيد آخر ({giftRecipients.length}/3)</span>
                            </button>
                        )}

                        {ushareTotalSaleUSD > 0 && (
                            <div style={{
                                background: 'var(--bg-card-sub)',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '11px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    إجمالي المبيعات: <b>${ushareTotalSaleUSD.toFixed(2)}</b>
                                </span>
                                <span style={{ color: 'var(--green)', fontWeight: '900' }}>
                                    صافي الربح: +${Math.max(0, ushareTotalSaleUSD - deductUSD).toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <datalist id="alfa-gift-customers-list">
                    {customers.map(c => (
                        <option key={c.id} value={c.name} />
                    ))}
                </datalist>

                {/* زر التثبيت والتنفيذ */}
                <button
                    type="button"
                    onClick={handleExecute}
                    disabled={isGiftSubmitDisabled}
                    className="btn-primary"
                    style={{
                        height: '46px',
                        fontSize: '15px',
                        fontWeight: '900',
                        marginTop: '6px',
                        opacity: isGiftSubmitDisabled ? 0.4 : 1,
                        cursor: isGiftSubmitDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    {isSubmitting ? (
                        <>
                            <RefreshCw size={18} className="spin-icon" />
                            <span>جاري الحفظ في السيرفر...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={18} />
                            <span>
                                {serviceMode === 'direct_gift' ? 'تثبيت بيع Alfa Gift' : 'تثبيت وتوزيع حصص U-Share'}
                            </span>
                        </>
                    )}
                </button>

            </div>
        </div>
    );
}