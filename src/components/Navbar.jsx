import React, { useState } from 'react';
import { Sprout, Bell, Globe, Check, Menu } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import MobileNavDrawer from './MobileNavDrawer';
import { getPublicNav } from '../config/navConfig';

export default function Navbar({ activeView, setActiveView }) {
  const { toggleLanguage, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "High humidity alert: Yellow Rust risk increased in main field.", time: "10m ago", read: false },
    { id: 2, text: "Field soil moisture is nearing its target band — consider irrigation.", time: "1h ago", read: false },
    { id: 3, text: "Weather forecast: Rain expected tomorrow evening.", time: "3h ago", read: true }
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  // Same nav data as the desktop center nav — bound to view navigation.
  const navItems = getPublicNav(t).map((item) => ({
    ...item,
    active: activeView === item.id,
    onClick: () => setActiveView(item.id),
  }));

  return (
    <header className={`${activeView === 'landing' ? 'bg-transparent shadow-none' : 'neu-nav sticky top-0'} z-40 w-full max-w-full box-border px-3 sm:px-4 lg:px-8 py-3 flex items-center justify-between gap-2 sm:gap-3 transition-all`}>
      {/* Brand Logo */}
      <div
        className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0 shrink"
        onClick={() => setActiveView('landing')}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-neumorphic shrink-0">
          <Sprout className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg sm:text-xl lg:text-2xl tracking-tight text-emerald-950 truncate">
              {t.brandName}
            </span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full shrink-0">
              AI Powered
            </span>
          </div>
          <p className="text-xs text-emerald-700/60 hidden sm:block truncate">{t.tagline}</p>
        </div>
      </div>

      {/* Center Navigation (Desktop) */}
      <nav className="hidden md:flex items-center gap-1 bg-white/60 backdrop-blur-sm p-1.5 rounded-full shadow-neumorphic">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              item.active
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-emerald-700/60 hover:text-emerald-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Controls (Language, Notifications, Profile, Hamburger) */}
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 min-w-0">
        {/* Language Toggle — desktop only (moves into the drawer on mobile) */}
        <button
          onClick={toggleLanguage}
          className="hidden md:flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-xs font-bold text-emerald-900 shadow-neumorphic transition-all active:scale-95 shrink-0"
          title="Switch Language"
          aria-label="Switch Language"
        >
          <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t.languageSwitch}</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-emerald-900 shadow-neumorphic transition-all active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-emerald-800" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm neu-card p-4 z-50 border border-emerald-100/50 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100/40 mb-3">
                <h4 className="font-bold text-sm text-emerald-950">Notifications</h4>
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
                    className={`p-3 rounded-2xl text-xs transition-colors ${
                      n.read
                        ? 'bg-emerald-50/40 text-emerald-800/70'
                        : 'bg-emerald-100/60 text-emerald-950 font-medium border-l-4 border-emerald-500'
                    }`}
                  >
                    <p className="line-clamp-2">{n.text}</p>
                    <span className="text-[10px] text-emerald-600/50 mt-1 block">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hamburger — mobile only, opens the primary nav drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-emerald-900 shadow-neumorphic transition-all active:scale-95 shrink-0"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          <Menu className="w-6 h-6 text-emerald-900" />
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t.brandName}
        subtitle={t.tagline}
        items={navItems}
        footer={
          <div className="space-y-2">
            {/* Language toggle — the only drawer footer action now that auth is removed */}
            <button
              onClick={() => {
                toggleLanguage();
                setDrawerOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors min-h-[48px]"
            >
              <Globe className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="truncate">{t.languageSwitch}</span>
            </button>
          </div>
        }
      />
    </header>
  );
}
