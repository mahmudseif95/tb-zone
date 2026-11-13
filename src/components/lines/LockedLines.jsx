import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronLeft,
    Plus
} from 'lucide-react';
import LineDetailsModal from './LineDetailsModal';

// تحليل آمن للتاريخ بصيغة YYYY-MM-DD أولاً
const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const clean = dateStr.toString().split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
};

export default function LockedLines({
    lines = [],
    customers = [],
    onAddLine,
    onUpdateLine,
    onDeleteLine,
    onRecordSaleFromLine
}) {
    const [activeTab, setActiveTab] = useState('locked'); // 'locked' | 'open'
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    const [activeModal, setActiveModal] = useState(null); // 'add' | 'details'
    const [selectedLine, setSelectedLine] = useState(null);

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthNames = [
        'كانون الثاني (1)', 'شباط (2)', 'آذار (3)', 'نيسان (4)',
        'أيار (5)', 'حزيران (6)', 'تموز (7)', 'آب (8)',
        'أيلول (9)', 'تشرين الأول (10)', 'تشرين الثاني (11)', 'كانون الأول (12)'
    ];

    const lockedLines = lines.filter(l => (l.type || 'locked') === 'locked');
    const openLines = lines.filter(l => l.type === 'open');
    const currentList = activeTab === 'locked' ? lockedLines : openLines;

    // صلاحية الخط بالأيام (تزيد مع كروت الشحن)
    const getRemainingValidity = (line) => {
        const total = Number(line.validityDays) || 0;
        const start = parseLocalDate(line.validityStartDate);
        if (!start) return total;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const rem = total - diff;
        return rem > 0 ? rem : 0;
    };

    // مدة الخدمة الشهرية (ثابتة 30 يوم فقط)
    const getServiceStatus = (line) => {
        if (!line.hasService || !line.serviceStartDate) {
            return { active: false, remainingDays: 0 };
        }
        const start = parseLocalDate(line.serviceStartDate);
        if (!start) return { active: false, remainingDays: 0 };

        const expiry = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diffMs = expiry.getTime() - now.getTime();
        const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return {
            active: remainingDays > 0,
            remainingDays: remainingDays > 0 ? remainingDays : 0
        };
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
        setSelectedDay(null);
    };

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
        setSelectedDay(null);
    };

    const displayedLines = selectedDay === 'unassigned'
        ? currentList.filter(l => !l.hasService || !l.serviceStartDate)
        : selectedDay
            ? currentList.filter(l => {
                if (!l.hasService || !l.serviceStartDate) return false;
                const sDate = parseLocalDate(l.serviceStartDate);
                if (!sDate) return false;
                return sDate.getDate() === selectedDay &&
                    sDate.getMonth() === currentMonth &&
                    sDate.getFullYear() === currentYear;
            })
            : currentList;

    const unassignedCount = currentList.filter(l => !l.hasService || !l.serviceStartDate).length;

    const nextSlotNumber = currentList.length > 0
        ? Math.max(...currentList.map(l => Number(l.slotNumber) || 0)) + 1
        : 1;

    const defaultServiceDate = selectedDay && selectedDay !== 'unassigned'
        ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
        : new Date().toISOString().split('T')[0];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>
            {/* التبديل العلوي بين الخطوط المسكرة والخطوط المفتوحة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        type="button"
                        onClick={() => { setActiveTab('locked'); setSelectedDay(null); }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'locked' ? 'var(--orange-primary)' : 'transparent',
                            color: activeTab === 'locked' ? '#fff' : 'var(--text-muted)',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        الخطوط المسكرة ({lockedLines.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => { setActiveTab('open'); setSelectedDay(null); }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'open' ? 'var(--orange-primary)' : 'transparent',
                            color: activeTab === 'open' ? '#fff' : 'var(--text-muted)',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        الخطوط المفتوحة ({openLines.length})
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => { setSelectedLine(null); setActiveModal('add'); }}
                    className="btn-primary"
                    style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
                >
                    <Plus size={14} />
                    <span>إضافة خط</span>
                </button>
            </div>

            {/* التقويم الشهري لتاريخ بداية الخدمة */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" onClick={prevMonth} style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', padding: '4px 6px', cursor: 'pointer' }}>
                            <ChevronRight size={14} />
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--orange-primary)' }}>
                            {monthNames[currentMonth]} {currentYear}
                        </span>
                        <button type="button" onClick={nextMonth} style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', padding: '4px 6px', cursor: 'pointer' }}>
                            <ChevronLeft size={14} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => setSelectedDay(selectedDay === 'unassigned' ? null : 'unassigned')}
                            style={{
                                background: selectedDay === 'unassigned' ? 'var(--orange-primary)' : 'var(--bg-card-sub)',
                                border: '1px solid var(--border-color)',
                                color: selectedDay === 'unassigned' ? '#fff' : 'var(--text-main)',
                                borderRadius: '8px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            بدون خدمة ({unassignedCount})
                        </button>
                        {selectedDay && (
                            <button
                                type="button"
                                onClick={() => setSelectedDay(null)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--orange-primary)',
                                    color: 'var(--orange-primary)',
                                    borderRadius: '8px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                الكل
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map((d) => {
                        const count = currentList.filter(l => {
                            if (!l.hasService || !l.serviceStartDate) return false;
                            const sDate = parseLocalDate(l.serviceStartDate);
                            if (!sDate) return false;
                            return sDate.getDate() === d &&
                                sDate.getMonth() === currentMonth &&
                                sDate.getFullYear() === currentYear;
                        }).length;

                        const isSelected = selectedDay === d;
                        const isToday = (today.getDate() === d && today.getMonth() === currentMonth && today.getFullYear() === currentYear);

                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setSelectedDay(isSelected ? null : d)}
                                style={{
                                    height: '38px',
                                    borderRadius: '8px',
                                    border: isSelected
                                        ? '2px solid var(--orange-primary)'
                                        : isToday
                                            ? '1.5px dashed var(--orange-primary)'
                                            : '1px solid var(--border-color)',
                                    background: isSelected
                                        ? 'var(--orange-primary)'
                                        : count > 0
                                            ? 'var(--bg-card-sub)'
                                            : 'transparent',
                                    color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: '2px'
                                }}
                            >
                                <span style={{ fontSize: '11px', fontWeight: '800', lineHeight: 1 }}>{d}</span>
                                {count > 0 && (
                                    <span style={{
                                        fontSize: '8px',
                                        fontWeight: '900',
                                        background: isSelected ? '#fff' : 'var(--orange-primary)',
                                        color: isSelected ? 'var(--orange-primary)' : '#fff',
                                        borderRadius: '4px',
                                        padding: '0 3px',
                                        marginTop: '2px'
                                    }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* قائمة بطاقات الخطوط */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                {displayedLines.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        لا توجد خطوط مسجلة تحت هذا التاريخ
                    </div>
                ) : (
                    displayedLines.map((line) => {
                        const remainingValidity = getRemainingValidity(line);
                        const service = getServiceStatus(line);

                        return (
                            <div
                                key={line.id}
                                onClick={() => { setSelectedLine(line); setActiveModal('details'); }}
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '14px',
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ background: 'var(--orange-glow)', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '6px' }}>
                                        {activeTab === 'open' ? `أدمن #${line.slotNumber}` : `خط #${line.slotNumber}`}
                                    </span>
                                    <span style={{ color: 'var(--green)', fontWeight: '800', fontSize: '11px' }}>
                                        ${line.balanceUSD}
                                    </span>
                                </div>

                                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                                    {line.phoneNumber || line.number}
                                </div>

                                {activeTab === 'open' && (
                                    <div style={{ fontSize: '10px', color: 'var(--orange-primary)', fontWeight: 'bold', background: 'var(--bg-card-sub)', padding: '3px 6px', borderRadius: '6px' }}>
                                        الأدمن: {line.adminName || 'الرئيسي'} ({line.adminGB || 22} GB)
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', background: 'var(--bg-card-sub)', padding: '4px 6px', borderRadius: '6px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>صلاحية الخط:</span>
                                    <span style={{ fontWeight: 'bold', color: remainingValidity <= 3 ? 'var(--red)' : 'var(--text-main)' }}>
                                        {remainingValidity} يوم
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', background: 'var(--bg-card-sub)', padding: '4px 6px', borderRadius: '6px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>الخدمة (30 يوم):</span>
                                    {service.active ? (
                                        <span style={{ fontWeight: 'bold', color: service.remainingDays <= 3 ? 'var(--red)' : 'var(--orange-primary)' }}>
                                            باقي {service.remainingDays} يوم
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>متوقفة</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* مودال إضافة / تعديل الخط */}
            {activeModal && (
                <LineDetailsModal
                    mode={activeModal}
                    lineType={activeModal === 'add' ? activeTab : (selectedLine?.type || activeTab)}
                    line={selectedLine}
                    defaultSlotNumber={nextSlotNumber.toString()}
                    defaultServiceDate={defaultServiceDate}
                    customers={customers}
                    onAddLine={onAddLine}
                    onUpdateLine={onUpdateLine}
                    onDeleteLine={onDeleteLine}
                    onRecordSaleFromLine={onRecordSaleFromLine}
                    onClose={() => { setActiveModal(null); setSelectedLine(null); }}
                />
            )}
        </div>
    );
}