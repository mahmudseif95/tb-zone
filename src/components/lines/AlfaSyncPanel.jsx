import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Link2, Loader2, DownloadCloud, MonitorUp } from 'lucide-react';
import { api } from '../../services/api';

const STATUS_META = {
    unlinked: { label: 'غير مرتبط', color: 'var(--text-muted)' },
    active: { label: 'متصل', color: 'var(--green)' },
    expired: { label: 'الجلسة منتهية', color: 'var(--orange-primary)' },
    error: { label: 'خطأ', color: 'var(--red)' }
};

export function AlfaStatusBadge({ status }) {
    const meta = STATUS_META[status] || STATUS_META.unlinked;
    return (
        <span style={{ fontSize: '10px', fontWeight: '900', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: '6px', padding: '1px 6px' }}>
            {meta.label}
        </span>
    );
}

/**
 * قسم ربط حساب Alfa Self-Care داخل مودال تعديل الخط المسكر.
 * كلمة المرور لا تُعاد من السيرفر أبداً؛ الحقل فارغ دائماً ويُرسل فقط عند إدخال قيمة جديدة.
 */
export default function AlfaSyncPanel({ line, onLinked }) {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [syncEnabled, setSyncEnabled] = useState(Boolean(line?.alfaSyncEnabled));
    const [status, setStatus] = useState(line?.alfaSessionStatus || 'unlinked');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null); // { type: 'ok' | 'err' | 'captcha', text }

    if (!line?.id) {
        return (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-card-sub)', padding: '8px', borderRadius: '10px' }}>
                يمكنك إدخال بيانات Alfa اختيارياً في الحقول أعلاه، أو ربط الحساب لاحقاً بفتح الخط للتعديل (مع ربط تفاعلي لحل CAPTCHA).
            </div>
        );
    }

    const save = async () => {
        await api.saveAlfaCredentials(line.id, {
            ...(username.trim() ? { username: username.trim() } : {}),
            ...(password ? { password } : {}),
            syncEnabled
        });
    };

    const handleConnect = async (interactive) => {
        setBusy(true);
        setMsg(null);
        try {
            await save();
            await api.connectAlfaSession(line.id, interactive);
            setStatus('active');
            setPassword('');
            setMsg({ type: 'ok', text: 'تم ربط الحساب والتحقق من صفحة U-Share بنجاح' });
            if (onLinked) onLinked();
        } catch (err) {
            const captcha = /CAPTCHA/i.test(err.message) || /كابتشا|CAPTCHA/.test(err.message);
            setStatus(captcha ? 'expired' : 'error');
            setMsg({ type: captcha ? 'captcha' : 'err', text: err.message });
        } finally {
            setBusy(false);
        }
    };

    const handleToggle = async (checked) => {
        setSyncEnabled(checked);
        try {
            await api.saveAlfaCredentials(line.id, { syncEnabled: checked });
            if (onLinked) onLinked();
        } catch (err) {
            setSyncEnabled(!checked);
            setMsg({ type: 'err', text: err.message });
        }
    };

    const msgColor = msg?.type === 'ok' ? 'var(--green)' : msg?.type === 'captcha' ? 'var(--orange-primary)' : 'var(--red)';

    return (
        <div className="tz-card" style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-card-sub)' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)', padding: 0 }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                    <Link2 size={14} />
                    ربط حساب Alfa Self-Care (مزامنة تلقائية)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlfaStatusBadge status={status} />
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>

            {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم المستخدم / رقم الخط على Alfa:</label>
                        <input
                            type="text"
                            autoComplete="off"
                            className="tz-input"
                            style={{ height: '38px' }}
                            placeholder={line.hasAlfaAccount ? 'محفوظ — اتركه فارغاً للإبقاء عليه' : '03123456'}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>كلمة المرور:</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            className="tz-input"
                            style={{ height: '38px' }}
                            placeholder={line.hasAlfaAccount ? '•••••••• (محفوظة ومشفّرة)' : 'كلمة مرور Alfa'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                        <span>مزامنة تلقائية مع موقع Alfa</span>
                        <input
                            type="checkbox"
                            checked={syncEnabled}
                            onChange={e => handleToggle(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--orange-primary)' }}
                        />
                    </label>

                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={busy || (!line.hasAlfaAccount && (!username.trim() || !password))}
                            onClick={() => handleConnect(false)}
                            style={{ flex: 1, height: '38px', fontSize: '11px' }}
                        >
                            {busy ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
                            <span>ربط وفحص الجلسة</span>
                        </button>
                        <button
                            type="button"
                            disabled={busy || (!line.hasAlfaAccount && (!username.trim() || !password))}
                            onClick={() => handleConnect(true)}
                            title="يفتح نافذة متصفح لحل CAPTCHA يدوياً مرة واحدة"
                            style={{ height: '38px', padding: '0 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '10px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--orange-primary)', color: 'var(--orange-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <MonitorUp size={14} />
                            <span>ربط تفاعلي</span>
                        </button>
                    </div>

                    {msg && (
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: msgColor, background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '8px', lineHeight: 1.6 }}>
                            {msg.text}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * شريط المزامنة داخل قسم المستخدمين: تبديل المزامنة التلقائية + جلب الأرقام والحصص الحية من Alfa.
 */
export function AlfaSubscriberBar({ line, enabled, onToggle, onFetched }) {
    const [busy, setBusy] = useState(false);
    const [subs, setSubs] = useState(null);
    const [err, setErr] = useState(null);

    if (!line?.id || !line.hasAlfaAccount) return null;

    const fetchLive = async () => {
        setBusy(true);
        setErr(null);
        try {
            const res = await api.getAlfaLiveStatus(line.id);
            setSubs(res.subscribers || []);
            if (onFetched) onFetched(res.subscribers || []);
        } catch (e) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', padding: '8px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px dashed var(--orange-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => onToggle(e.target.checked)}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--orange-primary)' }}
                    />
                    <span>مزامنة مع موقع Alfa تلقائياً</span>
                </label>
                <button
                    type="button"
                    onClick={fetchLive}
                    disabled={busy}
                    style={{ background: 'transparent', border: '1px solid var(--orange-primary)', color: 'var(--orange-primary)', borderRadius: '8px', padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    {busy ? <Loader2 size={12} className="spin" /> : <DownloadCloud size={12} />}
                    <span>جلب من Alfa</span>
                </button>
            </div>

            {err && <div style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 'bold' }}>{err}</div>}

            {subs && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {subs.length === 0 ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>لا يوجد مشتركون ثانويون على Alfa</span>
                    ) : subs.map(s => (
                        <div key={s.phone} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', background: 'var(--bg-card-sub)', padding: '3px 8px', borderRadius: '6px' }}>
                            <b>{s.phone}</b>
                            <span style={{ color: 'var(--orange-primary)', fontWeight: 'bold' }}>{s.quotaGB ?? '—'} GB</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
