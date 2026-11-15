import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronLeft,
    Plus,
    Search,
    X,
    Hash,
    Phone
} from 'lucide-react';
import LineDetailsModal from './LineDetailsModal';
import WhatsAppActivationButton from './WhatsAppActivationButton';
import { parseUserSlot } from '../../utils/whatsappHelper';

// يبني صفوف شبكة الأيام بحيث يكون كل صف ممتلئاً تماماً بلا خلايا فارغة متخلّفة في آخر صف:
// يُفضَّل عدد أعمدة يقسم عدد أيام الشهر بالتمام (7 لشهر 28 يوماً، 6 لشهر 30 يوماً)، وإن تعذّر
// (الأعداد الأولية كـ29 و31) يبقى العمود 7 وتتوسّع عناصر الصف الأخير (flex: 1) لتغطي العرض كاملاً.
function buildCalendarRows(daysInMonth) {
    const preferredCols = [7, 6, 5, 4];
    const cols = preferredCols.find((c) => daysInMonth % c === 0) || 7;
    const rows = [];
    for (let i = 1; i <= daysInMonth; i += cols) {
        rows.push(Array.from({ length: Math.min(cols, daysInMonth - i + 1) }, (_, k) => i + k));
    }
    return rows;
}

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
    onRecordSaleFromLine,
    onRefreshLines,
    brandConfig
}) {
    const [activeTab, setActiveTab] = useState('locked'); // 'locked' | 'open'
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    const [activeModal, setActiveModal] = useState(null); // 'add' | 'details'
    const [selectedLine, setSelectedLine] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState('all'); // 'all' | 'id' | 'phone'
    const [sortMode, setSortMode] = useState('all'); // 'all' | 'days' | 'bundle'
    const [daysDir, setDaysDir] = useState('asc'); // 'asc' (الأقل أولاً) | 'desc' (الأكثر أولاً)
    const [bundleDir, setBundleDir] = useState('desc'); // 'desc' (الأكبر أولاً) | 'asc' (الأصغر أولاً)

    // الضغط الأول على فلتر الترتيب يفعّله باتجاهه الافتراضي، والضغط الثاني (وهو مفعَّل) يعكس الاتجاه
    const handleSortPillClick = (mode) => {
        if (mode === 'all') { setSortMode('all'); return; }
        if (sortMode !== mode) { setSortMode(mode); return; }
        if (mode === 'days') setDaysDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else setBundleDir(d => (d === 'desc' ? 'asc' : 'desc'));
    };

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const calendarRows = buildCalendarRows(daysInCurrentMonth);
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

    // الباقة النشطة الحالية على الخط: إجمالي حصص GB للمستخدمين المسجَّلين، فقط إن كانت الخدمة فعّالة
    const getActiveBundleGB = (line) => {
        if (!line.hasService && !line.serviceActive) return 0;
        return ['user1', 'user2', 'user3'].reduce((sum, key) => {
            const sub = parseUserSlot(line[key], customers, line[`${key}Phone`]);
            return sum + (sub?.quotaGB ? parseFloat(sub.quotaGB) || 0 : 0);
        }, 0);
    };

    // فحص مطابقة البحث لخط معيّن حسب الوضع المختار (الكل / # رقم الخط / هاتف ومشترك)
    const matchesSearch = (line) => {
        const raw = searchQuery.trim();
        if (!raw) return true;

        const isHashQuery = raw.startsWith('#');
        const digitsOnly = raw.replace(/^#/, '').trim();

        // قاعدة البادئة # أو وضع "رقم الخط": تطابق تام وحصري مع رقم الخط، ولا علاقة له بأرقام الهاتف
        if (isHashQuery || searchMode === 'id') {
            if (!digitsOnly) return true;
            return String(line.slotNumber) === digitsOnly;
        }

        const q = raw.toLowerCase();

        // تطابق تام برقم الخط يُعتبر نتيجة صحيحة دائماً، في أي وضع آخر غير الصارم أعلاه
        if (String(line.slotNumber) === raw) return true;

        const phoneMain = String(line.phoneNumber || line.number || '').toLowerCase();
        if (phoneMain.includes(q)) return true;

        // وضع "هاتف / مشترك" أو "الكل": نبحث أيضاً في أسماء وهواتف المستخدمين الثلاثة على الخط
        return ['user1', 'user2', 'user3'].some((key) => {
            const sub = parseUserSlot(line[key], customers, line[`${key}Phone`]);
            if (!sub) return false;
            return (sub.phone && sub.phone.toLowerCase().includes(q)) || (sub.name && sub.name.toLowerCase().includes(q));
        });
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

    // فلترة البحث (رقم الخط / هاتف ومشترك) تُطبَّق فوق تصفية التاريخ، قبل الترتيب
    const searchedLines = searchQuery.trim() ? displayedLines.filter(matchesSearch) : displayedLines;

    // ترتيب القائمة حسب الفلتر المختار واتجاهه (لا يغيّر التصفية بالتاريخ/البحث أعلاه، فقط يعيد ترتيب نفس القائمة)
    const sortedLines = (() => {
        if (sortMode === 'days') {
            const dir = daysDir === 'asc' ? 1 : -1;
            return [...searchedLines].sort((a, b) => {
                const da = getServiceStatus(a).active ? getServiceStatus(a).remainingDays : Infinity;
                const db = getServiceStatus(b).active ? getServiceStatus(b).remainingDays : Infinity;
                return (da - db) * dir;
            });
        }
        if (sortMode === 'bundle') {
            const dir = bundleDir === 'desc' ? -1 : 1;
            return [...searchedLines].sort((a, b) => (getActiveBundleGB(a) - getActiveBundleGB(b)) * dir);
        }
        return searchedLines;
    })();

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

            {/* شريط البحث الذكي: يعمل بنفس الطريقة على الخطوط المسكرة والمفتوحة */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card-sub)', borderRadius: '10px', padding: '0 10px' }}>
                    <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث بـ # رقم الخط، أو رقم/اسم مشترك..."
                        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', height: '34px', fontSize: '12px', color: 'var(--text-main)', fontWeight: 'bold' }}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            title="مسح البحث"
                            className="tactile"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: '2px' }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    {[
                        { id: 'all', label: 'الكل', icon: null },
                        { id: 'id', label: '# رقم الخط (ID)', icon: Hash },
                        { id: 'phone', label: 'هاتف / مشترك', icon: Phone }
                    ].map((m) => {
                        const ModeIcon = m.icon;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setSearchMode(m.id)}
                                className="tactile"
                                style={{
                                    background: searchMode === m.id ? 'var(--orange-primary)' : 'var(--bg-card-sub)',
                                    color: searchMode === m.id ? '#fff' : 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '5px 4px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden'
                                }}
                            >
                                {ModeIcon && <ModeIcon size={11} style={{ flexShrink: 0 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* التقويم الشهري لتاريخ بداية الخدمة */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" onClick={prevMonth} style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', padding: '4px 6px', cursor: 'pointer' }}>
                            <ChevronRight size={14} />
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--orange-primary)', minWidth: '165px', display: 'inline-block', textAlign: 'center' }}>
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

                {/* شبكة الأيام: صفوف محسوبة ديناميكياً بحسب عدد أيام الشهر (28/29/30/31) بلا أي خلايا فارغة؛
                    مفتاح الصف المرتبط بالشهر/السنة يُعيد تشغيل حركة الدخول عند التبديل بين الأشهر */}
                <div key={`${currentYear}-${currentMonth}`} className="animate-tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {calendarRows.map((row, rowIdx) => (
                        <div key={rowIdx} style={{ display: 'flex', gap: '4px' }}>
                            {row.map((d) => {
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
                                            flex: 1,
                                            minWidth: 0,
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
                    ))}
                </div>
            </div>

            {/* فلاتر ترتيب الخطوط: ترتيب ثنائي الاتجاه — الضغط على فلتر مفعَّل يعكس اتجاهه */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                    { id: 'all', label: 'الكل' },
                    { id: 'days', label: `أيام الخدمة: ${daysDir === 'asc' ? 'الأقل ⬆' : 'الأكثر ⬇'}` },
                    { id: 'bundle', label: `الباقة: ${bundleDir === 'desc' ? 'الأكبر ⬇' : 'الأصغر ⬆'}` }
                ].map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSortPillClick(f.id)}
                        title={f.id !== 'all' ? 'اضغط مرة أخرى لعكس اتجاه الترتيب' : undefined}
                        className="tactile"
                        style={{
                            background: sortMode === f.id ? 'var(--orange-primary)' : 'var(--bg-card-sub)',
                            color: sortMode === f.id ? '#fff' : 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '999px',
                            padding: '5px 12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* قائمة بطاقات الخطوط */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                {sortedLines.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <span>
                            {searchQuery.trim()
                                ? `لا يوجد خط مطابق لـ "${searchQuery.trim()}"`
                                : 'لا توجد خطوط مسجلة تحت هذا التاريخ'}
                        </span>
                        {searchQuery.trim() && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="tactile"
                                style={{ background: 'var(--orange-subtle)', border: '1px solid var(--orange-primary)', color: 'var(--orange-primary)', borderRadius: '999px', padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                مسح البحث
                            </button>
                        )}
                    </div>
                ) : (
                    sortedLines.map((line, idx) => {
                        const remainingValidity = getRemainingValidity(line);
                        const service = getServiceStatus(line);
                        const activeBundleGB = getActiveBundleGB(line);

                        return (
                            <div
                                key={line.id}
                                onClick={() => { setSelectedLine(line); setActiveModal('details'); }}
                                className="stagger-card tactile tactile-lift"
                                style={{
                                    animationDelay: `${Math.min(idx, 12) * 35}ms`,
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

                                {/* شارة الباقة النشطة الحالية (تُحسب من حصص المستخدمين المسجَّلين)، تظهر فقط عند وجود خدمة فعّالة */}
                                {service.active && activeBundleGB > 0 && (
                                    <div style={{ alignSelf: 'flex-start', background: 'var(--orange-subtle)', color: 'var(--orange-primary)', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--orange-primary)', whiteSpace: 'nowrap' }}>
                                        باقة {activeBundleGB} GB
                                    </div>
                                )}

                                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                                    {line.phoneNumber || line.number}
                                </div>

                                {activeTab === 'locked' && (line.phoneNumber || line.number) && ['user1', 'user2', 'user3'].map((key) => {
                                    const sub = parseUserSlot(line[key], customers, line[`${key}Phone`]);
                                    if (!sub) return null;
                                    return (
                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px', fontSize: '10px', background: 'var(--bg-card-sub)', padding: '3px 6px', borderRadius: '6px' }}>
                                            <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {sub.name}{sub.quotaGB ? ` (${sub.quotaGB}GB)` : ''}
                                            </span>
                                            <WhatsAppActivationButton
                                                subscriberName={sub.name}
                                                subscriberPhone={sub.phone}
                                                quotaGB={sub.quotaGB}
                                                lockedLineNumber={line.phoneNumber || line.number}
                                                shopName={brandConfig?.name}
                                            />
                                        </div>
                                    );
                                })}

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
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', color: service.remainingDays <= 3 ? 'var(--red)' : 'var(--orange-primary)' }}>
                                            <span className={service.remainingDays <= 3 ? 'status-dot-warning' : 'status-dot-active'} />
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
                    line={selectedLine ? (lines.find(l => l.id === selectedLine.id) || selectedLine) : null}
                    onRefreshLines={onRefreshLines}
                    brandConfig={brandConfig}
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