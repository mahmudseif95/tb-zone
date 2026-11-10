import React, { useState } from 'react';
import { Gift, ChevronDown, Search, Plus, Trash2, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function AlfaGift({
    sims = [],
    lockedLines = [],
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

    const [giftSourceType, setGiftSourceType] = useState('closed_line'); // 'closed_line' | 'sim'
    const [giftSimId, setGiftSimId] = useState('');
    const [selectedGiftPackage, setSelectedGiftPackage] = useState('77');
    const [giftCostDeduction, setGiftCostDeduction] = useState('31');
    const [giftTotalGB, setGiftTotalGB] = useState('77');
    const [selectedLockedLineId, setSelectedLockedLineId] = useState('');
    const [lineSearchQuery, setLineSearchQuery] = useState('');
    const [isLineSearchOpen, setIsLineSearchOpen] = useState(false);

    const [giftRecipients, setGiftRecipients] = useState([
        { name: '', phone: '', gb: '22', price: '', currency: 'USD', isDebt: false }
    ]);

    const getSimTotalBalance = (sim) => {
        if (!sim) return 0;
        if (sim.batches && sim.batches.length > 0) {
            return sim.batches.reduce((sum, b) => sum + (parseFloat(b.remainingUSD) || 0), 0);
        }
        return parseFloat(sim.balance) || 0;
    };

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

    const handleExecute = (e) => {
        e.preventDefault();

        const deductUSD = parseFloat(giftCostDeduction) || 0;

        if (giftSourceType === 'closed_line') {
            if (!selectedLockedLineId) {
                alert('يرجى اختيار الخط المسكر المربوط بالخدمة أولاً!');
                return;
            }
            const lineBal = parseFloat(selectedLineObj?.balanceUSD || selectedLineObj?.balance || 0);
            if (deductUSD > lineBal) {
                alert(`رصيد الخط المسكر المتاح ($${lineBal.toFixed(2)}) لا يكفي لخصم تكلفة الخدمة ($${deductUSD})!`);
                return;
            }
        } else {
            if (!giftSimId) {
                alert('يرجى اختيار شريحة ألفا التي سيتم الخصم منها!');
                return;
            }
            const targetSim = sims.find(s => s.id === giftSimId);
            const simBal = getSimTotalBalance(targetSim);
            if (deductUSD > simBal) {
                alert(`رصيد الشريحة المتبقي ($${simBal.toFixed(2)}) لا يكفي لخصم $${deductUSD}!`);
                return;
            }
        }

        const validRecipients = giftRecipients.filter(r => r.name.trim() !== '');
        if (validRecipients.length === 0) {
            alert('يرجى إدخال اسم مستفيد واحد على الأقل مع حصته وسعره!');
            return;
        }

        onExecuteAlfaGiftSale({
            simId: giftSourceType === 'sim' ? giftSimId : null,
            selectedBatchId: null,
            deductUSD: deductUSD,
            lockedLineId: giftSourceType === 'closed_line' ? selectedLockedLineId : null,
            totalGB: maxGB,
            recipients: validRecipients,
            exchangeRate: exchangeRate
        });

        setGiftRecipients([{ name: '', phone: '', gb: '22', price: '', currency: 'USD', isDebt: false }]);
    };

    const isGiftSubmitDisabled = giftSourceType === 'closed_line' ? !selectedLockedLineId : !giftSimId;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

            <div className="tz-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* عنوان الصفحة والهيدر */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255, 122, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Gift size={24} color="var(--orange-primary)" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                خدمة ALFA GIFT
                            </h2>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                تفعيل الباقات وتوزيع الحصص على المشتركين بدقة
                            </span>
                        </div>
                    </div>

                    {giftTotalGB && (
                        <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--green)', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '8px' }}>
                            باقة: {giftTotalGB} GB
                        </span>
                    )}
                </div>

                {/* 1. اختيار مصدر خصم الرصيد */}
                <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                        مكان خصم تكلفة الخدمة:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setGiftSourceType('closed_line')}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: giftSourceType === 'closed_line' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: giftSourceType === 'closed_line' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-input)',
                                color: giftSourceType === 'closed_line' ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '13px',
                                fontWeight: '900',
                                cursor: 'pointer'
                            }}
                        >
                            من رصيد الخط المسكر
                        </button>

                        <button
                            type="button"
                            onClick={() => setGiftSourceType('sim')}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: giftSourceType === 'sim' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: giftSourceType === 'sim' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-input)',
                                color: giftSourceType === 'sim' ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '13px',
                                fontWeight: '900',
                                cursor: 'pointer'
                            }}
                        >
                            سحب من الشريحة الأساسية
                        </button>
                    </div>
                </div>

                {/* 2. اختيار الباقة والتكلفة */}
                <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                            اختر باقة ALFA GIFT:
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
                                {giftSourceType === 'closed_line' ? 'خصم من رصيد الخط ($):' : 'سحب من الشريحة ($):'}
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="tz-input"
                                value={giftCostDeduction}
                                onChange={(e) => setGiftCostDeduction(e.target.value)}
                                placeholder="المبلغ ($)..."
                                style={{ fontWeight: 'bold', color: 'var(--orange-primary)', height: '40px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>حجم الباقة الإجمالي (GB):</label>
                            <input
                                type="text"
                                className="tz-input"
                                value={giftTotalGB}
                                onChange={(e) => setGiftTotalGB(e.target.value)}
                                placeholder="الحجم (GB)..."
                                style={{ fontWeight: 'bold', height: '40px' }}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. تحديد الخط المسكر أو الشريحة */}
                {giftSourceType === 'sim' ? (
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '4px', display: 'block' }}>
                            اختر شريحة Alfa التي سيُسحب منها الرصيد:
                        </label>
                        <select
                            className="tz-select"
                            value={giftSimId}
                            onChange={(e) => setGiftSimId(e.target.value)}
                            style={{ fontWeight: 'bold', height: '44px' }}
                        >
                            <option value="">-- اختر شريحة الرصيد --</option>
                            {sims.filter(s => s.operator === 'alfa').map(sim => (
                                <option key={sim.id} value={sim.id}>
                                    {sim.name} ({sim.number}) - رصيدها: ${getSimTotalBalance(sim).toFixed(2)}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div style={{ position: 'relative' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)', marginBottom: '4px', display: 'block' }}>
                            الخط المسكر المفتوح منه الخدمة:
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

                {/* 4. تفاصيل المستفيدين وتوزيع الحصص */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        المستفيدون وتوزيع الحصص (3 مستفيدين كحد أقصى):
                    </label>

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
                                        <button type="button" onClick={() => handleRemoveRecipient(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '11px' }}>
                                            إلغاء
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="اسم الزبون..."
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
                            <span>إضافة مستفيد آخر</span>
                        </button>
                    )}
                </div>

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
                        marginTop: '8px',
                        opacity: isGiftSubmitDisabled ? 0.4 : 1,
                        cursor: isGiftSubmitDisabled ? 'not-allowed' : 'pointer'
                    }}
                >
                    فوت عليي
                </button>

            </div>

        </div>
    );
}