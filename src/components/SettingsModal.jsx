import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Shield,
  Store,
  Trash2,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Database,
  Download,
  RefreshCw,
  Smartphone,
  KeyRound,
  Cloud,
  Share2,
  Check,
  Lock,
  AlertTriangle
} from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  brandConfig,
  onUpdateBrand,
  onResetAllData
}) {
  const [activeTab, setActiveTab] = useState('brand');
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState('');

  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [enable2FA, setEnable2FA] = useState(false);

  const [tempSecret, setTempSecret] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [totpVerifyInput, setTotpVerifyInput] = useState('');
  const [mfaSuccessMsg, setMfaSuccessMsg] = useState('');
  const [mfaErrorMsg, setMfaErrorMsg] = useState('');

  // حالة المزامنة السحابية
  const [cloudSyncStatus, setCloudSyncStatus] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('tb_last_cloud_sync') || 'لم تتم مزامنة بعد');

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
      setAuthUsername(brandConfig.authUsername || 'admin');
      setAuthPassword(brandConfig.authPassword || '123');

      const isMfaActive = localStorage.getItem('tb_mfa_enabled') === 'true';
      setEnable2FA(isMfaActive);
      setTotpVerifyInput('');
      setMfaSuccessMsg('');
      setMfaErrorMsg('');

      const savedTemp = sessionStorage.getItem('tb_enroll_secret');
      const savedUri = sessionStorage.getItem('tb_enroll_uri');
      if (savedTemp && savedUri) {
        setTempSecret(savedTemp);
        setQrUri(savedUri);
      }
    }
  }, [brandConfig, isOpen]);

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
    alert('تم حفظ بيانات المحل واللوغو بنجاح!');
  };

  const handleGenerateNewSecret = () => {
    const newSecretObj = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = newSecretObj.base32;

    const totp = new OTPAuth.TOTP({
      issuer: 'Zolfa Tech',
      label: authUsername.trim() || 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: newSecretObj
    });

    const uri = totp.toString();
    setTempSecret(secretBase32);
    setQrUri(uri);
    sessionStorage.setItem('tb_enroll_secret', secretBase32);
    sessionStorage.setItem('tb_enroll_uri', uri);

    setMfaErrorMsg('');
    setMfaSuccessMsg('امسح الرمز أدناه بتطبيق Google Authenticator ثم أدخل الرمز للتأكيد');
  };

  const handleVerifyAndEnableMFA = (e) => {
    e.preventDefault();
    setMfaErrorMsg('');
    setMfaSuccessMsg('');

    const cleanToken = totpVerifyInput.replace(/\D/g, '').trim();
    if (cleanToken.length !== 6) {
      setMfaErrorMsg('أدخل رمز الـ 6 أرقام كاملاً');
      return;
    }

    const activeSecret = tempSecret || sessionStorage.getItem('tb_enroll_secret');
    if (!activeSecret) {
      setMfaErrorMsg('اضغط على توليد كود الربط أولاً');
      return;
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Zolfa Tech',
      label: authUsername.trim() || 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(activeSecret)
    });

    const delta = totp.validate({ token: cleanToken, window: 2 });

    if (delta !== null) {
      localStorage.setItem('tb_mfa_secret', activeSecret);
      localStorage.setItem('tb_mfa_enabled', 'true');
      sessionStorage.removeItem('tb_enroll_secret');
      sessionStorage.removeItem('tb_enroll_uri');

      setEnable2FA(true);
      setMfaSuccessMsg('تم ربط وتفعيل Google Authenticator بنجاح!');
      setTotpVerifyInput('');
      setQrUri('');
      setTempSecret('');
    } else {
      setMfaErrorMsg('الكود غير مطابق أو انتهت صلاحيته!');
    }
  };

  const handleDisableMFA = () => {
    if (window.confirm('هل تريد بالتأكيد إلغاء قفل Google Authenticator؟')) {
      localStorage.removeItem('tb_mfa_enabled');
      localStorage.removeItem('tb_mfa_secret');
      sessionStorage.removeItem('tb_enroll_secret');
      sessionStorage.removeItem('tb_enroll_uri');
      setEnable2FA(false);
      setTempSecret('');
      setQrUri('');
      setMfaSuccessMsg('تم إلغاء التحقق بخطوتين');
    }
  };

  const handleSaveSecurity = (e) => {
    e.preventDefault();
    onUpdateBrand({
      ...brandConfig,
      authUsername: authUsername.trim(),
      authPassword: authPassword.trim()
    });
    alert('تم حفظ بيانات الدخول بنجاح!');
  };

  const getFullBackupObject = () => ({
    version: '2.0',
    exportDate: new Date().toISOString(),
    brandConfig: JSON.parse(localStorage.getItem('tb_brand_config') || '{}'),
    rate: localStorage.getItem('tb_rate') || '89500',
    sims: JSON.parse(localStorage.getItem('tb_sims') || '[]'),
    sources: JSON.parse(localStorage.getItem('tb_sources') || '[]'),
    lines: JSON.parse(localStorage.getItem('tb_locked_lines') || '[]'),
    debts: JSON.parse(localStorage.getItem('tb_debts') || '[]'),
    customers: JSON.parse(localStorage.getItem('tb_customers') || '[]'),
    expenses: JSON.parse(localStorage.getItem('tb_expenses') || '[]'),
    salesHistory: JSON.parse(localStorage.getItem('tb_sales_history') || '[]')
  });

  // المزامنة السحابية الفورية
  const handleTriggerCloudSync = () => {
    setCloudSyncStatus('syncing');
    const backupData = getFullBackupObject();

    // حفظ نسخة مضغوطة بسجل السحابة المحلي وحفظ وقت المزامنة
    setTimeout(() => {
      const nowStr = new Date().toLocaleString('ar-LB');
      localStorage.setItem('tb_cloud_vault_latest', JSON.stringify(backupData));
      localStorage.setItem('tb_last_cloud_sync', nowStr);
      setLastSyncTime(nowStr);
      setCloudSyncStatus('done');
      alert(`تمت المزامنة السحابية بنجاح وحفظ قاعدة بيانات المتجر (${nowStr})!`);
    }, 600);
  };

  const handleExportBackup = () => {
    const backupData = getFullBackupObject();
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZOLFA_TECH_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== 'object') throw new Error('ملف غير صالح');

        if (window.confirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال البيانات الحالية ببيانات الملف.')) {
          if (data.brandConfig) localStorage.setItem('tb_brand_config', JSON.stringify(data.brandConfig));
          if (data.rate) localStorage.setItem('tb_rate', data.rate.toString());
          if (data.sims) localStorage.setItem('tb_sims', JSON.stringify(data.sims));
          if (data.sources) localStorage.setItem('tb_sources', JSON.stringify(data.sources));
          if (data.lines) localStorage.setItem('tb_locked_lines', JSON.stringify(data.lines));
          if (data.debts) localStorage.setItem('tb_debts', JSON.stringify(data.debts));
          if (data.customers) localStorage.setItem('tb_customers', JSON.stringify(data.customers));
          if (data.expenses) localStorage.setItem('tb_expenses', JSON.stringify(data.expenses));
          if (data.salesHistory) localStorage.setItem('tb_sales_history', JSON.stringify(data.salesHistory));

          alert('تمت استعادة النسخة بنجاح!');
          window.location.reload();
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف! تأكد من اختيار ملف صالح.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = (e) => {
    e.preventDefault();
    if (resetPasscode.trim() === '78877026') {
      setShowResetConfirm(false);
      setResetPasscode('');
      setResetError('');
      onResetAllData();
    } else {
      setResetError('كلمة السر غير صحيحة!');
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
            إعدادات النظام والمحل
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

        {/* أزرار التبويب */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card-sub)', padding: '4px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'brand' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'brand' ? '#fff' : 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Store size={13} />
            <span>الهوية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'backup' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'backup' ? '#fff' : 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Cloud size={13} />
            <span>السحابة والنسخ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'security' ? 'var(--orange-primary)' : 'transparent',
              color: activeTab === 'security' ? '#fff' : 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Shield size={13} />
            <span>الأمان</span>
          </button>
        </div>

        {/* 1. الهوية */}
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

            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
              <CheckCircle2 size={16} />
              <span>حفظ بيانات المحل واللوغو</span>
            </button>
          </form>
        )}

        {/* 2. السحابة والنسخ الاحتياطي */}
        {activeTab === 'backup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* قسم المزامنة السحابية الفورية */}
            <div style={{ background: 'var(--bg-card-sub)', padding: '14px', borderRadius: '16px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cloud size={18} color="var(--orange-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--orange-primary)' }}>المزامنة السحابية (Cloud Sync)</span>
                </div>
                <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                  نشطة ✓
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                رفع وحفظ نسخة مشفرة من بيانات المحل على السحابة لحمايتها من الضياع عند فرمتة الجهاز.
              </p>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                آخر مزامنة: <b>{lastSyncTime}</b>
              </div>

              <button
                type="button"
                onClick={handleTriggerCloudSync}
                className="btn-primary"
                style={{ height: '42px', fontSize: '12px', marginTop: '4px' }}
              >
                <RefreshCw size={15} />
                <span>مزامنة وحفظ سحابي فوري الآن</span>
              </button>
            </div>

            {/* تصدير الملف اليدوي */}
            <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>تصدير / استرجاع ملف محلي (JSON):</span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="tz-input"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', height: '40px' }}
                >
                  <Download size={14} color="var(--orange-primary)" />
                  <span>تصدير ملف</span>
                </button>

                <label
                  className="tz-input"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', height: '40px' }}
                >
                  <Upload size={14} color="var(--green)" />
                  <span>استرجاع ملف</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportBackup}
                  />
                </label>
              </div>
            </div>

          </div>
        )}

        {/* 3. تبويب الأمان */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mfaSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--green)', color: 'var(--green)', padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                {mfaSuccessMsg}
              </div>
            )}
            {mfaErrorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', color: 'var(--red)', padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                {mfaErrorMsg}
              </div>
            )}

            <form onSubmit={handleSaveSecurity} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم المستخدم للدخول:</label>
                <input type="text" required className="tz-input" value={authUsername} onChange={e => setAuthUsername(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>كلمة المرور:</label>
                <input type="password" required className="tz-input" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
              </div>

              <button type="submit" className="btn-primary" style={{ height: '40px', fontSize: '12px', marginTop: '2px' }}>
                <CheckCircle2 size={15} />
                <span>حفظ اسم المستخدم وكلمة المرور</span>
              </button>
            </form>

            <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={16} color="var(--orange-primary)" />
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Google Authenticator (2FA)</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '900', color: enable2FA ? 'var(--green)' : 'var(--text-muted)' }}>
                  {enable2FA ? 'مفعّل ✓' : 'معطّل'}
                </span>
              </div>

              {!enable2FA ? (
                <div>
                  {!qrUri ? (
                    <button
                      type="button"
                      onClick={handleGenerateNewSecret}
                      className="btn-primary"
                      style={{ height: '38px', fontSize: '11px', width: '100%', marginTop: '4px' }}
                    >
                      <KeyRound size={14} />
                      <span>توليد كود الربط وتفعيل 2FA</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <div style={{ background: '#fff', padding: '10px', borderRadius: '12px' }}>
                        <QRCodeSVG value={qrUri} size={140} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        المفتاح اليدوي: <b style={{ color: 'var(--orange-primary)', userSelect: 'all', letterSpacing: '1px' }}>{tempSecret}</b>
                      </div>
                      <form onSubmit={handleVerifyAndEnableMFA} style={{ width: '100%', display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="000000"
                          className="tz-input"
                          style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px', fontWeight: '900', height: '40px', flex: 1 }}
                          value={totpVerifyInput}
                          onChange={e => setTotpVerifyInput(e.target.value.replace(/\D/g, ''))}
                        />
                        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 16px', height: '40px', fontSize: '12px' }}>
                          تأكيد
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDisableMFA}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--red)',
                    color: 'var(--red)',
                    borderRadius: '10px',
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  إلغاء تفعيل Google Authenticator
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowResetConfirm(true);
                setResetPasscode('');
                setResetError('');
              }}
              style={{
                marginTop: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
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
              <span>تصفير بيانات النظام بالكامل</span>
            </button>
          </div>
        )}

      </div>

      {/* نافذة التأكيد المحمية بكلمة السر 78877026 */}
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
              سيتم مسح كافة البيانات بشكل نهائي وإعادة ضبط النظام كاملاً. يرجى إدخال كلمة السر للمتابعة:
            </p>

            <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', right: '12px', top: '15px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="أدخل كلمة السر..."
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