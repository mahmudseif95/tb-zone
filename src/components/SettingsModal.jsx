import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WhatsAppSendersEditor } from './lines/WhatsAppActivationButton';
import { api } from '../services/api';
import {
  X,
  Store,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  Lock,
  AlertTriangle,
  UserCircle2,
  Mail,
  ShieldCheck,
  LogOut
} from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  brandConfig,
  onUpdateBrand,
  onLogout,
  onResetAllData
}) {
  const [activeTab, setActiveTab] = useState('brand'); // 'brand' | 'account'

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState('');

  // بيانات الحساب (البريد) من السيرفر — تُجلَب مرة عند فتح المودال
  const [accountEmail, setAccountEmail] = useState('');

  // نافذة تأكيد تصفير النظام برمز الأمان
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPasscode, setResetPasscode] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    if (brandConfig && isOpen) {
      setName(brandConfig.name || 'ZOLFA TECH');
      setSubtitle(brandConfig.subtitle || 'OS TELECOM');
      setPhone(brandConfig.phone || '78877026');
      setLogo(brandConfig.logo || '');
    }
  }, [brandConfig, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    api.getMe()
      .then(res => setAccountEmail(res?.shop?.email || ''))
      .catch(() => { });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogoFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً! يرجى اختيار صورة أصغر من 2 ميغابايت.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBrand = (e) => {
    e.preventDefault();
    onUpdateBrand({
      ...brandConfig,
      name: name.trim(),
      subtitle: subtitle.trim(),
      phone: phone.trim(),
      logo: logo
    });
    alert('تم حفظ بيانات المحل واللوغو وتحديثها في السيرفر بنجاح!');
  };

  const handleConfirmReset = (e) => {
    e.preventDefault();
    if (resetPasscode.trim() === '78877026') {
      setShowResetConfirm(false);
      setResetPasscode('');
      setResetError('');
      onResetAllData();
    } else {
      setResetError('رمز التأكيد غير صحيح!');
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '16px',
        direction: 'rtl'
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '24px',
          padding: '20px',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>
            إعدادات النظام والمتجر
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-card-sub)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* أزرار التبويب الأساسية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'var(--bg-card-sub)', padding: '4px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'brand' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'brand' ? '#fff' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Store size={15} />
            <span>هوية المحل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('account')}
            style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'account' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'account' ? '#fff' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <UserCircle2 size={15} />
            <span>الحساب والخروج</span>
          </button>
        </div>

        {/* 1. هوية المحل */}
        {activeTab === 'brand' && (
          <form onSubmit={handleSaveBrand} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>اسم المحل / الشركة:</label>
              <input
                type="text"
                required
                className="tz-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>النص التوضيحي أسفل الاسم:</label>
              <input
                type="text"
                className="tz-input"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>رقم هاتف المحل (للفواتير والإيصالات):</label>
              <input
                type="tel"
                required
                placeholder="78877026"
                className="tz-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>شعار المحل (لوغو كصورة):</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  border: '2px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-card-sub)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {logo ? (
                    <img src={logo} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={22} color="var(--text-muted)" />
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="logo-file-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'var(--bg-card-sub)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  >
                    <Upload size={16} color="var(--orange-primary)" />
                    <span>اختر صورة اللوغو من جهازك</span>
                  </label>
                  <input
                    id="logo-file-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoFileUpload}
                  />

                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--red)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        marginTop: '2px'
                      }}
                    >
                      إزالة الصورة الحالية
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--orange-primary)' }}>حسابات واتساب (إرسال طريقة تفعيل U-Share 1323)</span>
              <WhatsAppSendersEditor />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
              <CheckCircle2 size={16} />
              <span>حفظ بيانات المحل واللوغو</span>
            </button>
          </form>
        )}

        {/* 2. الحساب والخروج */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* بطاقة معلومات الحساب */}
            <div style={{ background: 'var(--bg-card-sub)', padding: '14px', borderRadius: '16px', border: '1.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--orange-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserCircle2 size={24} color="var(--orange-primary)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {brandConfig?.name || 'المحل'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم المحل</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <Mail size={14} color="var(--orange-primary)" style={{ flexShrink: 0 }} />
                <span dir="ltr" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {accountEmail || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <ShieldCheck size={14} color="var(--green)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>مالك المحل (صلاحية كاملة)</span>
              </div>
            </div>

            {/* زر تسجيل الخروج */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('هل تريد بالتأكيد تسجيل الخروج من هذا الحساب؟')) {
                  if (onLogout) onLogout();
                }
              }}
              className="btn-primary"
              style={{ height: '44px', fontSize: '12px' }}
            >
              <LogOut size={16} />
              <span>تسجيل الخروج من الحساب</span>
            </button>

            {/* تصفير البيانات بحماية رمز المرور */}
            <div style={{ marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(true);
                  setResetPasscode('');
                  setResetError('');
                }}
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid var(--red)',
                  color: 'var(--red)',
                  borderRadius: '12px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={14} />
                <span>تصفير ومسح بيانات النظام بالكامل</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* نافذة التأكيد المحمية برمز الأمان 78877026 */}
      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000000,
            padding: '16px',
            direction: 'rtl'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--red)',
              borderRadius: '20px',
              padding: '20px',
              width: '100%',
              maxWidth: '350px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
              <AlertTriangle size={20} />
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>
                تأكيد تصفير ومسح البيانات
              </h4>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
              سيتم مسح كافة البيانات بشكل نهائي وإعادة ضبط النظام كاملاً. أدخل رمز التأكيد للمتابعة:
            </p>

            <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', right: '12px', top: '15px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="أدخل رمز التأكيد..."
                  className="tz-input"
                  value={resetPasscode}
                  onChange={(e) => {
                    setResetPasscode(e.target.value);
                    setResetError('');
                  }}
                  autoFocus
                  style={{ paddingRight: '36px', height: '44px', fontWeight: 'bold', letterSpacing: '2px', textAlign: 'center' }}
                />
              </div>

              {resetError && (
                <div style={{ color: 'var(--red)', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
                  {resetError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <button
                  type="submit"
                  style={{
                    background: 'var(--red)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    height: '40px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  تأكيد المسح
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetPasscode('');
                    setResetError('');
                  }}
                  style={{
                    background: 'var(--bg-card-sub)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    height: '40px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}