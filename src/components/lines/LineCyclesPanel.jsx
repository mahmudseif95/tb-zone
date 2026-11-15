import React, { useState } from 'react';
import { ChevronDown, History, Loader2, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';

const REASON_LABEL = {
    expired: 'انتهاء الدورة تلقائياً (30 يوم)',
    new_cycle: 'بدء دورة جديدة',
    manual: 'تصفير يدوي',
    manual_test: 'تصفير يدوي'
};

const fmtDateTime = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v).split('T')[0] : d.toLocaleString('ar-LB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * سجل الدورات السابقة لخط (مسكر أو مفتوح) وزر إنهاء الدورة الحالية وتصفير الخط يدوياً.
 * يؤرشف كل المشتركين وحصة الأدمن (إن وُجدت) في جدول line_cycles قبل تصفيرها.
 */
export default function LineCyclesPanel({ line, onReset }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cycles, setCycles] = useState(null);
    const [err, setErr] = useState(null);
    const [resetting, setResetting] = useState(false);

    if (!line?.id) return null;

    const loadCycles = async () => {
        setLoading(true);
        setErr(null);
        try {
            const res = await api.getLineCycles(line.id);
            setCycles(res.cycles || []);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next && cycles === null) loadCycles();
    };

    const handleArchiveReset = async () => {
        if (!window.confirm('سيتم أرشفة كل المشتركين وحصة الأدمن الحاليين في سجل الدورات، ثم تصفير الخط بالكامل (إيقاف الخدمة وحذف الخانات). هل تريد المتابعة؟')) return;
        setResetting(true);
        setErr(null);
        try {
            await api.archiveResetLine(line.id);
            setCycles(null);
            if (open) await loadCycles();
            if (onReset) onReset();
        } catch (e) {
            setErr(e.message);
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="tz-card" style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-card-sub)' }}>
            <button
                type="button"
                onClick={toggle}
                className="tactile"
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)', padding: 0 }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                    <History size={14} />
                    سجل الدورات السابقة
                </span>
                <ChevronDown size={14} className={`chevron-rotate${open ? ' is-open' : ''}`} />
            </button>

            <div className={`collapsible-panel${open ? ' is-open' : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={handleArchiveReset}
                        disabled={resetting}
                        className="tactile"
                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '10px', height: '38px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        {resetting ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                        <span>إنهاء الدورة وتصفير الخط</span>
                    </button>

                    {err && <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 'bold' }}>{err}</div>}

                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
                            <Loader2 size={16} className="spin" color="var(--orange-primary)" />
                        </div>
                    )}

                    {!loading && cycles && cycles.length === 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '6px' }}>
                            لا توجد دورات سابقة مؤرشَفة لهذا الخط
                        </div>
                    )}

                    {!loading && cycles && cycles.map((c) => (
                        <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)', flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}>{REASON_LABEL[c.reason] || c.reason}</span>
                                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDateTime(c.expiredAt)}</span>
                            </div>
                            {c.slots.length === 0 ? (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>لم يكن هناك مشتركون مسجَّلون</span>
                            ) : c.slots.map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                                    <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.slot === 'admin' ? 'الأدمن: ' : ''}{s.name}{s.phone ? ` (${s.phone})` : ''}
                                    </span>
                                    <span style={{ color: 'var(--orange-primary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        {s.usedGB ?? '—'} / {s.quotaGB ?? '—'} GB
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
