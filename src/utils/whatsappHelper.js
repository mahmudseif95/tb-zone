// رقم الاختصار الذي يُرسَل إليه رقم الخط المسكر لقبول دعوة U-Share
export const USHARE_ACTIVATION_SHORTCODE = '1323';

// تحويل رقم لبناني إلى صيغة دولية بدون + (مثال: 03123456 -> 9613123456)
export function formatLebanesePhone(phone) {
    const digits = String(phone || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.startsWith('961')) return digits;
    return `961${digits.replace(/^0+/, '')}`;
}

// نص رسالة طريقة التفعيل. رقم الخط المسكر يظهر داخل النص فقط ليرسله المشترك SMS إلى 1323
export function buildActivationMessage({ subscriberName, lockedLineNumber, quotaGB, shopName }) {
    const cleanLinePhone = String(lockedLineNumber || '').replace(/\s+/g, '').trim();
    return [
        `مرحباً ${subscriberName || 'عزيزي المشترك'}، تحية من *${shopName || 'ZOLFA TECH'}* 🌟`,
        `تم إرسال دعوة باقة الإنترنت U-Share${quotaGB ? ` (${quotaGB} GB)` : ''} إلى رقمك.`,
        '',
        `لتفعيل الباقة فوراً، أرسل رسالة نصية (SMS) إلى الرقم *${USHARE_ACTIVATION_SHORTCODE}* تحتوي فقط على رقم الخط التالي:`,
        `${cleanLinePhone}`,
        '',
        'أهلاً وسهلاً بك!'
    ].join('\n');
}

// يبني رابط واتساب حسب نمط المرسل. المحادثة تُفتح دائماً إلى رقم المشترك (وليس رقم الخط)
//  - app: whatsapp://send  (تطبيق واتساب/بيزنس المثبت)
//  - web: https://web.whatsapp.com/send  (واتساب ويب — يسمح بحساب ثانٍ بالتوازي)
export function buildWhatsAppUrl({ mode = 'web', subscriberPhone, text }) {
    const phone = formatLebanesePhone(subscriberPhone);
    const encoded = encodeURIComponent(text);
    if (mode === 'app') {
        return phone
            ? `whatsapp://send?phone=${phone}&text=${encoded}`
            : `whatsapp://send?text=${encoded}`;
    }
    return phone
        ? `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`
        : `https://wa.me/?text=${encoded}`;
}

export function launchWhatsAppWithSender({ sender, subscriberName, subscriberPhone, lockedLineNumber, quotaGB, shopName }) {
    const text = buildActivationMessage({ subscriberName, lockedLineNumber, quotaGB, shopName });
    const mode = sender?.mode === 'app' ? 'app' : 'web';
    const url = buildWhatsAppUrl({ mode, subscriberPhone, text });

    if (mode === 'app') {
        // بروتوكول مخصص: نستخدم التنقل المباشر لتجنب ترك تبويب فارغ
        window.location.href = url;
    } else {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    return url;
}

// يحلل نص خانة المشترك "الاسم (22 GB)" ويبحث عن هاتفه في الزبائن بالاسم
export function parseUserSlot(text, customers = [], storedPhone = '') {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const name = raw.split('(')[0].trim();
    const gbMatch = raw.match(/\(([^)]+)\)/);
    const quotaGB = gbMatch ? gbMatch[1].replace(/[^0-9.]/g, '') : '';
    const customer = customers.find(c => (c.name || '').toLowerCase().trim() === name.toLowerCase());
    return { name, quotaGB, phone: storedPhone || customer?.phone || '' };
}
