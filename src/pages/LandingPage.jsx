import React from 'react';
import { motion } from 'framer-motion';
import {
  Sprout, Sparkles, RadioTower, CloudSun, ShieldCheck,
  ArrowRight, ChevronDown, CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage({ onExploreDashboard }) {
  const { t, lang } = useLanguage();

  const capabilities = [
    {
      id: 'advisory',
      icon: Sprout,
      title: lang === 'hi' ? 'एकीकृत कृषि सलाह' : 'Unified Farm Advisory',
      desc: lang === 'hi'
        ? 'पत्ती स्कैन, मृदा सेंसर और स्थानीय मौसम डेटा को मिलाकर एक स्पष्ट, कार्रवाई योग्य सलाह।'
        : 'Fuses leaf diagnosis, soil moisture probes, and localized climate into one clear, actionable advice board.',
      accent: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/70',
      badge: lang === 'hi' ? 'मुख्य केंद्र' : 'Core Command',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'ai-scanner',
      icon: Sparkles,
      title: lang === 'hi' ? 'CropGuard AI स्कैनर' : 'CropGuard AI Diagnostics',
      desc: lang === 'hi'
        ? 'डिवाइस पर ऑन-डिवाइस न्यूरल नेटवर्क और क्लाउड एआई द्वारा पत्तियों के रोगों की सटीक पहचान।'
        : 'Instant crop health diagnosis with calibrated on-device neural models and cloud fallback for 38+ plant conditions.',
      accent: 'bg-purple-500/10 text-purple-700 border-purple-200/70',
      badge: lang === 'hi' ? 'ऑन-डिवाइस AI' : 'On-Device AI',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    },
    {
      id: 'field-sensors',
      icon: RadioTower,
      title: lang === 'hi' ? 'खेत सेंसर और टेलीमेट्री' : 'Field Sensors & Telemetry',
      desc: lang === 'hi'
        ? 'मृदा नमी, तापमान व आर्द्रता की वास्तविक समय टेलीमेट्री। कोई काल्पनिक मान नहीं।'
        : 'Continuous real-time soil moisture and environmental monitoring from physical ESP32 field probes.',
      accent: 'bg-blue-500/10 text-blue-700 border-blue-200/70',
      badge: lang === 'hi' ? 'हार्डवेयर तैयार' : 'Hardware Ready',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    },
    {
      id: 'climate-intelligence',
      icon: CloudSun,
      title: lang === 'hi' ? 'मौसम और वर्षा पूर्वानुमान' : 'Climate & Rain Outlook',
      desc: lang === 'hi'
        ? 'स्थान-विशिष्ट वर्षा संभावना, तापमान रुझान और पर्यावरणीय जोखिम सूचनाएं।'
        : 'Hyper-local weather forecasts, rain probability windows, and early microclimate fungal risk indicators.',
      accent: 'bg-cyan-500/10 text-cyan-700 border-cyan-200/70',
      badge: lang === 'hi' ? 'मौसम पूर्वानुमान' : 'Forecast',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    },
    {
      id: 'offline-first',
      icon: ShieldCheck,
      title: lang === 'hi' ? 'ऑफ़लाइन-प्रथम आर्किटेक्चर' : 'Offline-First Resilience',
      desc: lang === 'hi'
        ? 'इंटरनेट न होने पर भी ऑन-डिवाइस AI और स्थानीय डेटा संचयन पूरी तरह काम करता है।'
        : 'Built for rural connectivity gaps — runs local AI models and stores field history right on your device.',
      accent: 'bg-amber-500/10 text-amber-700 border-amber-200/70',
      badge: lang === 'hi' ? 'ऑफ़लाइन सक्षम' : 'Offline Ready',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20 text-slate-900">

      {/* ═══════════════════════════════════════════════════════════════
          HERO — clean, uncluttered, vivid photographic background
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative w-full min-h-[86svh] md:min-h-[90vh] flex flex-col bg-[url('/farming.png')] bg-cover bg-center bg-no-repeat overflow-hidden">

        {/* Mobile readability gradient */}
        <div className="md:hidden absolute inset-0 bg-gradient-to-b from-white/95 via-emerald-50/90 to-emerald-950/40 z-0 pointer-events-none" />

        {/* Desktop readability gradient */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-emerald-50/95 via-emerald-50/85 via-50% to-transparent w-full md:w-4/5 lg:w-2/3 z-0 pointer-events-none" />

        {/* Master hero container */}
        <div className="relative z-10 flex flex-col justify-start md:justify-center w-full max-w-3xl lg:max-w-4xl px-5 sm:px-8 md:px-12 lg:px-20 flex-1 pt-24 sm:pt-28 md:pt-16 pb-12">

          {/* Eyebrow / label */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-300/60 text-emerald-900 text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4 self-start backdrop-blur-md shadow-2xs"
          >
            <Sprout className="w-3.5 h-3.5 text-emerald-700" />
            <span>{lang === 'hi' ? 'एआई प्रिसिज़न एग्रीकल्चर' : 'AI Precision Agriculture'}</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-[clamp(2.1rem,6vw,3.6rem)] font-extrabold text-emerald-950 tracking-tight leading-[1.12] mb-4 sm:mb-6 text-balance drop-shadow-xs"
          >
            {lang === 'hi' ? (
              t.landingHeroTitle || 'स्मार्ट खेती, बेहतर पैदावार — AGRIO AI के साथ'
            ) : (
              <>
                Precision Agriculture <br className="hidden sm:inline" />
                Powered by <span className="text-emerald-700">AGRIO AI</span>
              </>
            )}
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-base sm:text-lg text-slate-700 font-normal max-w-xl leading-relaxed mb-8"
          >
            {t.landingHeroSub || 'One unified agricultural platform fusing on-device crop vision, field telemetry, and microclimate intelligence.'}
          </motion.p>

          {/* Button Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <button
              onClick={onExploreDashboard}
              className="px-7 sm:px-8 py-3.5 sm:py-4 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-base shadow-neumorphic hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 flex items-center gap-2.5 cursor-pointer ring-1 ring-inset ring-white/30 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none shrink-0"
            >
              <span>{t.exploreDashboard || 'Enter Dashboard'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>

        </div>

        {/* Scroll hint chevron */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden sm:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex-col items-center gap-1 opacity-60 pointer-events-none"
        >
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-4 h-4 text-slate-600" />
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CAPABILITIES SECTION — Standardized Glassmorphic Cards
      ═══════════════════════════════════════════════════════════════ */}
      <section className="w-full py-16 px-4 sm:px-8 lg:px-16 max-w-6xl mx-auto relative z-20">

        {/* Section Header */}
        <div className="mb-10 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'hi' ? 'कृषि क्षमताएं' : 'Platform Capabilities'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight">
            {lang === 'hi' ? 'खेत प्रबंधन के लिए एक सम्पूर्ण समाधान' : 'Everything Your Farm Needs in One Platform.'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl leading-relaxed">
            {lang === 'hi'
              ? 'एआई निदान, सेंसर टेलीमेट्री और मौसम सलाह का एक सहज, किसान-अनुकूल अनुभव।'
              : 'Verifiable AI intelligence fused with physical IoT telemetry and local environmental observations.'}
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.id}
                onClick={onExploreDashboard}
                className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-6 shadow-neumorphic hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer flex flex-col justify-between min-w-0 ring-1 ring-inset ring-white/50 group text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs group-hover:scale-105 transition-transform duration-200 ${cap.accent}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs truncate max-w-[120px] ${cap.badgeColor}`}>
                      {cap.badge}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-950 transition-colors mb-2">
                    {cap.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                    {cap.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:text-emerald-950">
                  <span>{lang === 'hi' ? 'डैशबोर्ड में देखें' : 'Explore Feature'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HONEST MISSION & DATA SAFETY STRIP (Replaces fake stats)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-emerald-950 text-white py-14 px-5 sm:px-10 lg:px-16 border-t border-emerald-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-left">
          <div className="min-w-0 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 block mb-2">
              {lang === 'hi' ? 'डेटा सत्यनिष्ठा और सुरक्षा' : 'Data Integrity & Verifiability'}
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {lang === 'hi'
                ? 'काल्पनिक आंकड़े नहीं — केवल वास्तविक परीक्षण और प्रामाणिक सेंसर डेटा'
                : 'No Fabricated Claims. Transparent AI & Verified Field Telemetry.'}
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/70 mt-2 leading-relaxed">
              {lang === 'hi'
                ? 'AGRIO प्रयोगशाला मृदा परीक्षण का दावा नहीं करता। पत्तियों के लक्षण दृश्य आधार पर परखे जाते हैं और हार्डवेयर केवल वास्तविक सेंसर रीडिंग प्रदर्शित करता है।'
                : 'AGRIO never fabricates nutrient lab numbers, soil moisture levels, or crop yield statistics. All observations are strictly tied to calibrated neural models and active sensor telemetry.'}
            </p>
          </div>

          <button
            onClick={onExploreDashboard}
            className="px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-sm shadow-md active:scale-95 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>{t.exploreDashboard || 'Enter Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

    </div>
  );
}


