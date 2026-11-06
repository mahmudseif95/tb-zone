import React, { useState } from 'react';
import { TELECOM_CARD_TIERS } from '../utils/telecomTiers';
import { executeCardRecharge } from '../utils/tools';
import { Smartphone, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function BuyTelecomCardModal({
    isOpen,
    onClose,
    sources = [],
    lockedLines = [],
    onSuccess
}) {
    if (!isOpen) return null;

    const [operator, setOperator] = useState('ALFA');
    const [selectedTierId, setSelectedTierId] = useState(TELECOM_CARD_TIERS.ALFA[0].id);
    const [sourceId, setSourceId] = useState(sources[0]?.id || '');
    const [targetLineId, setTargetLineId] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState('');

    // استخراج باقات الشركة المحددة
    const currentTiers = TELECOM_CARD_TIERS[operator];
    const selectedTier = currentTiers.find(t => t.id === selectedTierId) || currentTiers[0];

    // إيجاد المحفظة والخط المختارين
    const selectedWallet = sources.find(s => s.id === sourceId);
    const selectedLine = lockedLines.find(l => l.id === targetLineId || l.phone_number === targetLineId || l.number === targetLineId);

    // الخطوط التابعة لنفس المشغل
    const availableLines = lockedLines.filter(l => {
        if (!l.operator) return true;
        return l.operator.toUpperCase() === operator;
    });

    const handlePreSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!selectedWallet) {
            setError('يرجى اختيار محفظة الدفع');
            return;
        }
        if (Number(selectedWallet.balance) < Number(selectedTier.cost)) {
            setError(`رصيد المحفظة (${selectedWallet.balance}$) لا يكفي لخصم (${selectedTier.cost}$)`);
            return;
        }
        if (!selectedLine) {
            setError('يرجى اختيار الخط المغلق المستهدف');
            return;
        }

        setIsConfirming(true);
    };

    const handleExecute = () => {
        setError('');
        try {
            const result = executeCardRecharge({
                operator,
                tier: selectedTier,
                sourceId,
                targetLineId: selectedLine.id || selectedLine.phone_number || selectedLine.number,
                sources,
                lockedLines
            });

            onSuccess(result);
            onClose();
        } catch (err) {
            setError(err.message || 'حدث خطأ أثناء تنفيذ الحركة');
            setIsConfirming(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ direction: 'rtl' }}>
            <div className="modal-center" style={{ maxWidth: '420px', width: '92%', textAlign: 'right', position: 'relative' }}>

                {/* زر الإغلاق */}
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', left: '16px', top: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--orange-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange-primary)' }}>
                        <Smartphone size={22} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>شراء كارت وتغذية خط مغلق</h3>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Gift Recharge دون استهلاك رصيد الشرائح</p>
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {!isConfirming ? (
                    <form onSubmit={handlePreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                        {/* 1. اختيار المشغل */}
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>الشبكة:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    className="tz-input"
                                    style={{
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        borderColor: operator === 'ALFA' ? 'var(--orange-primary)' : 'var(--border-color)',
                                        background: operator === 'ALFA' ? 'var(--orange-subtle)' : 'transparent',
                                        color: operator === 'ALFA' ? 'var(--orange-primary)' : 'inherit'
                                    }}
                                    onClick={() => {
                                        setOperator('ALFA');
                                        setSelectedTierId(TELECOM_CARD_TIERS.ALFA[0].id);
                                        setTargetLineId('');
                                    }}
                                >
                                    ألفا (Alfa)
                                </button>
                                <button
                                    type="button"
                                    className="tz-input"
                                    style={{
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        borderColor: operator === 'TOUCH' ? 'var(--orange-primary)' : 'var(--border-color)',
                                        background: operator === 'TOUCH' ? 'var(--orange-subtle)' : 'transparent',
                                        color: operator === 'TOUCH' ? 'var(--orange-primary)' : 'inherit'
                                    }}
                                    onClick={() => {
                                        setOperator('TOUCH');
                                        setSelectedTierId(TELECOM_CARD_TIERS.TOUCH[0].id);
                                        setTargetLineId('');
                                    }}
                                >
                                    تاتش (Touch)
                                </button>
                            </div>
                        </div>

                        {/* 2. اختيار الفئة */}
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>فئة الكارت:</label>
                            <select
                                className="tz-input"
                                style={{ width: '100%', marginTop: '4px' }}
                                value={selectedTierId}
                                onChange={e => setSelectedTierId(e.target.value)}
                            >
                                {currentTiers.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 3. اختيار المحفظة */}
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>محفظة الدفع (الخصم):</label>
                            <select
                                className="tz-input"
                                style={{ width: '100%', marginTop: '4px' }}
                                value={sourceId}
                                onChange={e => setSourceId(e.target.value)}
                            >
                                {sources.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} (المتوفر: ${Number(s.balance).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 4. اختيار الخط المغلق */}
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>الخط المغلق المستهدف:</label>
                            <select
                                className="tz-input"
                                style={{ width: '100%', marginTop: '4px' }}
                                value={targetLineId}
                                onChange={e => setTargetLineId(e.target.value)}
                                required
                            >
                                <option value="">-- اضغط لاختيار الخط --</option>
                                {availableLines.map(line => (
                                    <option key={line.id || line.phone_number || line.number} value={line.id || line.phone_number || line.number}>
                                        {line.name ? `${line.name} - ` : ''}{line.phone_number || line.number} (رصيده: ${line.balance || 0}$)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                            متابعة لتأكيد العملية
                        </button>
                    </form>
                ) : (
                    /* شاشة التأكيد قبل الخصم */
                    <div>
                        <div style={{ background: 'var(--bg-card-sub)', padding: '14px', borderRadius: '14px', border: '1px dashed var(--border-color)', marginBottom: '16px', fontSize: '13px', lineHeight: '2' }}>
                            <div><strong>الشركة:</strong> {operator === 'ALFA' ? 'ألفا (Alfa)' : 'تاتش (Touch)'}</div>
                            <div><strong>الخط المستهدف:</strong> {selectedLine?.phone_number || selectedLine?.number} ({selectedLine?.name || 'خط مغلق'})</div>
                            <div><strong>الرصيد المضاف:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>+${selectedTier.credit}</span></div>
                            <div><strong>الأيام المضافة:</strong> <span style={{ color: '#2563eb', fontWeight: 'bold' }}>+{selectedTier.days} يوم</span></div>
                            <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px dashed var(--border-color)' }} />
                            <div><strong>محفظة الخصم:</strong> {selectedWallet?.name}</div>
                            <div><strong>التكلفة المخصومة:</strong> <span style={{ color: '#dc2626', fontWeight: '900', fontSize: '15px' }}>-${selectedTier.cost}</span></div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleExecute}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <CheckCircle2 size={18} />
                                <span>تأكيد وخصم المبلغ</span>
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setIsConfirming(false)}
                            >
                                تراجع
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}