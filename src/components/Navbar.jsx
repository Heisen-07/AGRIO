import React, { useState } from 'react';
import { Sprout, Bell, Globe, User, LogOut, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ activeView, setActiveView, isLoggedIn, setIsLoggedIn }) {
  const { lang, toggleLanguage, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "High humidity alert: Yellow Rust risk increased in Zone A.", time: "10m ago", read: false },
    { id: 2, text: "Automated irrigation completed for Zone B (450 L).", time: "1h ago", read: false },
    { id: 3, text: "Weather forecast: Rain expected tomorrow evening.", time: "3h ago", read: true }
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <header className="glass-nav sticky top-0 z-40 w-full border-b border-surface-border px-4 lg:px-8 py-3.5 flex items-center justify-between transition-all">
      {/* Brand Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setActiveView('landing')}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-soft-glow">
          <Sprout className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl lg:text-2xl tracking-tight text-forest">
              {t.brandName}
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
              AI Powered
            </span>
          </div>
          <p className="text-xs text-agrio-subtle hidden sm:block">{t.tagline}</p>
        </div>
      </div>

      {/* Center Navigation (Desktop) */}
      <nav className="hidden md:flex items-center gap-1 bg-surface-muted/80 p-1.5 rounded-2xl border border-surface-border">
        <button
          onClick={() => setActiveView('landing')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeView === 'landing'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-600 hover:text-emerald-700'
          }`}
        >
          {t.navLanding}
        </button>

        <button
          onClick={() => setActiveView('dashboard')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeView === 'dashboard'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-600 hover:text-emerald-700'
          }`}
        >
          {t.navDashboard}
        </button>
      </nav>

      {/* Controls (Language, Notifications, Profile) */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Language Toggle Button */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-surface-border hover:border-emerald-500 hover:text-emerald-700 text-xs font-bold text-gray-700 shadow-sm transition-all active:scale-95"
          title="Switch Language"
        >
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>{t.languageSwitch}</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-xl bg-white border border-surface-border hover:border-emerald-400 text-gray-700 shadow-sm transition-all active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-forest" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-lift border border-surface-border p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                <h4 className="font-bold text-sm text-forest">Notifications</h4>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark read
                  </button>
                )}
              </div>
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl text-xs transition-colors ${
                      n.read
                        ? 'bg-gray-50 text-gray-600'
                        : 'bg-emerald-50/60 text-emerald-950 font-medium border-l-4 border-emerald-500'
                    }`}
                  >
                    <p className="line-clamp-2">{n.text}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Account Button */}
        {isLoggedIn ? (
          <div className="flex items-center gap-2 pl-1">
            <div className="w-9 h-9 rounded-xl bg-forest text-white flex items-center justify-center font-bold text-sm shadow-sm">
              R
            </div>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setActiveView('login')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-soft-glow transition-all active:scale-95"
          >
            <User className="w-4 h-4" />
            <span>{t.navLogin}</span>
          </button>
        )}
      </div>
    </header>
  );
}
