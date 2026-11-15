import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

const EXIT_MS = 220;

export default function ActionToast({ message, subMessage, onClose }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(onClose, EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        background: 'var(--bg-card)',
        border: '2px solid var(--orange-primary)',
        boxShadow: '0 16px 36px var(--orange-glow)',
        borderRadius: '24px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '290px',
        maxWidth: '92%',
        animation: leaving
          ? `toastFadeOut ${EXIT_MS}ms ease-in forwards`
          : 'toastDrop 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <CheckCircle2 size={22} color="var(--green)" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-main)' }}>
          {message}
        </span>
        {subMessage && (
          <span style={{ fontSize: '11px', color: 'var(--orange-primary)', fontWeight: 'bold', marginTop: '2px' }}>
            {subMessage}
          </span>
        )}
      </div>

      <style>{`
        @keyframes toastDrop {
          from { opacity: 0; transform: translate(-50%, -28px) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes toastFadeOut {
          from { opacity: 1; transform: translate(-50%, 0) scale(1); }
          to { opacity: 0; transform: translate(-50%, -10px) scale(0.96); }
        }
      `}</style>
    </div>
  );
}