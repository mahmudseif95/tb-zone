import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PhoneCall,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  CheckCircle2,
  Trash2,
  Zap,
  Edit3,
  UserCheck,
  User,
  Building2
} from 'lucide-react';

export default function LockedLines({
  lines = [],
  customers = [],
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onRecordSaleFromLine,
  exchangeRate = 89500
}) {
  const [activeTab, setActiveTab] = useState('locked');
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const [activeModal, setActiveModal] = useState(null); // 'add' | 'details'
  const [selectedLine, setSelectedLine] = useState(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [targetUserSlot, setTargetUserSlot] = useState(1); // 1, 2, 3 or 'admin'
  const [userSaleForm, setUserSaleForm] = useState({
    customerType: 'customers', // 'customers' | 'merchants'
    name: '',
    phone: '',
    address: '',
    gb: '22',
    price: '',
    currency: 'USD',
    paymentType: 'cash', // 'cash' | 'partial' | 'debt'
    partialPaidAmount: '',
    isDebt: false
  });
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [editingUserInfo, setEditingUserInfo] = useState(null);

  const [formData, setFormData] = useState({
    type: 'locked',
    slotNumber: '',
    phoneNumber: '',
    validityDays: '30',
    hasService: false,
    serviceStartDate: '',
    balanceUSD: '0',
    adminName: 'المدير الرئيسي',
    adminPhone: '',
    adminAddress: '',
    adminGB: '22',
    adminPrice: '',
    user1: '',
    user2: '',
    user3: '',
    notes: ''
  });

  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthNames = [
    'كانون الثاني (1)', 'شباط (2)', 'آذار (3)', 'نيسان (4)',
    'أيار (5)', 'حزيران (6)', 'تموز (7)', 'آب (8)',
    'أيلول (9)', 'تشرين الأول (10)', 'تشرين الثاني (11)', 'كانون الأول (12)'
  ];

  const lockedLines = lines.filter(l => (l.type || 'locked') === 'locked');
  const openLines = lines.filter(l => l.type === 'open');
  const currentList = activeTab === 'locked' ? lockedLines : openLines;

  const getRemainingValidity = (line) => {
    const total = Number(line.validityDays) || 0;
    if (!line.validityStartDate) return total;
    const start = new Date(line.validityStartDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const rem = total - diff;
    return rem > 0 ? rem : 0;
  };

  const getServiceStatus = (line) => {
    if (!line.hasService || !line.serviceStartDate) {
      return { active: false, remainingDays: 0 };
    }
    const start = new Date(line.serviceStartDate);
    const expiry = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
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
        const sDate = new Date(l.serviceStartDate);
        return sDate.getDate() === selectedDay &&
          sDate.getMonth() === currentMonth &&
          sDate.getFullYear() === currentYear;
      })
      : currentList;

  const handleOpenAdd = () => {
    const list = currentList;
    const nextSlot = list.length > 0 ? Math.max(...list.map(l => Number(l.slotNumber) || 0)) + 1 : 1;
    const defaultDateStr = selectedDay && selectedDay !== 'unassigned'
      ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
      : new Date().toISOString().split('T')[0];

    setFormData({
      type: activeTab,
      slotNumber: nextSlot.toString(),
      phoneNumber: '',
      validityDays: '30',
      hasService: false,
      serviceStartDate: defaultDateStr,
      balanceUSD: '0',
      adminName: activeTab === 'open' ? 'المدير الرئيسي' : '',
      adminPhone: '',
      adminAddress: '',
      adminGB: '22',
      adminPrice: '',
      user1: '',
      user2: '',
      user3: '',
      notes: ''
    });
    setActiveModal('add');
  };

  const handleOpenDetails = (line) => {
    setSelectedLine(line);
    setFormData({
      type: line.type || activeTab,
      slotNumber: line.slotNumber || '',
      phoneNumber: line.phoneNumber || line.number || '',
      validityDays: line.validityDays || '30',
      hasService: !!(line.hasService || line.serviceActive),
      serviceStartDate: line.serviceStartDate || new Date().toISOString().split('T')[0],
      balanceUSD: line.balanceUSD || '0',
      adminName: line.adminName || '',
      adminPhone: line.adminPhone || '',
      adminAddress: line.adminAddress || '',
      adminGB: line.adminGB || '22',
      adminPrice: line.adminPrice || '',
      user1: line.user1 || '',
      user2: line.user2 || '',
      user3: line.user3 || '',
      notes: line.notes || ''
    });
    setActiveModal('details');
  };

  const openUserSaleModal = (slotNum) => {
    setTargetUserSlot(slotNum);

    if (slotNum === 'admin') {
      setUserSaleForm({
        customerType: 'customers',
        name: formData.adminName || '',
        phone: formData.adminPhone || '',
        address: formData.adminAddress || '',
        gb: formData.adminGB || '22',
        price: formData.adminPrice || '',
        currency: 'USD',
        paymentType: 'cash',
        partialPaidAmount: '',
        isDebt: false
      });
    } else {
      setUserSaleForm({
        customerType: 'customers',
        name: '',
        phone: '',
        address: '',
        gb: '22',
        price: '',
        currency: 'USD',
        paymentType: 'cash',
        partialPaidAmount: '',
        isDebt: false
      });
    }
    setCustomerSuggestions([]);
    setShowAddUserModal(true);
  };

  const handleCustomerSearch = (query) => {
    setUserSaleForm(prev => ({ ...prev, name: query }));
    if (!query.trim()) {
      setCustomerSuggestions([]);
      return;
    }
    const clean = query.toLowerCase().trim();
    const matches = customers.filter(c =>
      c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean))
    );
    setCustomerSuggestions(matches);
  };

  const handleSelectCustomer = (c) => {
    setUserSaleForm(prev => ({
      ...prev,
      name: c.name,
      phone: c.phone || '',
      address: c.address || ''
    }));
    setCustomerSuggestions([]);
  };

  const rawSaleTotal = parseFloat(userSaleForm.price) || 0;
  const remainingDebtAmount = userSaleForm.paymentType === 'debt'
    ? rawSaleTotal
    : userSaleForm.paymentType === 'partial'
      ? Math.max(0, rawSaleTotal - (parseFloat(userSaleForm.partialPaidAmount) || 0))
      : 0;

  const handleConfirmUserSale = (e) => {
    e.preventDefault();
    if (!userSaleForm.name.trim()) return;

    const userText = `${userSaleForm.name.trim()} (${userSaleForm.gb} GB)`;
    const isUserAdmin = targetUserSlot === 'admin';

    if (isUserAdmin) {
      setFormData(prev => ({
        ...prev,
        adminName: userSaleForm.name.trim(),
        adminPhone: userSaleForm.phone.trim(),
        adminAddress: userSaleForm.address.trim(),
        adminGB: userSaleForm.gb,
        adminPrice: userSaleForm.price
      }));

      if (selectedLine) {
        onUpdateLine(selectedLine.id, (prev) => ({
          ...prev,
          adminName: userSaleForm.name.trim(),
          adminPhone: userSaleForm.phone.trim(),
          adminAddress: userSaleForm.address.trim(),
          adminGB: userSaleForm.gb,
          adminPrice: userSaleForm.price
        }));
      }
    } else {
      const slotKey = `user${targetUserSlot}`;
      setFormData(prev => ({ ...prev, [slotKey]: userText }));

      if (selectedLine) {
        onUpdateLine(selectedLine.id, (prev) => ({
          ...prev,
          [slotKey]: userText
        }));
      }
    }

    if (onRecordSaleFromLine && userSaleForm.price) {
      const isPartialOrDebt = userSaleForm.paymentType === 'debt' || (userSaleForm.paymentType === 'partial' && remainingDebtAmount > 0);

      onRecordSaleFromLine({
        title: isUserAdmin ? `حصة أدمن #${formData.slotNumber}` : `حصة مستخدم #${formData.slotNumber}`,
        itemName: isUserAdmin
          ? `حصة أدمن (${userSaleForm.gb} GB #${formData.slotNumber} - ${formData.phoneNumber})`
          : `UShare (${userSaleForm.gb} GB #${formData.slotNumber} - ${formData.phoneNumber})`,
        sellingPrice: rawSaleTotal,
        currency: userSaleForm.currency,
        costUSD: 0,
        customerType: userSaleForm.customerType,
        customerName: userSaleForm.name.trim(),
        customerPhone: userSaleForm.phone.trim(),
        customerAddress: userSaleForm.address.trim(),
        paymentType: userSaleForm.paymentType,
        paidAmount: userSaleForm.paymentType === 'cash' ? rawSaleTotal : (parseFloat(userSaleForm.partialPaidAmount) || 0),
        remainingDebt: remainingDebtAmount,
        isDebt: isPartialOrDebt,
        targetLineId: selectedLine ? selectedLine.id : null,
        lockedLineId: selectedLine ? selectedLine.id : null,
        lineSlot: formData.slotNumber,
        linePhone: formData.phoneNumber,
        lineType: formData.type,
        date: new Date().toISOString()
      });
    }

    setShowAddUserModal(false);
  };

  const openEditUserModal = (slotKey) => {
    const rawText = formData[slotKey];
    if (!rawText) return;

    const namePart = rawText.split('(')[0].trim();
    const gbMatch = rawText.match(/\(([^)]+)\)/);
    const gbPart = gbMatch ? gbMatch[1].replace(/[^0-9.]/g, '') : '22';
    const customerObj = customers.find(c => c.name?.toLowerCase().trim() === namePart.toLowerCase());

    setEditingUserInfo({
      slotKey,
      name: namePart,
      phone: customerObj?.phone || '',
      address: customerObj?.address || '',
      gb: gbPart
    });
  };

  const handleSaveEditedUser = (e) => {
    e.preventDefault();
    if (!editingUserInfo) return;

    const updatedText = `${editingUserInfo.name.trim()} (${editingUserInfo.gb} GB)`;
    const slotKey = editingUserInfo.slotKey;

    setFormData(prev => ({ ...prev, [slotKey]: updatedText }));
    if (selectedLine) {
      onUpdateLine(selectedLine.id, (prev) => ({
        ...prev,
        [slotKey]: updatedText
      }));
    }

    setEditingUserInfo(null);
  };

  const handleClearUserSlot = (slotKey) => {
    setFormData(prev => ({ ...prev, [slotKey]: '' }));
    if (selectedLine) {
      onUpdateLine(selectedLine.id, (prev) => ({
        ...prev,
        [slotKey]: ''
      }));
    }
    setEditingUserInfo(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.phoneNumber) {
      alert('يرجى إدخال رقم الهاتف');
      return;
    }

    if (activeModal === 'add') {
      const newLine = {
        id: Date.now().toString(),
        type: activeTab,
        slotNumber: formData.slotNumber || '1',
        phoneNumber: formData.phoneNumber.trim(),
        number: formData.phoneNumber.trim(),
        validityDays: Number(formData.validityDays) || 30,
        validityStartDate: new Date().toISOString(),
        hasService: formData.hasService,
        serviceStartDate: formData.hasService ? formData.serviceStartDate : null,
        balanceUSD: parseFloat(formData.balanceUSD) || 0,
        adminName: activeTab === 'open' ? formData.adminName.trim() : '',
        adminPhone: activeTab === 'open' ? formData.adminPhone.trim() : '',
        adminAddress: activeTab === 'open' ? formData.adminAddress.trim() : '',
        adminGB: activeTab === 'open' ? formData.adminGB : '',
        adminPrice: activeTab === 'open' ? formData.adminPrice : '',
        user1: formData.user1.trim(),
        user2: formData.user2.trim(),
        user3: formData.user3.trim(),
        notes: formData.notes.trim()
      };
      onAddLine(newLine);
    } else if (activeModal === 'details' && selectedLine) {
      onUpdateLine(selectedLine.id, (prev) => ({
        ...prev,
        slotNumber: formData.slotNumber,
        phoneNumber: formData.phoneNumber.trim(),
        number: formData.phoneNumber.trim(),
        validityDays: Number(formData.validityDays) || 30,
        hasService: formData.hasService,
        serviceStartDate: formData.hasService ? formData.serviceStartDate : null,
        balanceUSD: parseFloat(formData.balanceUSD) || 0,
        adminName: formData.type === 'open' ? formData.adminName.trim() : '',
        adminPhone: formData.type === 'open' ? formData.adminPhone.trim() : '',
        adminAddress: formData.type === 'open' ? formData.adminAddress.trim() : '',
        adminGB: formData.type === 'open' ? formData.adminGB : '',
        adminPrice: formData.type === 'open' ? formData.adminPrice : '',
        user1: formData.user1.trim(),
        user2: formData.user2.trim(),
        user3: formData.user3.trim(),
        notes: formData.notes.trim()
      }));
    }

    setActiveModal(null);
    setSelectedLine(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('هل تريد حذف الخط نهائياً؟')) {
      onDeleteLine(id);
      setActiveModal(null);
      setSelectedLine(null);
    }
  };

  const unassignedCount = currentList.filter(l => !l.hasService || !l.serviceStartDate).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>

      {/* التبديل العلوي */}
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
            الخطوط المفتوحة / أدمن ({openLines.length})
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
        >
          <Plus size={14} />
          <span>إضافة خط</span>
        </button>
      </div>

      {/* التقويم الشهري */}
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
              const sDate = new Date(l.serviceStartDate);
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

      {/* قائمة الكروت */}
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
                onClick={() => handleOpenDetails(line)}
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

      {/* المودال المركزي لإضافة وتعديل الخط */}
      {activeModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '390px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {activeModal === 'add' ? `إضافة خط ${formData.type === 'open' ? 'مفتوح (أدمن)' : 'مسكر'}` : `تعديل خط #${formData.slotNumber}`}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
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

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الخط بالمحل</label>
                  <input type="number" required className="tz-input" style={{ height: '40px' }} value={formData.slotNumber} onChange={e => setFormData({ ...formData, slotNumber: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الهاتف</label>
                  <input type="tel" required placeholder="70123456" className="tz-input" style={{ height: '40px' }} value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>صلاحية الخط (أيام)</label>
                  <input type="number" className="tz-input" style={{ height: '40px' }} placeholder="30" value={formData.validityDays} onChange={e => setFormData({ ...formData, validityDays: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>الرصيد ($)</label>
                  <input type="number" step="any" className="tz-input" style={{ height: '40px' }} value={formData.balanceUSD} onChange={e => setFormData({ ...formData, balanceUSD: e.target.value })} />
                </div>
              </div>

              <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--orange-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={14} />
                    <span>تفعيل خدمة 30 يوم</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={formData.hasService}
                    onChange={e => setFormData({ ...formData, hasService: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--orange-primary)' }}
                  />
                </div>

                {formData.hasService && (
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                      تاريخ فتح الخدمة الفعلي:
                    </label>
                    <input
                      type="date"
                      className="tz-input"
                      style={{ height: '38px' }}
                      value={formData.serviceStartDate}
                      onChange={e => setFormData({ ...formData, serviceStartDate: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {formData.type === 'open' && (
                <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '14px', border: '1.5px solid var(--orange-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserCheck size={16} color="var(--orange-primary)" />
                      <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                        بيانات وحصة الأدمن:
                      </span>
                    </div>

                    {activeModal === 'details' && (
                      <button
                        type="button"
                        onClick={() => openUserSaleModal('admin')}
                        style={{
                          background: 'rgba(255, 122, 0, 0.15)',
                          border: '1px solid var(--orange-primary)',
                          color: 'var(--orange-primary)',
                          borderRadius: '8px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        تسجيل مبيع حصة الأدمن
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم الأدمن:</label>
                      <input
                        type="text"
                        required
                        placeholder="اسم الأدمن..."
                        className="tz-input"
                        style={{ height: '38px', fontSize: '12px' }}
                        value={formData.adminName}
                        onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>هاتف الأدمن:</label>
                      <input
                        type="tel"
                        placeholder="هاتف الأدمن..."
                        className="tz-input"
                        style={{ height: '38px', fontSize: '12px' }}
                        value={formData.adminPhone}
                        onChange={e => setFormData({ ...formData, adminPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>حصة الأدمن (GB):</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="22"
                        className="tz-input"
                        style={{ height: '38px', fontSize: '12px', fontWeight: 'bold' }}
                        value={formData.adminGB}
                        onChange={e => setFormData({ ...formData, adminGB: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>السعر ($):</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="السعر..."
                        className="tz-input"
                        style={{ height: '38px', fontSize: '12px' }}
                        value={formData.adminPrice}
                        onChange={e => setFormData({ ...formData, adminPrice: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>عنوان / منطقة السكن:</label>
                      <input
                        type="text"
                        placeholder="المنطقة..."
                        className="tz-input"
                        style={{ height: '38px', fontSize: '11px' }}
                        value={formData.adminAddress}
                        onChange={e => setFormData({ ...formData, adminAddress: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>المستخدمين التابعين للخط (3 كحد أقصى):</label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[1, 2, 3].map((num) => {
                    const slotKey = `user${num}`;
                    const val = formData[slotKey];

                    return (
                      <div key={slotKey} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {val ? (
                          <div style={{
                            flex: 1,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{val}</span>
                            <button
                              type="button"
                              onClick={() => openEditUserModal(slotKey)}
                              style={{ background: 'none', border: 'none', color: 'var(--orange-primary)', cursor: 'pointer', padding: '2px' }}
                            >
                              <Edit3 size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openUserSaleModal(num)}
                            style={{
                              flex: 1,
                              background: 'transparent',
                              border: '1px dashed var(--border-color)',
                              borderRadius: '10px',
                              padding: '6px',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <Plus size={14} color="var(--orange-primary)" />
                            <span>تسجيل حصة لمستخدم #{num}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, height: '44px' }}>
                  <CheckCircle2 size={16} />
                  <span>حفظ بيانات الخط</span>
                </button>
                {activeModal === 'details' && (
                  <button type="button" onClick={() => handleDelete(selectedLine.id)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '12px', padding: '0 12px', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* نافذة بيع وتخصيص الحصة */}
      {showAddUserModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '370px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {targetUserSlot === 'admin' ? 'تخصيص حصة الأدمن' : `تخصيص حصة مستخدم #${targetUserSlot}`}
              </h3>
              <button type="button" onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmUserSale} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* خيار نوع العميل: زبون عادي أو تاجر */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setUserSaleForm(prev => ({ ...prev, customerType: 'customers' }))}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: userSaleForm.customerType === 'customers' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: userSaleForm.customerType === 'customers' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                    color: userSaleForm.customerType === 'customers' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <User size={13} />
                  <span>زبون عادي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserSaleForm(prev => ({ ...prev, customerType: 'merchants' }))}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: userSaleForm.customerType === 'merchants' ? '2px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: userSaleForm.customerType === 'merchants' ? 'rgba(255, 122, 0, 0.15)' : 'var(--bg-card-sub)',
                    color: userSaleForm.customerType === 'merchants' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Building2 size={13} />
                  <span>تاجر / محل</span>
                </button>
              </div>

              {/* حقل اسم العميل مع البحث الذكي */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {userSaleForm.customerType === 'merchants' ? 'اسم التاجر / المحل:' : 'اسم العميل / الزبون:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ابحث بالاسم أو الرقم..."
                  className="tz-input"
                  style={{ height: '38px', marginTop: '2px' }}
                  value={userSaleForm.name}
                  onChange={e => handleCustomerSearch(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />

                {customerSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--orange-primary)',
                    borderRadius: '10px',
                    zIndex: 10000001,
                    maxHeight: '140px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    marginTop: '2px'
                  }}>
                    {customerSuggestions.map(cust => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
                      >
                        <span style={{ fontWeight: 'bold' }}>{cust.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{cust.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الهاتف:</label>
                  <input
                    type="tel"
                    placeholder="رقم الهاتف..."
                    className="tz-input"
                    style={{ height: '36px' }}
                    value={userSaleForm.phone}
                    onChange={e => setUserSaleForm({ ...userSaleForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>العنوان / المنطقة:</label>
                  <input
                    type="text"
                    placeholder="المنطقة..."
                    className="tz-input"
                    style={{ height: '36px' }}
                    value={userSaleForm.address}
                    onChange={e => setUserSaleForm({ ...userSaleForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>حجم الحصة (GB):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="22"
                    className="tz-input"
                    style={{ height: '36px', fontWeight: 'bold' }}
                    value={userSaleForm.gb}
                    onChange={e => setUserSaleForm({ ...userSaleForm, gb: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>سعر المبيع:</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="السعر..."
                    className="tz-input"
                    style={{ height: '36px', fontWeight: 'bold', color: 'var(--orange-primary)' }}
                    value={userSaleForm.price}
                    onChange={e => setUserSaleForm({ ...userSaleForm, price: e.target.value })}
                  />
                </div>
              </div>

              {/* اختيار عملة المبيع */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setUserSaleForm(prev => ({ ...prev, currency: 'USD' }))}
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    border: userSaleForm.currency === 'USD' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: userSaleForm.currency === 'USD' ? 'var(--orange-subtle)' : 'transparent',
                    color: userSaleForm.currency === 'USD' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  دولار ($)
                </button>
                <button
                  type="button"
                  onClick={() => setUserSaleForm(prev => ({ ...prev, currency: 'LBP' }))}
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    border: userSaleForm.currency === 'LBP' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                    background: userSaleForm.currency === 'LBP' ? 'var(--orange-subtle)' : 'transparent',
                    color: userSaleForm.currency === 'LBP' ? 'var(--orange-primary)' : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ليرة (LBP)
                </button>
              </div>

              {/* قسم طريقة الدفع: كاش، جزئي، دين */}
              <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>طريقة الدفع:</span>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                    المطلوب: {rawSaleTotal.toLocaleString()} {userSaleForm.currency === 'LBP' ? 'ل.ل' : '$'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setUserSaleForm(prev => ({ ...prev, paymentType: 'cash' }))}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: userSaleForm.paymentType === 'cash' ? '1.5px solid var(--green)' : '1px solid var(--border-color)',
                      background: userSaleForm.paymentType === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: userSaleForm.paymentType === 'cash' ? 'var(--green)' : 'var(--text-main)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    كاش نقداً
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserSaleForm(prev => ({ ...prev, paymentType: 'partial' }))}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: userSaleForm.paymentType === 'partial' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                      background: userSaleForm.paymentType === 'partial' ? 'rgba(255, 122, 0, 0.15)' : 'transparent',
                      color: userSaleForm.paymentType === 'partial' ? 'var(--orange-primary)' : 'var(--text-main)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    دفع جزئي
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserSaleForm(prev => ({ ...prev, paymentType: 'debt' }))}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: userSaleForm.paymentType === 'debt' ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                      background: userSaleForm.paymentType === 'debt' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      color: userSaleForm.paymentType === 'debt' ? 'var(--red)' : 'var(--text-main)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    آجل (دين)
                  </button>
                </div>

                {userSaleForm.paymentType === 'partial' && (
                  <div style={{ marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="any"
                      placeholder="المبلغ المدفوع كاش..."
                      className="tz-input"
                      style={{ height: '34px', fontSize: '11px', flex: 1 }}
                      value={userSaleForm.partialPaidAmount}
                      onChange={e => setUserSaleForm({ ...userSaleForm, partialPaidAmount: e.target.value })}
                      required
                    />
                    <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 'bold' }}>
                      المتبقي كدين: {remainingDebtAmount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '4px', height: '42px', fontSize: '13px' }}>
                تثبيت الحصة وتسجيل العملية
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* نافذة تعديل بيانات المشترك */}
      {editingUserInfo && createPortal(
        <div className="modal-overlay">
          <div className="modal-center" style={{ maxWidth: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={16} color="var(--orange-primary)" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900' }}>تعديل بيانات المشترك</h3>
              </div>
              <button type="button" onClick={() => setEditingUserInfo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>اسم العميل:</label>
                <input
                  type="text"
                  required
                  className="tz-input"
                  style={{ height: '38px' }}
                  value={editingUserInfo.name}
                  onChange={e => setEditingUserInfo({ ...editingUserInfo, name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>حصة الجيجابايت (GB):</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="tz-input"
                  style={{ height: '38px' }}
                  value={editingUserInfo.gb}
                  onChange={e => setEditingUserInfo({ ...editingUserInfo, gb: e.target.value })}
                />
              </div>

              {editingUserInfo.phone && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card-sub)', padding: '6px', borderRadius: '8px' }}>
                  الهاتف المسجل: <b>{editingUserInfo.phone}</b>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, height: '38px', fontSize: '12px' }}>
                  حفظ التعديل
                </button>
                <button
                  type="button"
                  onClick={() => handleClearUserSlot(editingUserInfo.slotKey)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--red)',
                    color: 'var(--red)',
                    borderRadius: '10px',
                    padding: '0 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  حذف من الخط
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}