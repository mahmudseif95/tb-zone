import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus,
    Edit2,
    Trash2,
    History,
    X,
    AlertTriangle
} from 'lucide-react';
import WalletTxModal from './WalletTxModal';
import DaysYearModal from './DaysYearModal';
import WalletLedgerModal from './WalletLedgerModal';

export default function WalletsManager({
    sources = [],
    customers = [],
    sims = [],
    lines = [],
    onAddSource,
    onUpdateSource,
    onDeleteSource,
    onRecordWalletTx,
    onRefreshData,
    exchangeRate = 89500
}) {
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [modalType, setModalType] = useState(null); // 'add' | 'edit' | 'tx' | 'days_year' | 'ledger' | 'delete_warning'
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editName, setEditName] = useState('');
    const [editUSD, setEditUSD] = useState('');
    const [editLBP, setEditLBP] = useState('');

    const [newWalletName, setNewWalletName] = useState('');
    const [newWalletInitialUSD, setNewWalletInitialUSD] = useState('');
    const [newWalletInitialLBP, setNewWalletInitialLBP] = useState('');

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newWalletName.trim() || isSubmitting) return;
        try {
            setIsSubmitting(true);
            await onAddSource(
                newWalletName.trim(),
                parseFloat(newWalletInitialUSD) || 0,
                parseFloat(newWalletInitialLBP) || 0
            );
            setNewWalletName('');
            setNewWalletInitialUSD('');
            setNewWalletInitialLBP('');
            setModalType(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartRename = (wallet) => {
        setSelectedWallet(wallet);
        setEditName(wallet.name);
        setEditUSD((wallet.balanceUSD ?? wallet.balance ?? 0).toString());
        setEditLBP((wallet.balanceLBP || 0).toString());
        setModalType('edit');
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!selectedWallet || !editName.trim() || isSubmitting) return;
        try {
            setIsSubmitting(true);
            await onUpdateSource(selectedWallet.id, {
                name: editName.trim(),
                balanceUSD: parseFloat(editUSD) || 0,
                balance: parseFloat(editUSD) || 0,
                balanceLBP: parseFloat(editLBP) || 0
            });
            setSelectedWallet(null);
            setModalType(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (wallet) => {
        setSelectedWallet(wallet);
        const balUSD = parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0);
        const balLBP = parseFloat(wallet.balanceLBP || 0);
        if (balUSD > 0 || balLBP > 0) {
            setModalType('delete_warning');
        } else {
            onDeleteSource(wallet.id);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>المحافظ وصناديق السيولة</h2>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>أرصدة مزدوجة، تحويل فوري، وصرافة داخلية</span>
                </div>
                <button
                    onClick={() => setModalType('add')}
                    className="btn-primary"
                    style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
                >
                    <Plus size={14} /> إضافة محفظة
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {sources.map(wallet => {
                    const balUSD = parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0);
                    const balLBP = parseFloat(wallet.balanceLBP || 0);

                    return (
                        <div key={wallet.id} className="tz-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '800', fontSize: '14px' }}>{wallet.name}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleStartRename(wallet)}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                        title="تعديل بيانات ورصيد المحفظة"
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick(wallet)}
                                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}
                                        title="حذف المحفظة"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-card-sub)', padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الدولار:</span>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                        ${balUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الليرة:</span>
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>
                                        {Math.round(balLBP).toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--orange-primary)' }}>ل.ل</span>
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <button
                                    onClick={() => { setSelectedWallet(wallet); setModalType('tx'); }}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '10px' }}
                                >
                                    حركة مالية
                                </button>

                                <button
                                    onClick={() => { setSelectedWallet(wallet); setModalType('ledger'); }}
                                    style={{
                                        background: 'var(--bg-card-sub)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-main)',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                    title="كشف حساب المعاملات"
                                >
                                    <History size={15} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* مودال إنشاء محفظة */}
            {modalType === 'add' && createPortal(
                <div className="modal-overlay">
                    <div className="modal-center">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>إضافة محفظة مالية جديدة</h3>
                            <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="اسم المحفظة (Whish Cash / TopUp / درج الكاش)"
                                required
                                className="tz-input"
                                value={newWalletName}
                                onChange={e => setNewWalletName(e.target.value)}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رصيد افتتاحي ($):</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        className="tz-input"
                                        value={newWalletInitialUSD}
                                        onChange={e => setNewWalletInitialUSD(e.target.value)}
                                        style={{ marginTop: '2px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>رصيد افتتاحي (ل.ل):</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0"
                                        className="tz-input"
                                        value={newWalletInitialLBP}
                                        onChange={e => setNewWalletInitialLBP(e.target.value)}
                                        style={{ marginTop: '2px' }}
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '6px', opacity: isSubmitting ? 0.6 : 1 }}>
                                {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المحفظة'}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* مودال تعديل المحفظة */}
            {modalType === 'edit' && selectedWallet && createPortal(
                <div className="modal-overlay">
                    <div className="modal-center" style={{ maxWidth: '380px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>تعديل بيانات المحفظة ورصيدها</h3>
                            <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>اسم المحفظة:</label>
                                <input
                                    type="text"
                                    required
                                    className="tz-input"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    autoFocus
                                    style={{ marginTop: '2px' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الدولار ($):</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        value={editUSD}
                                        onChange={e => setEditUSD(e.target.value)}
                                        style={{ marginTop: '2px', fontWeight: 'bold', color: 'var(--orange-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رصيد الليرة (LBP):</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        value={editLBP}
                                        onChange={e => setEditLBP(e.target.value)}
                                        style={{ marginTop: '2px', fontWeight: 'bold' }}
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '6px', opacity: isSubmitting ? 0.6 : 1 }}>
                                {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديل المباشر'}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* تحذير الحذف */}
            {modalType === 'delete_warning' && selectedWallet && createPortal(
                <div className="modal-overlay">
                    <div className="modal-center" style={{ maxWidth: '360px', textAlign: 'center', padding: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <AlertTriangle size={26} color="var(--red)" />
                        </div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '900' }}>لا يمكن حذف المحفظة</h4>
                        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            المحفظة <b>"{selectedWallet.name}"</b> تحتوي على رصيد قائم. يجب تصفير الأرصدة أولاً قبل الحذف!
                        </p>
                        <button
                            type="button"
                            onClick={() => setModalType(null)}
                            className="btn-primary"
                            style={{ height: '38px', fontSize: '12px' }}
                        >
                            حسناً، فهمت
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* نافذة الحركات المالية */}
            {modalType === 'tx' && selectedWallet && (
                <WalletTxModal
                    wallet={selectedWallet}
                    sources={sources}
                    customers={customers}
                    lines={lines}
                    exchangeRate={exchangeRate}
                    onRecordWalletTx={onRecordWalletTx}
                    onRefreshData={onRefreshData}
                    onSwitchToDaysYear={() => setModalType('days_year')}
                    onClose={() => setModalType(null)}
                />
            )}

            {/* نافذة دورة سنة أيام Alfa */}
            {modalType === 'days_year' && selectedWallet && (
                <DaysYearModal
                    wallet={selectedWallet}
                    sims={sims}
                    customers={customers}
                    exchangeRate={exchangeRate}
                    onRecordWalletTx={onRecordWalletTx}
                    onSwitchToGeneralTx={() => setModalType('tx')}
                    onClose={() => setModalType(null)}
                />
            )}

            {/* نافذة كشف حساب المحفظة */}
            {modalType === 'ledger' && selectedWallet && (
                <WalletLedgerModal
                    wallet={selectedWallet}
                    onClose={() => setModalType(null)}
                />
            )}
        </div>
    );
}