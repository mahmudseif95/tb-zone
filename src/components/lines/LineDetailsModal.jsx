import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus,
    X,
    CheckCircle2,
    Trash2,
    Zap,
    Edit3,
    UserCheck
} from 'lucide-react';
import LineUserSaleModal from './LineUserSaleModal';

export default function LineDetailsModal({
    mode, // 'add' | 'details'
    lineType, // 'locked' | 'open'
    line,
    defaultSlotNumber = '1',
    defaultServiceDate,
    customers = [],
    onAddLine,
    onUpdateLine,
    onDeleteLine,
    onRecordSaleFromLine,
    onClose
}) {
    const [formData, setFormData] = useState(() => {
        if (mode === 'details' && line) {
            return {
                type: line.type || lineType,
                slotNumber: line.slotNumber || '',
                phoneNumber: line.phoneNumber || line.number || '',
                validityDays: line.validityDays ?? '30',
                hasService: Boolean(line.hasService || line.serviceActive),
                serviceStartDate: line.serviceStartDate ? line.serviceStartDate.toString().split('T')[0] : new Date().toISOString().split('T')[0],
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
            };
        }
        return {
            type: lineType,
            slotNumber: defaultSlotNumber,
            phoneNumber: '',
            validityDays: '30',
            hasService: false,
            serviceStartDate: defaultServiceDate || new Date().toISOString().split('T')[0],
            balanceUSD: '0',
            adminName: '',
            adminPhone: '',
            adminAddress: '',
            adminGB: '22',
            adminPrice: '',
            user1: '',
            user2: '',
            user3: '',
            notes: ''
        };
    });

    const [saleSlotTarget, setSaleSlotTarget] = useState(null); // 1 | 2 | 3 | 'admin'
    const [editingUserInfo, setEditingUserInfo] = useState(null);

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
            gb: gbPart
        });
    };

    const handleSaveEditedUser = (e) => {
        e.preventDefault();
        if (!editingUserInfo) return;

        const updatedText = `${editingUserInfo.name.trim()} (${editingUserInfo.gb} GB)`;
        const slotKey = editingUserInfo.slotKey;

        setFormData(prev => ({ ...prev, [slotKey]: updatedText }));
        if (line && onUpdateLine) {
            onUpdateLine(line.id, (prev) => ({
                ...prev,
                [slotKey]: updatedText
            }));
        }
        setEditingUserInfo(null);
    };

    const handleClearUserSlot = (slotKey) => {
        setFormData(prev => ({ ...prev, [slotKey]: '' }));
        if (line && onUpdateLine) {
            onUpdateLine(line.id, (prev) => ({
                ...prev,
                [slotKey]: ''
            }));
        }
        setEditingUserInfo(null);
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (!formData.phoneNumber.trim()) {
            alert('يرجى إدخال رقم الهاتف');
            return;
        }

        if (mode === 'add') {
            onAddLine({
                type: formData.type,
                slotNumber: formData.slotNumber || '1',
                phoneNumber: formData.phoneNumber.trim(),
                number: formData.phoneNumber.trim(),
                validityDays: Number(formData.validityDays) || 30,
                validityStartDate: new Date().toISOString().split('T')[0],
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
            });
        } else if (mode === 'details' && line) {
            onUpdateLine(line.id, (prev) => ({
                ...prev,
                type: formData.type,
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

        onClose();
    };

    const handleDelete = () => {
        if (line && window.confirm('هل تريد حذف الخط نهائياً من قاعدة البيانات؟')) {
            onDeleteLine(line.id);
            onClose();
        }
    };

    return (
        <>
            {createPortal(
                <div className="modal-overlay">
                    <div className="modal-center" style={{ maxWidth: '390px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                {mode === 'add' ? `إضافة خط ${formData.type === 'open' ? 'مفتوح مع أدمن' : 'مسكر'}` : `تعديل خط #${formData.slotNumber}`}
                            </h3>
                            <button
                                type="button"
                                onClick={onClose}
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
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رقم الخط</label>
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
                                            تاريخ فتح الخدمة الفعلي (YYYY-MM-DD):
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

                                        {mode === 'details' && (
                                            <button
                                                type="button"
                                                onClick={() => setSaleSlotTarget('admin')}
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
                                                        onClick={() => setSaleSlotTarget(num)}
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
                                {mode === 'details' && (
                                    <button type="button" onClick={handleDelete} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '12px', padding: '0 12px', cursor: 'pointer' }}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* نافذة تخصيص وبيع حصة لمشترك أو أدمن */}
            {saleSlotTarget !== null && (
                <LineUserSaleModal
                    targetUserSlot={saleSlotTarget}
                    formData={formData}
                    line={line}
                    customers={customers}
                    onUpdateFormData={setFormData}
                    onUpdateLine={onUpdateLine}
                    onRecordSaleFromLine={onRecordSaleFromLine}
                    onClose={() => setSaleSlotTarget(null)}
                />
            )}

            {/* نافذة تعديل مشترك مسجل */}
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
        </>
    );
}