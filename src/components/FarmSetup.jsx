import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Check, Leaf, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { SUPPORTED_CROPS } from '../services/onnxLabels';

/**
 * AGRIO — Dashboard-entry setup gate.
 * ────────────────────────────────────────────────────────────────────────────
 * Collects the ONE active farmer name + ONE active crop before the dashboard is
 * usable (MVP: one farmer / one farm / one field, no authentication). Rendered
 * as a full-screen overlay by Dashboard when the farm profile is incomplete, or
 * on demand when the farmer taps "Change".
 *
 * Crop source of truth: the SET of on-device-AI-supported crops comes from
 * SUPPORTED_CROPS (onnxLabels.js — the CropGuard model's 14 crops). Existing
 * AGRIO crops that the model does NOT cover (wheat/mustard/rice) stay selectable
 * but are clearly flagged; when one is chosen, CropGuard abstains from offline
 * disease diagnosis (handled downstream by visionGuardService — untouched here).
 *
 * Selected crops are stored with their ENGLISH name + emoji so the existing
 * normalizers (cropProfiles.normalizeCropKey / visionGuardService
 * .normalizeToCropGuardKey) resolve them correctly regardless of UI language.
 */

// Presentational metadata for the 14 CropGuard-supported crops. The list of
// supported keys is driven by SUPPORTED_CROPS; this map only supplies label + emoji.
const SUPPORTED_DISPLAY = {
  apple: { emoji: '🍎', en: 'Apple', hi: 'सेब' },
  blueberry: { emoji: '🫐', en: 'Blueberry', hi: 'ब्लूबेरी' },
  cherry: { emoji: '🍒', en: 'Cherry', hi: 'चेरी' },
  corn: { emoji: '🌽', en: 'Corn / Maize', hi: 'मक्का' },
  grape: { emoji: '🍇', en: 'Grape', hi: 'अंगूर' },
  orange: { emoji: '🍊', en: 'Orange', hi: 'संतरा' },
  peach: { emoji: '🍑', en: 'Peach', hi: 'आड़ू' },
  pepper: { emoji: '🫑', en: 'Bell Pepper', hi: 'शिमला मिर्च' },
  potato: { emoji: '🥔', en: 'Potato', hi: 'आलू' },
  raspberry: { emoji: '🌿', en: 'Raspberry', hi: 'रसभरी' },
  soybean: { emoji: '🫘', en: 'Soybean', hi: 'सोयाबीन' },
  squash: { emoji: '🎃', en: 'Squash', hi: 'कद्दू' },
  strawberry: { emoji: '🍓', en: 'Strawberry', hi: 'स्ट्रॉबेरी' },
  tomato: { emoji: '🍅', en: 'Tomato', hi: 'टमाटर' },
};

// Existing AGRIO crops NOT covered by the CropGuard model — kept available, flagged.
const UNSUPPORTED_CROPS = [
  { key: 'wheat', emoji: '🌾', en: 'Wheat', hi: 'गेहूं' },
  { key: 'mustard', emoji: '🌼', en: 'Mustard', hi: 'सरसों' },
  { key: 'rice', emoji: '🌾', en: 'Rice (Paddy)', hi: 'धान' },
];

const SUPPORTED_OPTIONS = SUPPORTED_CROPS.map((key) => ({
  key,
  supported: true,
  ...(SUPPORTED_DISPLAY[key] || { emoji: '🌱', en: key.charAt(0).toUpperCase() + key.slice(1), hi: key }),
}));

const ALL_OPTIONS = [
  ...SUPPORTED_OPTIONS,
  ...UNSUPPORTED_CROPS.map((c) => ({ ...c, supported: false })),
];

/** Stored crop string — English name + emoji (keeps the normalizers language-agnostic). */
const cropValue = (opt) => `${opt.en} ${opt.emoji}`.trim();

/** Resolve a (possibly legacy free-text) crop string back to one of our option keys. */
function deriveSelectedKey(cropStr) {
  const slug = String(cropStr || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!slug) return '';
  const hit = ALL_OPTIONS.find((o) => slug.includes(o.key));
  if (hit) return hit.key;
  if (slug.includes('maize')) return 'corn';
  return '';
}

