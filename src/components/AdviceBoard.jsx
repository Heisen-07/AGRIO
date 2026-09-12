import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Leaf, Bug, ShieldAlert, FlaskConical, Droplets, CloudRain, CloudSun, Thermometer,
  CheckCircle, AlertTriangle, HelpCircle, Eye, Database, Sprout,
  ClipboardList, ListChecks, Radio, ChevronDown, ChevronUp, ShieldCheck,
  Camera, RadioTower, ExternalLink,
} from 'lucide-react';

/**
 * AGRIO Advice Board — the ONE unified, farmer-facing surface for a fused advisory.
 * ────────────────────────────────────────────────────────────────────────────────
 * Renders the normalized advisory object with clean, balanced, farmer-friendly layout:
 *   1. Visual Focus: AGRIO Advice Board hero card with status headline & metadata
 *   2. Touch-friendly Quick Next Actions (Scan leaf, Check sensors, View climate)
 *   3. Compact Risks & Alerts cards (or "No major risks right now")
 *   4. Farmer Action Section: WHAT TO DO NOW (2–4 concise checkmark items)
 *   5. Compact Irrigation Card (state, reason, moisture bar)
 *   6. Disease / Pest / Nutrient Observations (compact, never claiming measured NPK)
 *   7. Conditional Expert / KVK Referral (only when condition is severe or uncertain)
 *
 * Fully protected against dynamic text distortion with min-w-0, break-words,
 * and robust responsive containers.
 */

// ── Style maps ──
const STATUS_STYLE = {
  healthy: { grad: 'from-emerald-500 to-teal-600', tint: 'bg-gradient-to-br from-emerald-50/80 via-white/85 to-teal-50/60 border-emerald-200/90', icon: CheckCircle },
  monitor: { grad: 'from-amber-500 to-orange-500', tint: 'bg-gradient-to-br from-amber-50/80 via-white/85 to-orange-50/60 border-amber-200/90', icon: Eye },
  action_needed: { grad: 'from-rose-500 to-red-600', tint: 'bg-gradient-to-br from-rose-50/80 via-white/85 to-red-50/60 border-rose-200/90', icon: AlertTriangle },
  insufficient_data: { grad: 'from-slate-400 to-slate-500', tint: 'bg-gradient-to-br from-slate-50/80 via-white/85 to-slate-100/60 border-slate-200/90', icon: HelpCircle },
};

const IRR_STYLE = {
  required: { badge: 'bg-sky-100 text-sky-900 border-sky-300', icon: Droplets, accent: 'text-sky-700' },
  not_required: { badge: 'bg-slate-100 text-slate-700 border-slate-300', icon: CheckCircle, accent: 'text-slate-600' },
  delay: { badge: 'bg-amber-100 text-amber-900 border-amber-300', icon: CloudRain, accent: 'text-amber-700' },
  monitor: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', icon: Eye, accent: 'text-emerald-700' },
  insufficient_data: { badge: 'bg-slate-100 text-slate-700 border-slate-300', icon: HelpCircle, accent: 'text-slate-500' },
};

const SEV_CHIP = {
  Critical: 'bg-rose-100 text-rose-900 border-rose-300',
  High: 'bg-orange-100 text-orange-900 border-orange-300',
  Moderate: 'bg-amber-100 text-amber-900 border-amber-300',
  Low: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Info: 'bg-slate-100 text-slate-700 border-slate-300',
};

const RISK_ICON = {
  soil_moisture: Droplets,
  rain_water: CloudRain,
  heat_stress: Thermometer,
  humidity_fungal: CloudSun,
  pest: Bug,
  disease: Leaf,
  nutrient: FlaskConical,
  data_quality: Radio,
};

const RISK_ICON_ACCENT = {
  soil_moisture: 'bg-blue-50 text-blue-700 border-blue-200/60',
  rain_water: 'bg-sky-50 text-sky-700 border-sky-200/60',
  heat_stress: 'bg-rose-50 text-rose-700 border-rose-200/60',
  humidity_fungal: 'bg-amber-50 text-amber-700 border-amber-200/60',
  pest: 'bg-orange-50 text-orange-700 border-orange-200/60',
  disease: 'bg-amber-50 text-amber-700 border-amber-200/60',
  nutrient: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  data_quality: 'bg-slate-50 text-slate-700 border-slate-200/60',
};

