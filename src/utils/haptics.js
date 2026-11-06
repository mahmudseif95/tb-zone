// تشغيل الاهتزاز اللمسي الخاص بهواتف الآيفون واللمس
export const triggerHaptic = (type = 'light') => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    if (type === 'light') window.navigator.vibrate(12);
    else if (type === 'medium') window.navigator.vibrate(25);
    else if (type === 'success') window.navigator.vibrate([15, 40, 20]);
    else if (type === 'warning') window.navigator.vibrate([40, 30, 40]);
  }
};

// صوت تأكيد إتمام العملية بدون ملفات خارجية ثقيلة (Synthesizer Audio)
export const playSuccessChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Tone 1
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // Tone 2

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch (e) {
    // يتجاهل المتصفح الصوت إن كان محظوراً بالوضع الصامت
  }
};