import React from 'react';

export default function Navbar({ brandName = 'ZOLFA TECH', brandSubtitle = 'OS TELECOM', brandLogo = '' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px 8px',
      maxWidth: '440px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h1 className="brand-text-shimmer" style={{ margin: 0, fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px' }}>
          {brandName}
        </h1>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
          {brandSubtitle}
        </span>
      </div>

      {brandLogo ? (
        <div className="brand-logo-animated" style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-card-sub)',
          border: '1px solid var(--border-color)'
        }}>
          <img src={brandLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ) : (
        <div className="brand-logo-animated" style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #FF8800, #FF5500)',
          color: '#fff',
          fontWeight: '900',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          ZT
        </div>
      )}
    </div>
  );
}