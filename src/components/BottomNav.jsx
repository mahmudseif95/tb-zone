import React, { useLayoutEffect, useRef, useState } from 'react';
import { Home, Zap, Gift, PhoneCall, BookOpen } from 'lucide-react';

export default function BottomNav({ currentTab, onSelectTab, unreadDebtsCount = 0 }) {
  const tabs = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'recharge', label: 'بيع الرصيد', icon: Zap },
    { id: 'alfa_gift', label: 'Alfa Gift', icon: Gift },
    { id: 'lines', label: 'الخطوط', icon: PhoneCall },
    { id: 'debts', label: 'الديون', icon: BookOpen, badge: unreadDebtsCount }
  ];

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === currentTab));
  const itemRefs = useRef([]);
  // موضع الحبة يُقاس فعلياً من offsetLeft/offsetWidth الزر النشط، لا من صيغة محسوبة افتراضةً LTR —
  // بهذا تصح تلقائياً في RTL (حيث التبويب الأول أقصى اليمين، آخرها أقصى اليسار) دون أي صيغة معكوسة يدوياً
  const [pillRect, setPillRect] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[activeIndex];
      if (el) setPillRect({ left: el.offsetLeft + 6, width: el.offsetWidth - 12 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIndex]);

  return (
    <nav
      className="bottom-nav"
      aria-label="التنقل الأساسي"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}
    >
      {/* حبة المؤشر النشط المنزلقة: موضعها مقيس من الزر الفعلي (offsetLeft) فتصح في RTL واللغتين معاً */}
      {pillRect && (
        <span
          aria-hidden="true"
          className="nav-active-pill"
          style={{ left: `${pillRect.left}px`, width: `${pillRect.width}px` }}
        />
      )}
      {tabs.map((tab, i) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            ref={(el) => { itemRefs.current[i] = el; }}
            type="button"
            className="nav-item"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelectTab(tab.id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {tab.badge > 0 && (
                <span className="nav-badge" aria-label={`${tab.badge} غير مسددة`}>
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="nav-label" style={{ fontSize: '10px' }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
