import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, Phone, Lock, User, ArrowRight, Eye, EyeOff, Loader2, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';

/**
 * AuthPage — bilingual phone + password login/register gate for farmers.
 * Reuses the existing AGRIO LanguageContext and emerald design tokens.
 * Layout, spacing, sizing, button positions and overall design preserved exactly.
 */
export default function AuthPage({ onSuccess }) {
  const { t, toggleLanguage } = useLanguage();
  const { login, register, error: ctxError } = useUser();
  const [mode, setMode]         = useState('login');   // 'login' | 'register'
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const err = localError || ctxError || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'register') {
      if (name.trim().length < 1) {
        setLocalError(t.authErrNameRequired);
        return;
      }
      const rawDigits = phone.replace(/[^\d]/g, '');
      if (rawDigits.length < 7 || rawDigits.length > 15) {
        setLocalError(t.authErrPhoneInvalid);
        return;
      }
      if (password.length < 6) {
        setLocalError(t.authErrPasswordShort);
        return;
      }
    } else {
      const rawDigits = phone.replace(/[^\d]/g, '');
      if (!rawDigits) {
        setLocalError(t.authErrPhoneRequired);
        return;
      }
      if (!password) {
        setLocalError(t.authErrPasswordShort);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register({ name: name.trim(), phone: phone.trim(), password });
      } else {
        await login({ phone: phone.trim(), password });
      }
      onSuccess?.();
    } catch (err) {
      setLocalError(err.message || t.authErrGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setLocalError('');
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 flex items-center justify-center p-4">
      {/* Language switcher button — matches AGRIO's existing top navigation pattern */}
      <div className="absolute top-4 right-4 z-10">
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-xs font-bold text-emerald-900 shadow-neumorphic transition-all active:scale-95"
          title="Switch Language"
          aria-label="Switch Language"
        >
          <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t.languageSwitch}</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-neumorphic mb-4">
            <Sprout className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-emerald-950 tracking-tight">{t.brandName}</h1>
          <p className="text-xs text-emerald-700/60 mt-1">{t.tagline}</p>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-sm border border-emerald-100 rounded-3xl shadow-neumorphic overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-emerald-100">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${
                  mode === m
                    ? 'text-emerald-900 border-b-2 border-emerald-600'
                    : 'text-emerald-600/50 hover:text-emerald-800'
                }`}
              >
                {m === 'login' ? t.authSignIn : t.authCreateAccount}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label htmlFor="auth-name" className="block text-xs font-bold text-emerald-800/70 uppercase tracking-wider mb-1.5">
                    {t.authFullNameLabel}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.authFullNamePlaceholder}
                      autoComplete="name"
                      className="w-full pl-10 pr-4 py-3 bg-emerald-50/60 rounded-2xl text-sm font-semibold text-emerald-950 placeholder-emerald-500/40 border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Number */}
            <div>
              <label htmlFor="auth-phone" className="block text-xs font-bold text-emerald-800/70 uppercase tracking-wider mb-1.5">
                {t.authPhoneLabel}
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.authPhonePlaceholder}
                  autoComplete="tel"
                  className="w-full pl-10 pr-4 py-3 bg-emerald-50/60 rounded-2xl text-sm font-semibold text-emerald-950 placeholder-emerald-500/40 border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="auth-password" className="block text-xs font-bold text-emerald-800/70 uppercase tracking-wider mb-1.5">
                {t.authPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? t.authPasswordPlaceholderNew : t.authPasswordPlaceholderExisting}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full pl-10 pr-11 py-3 bg-emerald-50/60 rounded-2xl text-sm font-semibold text-emerald-950 placeholder-emerald-500/40 border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-700 transition-colors"
                  aria-label={showPw ? t.authHidePassword : t.authShowPassword}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {err && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
              >
                {err}
              </motion.p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-sm shadow-neumorphic transition-all flex items-center justify-center gap-2 min-h-[48px] active:scale-[0.99]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? t.authSubmitSignIn : t.authSubmitCreate}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-emerald-700/40 mt-6">
          {t.authFooterNote}
        </p>
      </motion.div>
    </div>
  );
}
