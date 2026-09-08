import React from 'react';
import { Droplets, CloudSun, BarChart3, ScanLine, Camera } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav({ activeTab, setActiveTab }) {
  const { t } = useLanguage();

  const leftItems = [
    { id: 'irrigation', label: t.tabIrrigation, icon: Droplets },
    { id: 'climate', label: t.tabClimate, icon: CloudSun },
  ];

  const rightItems = [
    { id: 'analytics', label: t.tabAnalytics, icon: BarChart3 },
    { id: 'diagnostics', label: t.tabDiagnostics, icon: ScanLine },
  ];

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`flex flex-col items-center justify-center py-2 px-2 rounded-2xl transition-all ${
          isActive
            ? 'text-emerald-800 font-bold'
            : 'text-emerald-700/50 hover:text-emerald-700 font-medium'
        }`}
      >
        <div className={`p-2 rounded-full transition-all ${isActive ? 'bg-emerald-100' : ''}`}>
          <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700 stroke-[2.5]' : ''}`} />
        </div>
        <span className="text-[9px] truncate max-w-[56px] text-center leading-tight mt-0.5">
          {item.label.split(' ')[0]}
        </span>
      </button>
    );
  };

  return (
    <div className="md:hidden fixed bottom-4 sm:bottom-5 inset-x-3 sm:inset-x-4 z-50 animate-float-up max-w-md mx-auto pointer-events-none">
      <div className="neu-float px-1.5 sm:px-2 py-1.5 flex items-center justify-between relative pointer-events-auto border border-white/80 shadow-lg">
        {/* Left nav items */}
        <div className="flex items-center gap-0.5">
          {leftItems.map(renderNavItem)}
        </div>

        {/* Center Camera Button — overlapping the pill bar */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-float transition-all active:scale-90 ${
              activeTab === 'diagnostics'
                ? 'bg-emerald-700 ring-4 ring-emerald-200'
                : 'bg-emerald-900 hover:bg-emerald-800'
            }`}
          >
            <Camera className="w-7 h-7 text-white" />
          </button>
        </div>

        {/* Center spacer */}
        <div className="w-16" />

        {/* Right nav items */}
        <div className="flex items-center gap-0.5">
          {rightItems.map(renderNavItem)}
        </div>
      </div>
    </div>
  );
}
