// فتح محادثة واتساب مع الزبون وإرسال الفاتورة
export const sendWhatsAppInvoice = (phone, customerName, details, remainingDebt, currency) => {
  if (!phone) {
    alert('رقم هاتف الزبون غير مسجل!');
    return;
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const finalPhone = cleanPhone.startsWith('961') ? cleanPhone : `961${cleanPhone.replace(/^0+/, '')}`;

  const message = `مرحباً ${customerName}،
وصلك إشعار من TB ZONE:
${details}
${remainingDebt > 0 ? `المبلغ المتبقي بذمتكم كدين: ${remainingDebt.toLocaleString()}${currency}` : 'تم الدفع بالكامل نقداً.'}
شكراً لتعاملكم معنا!`;

  window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

// دالة معالجة شراء كروت ألفا وتاتش وتغذية الخط المغلق (Gift Recharge)
export function executeCardRecharge({
  operator,        // 'ALFA' | 'TOUCH'
  tier,            // الكائن المختار من الفئات (credit, cost, days)
  sourceId,        // id المحفظة المختارة (Whish, Topup, إلخ)
  targetLineId,    // id أو رقم الخط المغلق المستهدف
  sources,         // مصفوفة المحافظ الحالية
  lockedLines      // مصفوفة الخطوط المغلقة الحالية
}) {
  // 1. التحقق من المحفظة والرصيد
  const walletIndex = sources.findIndex(s => s.id === sourceId);
  if (walletIndex === -1) {
    throw new Error('المحفظة المالية المحددة غير موجودة.');
  }

  const wallet = sources[walletIndex];
  if (Number(wallet.balance) < Number(tier.cost)) {
    throw new Error(`رصيد المحفظة ($${wallet.balance}) لا يكفي لتغطية التكلفة ($${tier.cost}).`);
  }

  // 2. التحقق من الخط المغلق
  const lineIndex = lockedLines.findIndex(l => l.id === targetLineId || l.phone_number === targetLineId || l.number === targetLineId);
  if (lineIndex === -1) {
    throw new Error('الخط المغلق المحدد غير موجود بالنظام.');
  }

  const line = lockedLines[lineIndex];

  // 3. خصم التكلفة من المحفظة
  const updatedSources = [...sources];
  const newWalletBalance = Number((Number(wallet.balance) - Number(tier.cost)).toFixed(2));

  const walletTx = {
    id: 'tx_' + Date.now(),
    type: 'EXPENSE',
    title: `شراء كارت ${operator} (${tier.credit}$)`,
    amount: tier.cost,
    target: line.phone_number || line.number || line.name,
    date: new Date().toISOString()
  };

  updatedSources[walletIndex] = {
    ...wallet,
    balance: newWalletBalance,
    ledger: [walletTx, ...(wallet.ledger || [])]
  };

  // 4. تحديث رصيد وأيام الخط المغلق
  const updatedLockedLines = [...lockedLines];
  const currentCredit = Number(line.balance || 0);
  const newCredit = Number((currentCredit + Number(tier.credit)).toFixed(2));

  // حساب تمديد الصلاحية
  const now = new Date();
  const currentExpiry = line.expiryDate ? new Date(line.expiryDate) : now;
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + (Number(tier.days) * 24 * 60 * 60 * 1000));
  const remainingDays = Math.ceil((newExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  updatedLockedLines[lineIndex] = {
    ...line,
    balance: newCredit,
    expiryDate: newExpiry.toISOString(),
    validityDays: remainingDays,
    lastRechargeDate: now.toISOString()
  };

  return {
    updatedSources,
    updatedLockedLines,
    summary: {
      operator,
      cost: tier.cost,
      credit: tier.credit,
      days: tier.days,
      newWalletBalance,
      newLineBalance: newCredit,
      targetNumber: line.phone_number || line.number || line.name
    }
  };
}