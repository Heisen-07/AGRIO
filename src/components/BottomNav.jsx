import React from 'react';
import { Droplets, CloudSun, BarChart3, ScanLine } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav({ activeTab, setActiveTab }) {
  const { t } = useLanguage();

  const items = [
    { id: 'diagnostics', label: t.tabDiagnostics, icon: ScanLine },
    { id: 'irrigation', label: t.tabIrrigation, icon: Droplets },
    { id: 'climate', label: t.tabClimate, icon: CloudSun },
    { id: 'analytics', label: t.tabAnalytics, icon: BarChart3 }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-surface-border px-3 py-2">
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-emerald-700 bg-emerald-100/70 font-bold scale-105'
                  : 'text-gray-500 hover:text-emerald-600 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-emerald-700 stroke-[2.5]' : ''}`} />
              <span className="text-[10px] truncate max-w-full text-center leading-tight">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
