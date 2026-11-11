import React, { useState, useEffect, useCallback } from 'react';
import './styles/theme.css';
import LoginScreen from './components/LoginScreen';
import RechargeHub from './components/RechargeHub';
import AlfaGift from './components/AlfaGift';
import SalesModal from './components/SalesModal';
import LockedLines from './components/LockedLines';
import Analytics from './components/Analytics';
import Customers from './components/Customers';
import Debts from './components/Debts';
import HomeDashboard from './components/HomeDashboard';
import SettingsModal from './components/SettingsModal';
import QuickToolsModal from './components/QuickToolsModal';
import ExpiryAlertBanner from './components/ExpiryAlertBanner';
import BottomNav from './components/BottomNav';
import WalletsManager from './components/WalletsManager';
import SplashScreen from './components/SplashScreen';
import ActionToast from './components/ActionToast';
import { formatDateTime } from './utils/dateFormatter';
import { api } from './services/api';
import {
  Users,
  TrendingUp,
  Wallet,
  Wrench,
  Settings,
  Sun,
  Moon,
  Check,
  ListOrdered
} from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('zt_token')));
  const [isLoadingBootstrap, setIsLoadingBootstrap] = useState(false);

  const [showSplash, setShowSplash] = useState(true);
  const [currentTab, setCurrentTab] = useState('home');
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showNotification = (message, subMessage = '') => {
    setToast({ message, subMessage });
  };

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('tb_theme') !== 'light');

  useEffect(() => {
    const themeName = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('tb_theme', themeName);
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const [brandConfig, setBrandConfig] = useState(() => {
    const saved = localStorage.getItem('tb_brand_config');
    return saved ? JSON.parse(saved) : {
      name: 'ZOLFA TECH',
      subtitle: 'OS TELECOM',
      phone: '78877026',
      logo: ''
    };
  });

  const [exchangeRate, setExchangeRate] = useState(() => {
    const saved = localStorage.getItem('tb_rate');
    return saved ? parseFloat(saved) : 89500;
  });
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRate.toString());

  const [sims, setSims] = useState(() => {
    const saved = localStorage.getItem('tb_sims');
    return saved ? JSON.parse(saved) : [];
  });

  const [sources, setSources] = useState(() => {
    const saved = localStorage.getItem('tb_sources');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map(s => ({
          ...s,
          balanceUSD: parseFloat(s.balanceUSD ?? s.balance ?? 0),
          balanceLBP: parseFloat(s.balanceLBP || 0)
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [lines, setLines] = useState(() => {
    const saved = localStorage.getItem('tb_locked_lines');
    return saved ? JSON.parse(saved) : [];
  });

  const [debts, setDebts] = useState(() => {
    const saved = localStorage.getItem('tb_debts');
    return saved ? JSON.parse(saved) : [];
  });

  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem('tb_customers');
    if (saved) {
      const list = JSON.parse(saved);
      const excludedNames = ['تغذية خط مسكر', 'حركة مباشرة', 'عام', 'ادمن', 'أدمن'];
      return list.filter(c => c && c.name && !excludedNames.includes(c.name.trim().toLowerCase()));
    }
    return [];
  });

  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('tb_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [salesHistory, setSalesHistory] = useState(() => {
    const saved = localStorage.getItem('tb_sales_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [currentTx, setCurrentTx] = useState({});

  // جلب كافة بيانات المتجر من MySQL
  const loadDataFromServer = useCallback(async () => {
    try {
      setIsLoadingBootstrap(true);
      const data = await api.fetchBootstrapData();
      if (data.brandConfig) setBrandConfig(data.brandConfig);
      if (data.exchangeRate) {
        setExchangeRate(data.exchangeRate);
        setTempRate(data.exchangeRate.toString());
      }
      if (data.sources) setSources(data.sources);
      if (data.sims) setSims(data.sims);
      if (data.lines) setLines(data.lines);
      if (data.debts) setDebts(data.debts);
      if (data.customers) setCustomers(data.customers);
      if (data.expenses) setExpenses(data.expenses);
      if (data.salesHistory) setSalesHistory(data.salesHistory);
    } catch (err) {
      console.error('Error fetching data from server:', err);
      if (err.message && (err.message.includes('انتهت الجلسة') || err.message.includes('تسجيل الدخول') || err.message.includes('مرفوض'))) {
        api.logout();
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoadingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDataFromServer();
    }
  }, [isAuthenticated, loadDataFromServer]);

  // حفظ نسخة احتياطية محلية متزامنة
  useEffect(() => {
    localStorage.setItem('tb_brand_config', JSON.stringify(brandConfig));
    localStorage.setItem('tb_rate', exchangeRate.toString());
    localStorage.setItem('tb_sims', JSON.stringify(sims));
    localStorage.setItem('tb_sources', JSON.stringify(sources));
    localStorage.setItem('tb_locked_lines', JSON.stringify(lines));
    localStorage.setItem('tb_debts', JSON.stringify(debts));
    localStorage.setItem('tb_customers', JSON.stringify(customers));
    localStorage.setItem('tb_expenses', JSON.stringify(expenses));
    localStorage.setItem('tb_sales_history', JSON.stringify(salesHistory));
  }, [brandConfig, exchangeRate, sims, sources, lines, debts, customers, expenses, salesHistory]);

  const handleSaveRate = async () => {
    const val = parseFloat(tempRate);
    if (val && val > 0) {
      setExchangeRate(val);
      setIsEditingRate(false);
      try {
        await api.updateExchangeRate(val);
        showNotification('تم تحديث سعر الصرف بنجاح', `$1 = ${val.toLocaleString()} ل.ل`);
      } catch (e) {
        showNotification('تم التحديث محلياً (تعذر الاتصال بالسيرفر)');
      }
    }
  };

  const handleUpdateSourceBalance = (sourceId, newBalanceUSD, newBalanceLBP = null) => {
    setSources(prev => prev.map(s => {
      if (s.id === sourceId) {
        return {
          ...s,
          balanceUSD: newBalanceUSD,
          balance: newBalanceUSD,
          ...(newBalanceLBP !== null ? { balanceLBP: newBalanceLBP } : {})
        };
      }
      return s;
    }));
    showNotification('تم تعديل رصيد الصندوق بنجاح');
  };

  const handleAddSource = async (name, initialUSD = 0, initialLBP = 0) => {
    try {
      await api.addSource({ name, initialUSD, initialLBP });
      await loadDataFromServer(); // إعادة جلب البيانات فوراً من MySQL
      showNotification('تمت إضافة محفظة جديدة بنجاح', name);
    } catch (err) {
      console.error('Add source error:', err);
      showNotification('خطأ في إضافة المحفظة بالسيرفر', err.message);
    }
  };

  const handleUpdateSource = async (id, fields) => {
    try {
      await api.updateSource(id, fields);
      await loadDataFromServer();
      showNotification('تم تحديث بيانات المحفظة');
    } catch (err) {
      console.error('Update source error:', err);
      showNotification('خطأ في تحديث المحفظة', err.message);
    }
  };

  const handleDeleteSource = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحفظة نهائياً من قاعدة البيانات؟')) return;

    try {
      await api.deleteSource(id);
      await loadDataFromServer();
      showNotification('تم حذف المحفظة بنجاح');
    } catch (err) {
      console.error('Delete source error:', err);
      showNotification('خطأ في حذف المحفظة بالسيرفر', err.message);
    }
  };

  const handleRecordDebtSale = (debtSaleData) => {
    const saleUSD = debtSaleData.currency === 'LBP' ? (parseFloat(debtSaleData.sellingPrice) / exchangeRate) : parseFloat(debtSaleData.sellingPrice);
    const costUSD = parseFloat(debtSaleData.costUSD || 0);
    const profitUSD = debtSaleData.profitUSD !== undefined ? parseFloat(debtSaleData.profitUSD) : Math.max(0, saleUSD - costUSD);

    const recordWithProfit = {
      ...debtSaleData,
      profitUSD: parseFloat(profitUSD.toFixed(2)),
      costUSD: parseFloat(costUSD.toFixed(2)),
      date: debtSaleData.date || new Date().toISOString()
    };
    setSalesHistory(prev => [recordWithProfit, ...prev]);
  };

  // تسجيل حركات المحافظ مع السيرفر
  const handleRecordWalletTx = async (walletId, tx) => {
    try {
      await api.recordWalletTx(walletId, { ...tx, daysFxRate: exchangeRate });
      await loadDataFromServer();
      showNotification('تم تسجيل حركة الصندوق بنجاح', tx.type === 'deposit' ? 'إيداع نقدي' : 'سحب نقدي');
    } catch (err) {
      console.error('Wallet TX error:', err);
      showNotification('خطأ في حفظ حركة الصندوق بالسيرفر', err.message);
    }
  };

  // بيع حصص ALFA GIFT مع السيرفر
  const handleExecuteAlfaGiftSale = async (giftData) => {
    try {
      await api.executeAlfaGiftSale(giftData);
      await loadDataFromServer();
      showNotification('تم تثبيت خدمة ALFA GIFT', 'سُددت المحافظ وحُفظت ديون المشتركين بدقة');
    } catch (err) {
      console.error('Alfa Gift error:', err);
      showNotification('خطأ أثناء تثبيت Alfa Gift', err.message);
    }
  };

  // تثبيت بيع الرصيد مع السيرفر
  const handleConfirmSale = async (confirmedData) => {
    try {
      await api.executeSale({ ...confirmedData, exchangeRate });
      await loadDataFromServer();
      setModalOpen(false);
      showNotification('تمت عملية البيع بنجاح', confirmedData.itemName);
    } catch (err) {
      console.error('Sale error:', err);
      showNotification('خطأ أثناء حفظ العملية', err.message);
    }
  };

  const handleRecordSaleFromLine = (saleItem) => {
    const saleUSDVal = saleItem.currency === 'LBP' ? (parseFloat(saleItem.sellingPrice) / exchangeRate) : parseFloat(saleItem.sellingPrice);
    const targetLineId = saleItem.targetLineId || saleItem.lockedLineId;

    let costAssigned = 0;
    let profitUSDVal = saleUSDVal;
    let walletRefundMap = {};

    setDebts(prevDebts => {
      let updatedDebts = [...prevDebts];

      if (targetLineId) {
        let remSale = saleUSDVal;
        const targetLine = lines.find(l => l.id === targetLineId);
        const lineLabel = targetLine ? `خط #${targetLine.slotNumber || 1}` : 'خط';

        const matchingDebts = updatedDebts
          .filter(d => !d.paid && d.category === 'boxes' && d.targetLineId === targetLineId)
          .sort((a, b) => (new Date(a.createdAt || a.dueDate || 0)) - (new Date(b.createdAt || b.dueDate || 0)));

        if (matchingDebts.length > 0) {
          updatedDebts = updatedDebts.map(d => {
            if (!d.paid && d.category === 'boxes' && d.targetLineId === targetLineId && remSale > 0) {
              const dRem = parseFloat(d.amount) || 0;
              if (dRem > 0) {
                const pay = Math.min(remSale, dRem);
                remSale -= pay;
                costAssigned += pay;

                if (d.sourceWalletId) {
                  walletRefundMap[d.sourceWalletId] = (walletRefundMap[d.sourceWalletId] || 0) + pay;
                }

                const newAmount = parseFloat((dRem - pay).toFixed(2));
                return {
                  ...d,
                  amount: newAmount,
                  paid: newAmount <= 0.01,
                  history: [
                    ...(d.history || []),
                    {
                      id: `tx_pay_${Date.now()}`,
                      date: new Date().toISOString(),
                      type: 'payment',
                      amount: pay,
                      currency: 'USD',
                      notes: `سداد من مبيع حصة ${lineLabel}`
                    }
                  ]
                };
              }
            }
            return d;
          });
        }
      }

      if (saleItem.isDebt) {
        updatedDebts.unshift({
          id: Date.now().toString(),
          category: 'customers',
          name: saleItem.customerName || 'عميل',
          amount: parseFloat(saleItem.sellingPrice),
          originalAmount: parseFloat(saleItem.sellingPrice),
          currency: saleItem.currency || 'USD',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          paid: false,
          notes: saleItem.itemName,
          createdAt: new Date().toISOString(),
          history: [{
            id: `tx_${Date.now()}`,
            date: new Date().toISOString(),
            type: 'debt',
            amount: parseFloat(saleItem.sellingPrice),
            currency: saleItem.currency || 'USD',
            notes: saleItem.itemName
          }]
        });
      }

      return updatedDebts;
    });

    profitUSDVal = Math.max(0, parseFloat((saleUSDVal - costAssigned).toFixed(2)));

    if (Object.keys(walletRefundMap).length > 0) {
      setSources(prev => prev.map(s => {
        if (walletRefundMap[s.id]) {
          const refund = walletRefundMap[s.id];
          const curUSD = parseFloat(s.balanceUSD ?? s.balance ?? 0);
          const updatedUSD = parseFloat((curUSD + refund).toFixed(2));
          return {
            ...s,
            balanceUSD: updatedUSD,
            balance: updatedUSD,
            ledger: [
              {
                id: `tx_return_${Date.now()}_${s.id}`,
                type: 'deposit',
                itemName: `استرداد تكلفة حصة من خط مسكر`,
                amount: refund,
                currency: 'USD',
                balanceAfterUSD: updatedUSD,
                date: new Date().toISOString()
              },
              ...(s.ledger || [])
            ]
          };
        }
        return s;
      }));
    }

    const saleWithDate = {
      ...saleItem,
      costUSD: parseFloat(costAssigned.toFixed(2)),
      profitUSD: parseFloat(profitUSDVal.toFixed(2)),
      date: saleItem.date || new Date().toISOString()
    };
    setSalesHistory(prev => [saleWithDate, ...prev]);

    const cleanName = (saleItem.customerName || '').trim();
    if (cleanName && !['تغذية خط مسكر', 'عام', 'حركة مباشرة'].includes(cleanName.toLowerCase())) {
      setCustomers(prev => {
        if (!prev.some(c => c.name?.toLowerCase() === cleanName.toLowerCase())) {
          return [{
            id: Date.now().toString(),
            name: cleanName,
            phone: saleItem.customerPhone || '',
            address: ''
          }, ...prev];
        }
        return prev;
      });
    }

    showNotification('تم تسجيل حصة المشترك بنجاح', saleItem.itemName);
  };

  const totalBalanceUSD = sources.reduce((acc, curr) => acc + (parseFloat(curr.balanceUSD ?? curr.balance ?? 0)), 0).toFixed(2);
  const unreadDebtsCount = debts.filter(d => !d.paid).length;

  // في حال لم يكن مسجل الدخول، يتم عرض شاشة الدخول أولاً
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-main)', color: 'var(--text-main)', paddingBottom: 'calc(var(--total-nav-height) + 24px)' }}>

      {showSplash && (
        <SplashScreen
          logo={brandConfig.logo}
          brandName={brandConfig.name}
          onFinish={() => setShowSplash(false)}
        />
      )}

      {toast && (
        <ActionToast
          message={toast.message}
          subMessage={toast.subMessage}
          onClose={() => setToast(null)}
        />
      )}

      {/* هيدر النظام */}
      <div style={{ position: 'sticky', top: 0, zIndex: 90, background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', backdropFilter: 'blur(12px)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {brandConfig?.logo ? (
              <img
                src={brandConfig.logo}
                alt={brandConfig.name || 'Logo'}
                className="live-custom-logo mobile-btn"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '1.5px solid var(--orange-primary)',
                  cursor: 'pointer'
                }}
              />
            ) : (
              <div
                className="live-alfa mobile-btn"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#DC2626',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  userSelect: 'none',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '8px', lineHeight: 1, fontWeight: 'bold' }}>alfa</span>
                <span style={{ fontSize: '18px', lineHeight: 1, fontWeight: '900' }}>α</span>
              </div>
            )}

            <div>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                {brandConfig.name}
              </h1>
              <p style={{ margin: 0, fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                {brandConfig.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '0 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>

          <div
            className="mobile-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card-sub)', padding: '5px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>$1 =</span>
            {isEditingRate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  value={tempRate}
                  onChange={e => setTempRate(e.target.value)}
                  style={{ width: '70px', padding: '2px 4px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--orange-primary)', background: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 'bold' }}
                  autoFocus
                />
                <button onClick={handleSaveRate} style={{ background: 'var(--orange-primary)', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 6px', cursor: 'pointer' }}>
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <span
                onClick={() => { setTempRate(exchangeRate.toString()); setIsEditingRate(true); }}
                style={{ fontSize: '13px', fontWeight: '900', color: 'var(--orange-primary)' }}
                title="اضغط لتعديل سعر الصرف"
              >
                {exchangeRate.toLocaleString()} ل.ل
              </span>
            )}

            <span style={{ position: 'relative', width: '8px', height: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="live-radar" style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: '#10B981' }}></span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={toggleTheme}
              className="mobile-btn"
              style={{
                background: 'var(--bg-card-sub)',
                border: '1px solid var(--border-color)',
                color: darkMode ? '#FBBF24' : '#1E293B',
                borderRadius: '10px',
                padding: '6px 9px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="live-theme" style={{ display: 'inline-flex' }}>
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('wallets')}
              className="mobile-btn live-wallet"
              style={{
                background: currentTab === 'wallets' ? 'var(--orange-primary)' : 'var(--bg-card-sub)',
                color: currentTab === 'wallets' ? '#fff' : 'var(--text-main)',
                border: '1.5px solid var(--orange-primary)',
                borderRadius: '10px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              <Wallet size={14} />
              <span>المحافظ (${totalBalanceUSD})</span>
            </button>

            <button
              onClick={() => setCurrentTab('transactions')}
              className="mobile-btn"
              style={{ background: currentTab === 'transactions' ? 'var(--orange-primary)' : 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: currentTab === 'transactions' ? '#fff' : 'var(--text-main)', borderRadius: '10px', padding: '6px 8px', cursor: 'pointer' }}
              title="سجل العمليات"
            >
              <span className="live-list" style={{ display: 'inline-flex' }}>
                <ListOrdered size={15} />
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('analytics')}
              className="mobile-btn"
              style={{ background: currentTab === 'analytics' ? 'var(--orange-primary)' : 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: currentTab === 'analytics' ? '#fff' : 'var(--text-main)', borderRadius: '10px', padding: '6px 8px', cursor: 'pointer' }}
              title="الجرد"
            >
              <span className="live-chart" style={{ display: 'inline-flex' }}>
                <TrendingUp size={15} />
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('customers')}
              className="mobile-btn"
              style={{ background: currentTab === 'customers' ? 'var(--orange-primary)' : 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: currentTab === 'customers' ? '#fff' : 'var(--text-main)', borderRadius: '10px', padding: '6px 8px', cursor: 'pointer' }}
              title="الزبائن"
            >
              <span className="live-users" style={{ display: 'inline-flex' }}>
                <Users size={15} />
              </span>
            </button>

            <button
              onClick={() => setShowToolsModal(true)}
              className="mobile-btn"
              style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '10px', padding: '6px 8px', cursor: 'pointer' }}
              title="أدوات"
            >
              <span className="live-wrench" style={{ display: 'inline-flex' }}>
                <Wrench size={15} />
              </span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="mobile-btn"
              style={{ background: 'var(--bg-card-sub)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '10px', padding: '6px 8px', cursor: 'pointer' }}
              title="الإعدادات"
            >
              <span className="live-gear" style={{ display: 'inline-flex' }}>
                <Settings size={15} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <main className="animate-tab-enter" style={{ padding: '14px', maxWidth: '440px', margin: '0 auto' }}>
        <ExpiryAlertBanner lines={lines} onNavigate={(tab) => setCurrentTab(tab)} />

        {currentTab === 'home' && (
          <HomeDashboard
            sources={sources}
            salesHistory={salesHistory}
            lines={lines}
            debts={debts}
            exchangeRate={exchangeRate}
            onNavigate={(tab) => setCurrentTab(tab)}
            onUpdateSourceBalance={handleUpdateSourceBalance}
          />
        )}

        {currentTab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="tz-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900' }}>سجل العمليات والحركات</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي العمليات: {salesHistory.length}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {salesHistory.length === 0 ? (
                <div className="tz-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  لا توجد عمليات مسجلة بعد.
                </div>
              ) : (
                salesHistory.map((item, idx) => {
                  const saleUSD = item.currency === 'LBP' ? (item.sellingPrice / exchangeRate) : item.sellingPrice;
                  const profitUSD = item.profitUSD !== undefined ? item.profitUSD : Math.max(0, saleUSD - (item.costUSD || 0));

                  return (
                    <div key={item.id || idx} className="tz-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '900', fontSize: '13px', color: 'var(--orange-primary)' }}>{item.itemName || item.title}</span>
                        <span style={{ fontWeight: '900', fontSize: '14px' }}>
                          {parseFloat(item.sellingPrice).toLocaleString()} {item.currency === 'LBP' ? 'ل.ل' : '$'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>الزبون: <b>{item.customerName || 'عام'}</b></span>
                        <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>صافي الربح: +${parseFloat(profitUSD).toFixed(2)}</span>
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {item.notes}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'left', direction: 'ltr' }}>
                        {formatDateTime(item.date)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {currentTab === 'wallets' && (
          <WalletsManager
            sources={sources}
            customers={customers}
            sims={sims}
            lines={lines}
            onAddSource={handleAddSource}
            onUpdateSource={handleUpdateSource}
            onDeleteSource={handleDeleteSource}
            onRecordWalletTx={handleRecordWalletTx}
            onUpdateLines={setLines}
            onAddDebt={(newDebt) => setDebts(prev => [newDebt, ...prev])}
            exchangeRate={exchangeRate}
          />
        )}

        {currentTab === 'recharge' && (
          <RechargeHub
            sims={sims}
            onAddSimBatch={(newSim) => setSims([newSim, ...sims])}
            onUpdateSim={(id, fields) => setSims(sims.map(s => s.id === id ? { ...s, ...fields } : s))}
            onDeleteSim={(id) => setSims(sims.filter(s => s.id !== id))}
            onExecuteMultiSale={(saleData) => {
              setCurrentTx(saleData);
              setModalOpen(true);
            }}
            exchangeRate={exchangeRate}
            onUpdateExchangeRate={(r) => setExchangeRate(r)}
          />
        )}

        {currentTab === 'alfa_gift' && (
          <AlfaGift
            sims={sims}
            lockedLines={lines}
            onExecuteAlfaGiftSale={handleExecuteAlfaGiftSale}
            exchangeRate={exchangeRate}
          />
        )}

        {currentTab === 'lines' && (
          <LockedLines
            lines={lines}
            customers={customers}
            onAddLine={(l) => setLines([l, ...lines])}
            onUpdateLine={(id, updater) => setLines(lines.map(l => l.id === id ? updater(l) : l))}
            onDeleteLine={(id) => setLines(lines.filter(l => l.id !== id))}
            onRecordSaleFromLine={handleRecordSaleFromLine}
            exchangeRate={exchangeRate}
          />
        )}

        {currentTab === 'debts' && (
          <Debts
            exchangeRate={exchangeRate}
            debts={debts}
            sources={sources}
            onUpdateDebts={(d) => setDebts([...d])}
            onRecordDebtSale={handleRecordDebtSale}
            onUpdateSourceBalance={handleUpdateSourceBalance}
            onRefreshData={loadDataFromServer}
          />
        )}

        {currentTab === 'analytics' && (
          <Analytics
            salesHistory={salesHistory}
            sources={sources}
            debts={debts}
            brandConfig={brandConfig}
            exchangeRate={exchangeRate}
          />
        )}

        {currentTab === 'customers' && (
          <Customers
            customers={customers}
            salesHistory={salesHistory}
            debts={debts}
            onAddCustomer={(c) => setCustomers([c, ...customers])}
            onUpdateCustomer={(id, f) => setCustomers(customers.map(c => c.id === id ? { ...c, ...f } : c))}
            onDeleteCustomer={(id) => setCustomers(customers.filter(c => c.id !== id))}
            brandConfig={brandConfig}
            exchangeRate={exchangeRate}
          />
        )}
      </main>

      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        unreadDebtsCount={unreadDebtsCount}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        brandConfig={brandConfig}
        onUpdateBrand={async (cfg) => {
          setBrandConfig(cfg);
          try {
            await api.updateBrand(cfg);
          } catch (err) {
            console.error('Update brand error:', err);
          }
        }}
        onLogout={() => {
          api.logout();
          setIsAuthenticated(false);
          setShowSettingsModal(false);
        }}
        onResetAllData={() => { localStorage.clear(); window.location.reload(); }}
      />

      <QuickToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        exchangeRate={exchangeRate}
        sims={sims}
        onTransferBalance={(fromId, toId, credits) => {
          const tax = 0.14;
          setSims(sims.map(s => {
            const curBal = (s.batches && s.batches.length > 0)
              ? s.batches.reduce((sum, b) => sum + (parseFloat(b.remainingUSD) || 0), 0)
              : (parseFloat(s.balance) || 0);

            if (s.id === fromId) {
              const newBal = parseFloat((curBal - (credits + tax)).toFixed(2));
              return { ...s, balance: newBal };
            }
            if (s.id === toId) {
              const newBal = parseFloat((curBal + credits).toFixed(2));
              return { ...s, balance: newBal };
            }
            return s;
          }));
          showNotification('تم تحويل الرصيد بين الشرائح بنجاح', `$${credits} رصيد`);
        }}
        onAddExpense={(exp) => setExpenses([exp, ...expenses])}
        expenses={expenses}
        sources={sources}
        salesHistory={salesHistory}
        debts={debts}
      />

      <SalesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        transactionData={currentTx}
        onConfirm={handleConfirmSale}
        customers={customers}
      />
    </div>
  );
}