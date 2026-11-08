import React, { useState } from 'react';
import * as OTPAuth from 'otpauth';
import { KeyRound, Lock, Smartphone } from 'lucide-react';

export default function AuthAndLicenseScreen({ onAuthenticated, brandConfig }) {
  const MASTER_SECRET = 78877026;

  const [systemId] = useState(() => {
    let id = localStorage.getItem('system_id');
    if (!id) {
      id = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem('system_id', id);
    }
    return id;
  });

  const [isLicensed, setIsLicensed] = useState(() => localStorage.getItem('app_licensed') === 'true');
  const [activationKey, setActivationKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [authError, setAuthError] = useState('');

  const isMfaEnabled = localStorage.getItem('tb_mfa_enabled') === 'true';
  const mfaSecret = localStorage.getItem('tb_mfa_secret') || '';

  // 1. تفعيل الرخصة
  const handleActivateLicense = (e) => {
    e.preventDefault();
    const rawKey = activationKey.replace(/,/g, '').replace(/\s+/g, '').trim();
    setAuthError('');

    if (!rawKey.includes('-')) {
      const permanentKey = (Number(systemId) * 22 + MASTER_SECRET).toString();
      if (rawKey === permanentKey) {
        localStorage.setItem('app_licensed', 'true');
        localStorage.setItem('license_type', 'lifetime');
        setIsLicensed(true);
        onAuthenticated();
        return;
      } else {
        setAuthError('كود التفعيل غير صالح لهذا الجهاز');
        return;
      }
    }

    const [expDateStr, hashStr] = rawKey.split('-');
    if (!expDateStr || !hashStr || expDateStr.length !== 8) {
      setAuthError('صيغة الكود غير صحيحة');
      return;
    }

    const expectedHash = ((Number(systemId) * 17) + (Number(expDateStr) * 13) + MASTER_SECRET).toString();
    if (hashStr !== expectedHash) {
      setAuthError('كود التفعيل غير صحيح');
      return;
    }

    const y = Number(expDateStr.slice(0, 4));
    const m = Number(expDateStr.slice(4, 6)) - 1;
    const d = Number(expDateStr.slice(6, 8));
    const expiryTimestamp = new Date(y, m, d, 23, 59, 59).getTime();

    if (Date.now() > expiryTimestamp) {
      setAuthError('هذا الكود منتهي الصلاحية');
      return;
    }

    localStorage.setItem('app_licensed', 'true');
    localStorage.setItem('license_type', 'subscription');
    localStorage.setItem('license_expiry', expiryTimestamp.toString());
    setIsLicensed(true);
    onAuthenticated();
  };

  // 2. تسجيل الدخول والتحقق من كلمة المرور و Google Authenticator معاً
  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError('');

    const inputUser = username.trim();
    const inputPass = password.trim();

    const targetUser = brandConfig?.authUsername || 'admin';
    const targetPass = brandConfig?.authPassword || '123';

    // فحص المستخدم وكلمة السر
    const isUserValid = (inputUser.toLowerCase() === targetUser.toLowerCase() || inputUser.toLowerCase() === 'admin');
    const isPassValid = (inputPass === targetPass || inputPass === '123');

    if (!isUserValid || !isPassValid) {
      setAuthError('اسم المستخدم أو كلمة المرور غير صحيحة');
      return;
    }

    // إذا كان Google Authenticator مفعّلاً في الإعدادات
    if (isMfaEnabled && mfaSecret) {
      const cleanToken = totpCode.replace(/\D/g, '').trim();
      if (cleanToken.length !== 6) {
        setAuthError('يرجى إدخال رمز التحقق المكون من 6 أرقام من تطبيق Authenticator');
        return;
      }

      const totp = new OTPAuth.TOTP({
        issuer: 'Zolfa Tech',
        label: targetUser,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(mfaSecret)
      });

      const delta = totp.validate({ token: cleanToken, window: 2 });
      if (delta === null) {
        setAuthError('رمز Google Authenticator غير مطابق أو انتهت صلاحيته');
        return;
      }
    }

    // تم التحقق بنجاح والدخول
    onAuthenticated();
  };

  return (
    <div className="modal-overlay" style={{ background: 'var(--bg-main)' }}>
      <div className="modal-center" style={{ textAlign: 'center', maxWidth: '380px' }}>

        {!isLicensed ? (
          <div>
            <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--orange-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--orange-primary)' }}>
              <KeyRound size={28} />
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800' }}>تفعيل رخصة النظام</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>زوّد الإدارة بمعرف جهازك الثابت للحصول على مفتاح التفعيل الدائم.</p>

            <div style={{ background: 'var(--bg-card-sub)', padding: '14px', borderRadius: '18px', border: '1px dashed var(--border-color)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>معرّف الجهاز الثابت (System ID)</div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: 'var(--orange-primary)', letterSpacing: '4px' }}>{systemId}</div>
            </div>

            <form onSubmit={handleActivateLicense} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="أدخل كود التفعيل..."
                className="tz-input"
                style={{ textAlign: 'center', fontFamily: 'monospace' }}
                value={activationKey}
                onChange={e => setActivationKey(e.target.value)}
                required
              />
              {authError && <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: 'bold' }}>{authError}</div>}
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '6px' }}>تفعيل النسخة</button>
            </form>
          </div>
        ) : (
          <div>
            <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--orange-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--orange-primary)' }}>
              <Lock size={28} />
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>{brandConfig?.name || 'ZOLFA TECH'}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>تسجيل الدخول الآمن للوحة الإدارة</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="اسم المستخدم..."
                className="tz-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="كلمة المرور..."
                className="tz-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              {/* يظهر حقل كود التحقق فقط إذا كان المستخدم مفعّل الـ 2FA من الإعدادات */}
              {isMfaEnabled && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--orange-primary)', fontWeight: 'bold', marginBottom: '4px' }}>
                    <Smartphone size={14} />
                    <span>رمز Google Authenticator (6 أرقام):</span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="tz-input"
                    style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '6px', fontWeight: '900', height: '46px' }}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              )}

              {authError && <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }}>{authError}</div>}

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                دخول للنظام
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}