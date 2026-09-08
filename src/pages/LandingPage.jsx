import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, ShieldAlert, Cpu, Activity, ArrowRight, Play, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage({ onExploreDashboard, onSignIn }) {
  const { t, lang } = useLanguage();

  return (
    <div className="min-h-screen bg-white">

      {/* ═══════════════════════════════════════════════════════════════
          HERO — clean, uncluttered, vivid photographic background
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative w-full h-screen flex flex-col bg-[url('/farming.png')] bg-cover bg-center bg-no-repeat overflow-hidden">

        {/* Directional gradient: solid white/mint behind text on left, tapering to transparent for crisp cornfield on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-transparent w-full md:w-4/5 lg:w-2/3 z-0 pointer-events-none" />

        {/* Master hero container — expanded width & comfortable breathing room */}
        <div className="relative z-10 flex flex-col justify-center max-w-3xl lg:max-w-4xl px-6 md:px-12 lg:px-20 h-full pt-12">

          {/* Main Heading — bold, relaxed 2-line layout */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-emerald-950 tracking-tight leading-[1.15] mb-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          >
            {lang === 'hi' ? (
              t.landingHeroTitle
            ) : (
              <>
                Precision Agriculture <br className="hidden sm:inline" />
                Powered by <span className="text-emerald-700">AGRIO AI</span>
              </>
            )}
          </motion.h1>

          {/* Subheading — loosened spacing & readable max-width */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="text-base sm:text-lg text-emerald-900/80 font-normal max-w-xl leading-relaxed mb-8"
          >
            {t.landingHeroSub}
          </motion.p>

          {/* Button Row — balanced spacing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="flex flex-wrap items-center gap-5"
          >
            {/* Primary CTA — solid dark green pill */}
            <button
              onClick={onExploreDashboard}
              className="px-8 py-4 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center gap-2"
            >
              <span>{t.exploreDashboard}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Ghost 'Farmer Login' CTA */}
            <button
              onClick={onSignIn}
              className="flex items-center gap-3 text-emerald-950 font-semibold hover:opacity-75 transition-opacity group py-1"
            >
              <span className="w-12 h-12 rounded-full bg-emerald-900 text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-emerald-800 transition-all duration-200 shrink-0">
                <Play className="w-4 h-4 fill-white translate-x-0.5" />
              </span>
              <span className="text-base font-semibold">{t.signInAccount}</span>
            </button>
          </motion.div>

        </div>

        {/* Scroll hint chevron */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 opacity-50 pointer-events-none"
        >
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </motion.div>
      </div>
      {/* ── End Hero ── */}

      {/* ═══════════════════════════════════════════════════════════════
          BELOW-FOLD CARDS — All info tiles: About, Stats + 3 Features
      ═══════════════════════════════════════════════════════════════ */}
      <section className="w-full bg-gradient-to-b from-gray-50 to-white py-16 px-6 lg:px-20 relative z-20 -mt-2">
        <div className="max-w-[1400px] mx-auto">

          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">Platform Capabilities</p>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-emerald-950">Everything your farm needs.</h2>
          </motion.div>

          {/* Row 1: About & Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">

            {/* About AGRIO */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="squircle-card p-7 bg-emerald-50/60"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 shadow-sm">
                <Sprout className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-950 mb-2">{t.aboutAgrio}</h3>
              <p className="text-sm text-emerald-800/55 leading-relaxed">{t.aboutAgrioDesc}</p>
            </motion.div>

            {/* Platform Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="squircle-card p-7 bg-emerald-50/60"
            >
              <h3 className="text-base font-bold text-emerald-950 mb-5">{t.liveStats}</h3>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <span className="text-3xl font-extrabold text-emerald-700">12.5K+</span>
                  <p className="text-xs text-emerald-700/50 font-semibold uppercase tracking-wide mt-1">Active Farmers</p>
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-emerald-700">96.4%</span>
                  <p className="text-xs text-emerald-700/50 font-semibold uppercase tracking-wide mt-1">AI Accuracy</p>
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-emerald-700">35%</span>
                  <p className="text-xs text-emerald-700/50 font-semibold uppercase tracking-wide mt-1">Water Saved</p>
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-emerald-700">24/7</span>
                  <p className="text-xs text-emerald-700/50 font-semibold uppercase tracking-wide mt-1">Telemetry</p>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Row 2: 3 Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              whileHover={{ y: -6 }}
              className="squircle-card p-7 hover:shadow-xl transition-all duration-300 bg-white"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 shadow-sm">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-950 mb-2">{t.feature1Title}</h3>
              <p className="text-sm text-emerald-800/55 leading-relaxed">{t.feature1Desc}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -6 }}
              className="squircle-card p-7 hover:shadow-xl transition-all duration-300 bg-white"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 shadow-sm">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-950 mb-2">{t.feature2Title}</h3>
              <p className="text-sm text-emerald-800/55 leading-relaxed">{t.feature2Desc}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -6 }}
              className="squircle-card p-7 hover:shadow-xl transition-all duration-300 bg-white"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 shadow-sm">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-950 mb-2">{t.feature3Title}</h3>
              <p className="text-sm text-emerald-800/55 leading-relaxed">{t.feature3Desc}</p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          LIVE STATS — Dark emerald band
      ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-emerald-950 text-white py-16 px-6 lg:px-20">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          <div>
            <h4 className="text-4xl font-extrabold text-emerald-400">12,500+</h4>
            <p className="text-xs text-emerald-200/55 mt-2 uppercase font-semibold tracking-wider">Active Kisaan Users</p>
          </div>
          <div>
            <h4 className="text-4xl font-extrabold text-emerald-400">96.4%</h4>
            <p className="text-xs text-emerald-200/55 mt-2 uppercase font-semibold tracking-wider">AI Diagnostic Accuracy</p>
          </div>
          <div>
            <h4 className="text-4xl font-extrabold text-emerald-400">35%</h4>
            <p className="text-xs text-emerald-200/55 mt-2 uppercase font-semibold tracking-wider">Water Saved / Hectare</p>
          </div>
          <div>
            <h4 className="text-4xl font-extrabold text-emerald-400">24/7</h4>
            <p className="text-xs text-emerald-200/55 mt-2 uppercase font-semibold tracking-wider">AGRIO Telemetry</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE STICKY CTA — thumb-zone accessible
      ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-30 pointer-events-none">
        <button
          onClick={onExploreDashboard}
          className="pointer-events-auto w-full py-4 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>{t.exploreDashboard}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
}

