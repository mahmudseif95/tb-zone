const API_BASE = 'http://localhost:5000/api';

const getHeaders = () => {
    const token = localStorage.getItem('zt_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const api = {
    // 1. المصادقة والتوثيق
    login: async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تسجيل الدخول');
        localStorage.setItem('zt_token', data.token);
        return data;
    },

    register: async (shopData) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shopData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل إنشاء الحساب');
        localStorage.setItem('zt_token', data.token);
        return data;
    },

    logout: () => {
        localStorage.removeItem('zt_token');
    },

    // 2. جلب وتحديث بيانات المحل
    fetchBootstrapData: async () => {
        const res = await fetch(`${API_BASE}/data/bootstrap`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل جلب البيانات');
        return data;
    },

    updateBrand: async (brandPayload) => {
        const res = await fetch(`${API_BASE}/data/brand`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(brandPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تحديث بيانات المحل');
        return data;
    },

    importLocalData: async (payload) => {
        const res = await fetch(`${API_BASE}/data/import-local`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل ترحيل البيانات');
        return data;
    },

    // 3. إدارة الصناديق والمحافظ (Sources)
    addSource: async (sourceData) => {
        const res = await fetch(`${API_BASE}/operations/source`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(sourceData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل إضافة المحفظة');
        return data;
    },

    updateSource: async (id, fields) => {
        const res = await fetch(`${API_BASE}/operations/source/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(fields)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تحديث المحفظة');
        return data;
    },

    deleteSource: async (sourceId) => {
        const res = await fetch(`${API_BASE}/operations/source/${sourceId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل حذف المحفظة');
        return data;
    },

    // 4. العمليات المباشرة على السيرفر
    updateExchangeRate: async (rate) => {
        const res = await fetch(`${API_BASE}/operations/exchange-rate`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ rate })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تحديث سعر الصرف');
        return data;
    },

    executeSale: async (salePayload) => {
        const res = await fetch(`${API_BASE}/operations/sale`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(salePayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تسجيل المبيع');
        return data;
    },

    recordWalletTx: async (walletId, tx) => {
        const res = await fetch(`${API_BASE}/operations/wallet-tx`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ walletId, tx })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تسجيل حركة المحفظة');
        return data;
    },

    executeAlfaGiftSale: async (giftPayload) => {
        const res = await fetch(`${API_BASE}/operations/alfa-gift-sale`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(giftPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تسجيل عملية Alfa Gift');
        return data;
    },

    payDebt: async (debtPaymentPayload) => {
        const res = await fetch(`${API_BASE}/operations/debt-payment`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(debtPaymentPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل سداد الدين');
        return data;
    }
};