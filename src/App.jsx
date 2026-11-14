import React, { useState, useEffect, useCallback } from 'react';
import './styles/theme.css';
import LoginScreen from './components/LoginScreen';
import RechargeHub from './components/RechargeHub';
import AlfaGift from './components/AlfaGift';
import SalesModal from './components/SalesModal';
import LockedLines from './components/lines/LockedLines';
import Analytics from './components/Analytics';
import Customers from './components/Customers';
import Debts from './components/Debts';
import HomeDashboard from './components/HomeDashboard';
import SettingsModal from './components/SettingsModal';
import QuickToolsModal from './components/QuickToolsModal';
import ExpiryAlertBanner from './components/ExpiryAlertBanner';
import BottomNav from './components/BottomNav';
import WalletsManager from './components/wallets/WalletsManager';
import SplashScreen from './components/SplashScreen';
import ActionToast from './components/ActionToast';
import ShopSetupModal from './components/ShopSetupModal';
import DeveloperFooter from './components/DeveloperFooter';
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
  ListOrdered,
  RotateCcw,
  Info
} from 'lucide-react';

const OP_TYPE_META = {
  card_purchase: { label: 'شراء كارت', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)' },
  days_year: { label: 'دورة سنة أيام', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' },
  ushare: { label: 'U-Share', color: '#FF7A00', bg: 'rgba(255, 122, 0, 0.14)' },
  alfa_gift: { label: 'Alfa Gift', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.14)' },
  recharge_sale: { label: 'بيع رصيد', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)' },
  wallet_sale: { label: 'مبيع محفظة', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)' },
  wallet_deposit: { label: 'إيداع محفظة', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)' },
  wallet_withdrawal: { label: 'سحب محفظة', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)' },
  wallet_transfer: { label: 'تحويل محافظ', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.14)' },
  fx_exchange: { label: 'صرافة FX', color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.14)' },
  source_adjust: { label: 'تسوية صندوق', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.14)' },
  debt_create: { label: 'تسجيل دين', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.14)' },
  debt_payment: { label: 'تسديد دين', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.14)' },
  expense: { label: 'مصروف', color: '#E11D48', bg: 'rgba(225, 29, 72, 0.14)' },
  sim_transfer: { label: 'تحويل شرائح', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.14)' },
  sim_topup: { label: 'تعبئة شريحة', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.14)' }
};

const NON_SALE_OP_TYPES = new Set([
  'card_purchase',
  'wallet_deposit',
  'wallet_withdrawal',
  'wallet_transfer',
  'fx_exchange',
  'source_adjust',
  'debt_create',
  'debt_payment',
  'expense',
  'sim_transfer',
  'sim_topup'
]);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('zt_token')));
  const [hasLoadedServerData, setHasLoadedServerData] = useState(false);

  const [showSplash, setShowSplash] = useState(true);
  const [currentTab, setCurrentTab] = useState('home');
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [txFilter, setTxFilter] = useState('all'); // 'all' | 'sales' | 'cards' | 'wallets' | 'debts_exp'
  const [rollingBackId, setRollingBackId] = useState(null);

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
      name: '',
      subtitle: '',
      phone: '',
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

  const [serviceCycles, setServiceCycles] = useState([]);

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

  const loadDataFromServer = useCallback(async () => {
    try {
      const data = await api.fetchBootstrapData();
      if (data.brandConfig) setBrandConfig(data.brandConfig);
      if (data.exchangeRate) {
        setExchangeRate(data.exchangeRate);
        setTempRate(data.exchangeRate.toString());
      }
      if (data.sources) setSources(data.sources);
      if (data.sims) setSims(data.sims);
      if (data.lines) setLines(data.lines);
      if (data.serviceCycles) setServiceCycles(data.serviceCycles);
      if (data.debts) setDebts(data.debts);
      if (data.customers) setCustomers(data.customers);
      if (data.expenses) setExpenses(data.expenses);
      if (data.salesHistory) setSalesHistory(data.salesHistory);
      setHasLoadedServerData(true);
    } catch (err) {
      console.error('Error fetching data from server:', err);
      if (err.message && (err.message.includes('انتهت الجلسة') || err.message.includes('تسجيل الدخول') || err.message.includes('مرفوض'))) {
        api.logout();
        setIsAuthenticated(false);
        setHasLoadedServerData(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDataFromServer();
    }
  }, [isAuthenticated, loadDataFromServer]);

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

  const handleSaveRate = async (customVal = null) => {
    const val = customVal !== null ? parseFloat(customVal) : parseFloat(tempRate);
    if (val && val > 0) {
      setExchangeRate(val);
      setTempRate(val.toString());
      setIsEditingRate(false);
      try {
        await api.updateExchangeRate(val);
        showNotification('تم تحديث سعر الصرف بنجاح', `$1 = ${val.toLocaleString()} ل.ل`);
      } catch (e) {
        showNotification('تم التحديث محلياً (تعذر الاتصال بالسيرفر)');
      }
    }
  };

  const handleUpdateSourceBalance = async (sourceId, newBalanceUSD, newBalanceLBP = null) => {
    try {
      await api.updateSource(sourceId, {
        balanceUSD: newBalanceUSD,
        ...(newBalanceLBP !== null ? { balanceLBP: newBalanceLBP } : {})
      });
      await loadDataFromServer();
      showNotification('تم تعديل رصيد الصندوق بنجاح');
    } catch (err) {
      console.error('Update balance error:', err);
      showNotification('خطأ في تعديل رصيد الصندوق بالسيرفر', err.message);
    }
  };

  const handleAddSource = async (name, initialUSD = 0, initialLBP = 0) => {
    try {
      await api.addSource({ name, initialUSD, initialLBP });
      await loadDataFromServer();
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

  const handleAddSimBatch = async (newSim) => {
    try {
      await api.addSim(newSim);
      await loadDataFromServer();
      showNotification('تمت إضافة الشريحة والرصيد بنجاح', newSim.name);
    } catch (err) {
      console.error('Add SIM error:', err);
      showNotification('خطأ في حفظ الشريحة بالسيرفر', err.message);
    }
  };

  const handleUpdateSim = async (id, fields) => {
    try {
      const existingSim = sims.find(s => s.id === id);
      let newBatch = null;

      if (fields.batches && existingSim) {
        const oldIds = new Set((existingSim.batches || []).map(b => b.id));
        const added = fields.batches.find(b => !oldIds.has(b.id));
        if (added) {
          newBatch = added;
        }
      }

      await api.updateSim(id, { ...fields, ...(newBatch ? { newBatch } : {}) });
      await loadDataFromServer();
      showNotification('تم تحديث بيانات الشريحة بنجاح');
    } catch (err) {
      console.error('Update SIM error:', err);
      showNotification('خطأ في تحديث الشريحة بالسيرفر', err.message);
    }
  };

  const handleDeleteSim = async (id) => {
    try {
      await api.deleteSim(id);
      await loadDataFromServer();
      showNotification('تم حذف الشريحة بنجاح');
    } catch (err) {
      console.error('Delete SIM error:', err);
      showNotification('خطأ في حذف الشريحة بالسيرفر', err.message);
    }
  };

  const handleTransferSimBalance = async (fromId, toId, credits) => {
    try {
      await api.transferSimBalance({ fromSimId: fromId, toSimId: toId, credits, tax: 0.14 });
      await loadDataFromServer();
      showNotification('تم تحويل الرصيد بين الشرائح بنجاح', `$${credits} رصيد`);
    } catch (err) {
      console.error('Transfer SIM balance error:', err);
      showNotification('خطأ أثناء تحويل الرصيد', err.message);
    }
  };

  const handleAddLine = async (newLine) => {
    try {
      await api.addLine(newLine);
      await loadDataFromServer();
      showNotification('تمت إضافة الخط بنجاح');
    } catch (err) {
      console.error('Add line error:', err);
      showNotification('خطأ في إضافة الخط بالسيرفر', err.message);
    }
  };

  const handleUpdateLine = async (id, updater) => {
    try {
      const currentLine = lines.find(l => l.id === id);
      if (!currentLine) return;
      const updatedLine = typeof updater === 'function' ? updater(currentLine) : { ...currentLine, ...updater };
      await api.updateLine(id, updatedLine);
      await loadDataFromServer();
      showNotification('تم تحديث بيانات الخط بنجاح');
    } catch (err) {
      console.error('Update line error:', err);
      showNotification('خطأ في تحديث الخط بالسيرفر', err.message);
    }
  };

  const handleDeleteLine = async (id) => {
    try {
      await api.deleteLine(id);
      await loadDataFromServer();
      showNotification('تم حذف الخط بنجاح');
    } catch (err) {
      console.error('Delete line error:', err);
      showNotification('خطأ في حذف الخط بالسيرفر', err.message);
    }
  };

  const handleBulkUpdateLines = async (updaterOrList) => {
    const nextList = typeof updaterOrList === 'function' ? updaterOrList(lines) : updaterOrList;
    setLines(nextList);
    try {
      for (const updated of nextList) {
        const prev = lines.find(l => l.id === updated.id);
        if (prev && JSON.stringify(prev) !== JSON.stringify(updated)) {
          await api.updateLine(updated.id, updated);
        }
      }
      await loadDataFromServer();
    } catch (err) {
      console.error('Bulk update lines error:', err);
    }
  };

  const handleExecuteAlfaGiftSale = async (giftData) => {
    try {
      await api.executeAlfaGiftSale(giftData);
      await loadDataFromServer();
      showNotification(
        giftData.mode === 'direct_gift' ? 'تم تثبيت بيع Alfa Gift بنجاح' : 'تم تثبيت وتوزيع حصص U-Share بنجاح',
        'تم تحديث الأرصدة والديون في قاعدة البيانات'
      );
    } catch (err) {
      console.error('Alfa Gift error:', err);
      showNotification('خطأ أثناء تثبيت العملية', err.message);
    }
  };

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

  const handleRecordSaleFromLine = async (saleItem) => {
    try {
      const targetLineId = saleItem.targetLineId || saleItem.lockedLineId || null;
      await api.executeAlfaGiftSale({
        mode: 'direct_gift',
        simId: null,
        selectedBatchId: null,
        deductUSD: 0,
        lockedLineId: targetLineId,
        totalGB: saleItem.gb || 0,
        recipients: [
          {
            itemName: saleItem.itemName,
            name: (saleItem.customerName || '').trim() || 'عام',
            phone: saleItem.customerPhone || '',
            customerType: saleItem.customerType || 'customers',
            gb: saleItem.gb || '',
            price: parseFloat(saleItem.sellingPrice) || 0,
            currency: saleItem.currency || 'USD',
            paymentType: saleItem.paymentType || (saleItem.isDebt ? 'debt' : 'cash'),
            paidAmount: saleItem.paidAmount,
            remainingDebt: saleItem.remainingDebt,
            isDebt: Boolean(saleItem.isDebt)
          }
        ],
        exchangeRate
      });
      await loadDataFromServer();
      showNotification('تم تسجيل حصة المشترك بنجاح', saleItem.itemName);
    } catch (err) {
      console.error('Record sale from line error:', err);
      showNotification('خطأ أثناء تسجيل حصة المشترك', err.message);
    }
  };

  const handleRollbackOperation = async (op) => {
    const isRoot = op.type === 'card_purchase' || op.type === 'days_year' || op.meta?.isCycleRoot;
    const confirmMsg = isRoot
      ? 'تنبيه: هذه عملية أساسية مرتبطة بدورة!\nالتراجع عنها سيحذف تلقائياً كافة المشتركين والديون والحصص المندرجة تحتها، ويُعيد الأرصدة والمبالغ إلى المحفظة والخط.\n\nهل تريد تأكيد التراجع الكامل؟'
      : 'هل تريد التراجع عن هذه العملية؟ سيتم عكس أثرها المالي وإلغاء أي دين أو مصروف مرتبط بها.';

    if (!window.confirm(confirmMsg)) return;

    try {
      setRollingBackId(op.id);
      await api.rollbackOperation(op.id);
      await loadDataFromServer();
      showNotification('تم التراجع عن العملية بنجاح', 'تمت استعادة الأرصدة وإلغاء القيود المرتبطة');
    } catch (err) {
      console.error('Rollback error:', err);
      showNotification('فشل التراجع عن العملية', err.message);
    } finally {
      setRollingBackId(null);
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

  const handleAddCustomer = async (c) => {
    try {
      await api.addCustomer(c);
      await loadDataFromServer();
      showNotification('تمت إضافة الزبون بنجاح', c.name);
    } catch (err) {
      console.error('Add customer error:', err);
      showNotification('خطأ في إضافة الزبون بالسيرفر', err.message);
    }
  };

  const handleUpdateCustomer = async (id, fields) => {
    try {
      await api.updateCustomer(id, fields);
      await loadDataFromServer();
      showNotification('تم تحديث بيانات الزبون');
    } catch (err) {
      console.error('Update customer error:', err);
      showNotification('خطأ في تحديث الزبون', err.message);
    }
  };

  const handleDeleteCustomer = async (id) => {
    try {
      await api.deleteCustomer(id);
      await loadDataFromServer();
      showNotification('تم حذف الزبون بنجاح');
    } catch (err) {
      console.error('Delete customer error:', err);
      showNotification('خطأ في حذف الزبون بالسيرفر', err.message);
    }
  };

  const handleAddExpense = async (exp) => {
    try {
      await api.addExpense(exp);
      await loadDataFromServer();
      showNotification('تم تسجيل المصروف بنجاح', exp.title);
    } catch (err) {
      console.error('Add expense error:', err);
      showNotification('خطأ في تسجيل المصروف بالسيرفر', err.message);
    }
  };

  const handleLogoutClean = () => {
    api.logout();
    localStorage.removeItem('tb_brand_config');
    localStorage.removeItem('tb_sources');
    localStorage.removeItem('tb_sims');
    localStorage.removeItem('tb_locked_lines');
    localStorage.removeItem('tb_debts');
    localStorage.removeItem('tb_customers');
    localStorage.removeItem('tb_expenses');
    localStorage.removeItem('tb_sales_history');
    setBrandConfig({ name: '', subtitle: '', phone: '', logo: '' });
    setHasLoadedServerData(false);
    setIsAuthenticated(false);
    setShowSettingsModal(false);
  };

  const totalBalanceUSD = sources.reduce((acc, curr) => acc + (parseFloat(curr.balanceUSD ?? curr.balance ?? 0)), 0).toFixed(2);
  const unreadDebtsCount = debts.filter(d => !d.paid).length;

  const filteredOperations = salesHistory.filter(item => {
    if (txFilter === 'all') return true;
    if (txFilter === 'cards') return item.type === 'card_purchase' || item.type === 'days_year' || item.type === 'sim_topup' || item.type === 'sim_transfer';
    if (txFilter === 'wallets') return ['wallet_deposit', 'wallet_withdrawal', 'wallet_transfer', 'fx_exchange', 'source_adjust'].includes(item.type);
    if (txFilter === 'debts_exp') return ['debt_create', 'debt_payment', 'expense'].includes(item.type);
    if (txFilter === 'sales') return ['recharge_sale', 'ushare', 'alfa_gift', 'wallet_sale', 'sale'].includes(item.type);
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
        <div style={{ flex: 1 }}>
          <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
        </div>
        <DeveloperFooter />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-main)', color: 'var(--text-main)', paddingBottom: 'calc(var(--total-nav-height) + 24px)' }}>

      {showSplash && (
        <SplashScreen
          logo={brandConfig.logo}
          brandName={brandConfig.name || 'TELECOM OS'}
          onFinish={() => setShowSplash(false)}
        />
      )}

      <ShopSetupModal
        isOpen={hasLoadedServerData && !brandConfig?.name?.trim()}
        onComplete={(newBrand) => setBrandConfig(prev => ({ ...prev, ...newBrand }))}
      />

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
                {brandConfig.name || 'متجر الاتصالات'}
              </h1>
              {brandConfig.subtitle && (
                <p style={{ margin: 0, fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  {brandConfig.subtitle}
                </p>
              )}
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
                <button onClick={() => handleSaveRate()} style={{ background: 'var(--orange-primary)', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 6px', cursor: 'pointer' }}>
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
            customers={customers}
            brandConfig={brandConfig}
            exchangeRate={exchangeRate}
            onNavigate={(tab) => setCurrentTab(tab)}
            onUpdateSourceBalance={handleUpdateSourceBalance}
          />
        )}

        {currentTab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="tz-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900' }}>سجل العمليات الشامل</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    كافة الحركات مع الشرح والتراجع المتسلسل ({filteredOperations.length})
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'sales', label: 'المبيعات' },
                  { id: 'cards', label: 'الكروت' },
                  { id: 'wallets', label: 'المحافظ' },
                  { id: 'debts_exp', label: 'ديون/مصاريف' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTxFilter(f.id)}
                    style={{
                      padding: '6px 2px',
                      borderRadius: '8px',
                      border: txFilter === f.id ? '1px solid var(--orange-primary)' : '1px solid var(--border-color)',
                      background: txFilter === f.id ? 'var(--orange-primary)' : 'var(--bg-input)',
                      color: txFilter === f.id ? '#fff' : 'var(--text-main)',
                      fontSize: '10px',
                      fontWeight: '900',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredOperations.length === 0 ? (
                <div className="tz-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  لا توجد عمليات مسجلة تحت هذا القسم بعد.
                </div>
              ) : (
                filteredOperations.map((item, idx) => {
                  const rawPrice = parseFloat(item.sellingPrice) || 0;
                  const isLBP = item.currency === 'LBP';
                  const saleUSD = isLBP ? (rawPrice / exchangeRate) : rawPrice;
                  const profitUSD = item.profitUSD !== undefined ? parseFloat(item.profitUSD) : Math.max(0, saleUSD - (item.costUSD || 0));
                  const opMeta = OP_TYPE_META[item.type] || { label: 'عملية', color: 'var(--orange-primary)', bg: 'rgba(255,122,0,0.12)' };
                  const isNonSale = NON_SALE_OP_TYPES.has(item.type);
                  const isRootCycle = item.type === 'card_purchase' || item.type === 'days_year' || item.meta?.isCycleRoot;

                  return (
                    <div
                      key={item.id || idx}
                      className="tz-card"
                      style={{
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px',
                        borderRight: `3.5px solid ${opMeta.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '900',
                            color: opMeta.color,
                            background: opMeta.bg,
                            padding: '2px 7px',
                            borderRadius: '6px'
                          }}>
                            {opMeta.label}
                          </span>
                          <span style={{ fontWeight: '900', fontSize: '13px', color: 'var(--text-main)' }}>
                            {item.itemName || item.title}
                          </span>
                        </div>

                        <span style={{ fontWeight: '900', fontSize: '14px', color: isLBP ? 'var(--orange-primary)' : 'var(--text-main)', flexShrink: 0 }}>
                          {isLBP ? `${Math.round(rawPrice).toLocaleString()} ل.ل` : `$${rawPrice.toFixed(2)}`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>الجهة / العميل: <b>{item.customerName || 'عام'}</b></span>
                        {!isNonSale && (
                          <span style={{ color: profitUSD > 0 ? 'var(--green)' : 'var(--orange-primary)', fontWeight: 'bold' }}>
                            {profitUSD > 0 ? `صافي الربح: +$${profitUSD.toFixed(2)}` : 'استرداد رأس مال'}
                          </span>
                        )}
                      </div>

                      {item.explanation && (
                        <div style={{
                          background: 'var(--bg-card-sub)',
                          padding: '8px 10px',
                          borderRadius: '9px',
                          border: '1px dashed var(--border-color)',
                          fontSize: '11px',
                          color: 'var(--text-main)',
                          lineHeight: '1.5',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px'
                        }}>
                          <Info size={14} color={opMeta.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{item.explanation}</span>
                        </div>
                      )}

                      {!item.explanation && item.notes && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {item.notes}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                        <button
                          type="button"
                          disabled={rollingBackId === item.id}
                          onClick={() => handleRollbackOperation(item)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: 'var(--red)',
                            borderRadius: '8px',
                            padding: '4px 9px',
                            fontSize: '10px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: rollingBackId === item.id ? 0.5 : 1
                          }}
                          title={isRootCycle ? 'تراجع كامل عن الدورة وكل ما اندرج تحتها' : 'تراجع وإلغاء العملية'}
                        >
                          <RotateCcw size={12} />
                          <span>{rollingBackId === item.id ? 'جاري التراجع...' : isRootCycle ? 'تراجع كامل عن الدورة' : 'تراجع وإلغاء'}</span>
                        </button>

                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', direction: 'ltr' }}>
                          {formatDateTime(item.date)}
                        </span>
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
            onUpdateLines={handleBulkUpdateLines}
            onRefreshData={loadDataFromServer}
            onAddDebt={async (newDebt) => {
              try {
                await api.addDebt({ ...newDebt, sourceWalletId: null });
                await loadDataFromServer();
              } catch (err) {
                console.error('Add box debt error:', err);
              }
            }}
            exchangeRate={exchangeRate}
          />
        )}

        {currentTab === 'recharge' && (
          <RechargeHub
            sims={sims}
            onAddSimBatch={handleAddSimBatch}
            onUpdateSim={handleUpdateSim}
            onDeleteSim={handleDeleteSim}
            onExecuteMultiSale={(saleData) => {
              setCurrentTx(saleData);
              setModalOpen(true);
            }}
            exchangeRate={exchangeRate}
            onUpdateExchangeRate={(r) => handleSaveRate(r)}
          />
        )}

        {currentTab === 'alfa_gift' && (
          <AlfaGift
            sims={sims}
            lockedLines={lines}
            customers={customers}
            serviceCycles={serviceCycles}
            onExecuteAlfaGiftSale={handleExecuteAlfaGiftSale}
            onRefreshData={loadDataFromServer}
            exchangeRate={exchangeRate}
          />
        )}

        {currentTab === 'lines' && (
          <LockedLines
            lines={lines}
            customers={customers}
            onAddLine={handleAddLine}
            onUpdateLine={handleUpdateLine}
            onDeleteLine={handleDeleteLine}
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
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            brandConfig={brandConfig}
            exchangeRate={exchangeRate}
          />
        )}

        <DeveloperFooter />
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
        onLogout={handleLogoutClean}
        onResetAllData={() => { localStorage.clear(); window.location.reload(); }}
      />

      <QuickToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        exchangeRate={exchangeRate}
        sims={sims}
        onTransferBalance={handleTransferSimBalance}
        onAddExpense={handleAddExpense}
        expenses={expenses}
        sources={sources}
        salesHistory={salesHistory}
        debts={debts}
        brandConfig={brandConfig}
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