import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Phone, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LoginPage({ onLoginSuccess }) {
  const { t } = useLanguage();
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
    }, 600);
  };

  const handleVerify = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white/85 backdrop-blur-sm rounded-3xl shadow-neumorphic-lg p-6 sm:p-8"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-neumorphic mb-3">
            <Sprout className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-emerald-950">{t.loginTitle}</h2>
          <p className="text-xs text-emerald-700/50 mt-1 max-w-xs">{t.loginSub}</p>
        </div>

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">
                {t.mobileNumberLabel}
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-emerald-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder={t.mobilePlaceholder}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-emerald-50/50 border-0 focus:ring-2 focus:ring-emerald-500 text-sm font-medium text-emerald-950 outline-none transition-all shadow-neumorphic-inset"
                  required
                />
              </div>
            </div>

            <p className="text-[11px] text-emerald-700/40 bg-emerald-50/60 p-3 rounded-2xl">
              💡 {t.demoNote}
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-neumorphic active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t.getOtp}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-4">
                <CheckCircle2 className="w-4 h-4" /> OTP Sent to {mobile}
              </span>
              <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider mb-3">
                {t.otpLabel}
              </label>

              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={otp[idx]}
                    onChange={(e) => {
                      const newOtp = [...otp];
                      newOtp[idx] = e.target.value;
                      setOtp(newOtp);
                      if (e.target.value && e.target.nextSibling) {
                        e.target.nextSibling.focus();
                      }
                    }}
                    className="w-13 h-13 text-center text-xl font-bold rounded-2xl bg-emerald-50/50 border-0 focus:ring-2 focus:ring-emerald-500 outline-none shadow-neumorphic-inset"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-neumorphic active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{t.verifyOtp}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full text-xs text-emerald-600/60 hover:text-emerald-700 font-semibold text-center"
            >
              ← Change Mobile Number
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
