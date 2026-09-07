import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, ShieldAlert, Cpu, Activity, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage({ onExploreDashboard, onSignIn }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold mb-6 border border-emerald-200 shadow-sm"
        >
          <Sprout className="w-4 h-4 text-emerald-600" />
          <span>Next-Gen Agricultural Intelligence Platform</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-forest tracking-tight max-w-4xl mx-auto leading-tight"
        >
          {t.landingHeroTitle}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-gray-600 max-w-2xl mx-auto font-normal leading-relaxed"
        >
          {t.landingHeroSub}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onExploreDashboard}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lift hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>{t.exploreDashboard}</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={onSignIn}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-gray-50 text-forest font-bold text-base border border-surface-border shadow-soft-glow hover:scale-[1.02] active:scale-95 transition-all"
          >
            {t.signInAccount}
          </button>
        </motion.div>

        {/* Feature Preview Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <motion.div
            whileHover={{ y: -6 }}
            className="bg-white p-6 rounded-2xl border border-surface-border shadow-soft-glow"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-forest mb-2">{t.feature1Title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t.feature1Desc}</p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6 }}
            className="bg-white p-6 rounded-2xl border border-surface-border shadow-soft-glow"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-forest mb-2">{t.feature2Title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t.feature2Desc}</p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6 }}
            className="bg-white p-6 rounded-2xl border border-surface-border shadow-soft-glow"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-forest mb-2">{t.feature3Title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t.feature3Desc}</p>
          </motion.div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="bg-forest text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <h4 className="text-3xl font-extrabold text-emerald-400">12,500+</h4>
            <p className="text-xs text-gray-300 mt-1 uppercase font-semibold">Active Kisaan Users</p>
          </div>
          <div>
            <h4 className="text-3xl font-extrabold text-emerald-400">96.4%</h4>
            <p className="text-xs text-gray-300 mt-1 uppercase font-semibold">AI Diagnostic Accuracy</p>
          </div>
          <div>
            <h4 className="text-3xl font-extrabold text-emerald-400">35%</h4>
            <p className="text-xs text-gray-300 mt-1 uppercase font-semibold">Water Saved / Hectare</p>
          </div>
          <div>
            <h4 className="text-3xl font-extrabold text-emerald-400">24/7</h4>
            <p className="text-xs text-gray-300 mt-1 uppercase font-semibold">AGRIO Telemetry</p>
          </div>
        </div>
      </section>
    </div>
  );
}
