const API_BASE = 'http://localhost:5000/api';

const getHeaders = () => {
    const token = localStorage.getItem('zt_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const request = async (endpoint, options = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...getHeaders(), ...(options.headers || {}) }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'خطأ في الاتصال بالسيرفر');
    return data;
};

export const api = {
    // 1. المصادقة والتوثيق
    login: async (email, password) => {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        localStorage.setItem('zt_token', data.token);
        return data;
    },

    register: async (shopData) => {
        const data = await request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(shopData)
        });
        localStorage.setItem('zt_token', data.token);
        return data;
    },

    logout: () => localStorage.removeItem('zt_token'),

    // 2. البيانات العامة وهوية المحل
    fetchBootstrapData: () => request('/data/bootstrap'),
    updateBrand: (brandPayload) => request('/data/brand', { method: 'PUT', body: JSON.stringify(brandPayload) }),
    importLocalData: (payload) => request('/data/import-local', { method: 'POST', body: JSON.stringify(payload) }),
    updateExchangeRate: (rate) => request('/operations/exchange-rate', { method: 'PUT', body: JSON.stringify({ rate }) }),

    // 3. إدارة الصناديق والمحافظ (Sources)
    addSource: (sourceData) => request('/operations/source', { method: 'POST', body: JSON.stringify(sourceData) }),
    updateSource: (id, fields) => request(`/operations/source/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
    deleteSource: (id) => request(`/operations/source/${id}`, { method: 'DELETE' }),
    recordWalletTx: (walletId, tx) => request('/operations/wallet-tx', { method: 'POST', body: JSON.stringify({ walletId, tx }) }),
    walletTransfer: (payload) => request('/operations/wallet-transfer', { method: 'POST', body: JSON.stringify(payload) }),

    // 4. الشرائح ودفعات الرصيد
    addSim: (simData) => request('/operations/sim', { method: 'POST', body: JSON.stringify(simData) }),
    updateSim: (id, fields) => request(`/operations/sim/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
    deleteSim: (id) => request(`/operations/sim/${id}`, { method: 'DELETE' }),
    transferSimBalance: (payload) => request('/operations/sim-transfer', { method: 'POST', body: JSON.stringify(payload) }),
    executeSale: (salePayload) => request('/operations/sale', { method: 'POST', body: JSON.stringify(salePayload) }),

    // 5. الخطوط المسكرة
    addLine: (lineData) => request('/operations/line', { method: 'POST', body: JSON.stringify(lineData) }),
    updateLine: (id, fields) => request(`/operations/line/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
    deleteLine: (id) => request(`/operations/line/${id}`, { method: 'DELETE' }),

    // 6. Alfa Gift & U-Share
    executeAlfaGiftSale: (giftPayload) => request('/operations/alfa-gift-sale', { method: 'POST', body: JSON.stringify(giftPayload) }),

    // 7. الديون (مع عزل العملة التام)
    addDebt: (debtData) => request('/operations/debt', { method: 'POST', body: JSON.stringify(debtData) }),
    updateDebt: (id, fields) => request(`/operations/debt/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
    deleteDebt: (id) => request(`/operations/debt/${id}`, { method: 'DELETE' }),
    payDebt: (debtPaymentPayload) => request('/operations/debt-payment', { method: 'POST', body: JSON.stringify(debtPaymentPayload) }),

    // 8. الزبائن والمصاريف
    addCustomer: (custData) => request('/operations/customer', { method: 'POST', body: JSON.stringify(custData) }),
    updateCustomer: (id, fields) => request(`/operations/customer/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
    deleteCustomer: (id) => request(`/operations/customer/${id}`, { method: 'DELETE' }),
    addExpense: (expData) => request('/operations/expense', { method: 'POST', body: JSON.stringify(expData) })
};