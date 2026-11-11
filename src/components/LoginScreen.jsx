import React, { useState } from 'react';
import { Store, Lock, Mail, Phone, ArrowLeft, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function LoginScreen({ onLoginSuccess }) {
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [migrateExistingData, setMigrateExistingData] = useState(true);

    // حقول الإدخال
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [shopName, setShopName] = useState('ZOLFA TECH');
    const [shopPhone, setShopPhone] = useState('78877026');

    // استخراج البيانات المخزنة محلياً في المتصفح لترحيلها إن رغب المستخدم
    const getLocalDataPayload = () => ({
        brandConfig: JSON.parse(localStorage.getItem('tb_brand_config') || '{}'),
        exchangeRate: parseFloat(localStorage.getItem('tb_rate') || '89500'),
        sources: JSON.parse(localStorage.getItem('tb_sources') || '[]'),
        sims: JSON.parse(localStorage.getItem('tb_sims') || '[]'),
        lines: JSON.parse(localStorage.getItem('tb_locked_lines') || '[]'),
        debts: JSON.parse(localStorage.getItem('tb_debts') || '[]'),
        customers: JSON.parse(localStorage.getItem('tb_customers') || '[]'),
        expenses: JSON.parse(localStorage.getItem('tb_expenses') || '[]'),
        salesHistory: JSON.parse(localStorage.getItem('tb_sales_history') || '[]')
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegister) {
                // تسجيل متجر جديد
                await api.register({
                    email: email.trim(),
                    password: password.trim(),
                    name: shopName.trim(),
                    subtitle: 'OS TELECOM',
                    phone: shopPhone.trim()
                });

                // ترحيل البيانات السابقة إن وُجدت
                if (migrateExistingData) {
                    const payload = getLocalDataPayload();
                    await api.importLocalData(payload);
                }
            } else {
                // تسجيل دخول متجر قائم
                await api.login(email.trim(), password.trim());
            }

            onLoginSuccess();
        } catch (err) {
            setError(err.message || 'حدث خطأ في الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100dvh',
            background: 'radial-gradient(ellipse at center, #111827 0%, #06080e 70%, #020306 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            direction: 'rtl'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: '#0d111a',
                border: '1.5px solid rgba(255, 122, 0, 0.4)',
                borderRadius: '24px',
                padding: '28px 24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 122, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>

                {/* الهيدر والشعار */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '18px',
                        background: 'linear-gradient(145deg, #182030, #0c1018)',
                        border: '2px solid #FF7A00',
                        boxShadow: '0 0 20px rgba(255, 122, 0, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px'
                    }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: '#FF7A00' }}>ZT</span>
                    </div>

                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#fff' }}>
                        {isRegister ? 'إنشاء حساب متجر جديد' : 'تسجيل دخول المتجر'}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        منظومة إدارة الاتصالات والصناديق السحابية
                    </p>
                </div>

                {/* شريط التبديل بين الدخول والتسجيل */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '12px' }}>
                    <button
                        type="button"
                        onClick={() => { setIsRegister(false); setError(''); }}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: !isRegister ? '#FF7A00' : 'transparent',
                            color: !isRegister ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        تسجيل دخول
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsRegister(true); setError(''); }}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isRegister ? '#FF7A00' : 'transparent',
                            color: isRegister ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        إنشاء حساب جديد
                    </button>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #EF4444',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#EF4444',
                        fontSize: '11px',
                        fontWeight: 'bold'
                    }}>
                        <AlertCircle size={16} flexShrink={0} />
                        <span>{error}</span>
                    </div>
                )}

                {/* نموذج الإدخال */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {isRegister && (
                        <>
                            <div>
                                <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: '4px' }}>
                                    اسم المحل:
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Store size={15} style={{ position: 'absolute', right: '12px', top: '13px', color: 'rgba(255, 255, 255, 0.4)' }} />
                                    <input
                                        type="text"
                                        required
                                        placeholder="مثال: ZOLFA TECH"
                                        value={shopName}
                                        onChange={(e) => setShopName(e.target.value)}
                                        className="tz-input"
                                        style={{ paddingRight: '36px', height: '42px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: '4px' }}>
                                    رقم الهاتف:
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={15} style={{ position: 'absolute', right: '12px', top: '13px', color: 'rgba(255, 255, 255, 0.4)' }} />
                                    <input
                                        type="tel"
                                        required
                                        placeholder="مثال: 78877026"
                                        value={shopPhone}
                                        onChange={(e) => setShopPhone(e.target.value)}
                                        className="tz-input"
                                        style={{ paddingRight: '36px', height: '42px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: '4px' }}>
                            البريد الإلكتروني:
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={15} style={{ position: 'absolute', right: '12px', top: '13px', color: 'rgba(255, 255, 255, 0.4)' }} />
                            <input
                                type="email"
                                required
                                dir="ltr"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="tz-input"
                                style={{ paddingRight: '36px', height: '42px', fontSize: '13px', textAlign: 'left' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: '4px' }}>
                            كلمة المرور:
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={15} style={{ position: 'absolute', right: '12px', top: '13px', color: 'rgba(255, 255, 255, 0.4)' }} />
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="tz-input"
                                style={{ paddingRight: '36px', height: '42px', fontSize: '13px' }}
                            />
                        </div>
                    </div>

                    {isRegister && (
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color: '#10B981',
                            cursor: 'pointer',
                            background: 'rgba(16, 185, 129, 0.08)',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>
                            <input
                                type="checkbox"
                                checked={migrateExistingData}
                                onChange={(e) => setMigrateExistingData(e.target.checked)}
                                style={{ accentColor: '#10B981', width: '16px', height: '16px' }}
                            />
                            <span>ترحيل وحفظ بيانات المتصفح لهذا الحساب في السيرفر</span>
                        </label>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            height: '46px',
                            marginTop: '6px',
                            fontSize: '14px',
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? 'wait' : 'pointer'
                        }}
                    >
                        {loading ? (
                            <RefreshCw size={18} className="spin-icon" />
                        ) : (
                            <>
                                <span>{isRegister ? 'إنشاء الحساب ومزامنة المتجر' : 'دخول إلى المتجر'}</span>
                                <ArrowLeft size={16} />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)' }}>
                    <ShieldCheck size={13} color="#10B981" />
                    <span>بيانات كل متجر مشفرة ومعزولة بالكامل على السيرفر</span>
                </div>

            </div>
        </div>
    );
}