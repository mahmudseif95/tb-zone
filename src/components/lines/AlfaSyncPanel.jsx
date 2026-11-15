import React, { useState, useRef } from 'react';
import { ChevronDown, Link2, Loader2, ExternalLink, ClipboardPaste, Copy, Check } from 'lucide-react';
import { api } from '../../services/api';

/**
 * زر نسخ رقم بلمسة واحدة، لتسهيل لصقه في موقع Alfa.
 */
export function CopyPhoneButton({ phone }) {
    const [copied, setCopied] = useState(false);
    if (!phone) return null;

    const copy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(phone);
        } catch {
            // بعض المتصفحات تمنع الوصول للحافظة بدون تفاعل مباشر؛ نتجاهل الفشل الصامت هنا
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            type="button"
            onClick={copy}
            title="نسخ الرقم"
            className={`tactile${copied ? ' confirm-pulse' : ''}`}
            style={{
                background: copied ? 'var(--green)' : 'var(--bg-card-sub)',
                border: '1px solid var(--border-color)',
                color: copied ? '#fff' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '9px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                flexShrink: 0
            }}
        >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            <span>{copied ? 'تم النسخ ✓' : 'نسخ الرقم'}</span>
        </button>
    );
}

/**
 * قسم حفظ بيانات حساب Alfa الخاصة بالخط (اختياري). لا تُعاد كلمة المرور من السيرفر أبداً.
 * هذه البيانات لا تُستخدم حالياً لأي اتصال آلي بموقع Alfa (متوقف بانتظار API رسمي)، وتُحفظ
 * فقط لتُستخدم تلقائياً فور توفّر ذلك API دون أي خطوة إضافية من المستخدم.
 */
