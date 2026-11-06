/**
 * تنسيق موحد للتاريخ والوقت مع قفل الاتجاه:
 * 05/11/2026 - 9:50 AM
 */
export function formatDateTime(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;

    // \u200E يفرض ظهور التاريخ أولاً ثم الشرطة ثم الوقت والـ AM/PM في صفحات الـ RTL
    return `\u200E${day}/${month}/${year} - ${hours}:${minutes} ${ampm}\u200E`;
}

/**
 * تنسيق التاريخ فقط:
 * 05/11/2026
 */
export function formatDateOnly(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `\u200E${day}/${month}/${year}\u200E`;
}