export default function FarmSetup({
  t = {},
  lang = 'en',
  initialFarmerName = '',
  initialCrop = '',
  onSave,
  onCancel,
  canCancel = false,
}) {
  const [name, setName] = useState(initialFarmerName || '');
  const [selectedKey, setSelectedKey] = useState(() => deriveSelectedKey(initialCrop));

  const label = (opt) => (lang === 'hi' ? opt.hi : opt.en);
  const canSave = name.trim().length > 0 && Boolean(selectedKey);

  const handleSave = () => {
    if (!canSave) return;
    const opt = ALL_OPTIONS.find((o) => o.key === selectedKey);
    if (!opt) return;
    onSave?.({ farmerName: name.trim(), crop: cropValue(opt) });
  };

  const CropCard = ({ opt }) => {
    const active = selectedKey === opt.key;
    return (
      <button
        type="button"
        onClick={() => setSelectedKey(opt.key)}
        aria-pressed={active}
        className={`relative min-h-[68px] p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all active:scale-[0.98] min-w-0 ${
          active
            ? 'bg-emerald-600 border-emerald-600 text-white shadow-neumorphic'
            : 'bg-white border-emerald-100 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-50/60 shadow-sm'
        }`}
      >
        <span className="text-2xl shrink-0 leading-none">{opt.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-sm leading-tight truncate">{label(opt)}</span>
          {!opt.supported && (
            <span className={`block text-[10px] leading-tight mt-0.5 ${active ? 'text-amber-100' : 'text-amber-600'}`}>
              {t.setupUnsupportedNote || 'Offline disease AI not currently supported'}
            </span>
          )}
        </span>
        {active && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/90 text-emerald-700 flex items-center justify-center shadow shrink-0">
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-emerald-950/70 backdrop-blur-md">
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-2xl bg-white rounded-3xl shadow-neumorphic-lg border border-emerald-100 my-2 sm:my-4 overflow-hidden min-w-0"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-emerald-900 to-emerald-700 p-5 sm:p-6 text-white">
            {canCancel && (
              <button
                type="button"
                onClick={() => onCancel?.()}
                aria-label={t.close || 'Close'}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Sprout className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-lg sm:text-xl tracking-tight truncate">
                  {canCancel
                    ? (t.setupEditTitle || t.setupTitle || 'Update Your Farm')
                    : (t.setupTitle || 'Welcome to AGRIO')}
                </h2>
                <p className="text-[11px] sm:text-xs text-emerald-100/80 leading-snug">
                  {t.setupSubtitle || 'Set up your farm to get personalized crop advice'}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-5 max-w-full min-w-0">
            {/* Farmer name */}
            <div>
              <label htmlFor="agrio-farmer-name" className="text-[11px] font-bold text-emerald-800/70 uppercase tracking-wider block mb-1.5">
                {t.setupFarmerNameLabel || 'Farmer Name'}
              </label>
              <input
                id="agrio-farmer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.setupFarmerNamePlaceholder || 'Enter your name'}
                autoComplete="name"
                className="w-full px-4 py-3 bg-emerald-50/60 rounded-2xl text-base font-semibold text-emerald-950 placeholder-emerald-600/40 border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            {/* On-device AI supported crops */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Leaf className="w-4 h-4 text-emerald-600 shrink-0" />
                <h3 className="font-extrabold text-sm text-emerald-950">
                  {t.setupSupportedHeader || 'On-device AI supported crops'}
                </h3>
              </div>
              <p className="text-[11px] text-emerald-700/60 mb-3 leading-snug">
                {t.setupSupportedHint || 'CropGuard runs offline disease diagnosis on-device for these crops.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full min-w-0">
                {SUPPORTED_OPTIONS.map((opt) => <CropCard key={opt.key} opt={opt} />)}
              </div>
            </div>

            {/* Unsupported (existing AGRIO) crops */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <h3 className="font-extrabold text-sm text-emerald-950">
                  {t.setupUnsupportedHeader || 'Other AGRIO crops'}
                </h3>
              </div>
              <p className="text-[11px] text-amber-700/70 mb-3 leading-snug">
                {t.setupUnsupportedHint || 'Fully supported across AGRIO, but offline disease AI is not available yet — the scanner uses cloud AI or abstains.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full min-w-0">
                {UNSUPPORTED_CROPS.map((c) => <CropCard key={c.key} opt={{ ...c, supported: false }} />)}
              </div>
            </div>

            {/* Continue / Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={`w-full py-4 rounded-2xl font-bold text-base shadow-neumorphic-lg transition-all flex items-center justify-center gap-2 min-h-[52px] ${
                canSave
                  ? 'bg-emerald-900 hover:bg-emerald-800 text-white active:scale-[0.99]'
                  : 'bg-emerald-100 text-emerald-400 cursor-not-allowed'
              }`}
            >
              <span>{canCancel ? (t.setupSave || 'Save') : (t.setupContinue || 'Continue to Dashboard')}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
