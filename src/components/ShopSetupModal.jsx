import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Store, Phone, Type, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function ShopSetupModal({ isOpen, onComplete }) {
    const [name, setName] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [phone, setPhone] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const currentYear = new Date().getFullYear();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim() || isSaving) return;

        const payload = {
            name: name.trim(),
            subtitle: subtitle.trim(),
            phone: phone.trim()
        };

        try {
            setIsSaving(true);
            await api.updateBrand(payload);
            localStorage.setItem('tb_brand_config', JSON.stringify(payload));
            if (onComplete) onComplete(payload);
        } catch (err) {
            alert('فشل حفظ بيانات المحل: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="modal-overlay" style={{ zIndex: 999999 }}>
            <div className="modal-center" style={{ maxWidth: '400px', textAlign: 'right', direction: 'rtl' }}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '16px',
                        background: 'var(--orange-subtle)',
                        color: 'var(--orange-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px'
                    }}>
                        <Store size={28} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>
                        إعداد هوية المتجر
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        أدخل بيانات محلك لتظهر على الفواتير وتقارير الواتساب الخاصة بزبائنك
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Store size={13} color="var(--orange-primary)" />
                            <span>اسم المحل / المتجر (مطلوب):</span>
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="مثال: سنتر النور للاتصالات..."
                            className="tz-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Type size={13} color="var(--orange-primary)" />
                            <span>العبارة الفرعية تحت الاسم (اختياري):</span>
                        </label>
                        <input
                            type="text"
                            placeholder="مثال: بيع وصيانة هواتف وخدمات اتصالات..."
                            className="tz-input"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Phone size={13} color="var(--orange-primary)" />
                            <span>رقم هاتف المحل (مطلوب):</span>
                        </label>
                        <input
                            type="tel"
                            required
                            placeholder="مثال: 70123456"
                            className="tz-input"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="btn-primary"
                        style={{ marginTop: '6px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isSaving ? 0.6 : 1 }}
                    >
                        {isSaving ? <RefreshCw size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                        <span>{isSaving ? 'جاري الحفظ...' : 'حفظ الهوية وبدء العمل'}</span>
                    </button>
                </form>

                <div style={{
                    marginTop: '16px',
                    paddingTop: '10px',
                    borderTop: '1px dashed var(--border-color)',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    direction: 'ltr'
                }}>
                    By <strong style={{ color: 'var(--orange-primary)' }}>Zolfa Tech Est</strong> • © {currentYear}
                </div>
            </div>
        </div>,
        document.body
    );
}