export default function AlfaSyncPanel({ line, onLinked }) {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    if (!line?.id) {
        return (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-card-sub)', padding: '8px', borderRadius: '10px' }}>
                يمكنك حفظ بيانات حساب Alfa اختيارياً بعد إضافة الخط، وفتح "لصق من Alfa" لمزامنة المشتركين يدوياً.
            </div>
        );
    }

    const handleSave = async () => {
        setBusy(true);
        setMsg(null);
        try {
            await api.saveAlfaCredentials(line.id, {
                ...(username.trim() ? { username: username.trim() } : {}),
                ...(password ? { password } : {})
            });
            setPassword('');
            setMsg({ type: 'ok', text: 'تم حفظ بيانات الحساب (مشفّرة)' });
            if (onLinked) onLinked();
        } catch (err) {
            setMsg({ type: 'err', text: err.message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="tz-card" style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-card-sub)' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="tactile"
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)', padding: 0 }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                    <Link2 size={14} />
                    بيانات حساب Alfa (اختياري)
                </span>
                <ChevronDown size={14} className={`chevron-rotate${open ? ' is-open' : ''}`} />
            </button>

            <div className={`collapsible-panel${open ? ' is-open' : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                        المزامنة الآلية المباشرة مع موقع Alfa متوقفة حالياً بانتظار واجهة API رسمية منهم.
                        استخدم الأزرار أدناه عند قائمة المشتركين ("فتح في Alfa" و"لصق من Alfa") لإدارتهم يدوياً الآن.
                    </div>
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
                    <button
                        type="button"
                        className="btn-primary tactile"
                        disabled={busy || (!username.trim() && !password)}
                        onClick={handleSave}
                        style={{ height: '38px', fontSize: '11px' }}
                    >
                        {busy ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
                        <span>حفظ بيانات الحساب</span>
                    </button>

                    {msg && (
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '8px', lineHeight: 1.6 }}>
                            {msg.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const ushareUrl = (phone) => `https://www.alfa.com.lb/en/account/manage-services/ushare?mobileNumber=${encodeURIComponent(phone || '')}`;

/**
 * شريط مزامنة U-Share اليدوي: فتح صفحة الخط على Alfa في المتصفح، ولصق نصها لتحليله
 * وحفظ المشتركين (الرقم والحصة والحالة) محلياً دون أي اتصال آلي بالموقع.
 */
export function AlfaManualSyncBar({ line, onFetched }) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [info, setInfo] = useState(null);
    const [justSynced, setJustSynced] = useState(false);
    const taRef = useRef(null);

    if (!line?.id || !(line.phoneNumber || line.number)) return null;
    const linePhone = line.phoneNumber || line.number;

    const submit = async (raw) => {
        const value = (raw ?? text).trim();
        if (!value || busy) return;
        setBusy(true);
        setErr(null);
        setInfo(null);
        try {
            const res = await api.parseAlfaUShareText(line.id, value);
            const { added, updated, overflow, mainInfo } = res.merge || {};
            const daysPart = Number.isFinite(mainInfo?.remainingDays) ? `تم التحديث: باقي ${mainInfo.remainingDays} يوم • ` : '';
            setInfo(`${daysPart}${added ?? 0} جديد، ${updated ?? 0} محدَّث` + (overflow ? ` — ${overflow} مشترك زائد لا يتّسع له الخط (الحد 3)` : ''));
            setText('');
            setDrawerOpen(false);
            setJustSynced(true);
            setTimeout(() => setJustSynced(false), 500);
            if (onFetched) onFetched(res.merge);
        } catch (e) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    };

    const pasteFromClipboard = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            if (clip && clip.trim()) {
                await submit(clip);
                return;
            }
            setErr('الحافظة فارغة. انسخ نص صفحة U-Share من Alfa (تحديد الكل ثم نسخ) وحاول مجدداً');
        } catch {
            // الموبايل غالباً يمنع قراءة الحافظة تلقائياً: نفتح مربع اللصق اليدوي بدلاً من ذلك
            setDrawerOpen(true);
            setErr('لا يمكن قراءة الحافظة تلقائياً على هذا المتصفح — الصق النص في المربع أدناه');
            setTimeout(() => taRef.current?.focus(), 50);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', padding: '8px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px dashed var(--orange-primary)' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <a
                    href={ushareUrl(linePhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tactile"
                    style={{ flex: '1 1 130px', height: '34px', textAlign: 'center', whiteSpace: 'nowrap', background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', padding: '0 8px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textDecoration: 'none' }}
                >
                    <ExternalLink size={12} />
                    <span>فتح في Alfa</span>
                </a>
                <button
                    type="button"
                    onClick={pasteFromClipboard}
                    disabled={busy}
                    className={`tactile${justSynced ? ' confirm-pulse' : ''}`}
                    style={{ flex: '1 1 130px', height: '34px', whiteSpace: 'nowrap', background: justSynced ? 'rgba(16, 185, 129, 0.15)' : 'transparent', border: `1px solid ${justSynced ? 'var(--green)' : 'var(--orange-primary)'}`, color: justSynced ? 'var(--green)' : 'var(--orange-primary)', borderRadius: '8px', padding: '0 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                    {busy ? <Loader2 size={12} className="spin" /> : justSynced ? <Check size={12} /> : <ClipboardPaste size={12} />}
                    <span>{justSynced ? 'تم الحفظ ✓' : 'لصق وحفظ من الحافظة'}</span>
                </button>
            </div>

            <button
                type="button"
                onClick={() => setDrawerOpen(o => !o)}
                className="tactile"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
                <span>{drawerOpen ? 'إخفاء مربع اللصق اليدوي' : 'أو الصق النص يدوياً هنا'}</span>
                <ChevronDown size={12} className={`chevron-rotate${drawerOpen ? ' is-open' : ''}`} />
            </button>

            <div className={`collapsible-panel${drawerOpen ? ' is-open' : ''}`}>
                <textarea
                    ref={taRef}
                    className="tz-input"
                    rows={4}
                    placeholder="افتح صفحة U-Share على Alfa، حدّد الكل وانسخ، ثم الصق هنا (يُحفظ تلقائياً فوراً)"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onPaste={(e) => {
                        const pasted = e.clipboardData?.getData('text');
                        if (pasted && pasted.trim()) {
                            e.preventDefault();
                            setText(pasted);
                            submit(pasted);
                        }
                    }}
                    style={{ width: '100%', fontSize: '11px', lineHeight: 1.6, resize: 'vertical' }}
                />
            </div>

            {err && <div style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 'bold' }}>{err}</div>}
            {info && <div style={{ fontSize: '10px', color: 'var(--green)', fontWeight: 'bold' }}>تم الحفظ في قاعدة البيانات: {info}</div>}
        </div>
    );
}
