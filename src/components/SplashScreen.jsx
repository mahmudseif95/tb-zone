import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Zap,
  Wifi,
  DollarSign,
  Radio,
  Cpu,
  Database,
  ShieldCheck,
  Activity,
  Layers
} from 'lucide-react';

export default function SplashScreen({ logo, brandName, onFinish }) {
  const [fade, setFade] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState('تهيئة أنظمة وشبكات الاتصال...');

  // تسلسل الإقلاع الرقمي على مدار 6.5 ثواني كاملة
  useEffect(() => {
    // عداد النسبة المئوية السلس من 0% إلى 100%
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 55); // يصل إلى 100% خلال ~5.5 ثوانٍ

    // مراحل سجل الاتصالات وتدفق البيانات
    const t1 = setTimeout(() => {
      setStatusLog('ربط شبكات Alfa & Touch وحزم 5G...');
    }, 1200);

    const t2 = setTimeout(() => {
      setStatusLog('مزامنة رصيد سنة أيام Alfa وتوزيع الحصص...');
    }, 2400);

    const t3 = setTimeout(() => {
      setStatusLog('تحميل معلقات المحافظ (Whish & TopUp) والديون...');
    }, 3800);

    const t4 = setTimeout(() => {
      setStatusLog('تأمين ومزامنة بوابات السيرفر والخطوط المسكرة...');
    }, 4900);

    const t5 = setTimeout(() => {
      setStatusLog('تم الإقلاع بنجاح • مرحباً بك في النظام');
    }, 5800);

    // بدء التلاشي السلس في الثانية السادسة
    const fadeTimer = setTimeout(() => {
      setFade(true);
    }, 6100);

    // إنهاء السبلاش وفتح النظام بالكامل عند 6.6 ثوانٍ
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 6600);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999999,
      background: 'radial-gradient(ellipse at center, #111827 0%, #06080e 70%, #020306 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      userSelect: 'none',
      direction: 'rtl',
      transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: fade ? 0 : 1,
      transform: fade ? 'scale(1.04)' : 'scale(1)',
      pointerEvents: fade ? 'none' : 'auto'
    }}>

      {/* 1. شبكة النجوم والبيانات السابحة في المجرة (خلفية حية) */}
      <div className="galaxy-floating-item fl-1">$</div>
      <div className="galaxy-floating-item fl-2">77 GB</div>
      <div className="galaxy-floating-item fl-3">α ALFA</div>
      <div className="galaxy-floating-item fl-4">TOUCH</div>
      <div className="galaxy-floating-item fl-5">U-SHARE</div>
      <div className="galaxy-floating-item fl-6">5G+</div>
      <div className="galaxy-floating-item fl-7">LBP</div>
      <div className="galaxy-floating-item fl-8">44 GB</div>

      {/* 2. المركز المداري المتناسق هندسياً (360 درجة سنتر مطلق) */}
      <div style={{
        position: 'relative',
        width: '340px',
        height: '340px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>

        {/* هالة التوهج النيبولية الضخمة بالخلفية */}
        <div style={{
          position: 'absolute',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 122, 0, 0.18) 0%, rgba(16, 185, 129, 0.08) 50%, transparent 75%)',
          filter: 'blur(35px)',
          pointerEvents: 'none'
        }} />

        {/* أ) المدار الخارجي (يدور مع عقارب الساعة مع هاتف وقاعدة بيانات) */}
        <div className="orbit-track orbit-outer">
          <div className="orbit-satellite sat-phone">
            <Smartphone size={16} color="#FF7A00" />
          </div>
          <div className="orbit-satellite sat-db">
            <Database size={15} color="#10B981" />
          </div>
        </div>

        {/* ب) المدار الأوسط (يدور عكس عقارب الساعة مع كاش وواي فاي) */}
        <div className="orbit-track orbit-mid">
          <div className="orbit-satellite sat-cash">
            <DollarSign size={16} color="#10B981" />
          </div>
          <div className="orbit-satellite sat-wifi">
            <Radio size={14} color="#FF7A00" />
          </div>
        </div>

        {/* ج) المدار الداخلي (حزام الجزيئات السريعة ونبضات الضوء) */}
        <div className="orbit-track orbit-inner">
          <div className="orbit-satellite sat-zap">
            <Zap size={13} color="#FBBF24" />
          </div>
        </div>

        {/* د) أشعة الليزر الشعاعية المتصلة (بيانات عم بتفوت وبيانات عم تطلع) */}
        <div className="radial-beam-line beam-deg-0"><div className="beam-pulse-dot" /></div>
        <div className="radial-beam-line beam-deg-90"><div className="beam-pulse-dot dot-reverse" /></div>
        <div className="radial-beam-line beam-deg-180"><div className="beam-pulse-dot" /></div>
        <div className="radial-beam-line beam-deg-270"><div className="beam-pulse-dot dot-reverse" /></div>

        {/* هـ) موجات رادار دائرية متناغمة من قلب اللوغو */}
        <div className="core-sonar-pulse wave-a" />
        <div className="core-sonar-pulse wave-b" />

        {/* و) كبسولة اللوغو المركزية المضيئة في نقطة الصفر الدقيقة */}
        <div style={{
          position: 'relative',
          width: '94px',
          height: '94px',
          borderRadius: '26px',
          background: 'linear-gradient(145deg, #182030, #0c1018)',
          border: '2px solid rgba(255, 122, 0, 0.7)',
          boxShadow: '0 0 30px rgba(255, 122, 0, 0.4), inset 0 0 18px rgba(255, 122, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 10
        }}>
          {/* انعكاس الضوء المائل الذي يمسح اللوغو باستمرار */}
          <div className="core-light-sweep" />

          {logo ? (
            <img
              src={logo}
              alt="Logo"
              style={{ width: '78%', height: '78%', objectFit: 'contain', zIndex: 2 }}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2
            }}>
              <span style={{ fontSize: '26px', fontWeight: '900', color: '#FF7A00', lineHeight: 1 }}>ZT</span>
              <span style={{ fontSize: '8px', fontWeight: '900', color: '#10B981', letterSpacing: '1px', marginTop: '2px' }}>TELECOM</span>
            </div>
          )}
        </div>

      </div>

      {/* 3. هوية المحل والنظام */}
      <div style={{ marginTop: '16px', textAlign: 'center', zIndex: 10 }}>
        <h1 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '900',
          color: '#ffffff',
          letterSpacing: '1px',
          textShadow: '0 4px 20px rgba(255, 122, 0, 0.5)'
        }}>
          {brandName || 'ZOLFA TECH'}
        </h1>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '6px'
        }}>
          <span style={{
            background: 'rgba(255, 122, 0, 0.15)',
            border: '1px solid rgba(255, 122, 0, 0.4)',
            color: '#FF7A00',
            fontSize: '10px',
            fontWeight: '900',
            padding: '2px 8px',
            borderRadius: '6px'
          }}>
            OS TELECOM
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', fontWeight: 'bold' }}>
            Stay Connected to the world
          </span>
        </div>
      </div>

      {/* 4. لوحة التيليميتري السفلية (النسبة المئوية وسجل البيانات المباشر) */}
      <div style={{
        marginTop: '28px',
        width: '260px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10
      }}>

        {/* شريط التحميل والنسبة الرقمية */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 'bold' }}>مستوى التهيئة</span>
          <span style={{ color: '#10B981', fontWeight: '900', fontFamily: 'monospace', fontSize: '13px' }}>
            {progress}%
          </span>
        </div>

        <div style={{
          width: '100%',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #FF7A00, #FBBF24, #10B981)',
              borderRadius: '10px',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)',
              transition: 'width 0.1s linear'
            }}
          />
        </div>

        {/* سطر اللوغ الرقمي التفاعلي مع وميض الاتصال */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '22px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          padding: '4px 8px'
        }}>
          <span className="live-status-blinker" style={{
            background: progress >= 100 ? '#10B981' : '#FF7A00',
            boxShadow: progress >= 100 ? '0 0 8px #10B981' : '0 0 8px #FF7A00'
          }} />
          <span style={{
            fontSize: '11px',
            color: progress >= 100 ? '#10B981' : 'rgba(255, 255, 255, 0.75)',
            fontWeight: progress >= 100 ? '900' : 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {statusLog}
          </span>
        </div>

      </div>

      {/* أنماط الحركة والمؤثرات المجرية */}
      <style>{`
        /* عناصر المجرة العائمة بالخلفية */
        .galaxy-floating-item {
          position: absolute;
          font-family: monospace;
          font-weight: 900;
          pointer-events: none;
          opacity: 0.25;
          filter: drop-shadow(0 0 8px rgba(255, 122, 0, 0.3));
        }
        .fl-1 { top: 12%; right: 15%; font-size: 24px; color: #10B981; animation: orbitFloat 5s ease-in-out infinite alternate; }
        .fl-2 { top: 20%; left: 14%; font-size: 13px; color: #FF7A00; animation: orbitFloat 6s ease-in-out infinite alternate-reverse; }
        .fl-3 { bottom: 25%; right: 12%; font-size: 12px; color: #EF4444; animation: orbitFloat 5.5s ease-in-out infinite alternate; }
        .fl-4 { bottom: 18%; left: 16%; font-size: 13px; color: #3B82F6; animation: orbitFloat 6.5s ease-in-out infinite alternate-reverse; }
        .fl-5 { top: 38%; right: 8%; font-size: 11px; color: #FBBF24; animation: orbitFloat 4.8s ease-in-out infinite alternate; }
        .fl-6 { bottom: 38%; left: 10%; font-size: 14px; color: #10B981; animation: orbitFloat 5.2s ease-in-out infinite alternate-reverse; }
        .fl-7 { top: 10%; left: 32%; font-size: 12px; color: #FF7A00; animation: orbitFloat 7s ease-in-out infinite alternate; }
        .fl-8 { bottom: 10%; right: 30%; font-size: 12px; color: #10B981; animation: orbitFloat 6.2s ease-in-out infinite alternate-reverse; }

        @keyframes orbitFloat {
          0% { transform: translateY(0px) rotate(0deg); opacity: 0.15; }
          50% { opacity: 0.45; }
          100% { transform: translateY(-20px) rotate(12deg); opacity: 0.2; }
        }

        /* المدارات الدائرية المتناظرة */
        .orbit-track {
          position: absolute;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justifyContent: center;
          pointer-events: none;
        }

        /* مدار خارجي */
        .orbit-outer {
          width: 300px;
          height: 300px;
          border: 1px dashed rgba(255, 122, 0, 0.25);
          animation: spinCW 22s linear infinite;
        }

        /* مدار أوسط */
        .orbit-mid {
          width: 210px;
          height: 210px;
          border: 1px solid rgba(16, 185, 129, 0.25);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.08);
          animation: spinCCW 14s linear infinite;
        }

        /* مدار داخلي */
        .orbit-inner {
          width: 140px;
          height: 140px;
          border: 1px dashed rgba(251, 191, 36, 0.35);
          animation: spinCW 8s linear infinite;
        }

        @keyframes spinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCCW {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        /* الأقمار / العقد التي تدور في المدار */
        .orbit-satellite {
          position: absolute;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #0f1522;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justifyContent: center;
          box-shadow: 0 0 12px rgba(0, 0, 0, 0.8);
        }

        .sat-phone {
          top: -15px;
          left: calc(50% - 15px);
          border-color: #FF7A00;
          box-shadow: 0 0 12px rgba(255, 122, 0, 0.5);
        }
        .sat-db {
          bottom: -15px;
          left: calc(50% - 15px);
          border-color: #10B981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }
        .sat-cash {
          top: calc(50% - 15px);
          right: -15px;
          border-color: #10B981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }
        .sat-wifi {
          top: calc(50% - 15px);
          left: -15px;
          border-color: #FF7A00;
          box-shadow: 0 0 12px rgba(255, 122, 0, 0.5);
        }
        .sat-zap {
          top: -15px;
          left: calc(50% - 15px);
          border-color: #FBBF24;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        }

        /* خطوط تدفق ونقل البيانات الشعاعية */
        .radial-beam-line {
          position: absolute;
          width: 130px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 122, 0, 0.3), transparent);
          pointer-events: none;
        }
        .beam-deg-0 { transform: rotate(0deg) translateX(70px); }
        .beam-deg-90 { transform: rotate(90deg) translateX(70px); }
        .beam-deg-180 { transform: rotate(180deg) translateX(70px); }
        .beam-deg-270 { transform: rotate(270deg) translateX(70px); }

        .beam-pulse-dot {
          position: absolute;
          width: 14px;
          height: 2px;
          border-radius: 4px;
          background: #FF7A00;
          box-shadow: 0 0 8px #FF7A00;
          animation: laserMove 1.6s ease-in-out infinite;
        }
        .dot-reverse {
          animation: laserMoveReverse 1.6s ease-in-out infinite 0.8s;
          background: #10B981;
          box-shadow: 0 0 8px #10B981;
        }

        @keyframes laserMove {
          0% { left: 0%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes laserMoveReverse {
          0% { left: 100%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: 0%; opacity: 0; }
        }

        /* موجات الرادار المركزية */
        .core-sonar-pulse {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 122, 0, 0.45);
          pointer-events: none;
        }
        .wave-a {
          width: 94px;
          height: 94px;
          animation: sonarPing 2.5s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .wave-b {
          width: 94px;
          height: 94px;
          animation: sonarPing 2.5s cubic-bezier(0, 0.2, 0.8, 1) infinite 1.25s;
        }

        @keyframes sonarPing {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        /* مسح الضوء المائل عبر اللوغو */
        .core-light-sweep {
          position: absolute;
          top: -50%;
          left: -150%;
          width: 70%;
          height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
          transform: rotate(25deg);
          animation: sweepCore 2.4s infinite;
        }

        @keyframes sweepCore {
          0% { left: -150%; }
          100% { left: 220%; }
        }

        /* مؤشر النبض المباشر */
        .live-status-blinker {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: pulseDot 0.8s ease-in-out infinite alternate;
        }

        @keyframes pulseDot {
          0% { opacity: 0.3; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}