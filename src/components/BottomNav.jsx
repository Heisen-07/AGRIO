import React from 'react';
import { Sprout, Radio, Camera, CloudSun, BarChart3 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Mobile Bottom Navigation Bar
 * 
 * Visual Layout:
 * - LEFT: 🌱 Advisory, 📡 Field Sensors
 * - CENTER: 📷 AI Scanner (Visually emphasized, elevated circular glass button)
 * - RIGHT: 🌦 Climate, 📊 Analytics
 * 
 * Features:
 * - Touch targets >= 44px
 * - Safe-area inset support
 * - Clean semantic colors and glassmorphic depth
 * - Active tab highlighting
 */
export default function BottomNav({ activeTab, setActiveTab }) {
  const { t } = useLanguage();

  const leftItems = [
    { id: 'advisory', label: t.tabAdvisory || 'Advisory', icon: Sprout },
    { id: 'irrigation', label: t.tabFieldSensors || 'Sensors', icon: Radio },
  ];

  const rightItems = [
    { id: 'climate', label: t.tabClimate || 'Climate', icon: CloudSun },
    { id: 'analytics', label: t.tabAnalytics || 'Analytics', icon: BarChart3 },
  ];

  const renderNormalItem = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const shortLabel = item.label.split(' ')[0];

    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        role="tab"
        aria-selected={isActive}
        aria-label={item.label}
        className={`flex-1 min-w-0 min-h-[48px] py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          isActive
            ? 'bg-emerald-500/15 text-emerald-950 font-bold border border-emerald-400/30 shadow-2xs'
            : 'text-slate-500 hover:text-emerald-900 hover:bg-emerald-50/50 font-medium'
        }`}
      >
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
            isActive
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
        </div>
        <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-[56px] text-center font-semibold">
          {shortLabel}
        </span>
      </button>
    );
  };

  const isScannerActive = activeTab === 'diagnostics';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/92 backdrop-blur-xl border-t border-emerald-100/90 shadow-[0_-8px_30px_rgba(6,78,59,0.08)] ring-1 ring-inset ring-white/60"
    >
      <div className="w-full max-w-md mx-auto px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.625rem)] flex items-center justify-between relative">
        {/* Left: Advisory & Field Sensors */}
        <div className="flex-1 flex items-center justify-around gap-1">
          {leftItems.map(renderNormalItem)}
        </div>

        {/* Center: Visually Emphasized AI Scanner Button */}
        <div className="px-2 shrink-0 flex flex-col items-center justify-center">
          <button
            onClick={() => setActiveTab('diagnostics')}
            role="tab"
            aria-selected={isScannerActive}
            aria-label={t.tabScanner || 'AI Scanner'}
            className={`w-14 h-14 -mt-5 rounded-full flex flex-col items-center justify-center shadow-neumorphic border-2 border-white ring-4 transition-all duration-200 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              isScannerActive
                ? 'bg-gradient-to-tr from-emerald-950 to-emerald-700 text-white ring-emerald-400/50 shadow-lg scale-105'
                : 'bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white ring-emerald-500/20 hover:scale-105'
            }`}
          >
            <Camera className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[8px] font-extrabold uppercase tracking-tight mt-0.5">
              {t.tabScannerShort || 'Scan'}
            </span>
          </button>
        </div>

        {/* Right: Climate & Analytics */}
        <div className="flex-1 flex items-center justify-around gap-1">
          {rightItems.map(renderNormalItem)}
        </div>
      </div>
    </nav>
  );
}
