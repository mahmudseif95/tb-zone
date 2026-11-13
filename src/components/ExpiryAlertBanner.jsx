import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

export default function ExpiryAlertBanner({ lines = [], onNavigate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiringLines = lines.filter(line => {
    let expiryTime = null;

    if (line.expiryDate) {
      expiryTime = new Date(line.expiryDate).getTime();
    } else {
      const startStr = line.serviceStartDate || line.service_start_date || line.validityStartDate;
      const daysNum = parseInt(line.serviceDays || line.service_days || line.validityDays || 0, 10);
      if (startStr && daysNum > 0) {
        const startDate = new Date(startStr);
        startDate.setHours(0, 0, 0, 0);
        expiryTime = startDate.getTime() + daysNum * 24 * 60 * 60 * 1000;
      }
    }

    if (!expiryTime || Number.isNaN(expiryTime)) return false;

    const diffDays = Math.ceil((expiryTime - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
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
          تنبيه: يوجد {expiringLines.length} خط منتهي أو تنتهي صلاحيته خلال 3 أيام!
        </span>
      </div>
      <ChevronRight size={16} color="var(--red)" />
    </div>
  );
}