const RISK_BORDER = {
  Critical: 'border-l-4 border-l-rose-500 border-rose-200/80 bg-rose-50/40 text-rose-950',
  High: 'border-l-4 border-l-orange-500 border-orange-200/80 bg-orange-50/40 text-orange-950',
  Moderate: 'border-l-4 border-l-amber-500 border-amber-200/80 bg-amber-50/40 text-amber-950',
  Low: 'border-l-4 border-l-emerald-500 border-emerald-200/80 bg-emerald-50/40 text-emerald-950',
  Info: 'border-l-4 border-l-slate-400 border-slate-200/80 bg-slate-50/40 text-slate-900',
};

// ── Presentational helpers ──
const L = (t, key, fallback) => (t && t[key]) || fallback;

function Chip({ className = '', children }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs whitespace-nowrap shrink-0 ${className}`}>
      {children}
    </span>
  );
}

/** Horizontal soil-moisture band */
function MoistureBar({ sm, t }) {
  const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const pct = (v) => `${clamp(v)}%`;
  return (
    <div className="mt-2 min-w-0">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
        <span>{L(t, 'advSoilMoisture', 'Soil moisture')}</span>
        <span className="text-emerald-950 font-bold">{sm.value}{sm.unit || '%'}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-100/90 overflow-hidden border border-slate-200/80">
        <div className="absolute inset-y-0 left-0 bg-rose-200/70" style={{ width: pct(sm.criticalLow) }} />
        <div
          className="absolute inset-y-0 bg-emerald-300/70"
          style={{ left: pct(sm.targetMin), width: `${clamp(sm.targetMax) - clamp(sm.targetMin)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-white shadow"
          style={{ left: pct(sm.value) }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
        <span>{sm.criticalLow}% min</span>
        <span>{L(t, 'advTargetBand', 'Target:')} {sm.targetMin}–{sm.targetMax}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/** One compact risk/alert card */
export function RiskCard({ risk, t }) {
  const Icon = RISK_ICON[risk.type] || AlertTriangle;
  const iconAccent = RISK_ICON_ACCENT[risk.type] || 'bg-slate-50 text-slate-700 border-slate-200/60';
  const borderStyle = RISK_BORDER[risk.severity] || RISK_BORDER.Info;
  const sevLabel = L(t, `riskSev_${risk.severity}`, risk.severity);

  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all min-w-0 flex flex-col justify-between ${borderStyle}`}>
      <div>
        <div className="flex items-start justify-between gap-2 min-w-0 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${iconAccent}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-sm font-bold text-slate-900 leading-snug truncate min-w-0">{risk.title}</p>
          </div>
          <Chip className={SEV_CHIP[risk.severity] || SEV_CHIP.Info}>{sevLabel}</Chip>
        </div>

        {risk.description && (
          <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed break-words min-w-0 mt-1">
            {risk.description}
          </p>
        )}
      </div>

      {/* Single concise recommendation if available */}
      {Array.isArray(risk.recommendations) && risk.recommendations.length > 0 && (
        <p className="text-xs text-emerald-900 font-medium mt-2 pt-2 border-t border-slate-200/50 flex items-start gap-1.5 leading-snug break-words min-w-0">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1">{risk.recommendations[0]}</span>
        </p>
      )}
    </div>
  );
}

/** Compact Risks & Alerts Section */
function CompactRiskAlerts({ risks = [], t }) {
  const [expanded, setExpanded] = useState(false);
  const TOP = 3;
  const list = Array.isArray(risks) ? risks : [];
  const shown = expanded ? list : list.slice(0, TOP);
  const extra = Math.max(0, list.length - TOP);

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-emerald-100/80 rounded-3xl p-4 sm:p-5 shadow-neumorphic w-full min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="font-bold text-base sm:text-lg text-emerald-950 truncate min-w-0">
            {L(t, 'riskSectionTitle', 'Risks & Alerts')}
          </h3>
        </div>
        {list.length > 0 && (
          <span className="text-xs text-slate-500 font-medium shrink-0">
            {list.length} {list.length === 1 ? 'alert' : 'alerts'}
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-950">
              {L(t, 'noMajorRisksTitle', 'No major risks right now')}
            </p>
            <p className="text-xs text-emerald-800/80 mt-0.5 leading-relaxed break-words">
              {L(t, 'noMajorRisksBody', "AGRIO isn't seeing any priority risks from the current data.")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map((risk) => <RiskCard key={risk.id} risk={risk} t={t} />)}
          </div>
          {extra > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-2xl text-xs font-bold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/70 transition-colors min-h-[40px] cursor-pointer"
            >
              {expanded
                ? (<>{L(t, 'riskShowLess', 'Show less')} <ChevronUp className="w-4 h-4" /></>)
                : (<>+{extra} · {L(t, 'riskShowMore', 'Show more risks')} <ChevronDown className="w-4 h-4" /></>)}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function AdviceBoard({
  advisory,
  risks = [],
  t = {},
  lang = 'en',
  onNavigateTab,
  diagnosticResult,
}) {
  if (!advisory) return null;

  const {
    overallStatus,
    detectedIssues = [],
    treatmentRecommendations = [],
    nutrientRecommendations = [],
    irrigationRecommendation: irr,
    preventionRecommendations = [],
    nextActions = [],
    dataSources = [],
    crop,
    zone,
    generatedAt,
  } = advisory;

  const st = STATUS_STYLE[overallStatus?.code] || STATUS_STYLE.insufficient_data;
  const is = IRR_STYLE[irr?.state] || IRR_STYLE.insufficient_data;
  const HeroIcon = st.icon;
  const IrrIcon = is.icon;

  let generatedLabel = null;
  try {
    generatedLabel = generatedAt
      ? new Date(generatedAt).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' })
      : null;
  } catch {
    generatedLabel = null;
  }

  // Gather 2 to 4 priority actions for "WHAT TO DO NOW"
  const rawActions = [];
  if (Array.isArray(treatmentRecommendations)) {
    for (const tr of treatmentRecommendations) {
      if (Array.isArray(tr.steps)) {
        for (const s of tr.steps) {
          if (s && !rawActions.includes(s)) rawActions.push(s);
        }
      }
    }
  }
  if (rawActions.length < 3 && Array.isArray(preventionRecommendations)) {
    for (const p of preventionRecommendations) {
      if (p.title && !rawActions.includes(p.title)) rawActions.push(p.title);
    }
  }
  if (rawActions.length < 3 && Array.isArray(nextActions)) {
    for (const a of nextActions) {
      if (a.action && !rawActions.includes(a.action)) rawActions.push(a.action);
    }
  }
  // Default sensible action if list is empty
  if (rawActions.length === 0) {
    if (overallStatus?.code === 'healthy') {
      rawActions.push(
        lang === 'hi' ? 'हर 3–5 दिन में नियमित खेत निरीक्षण जारी रखें' : 'Continue routine field scouting every 3–5 days',
        lang === 'hi' ? 'संतुलित पोषण और अनुशंसित नमी स्तर बनाए रखें' : 'Maintain balanced nutrition and recommended soil moisture'
      );
    } else {
      rawActions.push(
        lang === 'hi' ? 'प्रभावित पत्तियों का बारीकी से निरीक्षण करें' : 'Inspect affected leaves and monitor closely',
        lang === 'hi' ? 'सिंचाई और मिट्टी की नमी को लक्ष्य सीमा में रखें' : 'Maintain soil moisture within recommended target range',
        lang === 'hi' ? 'अनुशंसित अंतराल के बाद दोबारा जांच करें' : 'Monitor again after the recommended interval'
      );
    }
  }
  const whatToDoList = rawActions.slice(0, 4);

  // Check if Expert / KVK referral is warranted
  const isExpertWarranted =
    diagnosticResult?.severity === 'Critical' ||
    diagnosticResult?.severity === 'High' ||
    diagnosticResult?.guardrailStatus === 'abstained' ||
    (diagnosticResult?.confidence != null && diagnosticResult.confidence < 60) ||
    overallStatus?.severity === 'Critical';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full text-left space-y-4 sm:space-y-5 min-w-0"
    >
      {/* ── 1. VISUAL FOCUS: AGRIO ADVICE BOARD HERO CARD ── */}
      <div className={`relative overflow-hidden rounded-3xl border shadow-neumorphic-lg p-5 sm:p-7 ${st.tint} backdrop-blur-md ring-1 ring-inset ring-white/60 w-full min-w-0`}>
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          {/* Status Icon */}
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${st.grad} flex items-center justify-center shrink-0 shadow-md text-white ring-2 ring-white/60`}>
            <HeroIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-emerald-800/80">
                {L(t, 'adviceBoardTitle', 'AGRIO ADVICE BOARD')}
              </span>
            </div>

            {/* Status headline */}
            <h2 className="text-xl sm:text-2xl lg:text-[26px] font-bold text-slate-950 leading-tight break-words min-w-0">
              {overallStatus?.headline || (lang === 'hi' ? 'स्वस्थ — कोई कार्रवाई आवश्यक नहीं' : 'Healthy — no action needed')}
            </h2>

            {/* One short supporting sentence */}
            <p className="text-sm sm:text-base font-normal text-slate-700 mt-1.5 leading-relaxed break-words min-w-0 max-w-3xl">
              {overallStatus?.summary || (lang === 'hi' ? 'पत्ती स्कैन उपलब्ध नहीं है। मिट्टी की नमी पर्याप्त है।' : 'Leaf scan not available. Soil moisture is adequate.')}
            </p>

            {/* Small metadata chips: [Apple] [Field] [Severity] */}
            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              {crop?.name && (
                <Chip className="bg-emerald-50 text-emerald-950 border-emerald-300/70">
                  <Sprout className="w-3 h-3 inline -mt-0.5 mr-1 text-emerald-700" />
                  <span>{crop.name}</span>
                </Chip>
              )}
              {zone && (
                <Chip className="bg-sky-50 text-sky-950 border-sky-300/70">
                  <span>{zone === 'field' ? (lang === 'hi' ? 'खेत' : 'Field Node') : zone}</span>
                </Chip>
              )}
              {overallStatus?.severity && (
                <Chip className={SEV_CHIP[overallStatus.severity] || SEV_CHIP.Info}>
                  <span>{overallStatus.severity}</span>
                </Chip>
              )}
            </div>
          </div>
        </div>

        {generatedLabel && (
          <p className="text-[10px] text-slate-500 mt-3 sm:absolute sm:top-5 sm:right-6 sm:mt-0 font-medium">
            {L(t, 'advGeneratedAt', 'Updated')} {generatedLabel}
          </p>
        )}
      </div>

      {/* ── 2. TOUCH-FRIENDLY NEXT ACTIONS (Quick Navigation Cards) ── */}
      {onNavigateTab && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
          <button
            type="button"
            onClick={() => onNavigateTab('diagnostics')}
            className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white border border-emerald-100/70 hover:border-purple-300 shadow-neumorphic hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 min-h-[56px] text-left group cursor-pointer ring-1 ring-inset ring-white/50 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-2xs">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-950 transition-colors truncate">
                {L(t, 'actionScanLeaf', 'Scan a leaf')}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {lang === 'hi' ? 'रोग और कीट निदान' : 'Instant AI leaf diagnosis'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('irrigation')}
            className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white border border-emerald-100/70 hover:border-blue-300 shadow-neumorphic hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 min-h-[56px] text-left group cursor-pointer ring-1 ring-inset ring-white/50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-2xs">
              <RadioTower className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-950 transition-colors truncate">
                {L(t, 'actionCheckSensors', 'Check field sensors')}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {lang === 'hi' ? 'मिट्टी की नमी और स्थिति' : 'Soil moisture & probes'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('weather')}
            className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white border border-emerald-100/70 hover:border-cyan-300 shadow-neumorphic hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 min-h-[56px] text-left group cursor-pointer ring-1 ring-inset ring-white/50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200/60 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-2xs">
              <CloudSun className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-cyan-950 transition-colors truncate">
                {L(t, 'actionViewClimate', 'View climate')}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {lang === 'hi' ? 'मौसम और बारिश का पूर्वानुमान' : 'Forecast & rain outlook'}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* ── 3. RISKS & ALERTS SECTION ── */}
      <CompactRiskAlerts risks={risks} t={t} />

      {/* ── 4 & 5. TWO-COLUMN BALANCED SECTION: Actions & Irrigation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full min-w-0">
        {/* WHAT TO DO NOW (Farmer Action Section) */}
        <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-white/50 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0 text-emerald-700 shadow-2xs">
                <ListChecks className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-emerald-950 truncate min-w-0">
                {L(t, 'whatToDoNow', 'WHAT TO DO NOW')}
              </h3>
            </div>

            <ul className="space-y-3 mt-2">
              {whatToDoList.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-slate-800 leading-normal break-words min-w-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-2xs">
                    ✓
                  </div>
                  <span className="min-w-0 flex-1">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-slate-400 mt-4 italic border-t border-slate-100 pt-2.5">
            {lang === 'hi' ? 'वर्तमान फसल और पर्यावरण डेटा पर आधारित' : 'Derived from current crop and environmental observations'}
          </p>
        </div>

        {/* COMPACT IRRIGATION CARD */}
        <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-white/50 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200/60 flex items-center justify-center shrink-0 text-sky-700 shadow-2xs">
                  <Droplets className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-emerald-950 truncate min-w-0">
                  {L(t, 'advIrrigation', '💧 IRRIGATION')}
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs flex items-center gap-1.5 ${is.badge}`}>
                <IrrIcon className="w-3.5 h-3.5" />
                <span>{L(t, `advState_${irr?.state}`, irr?.state?.toUpperCase() || 'MONITOR')}</span>
              </span>
            </div>

            {/* Concise Reason */}
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words min-w-0 mt-1">
              {irr?.reason || (lang === 'hi' ? 'वर्तमान नमी लक्ष्य सीमा में है।' : 'Current moisture is within the target range.')}
            </p>

            {/* Soil moisture target bar if available */}
            {irr?.soilMoisture && (
              <div className="mt-2.5">
                <MoistureBar sm={irr.soilMoisture} t={t} />
              </div>
            )}

            {/* Rain outlook if available */}
            {irr?.rainOutlook && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold">{L(t, 'advRainOutlook', 'Rain Outlook')}:</span>
                {irr.rainOutlook.amountMm != null && (
                  <Chip className="bg-sky-100 text-sky-900 border-sky-300">≈{irr.rainOutlook.amountMm} mm</Chip>
                )}
                {irr.rainOutlook.pop != null && (
                  <Chip className="bg-sky-100 text-sky-900 border-sky-300">{irr.rainOutlook.pop}%</Chip>
                )}
                {irr.rainOutlook.timingHours != null && (
                  <Chip className="bg-slate-100 text-slate-700 border-slate-300">~{irr.rainOutlook.timingHours}h</Chip>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 italic border-t border-slate-100 pt-2.5">
            {lang === 'hi' ? 'सिफारिश केवल मार्गदर्शन के लिए है' : 'Recommendation-only • No automatic valve controls'}
          </p>
        </div>
      </div>

      {/* ── 6. COMPACT DIAGNOSTIC OBSERVATIONS (DISEASE / PEST / NUTRIENT) ── */}
      {detectedIssues.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-white/50 w-full min-w-0">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0 text-amber-700 shadow-2xs">
              <ClipboardList className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-emerald-950 truncate min-w-0">
              {L(t, 'advDetected', 'Field Observations')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
            {/* Disease Card */}
            {(() => {
              const diseaseIssue = detectedIssues.find((i) => i.category === 'disease');
              return (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 backdrop-blur-sm p-4 flex flex-col justify-between min-w-0 shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 flex items-center gap-1.5">
                        <Leaf className="w-3.5 h-3.5 text-amber-700" />
                        {lang === 'hi' ? 'रोग' : 'DISEASE'}
                      </span>
                      {diseaseIssue && (
                        <Chip className={SEV_CHIP[diseaseIssue.severity] || SEV_CHIP.Low}>{diseaseIssue.severity}</Chip>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                      {diseaseIssue ? diseaseIssue.title : (lang === 'hi' ? 'कोई रोग नहीं मिला' : 'No disease detected')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-amber-200/50 text-[11px] text-slate-500 font-medium">
                    {diseaseIssue?.confidence != null ? `Confidence: ${diseaseIssue.confidence}%` : 'Visual Inspection'}
                  </div>
                </div>
              );
            })()}

            {/* Pest Card */}
            {(() => {
              const pestIssue = detectedIssues.find((i) => i.category === 'pest');
              return (
                <div className="rounded-2xl border border-orange-200/60 bg-orange-50/30 backdrop-blur-sm p-4 flex flex-col justify-between min-w-0 shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-900/70 flex items-center gap-1.5">
                        <Bug className="w-3.5 h-3.5 text-orange-700" />
                        {lang === 'hi' ? 'कीट' : 'PEST'}
                      </span>
                      {pestIssue && (
                        <Chip className={SEV_CHIP[pestIssue.severity] || SEV_CHIP.Low}>{pestIssue.severity}</Chip>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                      {pestIssue ? pestIssue.title : (t.pestNoneDetected || (lang === 'hi' ? 'कोई कीट नहीं पाया गया' : 'None detected'))}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-orange-200/50 text-[11px] text-slate-500 font-medium">
                    {pestIssue ? (pestIssue.detail || 'Observed') : (lang === 'hi' ? 'स्थिति सामान्य' : 'Status: Optimal')}
                  </div>
                </div>
              );
            })()}

            {/* Nutrient Observation Card (explicitly visual observation, never claiming laboratory NPK) */}
            {(() => {
              const nutrientIssue = detectedIssues.find((i) => i.category === 'nutrient') || nutrientRecommendations[0];
              return (
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 backdrop-blur-sm p-4 flex flex-col justify-between min-w-0 shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900/70 flex items-center gap-1.5 mb-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-emerald-700" />
                      {t.nutrientObsTitle || (lang === 'hi' ? 'पोषक तत्व अवलोकन' : 'NUTRIENT OBSERVATION')}
                    </span>
                    <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                      {nutrientIssue ? (nutrientIssue.title || nutrientIssue.symptomStatement) : (lang === 'hi' ? 'पोषक लक्षण सामान्य' : 'No visible deficiency')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-200/50">
                    <p className="text-[10px] text-emerald-800/80 italic leading-tight">
                      {t.nutrientVisualNote || (lang === 'hi' ? 'केवल दृश्य लक्षण — प्रयोगशाला मृदा परीक्षण नहीं' : 'Visual symptoms only — not a soil test')}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── 7. CONDITIONAL EXPERT / KVK SECTION (Only shown when warranted) ── */}
      {isExpertWarranted && (
        <div className="rounded-3xl border border-purple-200/80 bg-gradient-to-r from-purple-50/90 via-white/85 to-blue-50/90 backdrop-blur-md p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-white/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full min-w-0">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm sm:text-base text-purple-950 leading-snug">
                {L(t, 'expertReviewTitle', 'Expert Review Recommended')}
              </h4>
              <p className="text-xs sm:text-[13px] text-purple-900/80 mt-0.5 leading-relaxed break-words">
                {L(t, 'expertReviewBody', 'AI confidence is low or the condition is severe. Consult your nearest Krishi Vigyan Kendra (KVK).')}
              </p>
            </div>
          </div>

          <a
            href="https://kvk.icar.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-800 hover:bg-purple-900 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <span>{L(t, 'findKvkBtn', 'Find Nearest KVK')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ── 8. DATA SOURCES STRIP (Compact footer) ── */}
      {Array.isArray(dataSources) && dataSources.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/60 border border-emerald-100/60 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600 flex items-center gap-1">
            <Database className="w-3 h-3 text-slate-400" />
            {L(t, 'advDataSources', 'Data Sources')}:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {dataSources.map((ds, idx) => (
              <span key={idx} className="inline-flex items-center gap-1">
                <span className="font-medium text-slate-700">{ds.label}</span>
                <span className="text-[10px] text-slate-400">({ds.status})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
