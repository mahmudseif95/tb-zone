import React, { useState } from 'react';
import {
  TrendingUp,
  AlertCircle,
  Edit2,
  Check,
  X,
  BellRing,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const getDaysRemainingFromDate = (startDateStr, totalDays = 30) => {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return (parseInt(totalDays, 10) || 30) - elapsed;
};

export default function HomeDashboard({
  sources = [],
  salesHistory = [],
  lines = [],
  debts = [],
  customers = [],
  brandConfig = {},
  exchangeRate = 89500,
  onNavigate,
  onUpdateSourceBalance
}) {
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [tempBalanceUSD, setTempBalanceUSD] = useState('');
  const [tempBalanceLBP, setTempBalanceLBP] = useState('');
  const [isRadarExpanded, setIsRadarExpanded] = useState(true);

  const shopTitle = brandConfig?.name || 'ZOLFA TECH';

  // 1. احتساب السيولة النقدية الفعلية للعملتين بشكل مستقل
  const totalActualUSD = sources.reduce((sum, s) => sum + (parseFloat(s.balanceUSD ?? s.balance ?? 0) || 0), 0);
  const totalActualLBP = sources.reduce((sum, s) => sum + (parseFloat(s.balanceLBP || 0) || 0), 0);

  // 2. احتساب إجمالي الديون غير المسددة
  const totalUnpaidDebtsUSD = debts
    .filter(d => !d.paid)
    .reduce((sum, d) => {
      const val = parseFloat(d.amount) || 0;
      return sum + (d.currency === 'LBP' ? val / exchangeRate : val);
    }, 0);

  // 3. احتساب صافي أرباح اليوم الفورية
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = salesHistory.filter(s => s.date && s.date.startsWith(todayStr));

  let todayProfitsUSD = 0;
  todaySales.forEach(item => {
    if (item.profitUSD !== undefined) {
      todayProfitsUSD += parseFloat(item.profitUSD) || 0;
    } else {
      const sale = parseFloat(item.sellingPrice) || 0;
      const isLBP = item.currency === 'LBP';
      const saleUSD = isLBP ? sale / exchangeRate : sale;
      const costUSD = parseFloat(item.costUSD) || 0;
      todayProfitsUSD += Math.max(0, saleUSD - costUSD);
    }
  });

  // 4. بناء رادار التجديدات والديون المستحقة (Smart Renewal Radar)
  const findPhoneByName = (personName) => {
    if (!personName) return '';
    const clean = personName.trim().toLowerCase();
    const custMatch = customers.find(c => c.name && c.name.trim().toLowerCase() === clean && c.phone);
    if (custMatch) return custMatch.phone;
    const saleMatch = salesHistory.find(s => s.customerName && s.customerName.trim().toLowerCase() === clean && s.customerPhone);
    return saleMatch ? saleMatch.customerPhone : '';
  };

  const radarItems = [];

  // أ) اشتراكات U-Share / الخدمات التي باقٍ لها 3 أيام أو أقل
  lines.forEach((line) => {
    if (!line.hasService && !line.serviceActive) return;
    const remServiceDays = getDaysRemainingFromDate(line.serviceStartDate, line.serviceDays || 30);
    if (remServiceDays === null || remServiceDays > 3) return;

    const slots = [line.user1, line.user2, line.user3].filter(Boolean);
    if (line.type === 'open' && line.adminName) {
      slots.unshift(`${line.adminName} (${line.adminGB || '22'} GB)`);
    }

    if (slots.length === 0) {
      const linePhone = line.phoneNumber || line.number || '';
      const timeLabel = remServiceDays <= 0 ? 'منتهية اليوم' : `باقي ${remServiceDays} يوم`;
      const msg = `مرحباً، تنبيه من ${shopTitle}: باقة الإنترنت على الخط #${line.slotNumber} (${linePhone}) ${timeLabel}.`;
      radarItems.push({
        id: `rad_line_${line.id}`,
        kind: 'service',
        title: `خط #${line.slotNumber} (${linePhone || 'بدون رقم'})`,
        sub: `اشتراك خدمة U-Share • ${timeLabel}`,
        badge: timeLabel,
        isUrgent: remServiceDays <= 1,
        phone: linePhone,
        waMessage: msg
      });
    } else {
      slots.forEach((rawSlot, sIdx) => {
        const subName = rawSlot.split('(')[0].trim();
        const phone = (line.type === 'open' && sIdx === 0 && line.adminPhone)
          ? line.adminPhone
          : findPhoneByName(subName);
        const timeLabel = remServiceDays <= 0 ? 'ينتهي اليوم' : `باقي ${remServiceDays} يوم`;
        const msg = `مرحباً ${subName}، تحية طيبة من *${shopTitle}* 🌟\nنود تذكيرك بأن اشتراك الإنترنت (U-Share) الخاص بك ${remServiceDays <= 0 ? 'تنتهي صلاحيته اليوم' : `باقي له ${remServiceDays} ${remServiceDays === 1 ? 'يوم واحد' : 'أيام'} وينتهي`}.\nيرجى التواصل معنا في حال رغبت بالتجديد. أهلاً وسهلاً بك!`;

        radarItems.push({
          id: `rad_sub_${line.id}_${sIdx}`,
          kind: 'service',
          title: subName,
          sub: `اشتراك U-Share (خط #${line.slotNumber}) • ${rawSlot}`,
          badge: timeLabel,
          isUrgent: remServiceDays <= 1,
          phone,
          waMessage: msg
        });
      });
    }
  });

  // ب) ديون الزبائن والتجار المستحقة اليوم أو المتأخرة
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  debts.forEach((d) => {
    if (d.paid || d.category === 'boxes' || !d.dueDate) return;
    const due = new Date(d.dueDate);
    if (isNaN(due.getTime())) return;
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((due - todayMidnight) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return; // لم يحن موعده بعد

    const amtFormatted = d.currency === 'LBP'
      ? `${Math.round(parseFloat(d.amount) || 0).toLocaleString()} ل.ل`
      : `$${(parseFloat(d.amount) || 0).toFixed(2)}`;
    const phone = d.phone || findPhoneByName(d.name);
    const dueLabel = diffDays === 0 ? 'مستحق اليوم' : `متأخر ${Math.abs(diffDays)} يوم`;
    const msg = `مرحباً ${d.name}، تحية طيبة من *${shopTitle}* 🤝\nنود تذكيرك بلطف أن لديك دفعة مستحقة بقيمة *${amtFormatted}*${d.notes ? ` (${d.notes})` : ''}.\nنشكر تعاونك الدائم معنا!`;

    radarItems.push({
      id: `rad_debt_${d.id}`,
      kind: 'debt',
      title: d.name,
      sub: `ذمة مالية: ${amtFormatted}${d.notes ? ` • ${d.notes}` : ''}`,
      badge: dueLabel,
      isUrgent: diffDays < 0,
      phone,
      waMessage: msg
    });
  });

  const openWhatsAppReminder = (phone, message) => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    const waUrl = clean
      ? `https://wa.me/${clean.startsWith('961') ? clean : '961' + clean}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleStartEdit = (source) => {
    setEditingSourceId(source.id);
    setTempBalanceUSD((source.balanceUSD ?? source.balance ?? 0).toString());
    setTempBalanceLBP((source.balanceLBP || 0).toString());
  };

  const handleSaveBalance = (sourceId) => {
    const valUSD = parseFloat(tempBalanceUSD) || 0;
    const valLBP = parseFloat(tempBalanceLBP) || 0;
    if (onUpdateSourceBalance) {
      onUpdateSourceBalance(sourceId, valUSD, valLBP);
    }
    setEditingSourceId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      {/* بطاقة إجمالي السيولة النقدية بالعملتين المستقلتين */}
      <div className="tz-card" style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px' }}>
          إجمالي السيولة النقدية المتوفرة
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>رصيد الدولار الكاش ($)</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--orange-primary)', marginTop: '4px' }}>
              ${totalActualUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card-sub)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>رصيد الليرة الكاش (LBP)</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)', marginTop: '6px' }}>
              {Math.round(totalActualLBP).toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--orange-primary)' }}>ل.ل</span>
            </div>
          </div>
        </div>
      </div>

      {/* بطاقتي الأرباح والديون */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div
          onClick={() => onNavigate && onNavigate('analytics')}
          className="tz-card"
          style={{ padding: '14px', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold' }}>
            <TrendingUp size={14} color="var(--green)" />
            <span>أرباح اليوم</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--green)', marginTop: '4px' }}>
            +${todayProfitsUSD.toFixed(2)}
          </div>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('debts')}
          className="tz-card"
          style={{ padding: '14px', textAlign: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold' }}>
            <AlertCircle size={14} color="var(--red)" />
            <span>الديون الغير مسددة</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--red)', marginTop: '4px' }}>
            ${totalUnpaidDebtsUSD.toFixed(2)}
          </div>
        </div>
      </div>

      {/* رادار التجديدات والديون المستحقة (يظهر تلقائياً فقط عند وجود تنبيهات) */}
      {radarItems.length > 0 && (
        <div className="tz-card" style={{ padding: '12px 14px', border: '1px solid rgba(255, 122, 0, 0.35)' }}>
          <div
            onClick={() => setIsRadarExpanded(!isRadarExpanded)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <BellRing size={16} color="var(--orange-primary)" />
              <span style={{ fontWeight: '900', fontSize: '13px', color: 'var(--text-main)' }}>
                رادار التجديدات والديون المستحقة
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '900',
                background: 'rgba(255, 122, 0, 0.16)',
                color: 'var(--orange-primary)',
                padding: '2px 7px',
                borderRadius: '8px'
              }}>
                {radarItems.length}
              </span>
            </div>
            {isRadarExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>

          {isRadarExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
              {radarItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-card-sub)',
                    padding: '9px 11px',
                    borderRadius: '11px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '900', fontSize: '12px', color: 'var(--text-main)' }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '900',
                        padding: '1px 6px',
                        borderRadius: '5px',
                        background: item.isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 122, 0, 0.15)',
                        color: item.isUrgent ? 'var(--red)' : 'var(--orange-primary)'
                      }}>
                        {item.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.sub}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openWhatsAppReminder(item.phone, item.waMessage)}
                    style={{
                      background: '#25D366',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '9px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0
                    }}
                    title="إرسال تذكير جاهز عبر واتساب"
                  >
                    <MessageCircle size={13} />
                    <span>تذكير</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* أرصدة الصناديق النشطة مع إمكانية تعديل الدولار واللبناني معاً */}
      <div className="tz-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: '900', fontSize: '14px' }}>أرصدة الصناديق </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sources.length} صناديق</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sources.map(src => {
            const isEditing = editingSourceId === src.id;
            const balUSD = parseFloat(src.balanceUSD ?? src.balance ?? 0);
            const balLBP = parseFloat(src.balanceLBP || 0);

            return (
              <div
                key={src.id}
                style={{
                  background: 'var(--bg-card-sub)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: '800', fontSize: '13px' }}>{src.name}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>$:</span>
                          <input
                            type="number"
                            step="any"
                            value={tempBalanceUSD}
                            onChange={e => setTempBalanceUSD(e.target.value)}
                            className="tz-input"
                            style={{ width: '85px', height: '28px', padding: '2px 4px', fontSize: '12px', fontWeight: '900' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LBP:</span>
                          <input
                            type="number"
                            step="any"
                            value={tempBalanceLBP}
                            onChange={e => setTempBalanceLBP(e.target.value)}
                            className="tz-input"
                            style={{ width: '85px', height: '28px', padding: '2px 4px', fontSize: '12px', fontWeight: '900' }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveBalance(src.id)}
                        style={{ background: 'var(--orange-primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}
                        title="حفظ"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingSourceId(null)}
                        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}
                        title="إلغاء"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleStartEdit(src)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      title="اضغط لتعديل رصيد الدولار أو الليرة"
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '900', fontSize: '15px', color: 'var(--orange-primary)' }}>
                          ${balUSD.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-main)' }}>
                          {Math.round(balLBP).toLocaleString()} ل.ل
                        </div>
                      </div>
                      <Edit2 size={13} color="var(--text-muted)" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}