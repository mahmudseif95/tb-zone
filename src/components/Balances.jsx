import React, { useState } from 'react';
import { Wallet, Plus, ArrowDownCircle, ShieldCheck } from 'lucide-react';

export default function Balances({ sources, onAddSource, onDeposit }) {
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState(sources[0]?.id || '');
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBal, setNewWalletBal] = useState('');
  const [showAddWallet, setShowAddWallet] = useState(false);

  const total = sources.reduce((acc, s) => acc + (parseFloat(s.balance) || 0), 0);

  const handleDepositSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(depositAmount);
    if (!val || val <= 0) return;
    onDeposit(selectedSourceId, val);
    setDepositAmount('');
  };

  const handleAddWalletSubmit = (e) => {
    e.preventDefault();
    if (!newWalletName) return;
    onAddSource(newWalletName, parseFloat(newWalletBal) || 0);
    setNewWalletName('');
    setNewWalletBal('');
    setShowAddWallet(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* بطاقة السيولة الإجمالية */}
      <div style={{
        background: 'linear-gradient(135deg, #1C202C 0%, #12151D 100%)',
        border: '1px solid rgba(255, 122, 0, 0.25)',
        borderRadius: '20px',
        padding: '18px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>السيولة النقدية العامة</div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: 'var(--orange-primary)', marginTop: '2px' }}>
            ${total.toFixed(2)}
          </div>
        </div>
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '14px',
          background: 'rgba(255, 122, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--orange-primary)'
        }}>
          <Wallet size={24} />
        </div>
      </div>

      {/* شبكة كروت المحافظ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {sources.map((s) => (
          <div
            key={s.id}
            style={{
              background: '#161922',
              border: '1px solid #232734',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '80px'
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{s.name}</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#fff', marginTop: '6px' }}>
              ${parseFloat(s.balance).toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
              <ShieldCheck size={11} /> حساب نشط
            </div>
          </div>
        ))}
      </div>

      {/* زر إضافة محفظة جديدة */}
      {!showAddWallet ? (
        <button
          type="button"
          onClick={() => setShowAddWallet(true)}
          style={{
            background: 'transparent',
            border: '1px dashed #2E3446',
            color: 'var(--orange-primary)',
            padding: '10px',
            borderRadius: '14px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Plus size={15} /> إضافة محفظة أو صندوق جديد
        </button>
      ) : (
        <form onSubmit={handleAddWalletSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#161922', padding: '12px', borderRadius: '14px', border: '1px solid #262B3A' }}>
          <input
            type="text"
            className="tz-input"
            placeholder="اسم المحفظة الجديدة..."
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            required
          />
          <input
            type="number"
            step="any"
            className="tz-input"
            placeholder="الرصيد الافتتاحي ($)..."
            value={newWalletBal}
            onChange={(e) => setNewWalletBal(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="submit" className="btn-action-full" style={{ flex: 1, padding: '8px', justifyContent: 'center' }}>
              <span>إضافة</span>
            </button>
            <button type="button" onClick={() => setShowAddWallet(false)} className="btn-action-full" style={{ flex: 1, padding: '8px', justifyContent: 'center', background: '#222634' }}>
              <span>إلغاء</span>
            </button>
          </div>
        </form>
      )}

      {/* تعبئة وإيداع رصيد في المحفظة */}
      <form onSubmit={handleDepositSubmit} style={{ background: '#161922', padding: '14px', borderRadius: '16px', border: '1px solid #232734', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--orange-primary)' }}>إيداع نقدي في محفظة:</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            className="tz-select"
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            style={{ flex: 1 }}
          >
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="number"
            step="any"
            placeholder="المبلغ ($)..."
            className="tz-input"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            style={{ flex: 1 }}
            required
          />
        </div>
        <button type="submit" className="btn-action-full" style={{ justifyContent: 'center', padding: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowDownCircle size={15} /> تأكيد الإيداع بالصندوق
          </span>
        </button>
      </form>

    </div>
  );
}