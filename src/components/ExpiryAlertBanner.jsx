import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

export default function ExpiryAlertBanner({ lines, onNavigate }) {
  const expiringLines = lines.filter(line => {
    if (!line.expiryDate) return false;
    const diff = new Date(line.expiryDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 3 && days >= 0;
  });

  if (expiringLines.length === 0) return null;

  return (
    <div 
      onClick={() => onNavigate('lines')}
      style={{
        background: 'linear-gradient(135deg, rgba(255, 77, 77, 0.2), rgba(21, 24, 31, 0.95))',
        border: '1px solid var(--red)',
        borderRadius: '16px',
        padding: '10px 14px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertTriangle size={18} color="var(--red)" />
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
          تنبيه: يوجد {expiringLines.length} خط تنتهي صلاحيته خلال 3 أيام لتفادي خسارته!
        </span>
      </div>
      <ChevronRight size={16} color="var(--red)" />
    </div>
  );
}