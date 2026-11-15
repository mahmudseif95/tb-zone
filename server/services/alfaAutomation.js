/**
 * واجهة محوَّلة (adapter) لمزامنة Alfa Self-Care — نقطة التبديل الوحيدة متى توفّر API رسمي من Alfa.
 *
 * لا يوجد حالياً اتصال آلي بموقع alfa.com.lb (لا متصفح، لا طلبات HTTP تنتحل تسجيل دخول المستخدم):
 * جدار الحماية F5 في الموقع مصمَّم لرفض أي عميل آلي، وتجاوزه (بانتحال متصفح حقيقي أو إعادة توليد
 * نماذج تسجيل الدخول) هو كسر لآلية حماية الموقع، لسنا نقوم به. الحل البديل المعتمد حالياً هو:
 *   - زر "فتح في Alfa" (رابط مباشر لصفحة U-Share في متصفح المستخدم نفسه).
 *   - زر "لصق من Alfa" (Paste-and-Parse): المستخدم يسجّل دخوله بنفسه ويلصق نص الصفحة،
 *     ويُحلَّل ويُحفظ محلياً عبر parseAlfaUShareText + mergeSubscribersIntoLine في alfaLineSync.js.
 *
 * تُبقى توقيعات الدوال المصدَّرة كما هي (connectAndVerifySession وغيرها) فقط حتى يُستبدل محتواها
 * بتكامل حقيقي فور توفّر مفتاح API رسمي من Alfa، دون أي تعديل على alfaSync.js أو الواجهة أو قاعدة البيانات.
 */

class AlfaError extends Error {
    constructor(message, code = 'ALFA_ERROR') {
        super(message);
        this.name = 'AlfaError';
        this.code = code;
    }
}

const NOT_CONFIGURED_MESSAGE =
    'الربط التلقائي بانتظار مفتاح API الرسمي من Alfa — استخدم زر "فتح في Alfa" و"لصق من Alfا" حالياً';

const notConfigured = () => {
    throw new AlfaError(NOT_CONFIGURED_MESSAGE, 'API_NOT_CONFIGURED');
};

// ترقيم لبناني 8 خانات مع الإبقاء على الصفر البادئ (يُستخدم في alfaLineSync.js وواجهة المستخدم)
function normPhone8(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.startsWith('00961')) d = d.slice(5);
    else if (d.startsWith('961')) d = d.slice(3);
    if (d.length === 7) d = `0${d}`;
    return d;
}

// 1. ربط وفحص الجلسة
async function connectAndVerifySession(_params) {
    return notConfigured();
}

// 2. جلب المشتركين الثانويين الحاليين وحصصهم
async function fetchLiveUShareStatus(_params) {
    return notConfigured();
}

// 3. تنفيذ إضافة / تعديل / حذف مشترك
async function executeUShareSync(_params) {
    return notConfigured();
}

module.exports = {
    connectAndVerifySession,
    fetchLiveUShareStatus,
    executeUShareSync,
    AlfaError,
    normPhone8
};
