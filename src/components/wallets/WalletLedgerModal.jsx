import React from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime } from '../../utils/dateFormatter';
import { X } from 'lucide-react';

export default function WalletLedgerModal({ wallet, onClose }) {
    if (!wallet) return null;

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-center" style={{ maxWidth: '440px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                            كشف حساب: {wallet.name}
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            الرصيد: ${parseFloat(wallet.balanceUSD ?? wallet.balance ?? 0).toFixed(2)} • {Math.round(parseFloat(wallet.balanceLBP || 0)).toLocaleString()} ل.ل
                        </span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
                    {(!wallet.ledger || wallet.ledger.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            لا توجد حركات مسجلة على هذه المحفظة بعد.
                        </div>
                    ) : (
                        wallet.ledger.map((item, idx) => {
                            const isEntryLBP = item.currency === 'LBP';
                            return (
                                <div
                                    key={item.id || idx}
                                    style={{
                                        background: 'var(--bg-card-sub)',
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                        <span style={{ fontSize: '13px' }}>{item.itemName}</span>
                                        <span style={{ color: item.type === 'deposit' ? 'var(--green)' : 'var(--red)', fontWeight: '900' }}>
                                            {item.type === 'deposit' ? '+' : '-'}
                                            {isEntryLBP
                                                ? `${Math.round(item.amount).toLocaleString()} ل.ل`
                                                : `$${parseFloat(item.walletDeduction || item.amount).toFixed(2)}`}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span>{item.customerName || 'حركة داخلية'}</span>
                                        {isEntryLBP && item.balanceAfterLBP !== undefined ? (
                                            <span style={{ color: 'var(--orange-primary)', fontWeight: 'bold' }}>
                                                بعد الحركة: {Math.round(parseFloat(item.balanceAfterLBP)).toLocaleString()} ل.ل
                                            </span>
                                        ) : item.balanceAfterUSD !== undefined ? (
                                            <span style={{ color: 'var(--orange-primary)', fontWeight: 'bold' }}>
                                                بعد الحركة: ${parseFloat(item.balanceAfterUSD).toFixed(2)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'left' }}>
                                        {formatDateTime(item.date)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="btn-primary"
                    style={{ marginTop: '12px', height: '38px', fontSize: '12px' }}
                >
                    إغلاق
                </button>
            </div>
        </div>,
        document.body
    );
}