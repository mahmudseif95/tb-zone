import React, { useEffect, useState } from 'react';

export default function SplashScreen({ logo, brandName, onFinish }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFade(true);
    }, 1600);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      background: 'var(--bg-main)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'opacity 0.4s ease-out',
      opacity: fade ? 0 : 1,
      pointerEvents: fade ? 'none' : 'auto'
    }}>
      <div style={{
        width: '110px',
        height: '110px',
        borderRadius: '26px',
        background: 'var(--bg-card)',
        border: '2px solid var(--orange-primary)',
        boxShadow: '0 10px 30px var(--orange-glow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        animation: 'splashPulse 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite'
      }}>
        {logo ? (
          <img src={logo} alt="Logo" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--orange-primary)' }}>ZT</div>
        )}
      </div>

      <div style={{ marginTop: '18px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--orange-primary)', letterSpacing: '1px' }}>
          {brandName || 'ZOLFA TECH'}
        </h1>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
          Telecom Management System
        </span>
      </div>

      <style>{`
        @keyframes splashPulse {
          0% { transform: scale(0.92); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.92); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}