import { useSyncExternalStore } from 'react';

// حسابات واتساب الخاصة بالمحل (محفوظة على هذا الجهاز لأن حسابات واتساب تختلف من جهاز لآخر)
const STORAGE_KEY = 'tb_wa_senders';

export const DEFAULT_SENDERS = [
    { id: 'wa_business', label: 'واتساب بيزنس', phone: '', mode: 'app' },
    { id: 'wa_regular', label: 'واتساب عادي', phone: '', mode: 'web' }
];

const sanitize = (list) => {
    if (!Array.isArray(list) || list.length === 0) return DEFAULT_SENDERS;
    return list.map((s, i) => ({
        id: String(s?.id || `wa_${Date.now()}_${i}`),
        label: String(s?.label || '').slice(0, 40),
        phone: String(s?.phone || '').slice(0, 30),
        mode: s?.mode === 'app' ? 'app' : 'web'
    }));
};

const read = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? sanitize(JSON.parse(raw)) : DEFAULT_SENDERS;
    } catch {
        return DEFAULT_SENDERS;
    }
};

// نخزن النسخة المحللة مرة واحدة ليبقى المرجع ثابتاً لـ useSyncExternalStore
let cache = read();
const listeners = new Set();

export const getSenders = () => cache;

export const saveSenders = (list) => {
    cache = sanitize(list);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // التخزين غير متاح: تبقى القيم في الذاكرة لهذه الجلسة
    }
    listeners.forEach(l => l());
};

const subscribe = (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};

export const useWhatsAppSenders = () => useSyncExternalStore(subscribe, getSenders, getSenders);
