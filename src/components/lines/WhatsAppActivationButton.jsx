import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Settings2, Plus, Trash2, X } from 'lucide-react';
import { launchWhatsAppWithSender, USHARE_ACTIVATION_SHORTCODE } from '../../utils/whatsappHelper';
import { useWhatsAppSenders, saveSenders, DEFAULT_SENDERS } from '../../utils/whatsappSenders';

const modeLabel = (mode) => (mode === 'app' ? 'تطبيق' : 'متصفح');

const Badge = ({ mode }) => (
    <span style={{ fontSize: '9px', fontWeight: '900', padding: '1px 6px', borderRadius: '6px', background: mode === 'app' ? 'rgba(37, 211, 102, 0.18)' : 'var(--bg-card-sub)', color: mode === 'app' ? '#25D366' : 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
        {mode === 'app' ? 'App' : 'Web'}
    </span>
);

/**
 * محرر حسابات واتساب الخاصة بالمحل (التسمية، الرقم، نمط الفتح: تطبيق/متصفح، إضافة وحذف).
 * يحفظ فوراً على هذا الجهاز. كل الأزرار type="button" ليصلح داخل النماذج.
 */
export function WhatsAppSendersEditor() {
    const senders = useWhatsAppSenders();

    const update = (id, patch) => saveSenders(senders.map(s => (s.id === id ? { ...s, ...patch } : s)));
    const remove = (id) => {
        const next = senders.filter(s => s.id !== id);
        saveSenders(next.length ? next : DEFAULT_SENDERS);
    };
    const add = () => saveSenders([...senders, { id: `wa_${Date.now()}`, label: `حساب ${senders.length + 1}`, phone: '', mode: 'web' }]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {senders.map((s) => (
                <div key={s.id} style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                            type="text"
                            className="tz-input"
                            style={{ height: '34px', fontSize: '12px', flex: 1 }}
                            placeholder="اسم الحساب (واتساب بيزنس...)"
                            value={s.label}
                            onChange={e => update(s.id, { label: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={() => remove(s.id)}
                            title="حذف الحساب"
                            aria-label="حذف الحساب"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '8px', padding: '0 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <input
                            type="tel"
                            className="tz-input"
                            style={{ height: '34px', fontSize: '12px', flex: '1 1 140px', minWidth: 0 }}
                            placeholder="رقم هذا الحساب (Alfa/Touch)"
                            value={s.phone}
                            onChange={e => update(s.id, { phone: e.target.value })}
                        />
                        <select
                            className="tz-select"
                            style={{ height: '34px', fontSize: '12px', minWidth: '130px', flex: '0 0 auto', padding: '0 10px' }}
                            value={s.mode}
                            onChange={e => update(s.id, { mode: e.target.value })}
                        >
                            <option value="app">تطبيق (App)</option>
                            <option value="web">متصفح (Web)</option>
                        </select>
                    </div>
                </div>
            ))}
            <button
                type="button"
                onClick={add}
                style={{ background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '6px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
                <Plus size={14} color="var(--orange-primary)" />
                <span>إضافة حساب واتساب</span>
            </button>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                المحادثة تُفتح دائماً إلى رقم المشترك. نمط «تطبيق» يفتح واتساب المثبت على الجهاز، ونمط «متصفح» يفتح واتساب ويب (يتيح حساباً ثانياً بالتوازي). تُحفظ هذه الإعدادات على هذا الجهاز فقط.
            </div>
        </div>
    );
}

/**
 * زر إرسال طريقة تفعيل U-Share (1323) عبر واتساب.
 * حساب واحد: يُطلق مباشرة. أكثر من حساب: قائمة اختيار مع ترس لتعديل الأرقام.
 */
export default function WhatsAppActivationButton({
    subscriberName,
    subscriberPhone,
    lockedLineNumber,
    quotaGB,
    shopName,
    variant = 'icon', // 'icon' | 'full'
    label
}) {
    const senders = useWhatsAppSenders();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const popRef = useRef(null);

    const launch = (sender) => {
        launchWhatsAppWithSender({ sender, subscriberName, subscriberPhone, lockedLineNumber, quotaGB, shopName });
        setOpen(false);
        setEditing(false);
    };

    const handleClick = (e) => {
        e.stopPropagation(); // لا نفتح مودال الخط عند الضغط من بطاقة
        if (senders.length === 1) {
            launch(senders[0]);
            return;
        }
        setOpen(o => !o);
    };

    // موضع القائمة بالنسبة للزر (fixed) مع إبقائها داخل الشاشة
    useLayoutEffect(() => {
        if (!open || !btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        const width = 270;
        const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
        const below = r.bottom + 6;
        const top = below + 260 > window.innerHeight ? Math.max(8, r.top - 6 - 260) : below;
        setPos({ top, left });
    }, [open, editing, senders.length]);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
            setOpen(false);
            setEditing(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setEditing(false); } };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const title = `إرسال طريقة التفعيل ${USHARE_ACTIVATION_SHORTCODE} عبر واتساب`;

    return (
        <>
            {variant === 'full' ? (
                <button
                    ref={btnRef}
                    type="button"
                    title={title}
                    onClick={handleClick}
                    style={{ width: '100%', height: '44px', borderRadius: '12px', border: 'none', background: '#25D366', color: '#fff', fontWeight: '900', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <MessageCircle size={18} />
                    <span>{label || `إرسال طريقة التفعيل واتساب (${USHARE_ACTIVATION_SHORTCODE})`}</span>
                </button>
            ) : (
                <button
                    ref={btnRef}
                    type="button"
                    title={title}
                    aria-label={title}
                    onClick={handleClick}
                    style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: '6px', padding: label ? '3px 7px' : '3px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, fontSize: '10px', fontWeight: 'bold' }}
                >
                    <MessageCircle size={12} />
                    {label && <span>{label}</span>}
                </button>
            )}

            {open && createPortal(
                <div
                    ref={popRef}
                    onClick={(e) => e.stopPropagation()}
                    className="tz-card"
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: '270px', maxHeight: '70vh', overflowY: 'auto', zIndex: 1000000, direction: 'rtl', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '900' }}>اختر حساب واتساب للإرسال</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                type="button"
                                onClick={() => setEditing(v => !v)}
                                title="إعداد أرقام الواتساب"
                                aria-label="إعداد أرقام الواتساب"
                                style={{ background: editing ? 'var(--orange-primary)' : 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: editing ? '#fff' : 'var(--text-main)', borderRadius: '8px', padding: '3px 5px', cursor: 'pointer', display: 'flex' }}
                            >
                                <Settings2 size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setOpen(false); setEditing(false); }}
                                aria-label="إغلاق"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {editing ? (
                        <>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>إعداد أرقام الواتساب</div>
                            <WhatsAppSendersEditor />
                        </>
                    ) : (
                        senders.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => launch(s)}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px 10px', cursor: 'pointer', color: 'var(--text-main)', textAlign: 'right' }}
                            >
                                <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '900' }}>{s.label || 'حساب واتساب'}</span>
                                    {s.phone && <span dir="ltr" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>{s.phone}</span>}
                                </span>
                                <span title={modeLabel(s.mode)}><Badge mode={s.mode} /></span>
                            </button>
                        ))
                    )}
                </div>,
                document.body
            )}
        </>
    );
}
