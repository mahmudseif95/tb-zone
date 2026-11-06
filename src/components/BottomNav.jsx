import React from 'react';
import { Home, Zap, PhoneCall, BookOpen } from 'lucide-react';

export default function BottomNav({ currentTab, onSelectTab, unreadDebtsCount = 0 }) {
  const tabs = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'recharge', label: 'بيع الرصيد', icon: Zap },
    { id: 'lines', label: 'الخطوط', icon: PhoneCall },
    { id: 'debts', label: 'الديون', icon: BookOpen, badge: unreadDebtsCount }
  ];

  return (
    <nav className="bottom-nav" aria-label="التنقل الأساسي">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            className="nav-item"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelectTab(tab.id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              {tab.badge > 0 && (
                <span className="nav-badge" aria-label={`${tab.badge} غير مسددة`}>
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}