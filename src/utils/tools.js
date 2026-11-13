// فتح محادثة واتساب مع الزبون وإرسال تفاصيل الفاتورة
export const sendWhatsAppInvoice = (phone, customerName, details, remainingDebt, currency) => {
  if (!phone) {
    alert('رقم هاتف الزبون غير مسجل!');
    return;
  }

  let shopName = 'ZOLFA TECH';
  try {
    const raw = localStorage.getItem('tb_brand_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.name) shopName = parsed.name;
    }
  } catch (e) {
    // تجاهل في حال عدم توفر الإعدادات المحلية
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const finalPhone = cleanPhone.startsWith('961') ? cleanPhone : `961${cleanPhone.replace(/^0+/, '')}`;

  const message = `مرحباً ${customerName}،
وصلك إشعار من ${shopName}:
${details}
${remainingDebt > 0 ? `المبلغ المتبقي بذمتكم كدين: ${remainingDebt.toLocaleString()} ${currency}` : 'تم الدفع بالكامل نقداً.'}
شكراً لتعاملكم معنا!`;

  window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
};