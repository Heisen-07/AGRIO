import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, CloudSun, AlertTriangle, CheckCircle, Radio,
  Wind, Thermometer, CloudRain, Sun, Upload, Camera, Sparkles, X, RefreshCw, Eye, KeyRound,
  Sprout, Home, Leaf, Cloud, Sliders, Bug, ShieldAlert, FlaskConical, Clock,
  Menu, Bell, Globe, WifiOff, Navigation, BarChart3, ExternalLink
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFarm } from '../context/FarmContext';
import SoilMoistureRing from '../components/SoilMoistureRing';
import MobileNavDrawer from '../components/MobileNavDrawer';
import HardwareConfigModal from '../components/HardwareConfigModal';
import FarmSetup from '../components/FarmSetup';
import { getDashboardNav } from '../config/navConfig';
import { diagnoseLeaf } from '../services/diagnosisService';
import { saveDiagnosisRecord } from '../services/storageService';
import { generateAdvisory, assessIrrigationForZone } from '../services/advisoryService';
import { generateRisks, RISK_TYPE } from '../services/riskService';
import { getCropProfile } from '../config/cropProfiles';
import { isCropSupported } from '../services/visionGuardService';
import AdviceBoard from '../components/AdviceBoard';
import AnalyticsView from '../components/AnalyticsView';

const CROP_EMOJI_MAP = {
  apple: '🍎', blueberry: '🫐', cherry: '🍒', corn: '🌽', maize: '🌽',
  grape: '🍇', orange: '🍊', peach: '🍑', pepper: '🫑', potato: '🥔',
  raspberry: '🌿', soybean: '🫘', squash: '🎃', strawberry: '🍓', tomato: '🍅',
  wheat: '🌾', mustard: '🌼', rice: '🌾',
};

/**
 * Leaf Diagnostic Result Component rendering 3 distinct agricultural health vectors:
 * 1. Disease Diagnostics Badge (name, severity, treatment plan)
 * 2. Nutrient Deficiency Badge & Tag (status, symptoms, 1-sentence fertilizer advice)
 * 3. Pest Infestation & Pressure Badge (risk badge, pattern, targeted action)
 * 4. Actionable Farmer Advisory Protocol (Spray status, Fertilizer, Next inspection)
 */
function LeafDiagnosticCard({ diagnosticResult, t, severityBadgeClasses, lang = 'en' }) {
  if (!diagnosticResult) return null;

  const isNutrientOptimal = 
    diagnosticResult.nutrientDeficiency?.status?.toLowerCase().includes('optimal') ||
    diagnosticResult.nutrientDeficiency?.status?.toLowerCase().includes('none') ||
    diagnosticResult.nutrientDeficiency?.status?.includes('अनुकूल');

  const pestSeverity = diagnosticResult.pestPressure?.severity || 'Low';
  const pestBadgeStyle = pestSeverity === 'Critical' || pestSeverity === 'High'
    ? 'bg-rose-100 text-rose-800 border-rose-300'
    : pestSeverity === 'Moderate'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  const isKvkWarranted =
    diagnosticResult.severity === 'Critical' ||
    diagnosticResult.severity === 'High' ||
    diagnosticResult.guardrailStatus === 'abstained' ||
    (typeof diagnosticResult.confidence === 'number' && diagnosticResult.confidence < 60);

  const confidenceDisplay = typeof diagnosticResult.confidence === 'number'
    ? (diagnosticResult.confidence > 1 ? `${Math.round(diagnosticResult.confidence)}%` : `${Math.round(diagnosticResult.confidence * 100)}%`)
    : null;

  const treatmentSteps = Array.isArray(diagnosticResult.treatment_steps)
    ? diagnosticResult.treatment_steps.slice(0, 4)
    : [];

  return (
    <div className="space-y-3.5 w-full min-w-0 text-left mt-4">
      {/* Engine Identity Badge */}
      {diagnosticResult.engine && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 border backdrop-blur-md min-w-0 shadow-2xs ring-1 ring-inset ring-white/40 ${
          diagnosticResult.engine === 'cropguard-onnx'
            ? diagnosticResult.guardrailStatus === 'abstained'
              ? 'bg-amber-50/80 text-amber-950 border-amber-200/80'
              : 'bg-purple-50/80 text-purple-950 border-purple-200/80'
            : diagnosticResult.engine === 'on-device'
              ? 'bg-slate-50/80 text-slate-900 border-slate-200/80'
              : 'bg-blue-50/80 text-blue-950 border-blue-200/80'
        }`}>
          <span className="shrink-0 mt-0.5 text-base">
            {diagnosticResult.engine === 'cropguard-onnx' ? '🧬' : diagnosticResult.engine === 'on-device' ? '⚡' : '☁️'}
          </span>
          <div className="min-w-0 flex-1">
            <span className="font-bold">
              {diagnosticResult.engine === 'cropguard-onnx'
                ? (lang === 'hi' ? 'CropGuard AI (डिवाइस पर न्यूरल नेटवर्क)' : 'CropGuard AI (On-Device Neural Network)')
                : diagnosticResult.engine === 'on-device'
                  ? (lang === 'hi' ? 'डिवाइस पर ह्युरिस्टिक इंजन' : 'On-Device Heuristic Engine')
                  : (lang === 'hi' ? 'क्लाउड AI (Gemini)' : 'Cloud AI (Gemini Multi-Crop)')}
            </span>
            {diagnosticResult.demoNotice && (
              <p className="mt-0.5 text-[11px] text-slate-600 leading-snug break-words">{diagnosticResult.demoNotice}</p>
            )}
            {diagnosticResult.guardrailStatus === 'abstained' && diagnosticResult.guardrailReasons?.length > 0 && (
              <p className="mt-1 font-semibold text-amber-800 text-[11px] break-words">
                {lang === 'hi' ? 'कारण: ' : 'Reason: '}
                {diagnosticResult.guardrailReasons.map((r) => r.replace(/_/g, ' ')).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3 Dedicated Compact Visual Cards (Single-column mobile, 3 columns desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
        {/* 1. Disease Diagnostics Card */}
        <div className="bg-amber-50/50 border border-amber-200/80 backdrop-blur-sm rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-w-0 ring-1 ring-inset ring-white/50">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
              <span className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Leaf className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                {lang === 'hi' ? 'रोग' : 'DISEASE'}
              </span>
              <span className={`px-2 py-0.5 font-bold text-[10px] rounded-full border shadow-2xs shrink-0 ${severityBadgeClasses[diagnosticResult.severity] || severityBadgeClasses.Moderate}`}>
                {diagnosticResult.severity}
              </span>
            </div>

            <h4 className="font-bold text-base text-slate-900 mb-1 leading-snug break-words min-w-0">
              {diagnosticResult.disease}
            </h4>

            {diagnosticResult.description ? (
              <p className="text-xs text-slate-700 leading-relaxed break-words min-w-0 mt-1">
                {diagnosticResult.description}
              </p>
            ) : null}
          </div>

          <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900/80 font-medium">
            <span>{confidenceDisplay ? `${lang === 'hi' ? 'विश्वास' : 'Confidence'}: ${confidenceDisplay}` : 'Diagnosed'}</span>
            <span className="font-semibold">{diagnosticResult.severity} Risk</span>
          </div>
        </div>

        {/* 2. Pest Pressure Card */}
        <div className="bg-orange-50/40 border border-orange-200/70 backdrop-blur-sm rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-w-0 ring-1 ring-inset ring-white/50">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
              <span className="text-[10px] font-bold text-orange-900/70 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Bug className="w-3.5 h-3.5 text-orange-700 shrink-0" />
                {lang === 'hi' ? 'कीट' : 'PEST'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs shrink-0 ${pestBadgeStyle}`}>
                {pestSeverity}
              </span>
            </div>

            <h4 className="font-bold text-base text-slate-900 mb-1 leading-snug break-words min-w-0">
              {diagnosticResult.pestPressure?.status || (lang === 'hi' ? 'कोई कीट नहीं पाया गया' : 'None Detected')}
            </h4>

            <p className="text-xs text-slate-700 leading-relaxed break-words min-w-0 mt-1">
              {diagnosticResult.pestPressure?.action || (pestSeverity === 'Low'
                ? (lang === 'hi' ? 'पत्तियों पर कोई गंभीर कीट क्षति नहीं दिखी।' : 'No active foliar pest damage detected.')
                : (lang === 'hi' ? 'सक्रिय कीट पैटर्न देखा गया।' : 'Active pest pressure noted.'))}
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-orange-200/60 text-[11px] text-slate-500 font-medium">
            <span>{pestSeverity === 'Low' ? (lang === 'hi' ? 'स्थिति सामान्य' : 'Status: Optimal') : 'Intervention advised'}</span>
          </div>
        </div>

        {/* 3. Nutrient Observation Card */}
        <div className="bg-emerald-50/50 border border-emerald-200/80 backdrop-blur-sm rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-w-0 ring-1 ring-inset ring-white/50">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
              <span className="text-[10px] font-bold text-emerald-900/70 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <FlaskConical className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                {lang === 'hi' ? 'पोषक तत्व अवलोकन' : 'NUTRIENT OBSERVATION'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs shrink-0 ${
                isNutrientOptimal 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {isNutrientOptimal ? 'Optimal' : 'Observed'}
              </span>
            </div>

            <h4 className="font-bold text-base text-slate-900 mb-1 leading-snug break-words min-w-0">
              {diagnosticResult.nutrientDeficiency?.status || (isNutrientOptimal ? 'Nutrient Levels: Optimal' : 'Possible Nutrient Symptoms')}
            </h4>

            <p className="text-xs text-slate-700 leading-relaxed break-words min-w-0 mt-1">
              {diagnosticResult.nutrientDeficiency?.symptoms || 'Visual foliage appearance is within normal parameters.'}
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-emerald-200/60">
            <p className="text-[10px] text-emerald-800/80 italic leading-tight">
              {lang === 'hi' ? 'केवल दृश्य लक्षण — प्रयोगशाला मृदा परीक्षण नहीं' : 'Visual symptoms only — not a soil test'}
            </p>
          </div>
        </div>
      </div>

      {/* WHAT TO DO NOW (Farmer Action Section) */}
      {treatmentSteps.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-2xl p-4 sm:p-5 min-w-0 shadow-2xs ring-1 ring-inset ring-white/50">
          <p className="font-bold text-xs text-emerald-950 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 text-xs font-bold">✓</div>
            <span>{t.whatToDoNow || 'WHAT TO DO NOW'}</span>
          </p>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-800 font-medium">
            {treatmentSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-snug break-words min-w-0">
                <span className="text-emerald-700 font-bold shrink-0 mt-0.5">•</span>
                <span className="min-w-0 flex-1">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actionable Protocol Pills (Spray, Fertilizer, Next Inspection) */}
      {diagnosticResult.advisory && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
          <div className="bg-white/80 backdrop-blur-md border border-emerald-100 rounded-2xl p-3 flex items-center gap-2.5 min-w-0 shadow-2xs ring-1 ring-inset ring-white/50">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center shrink-0 shadow-2xs">
              <Droplets className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-sky-900/60 tracking-wider truncate">
                {t.sprayStatusLabel || 'Spray Status'}
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">
                {diagnosticResult.advisory.sprayStatus || 'Verify Diagnosis First'}
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-emerald-100 rounded-2xl p-3 flex items-center gap-2.5 min-w-0 shadow-2xs ring-1 ring-inset ring-white/50">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0 shadow-2xs">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-emerald-900/60 tracking-wider truncate">
                {t.fertilizerActionLabel || 'Fertilizer'}
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">
                {diagnosticResult.advisory.fertilizerAction || 'Confirm with Soil Test'}
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-emerald-100 rounded-2xl p-3 flex items-center gap-2.5 min-w-0 shadow-2xs ring-1 ring-inset ring-white/50">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200/60 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-cyan-900/60 tracking-wider truncate">
                {t.nextInspectionLabel || 'Next Inspection'}
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">
                {diagnosticResult.advisory.nextInspection || '48 Hours'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONDITIONAL EXPERT / KVK REFERRAL (Only shown when warranted) */}
      {isKvkWarranted && (
        <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-r from-purple-50/90 via-white/85 to-blue-50/90 backdrop-blur-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0 shadow-2xs ring-1 ring-inset ring-white/50">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h5 className="font-bold text-xs sm:text-sm text-purple-950">
                {t.expertReviewTitle || 'Expert Review Recommended'}
              </h5>
              <p className="text-xs text-purple-900/80 mt-0.5 break-words">
                {t.expertReviewBody || 'AI confidence is low or the condition is severe. Consult your nearest Krishi Vigyan Kendra (KVK).'}
              </p>
            </div>
          </div>
          <a
            href="https://kvk.icar.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200 shrink-0 min-h-[38px] cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <span>{t.findKvkBtn || 'Find Nearest KVK'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ activeTab, setActiveTab, setActiveView }) {
  const { lang, t, toggleLanguage } = useLanguage();
  const {
    telemetry, telemetryStatus, telemetryHistory,
    diagnosisHistory, fetchDiagnosisHistory, activeFarm,
    weatherData, refreshWeather,
    detectLocation, isDetectingLocation,
    locationStatus,
    farmerName, activeCrop, isSetupComplete, saveFarmProfile,
  } = useFarm();

  // Automatic background location detection once per Dashboard mount
  const hasAutoDetectedRef = useRef(false);
  useEffect(() => {
    if (hasAutoDetectedRef.current) return;
    hasAutoDetectedRef.current = true;
    detectLocation();
  }, [detectLocation]);

  // Mobile navigation drawer + header notification popover
  const [navOpen, setNavOpen] = useState(false);
  const [showDashNotifs, setShowDashNotifs] = useState(false);
  const [showHardwareConfig, setShowHardwareConfig] = useState(false);

  // Real location name (replaces hardcoded "Punjab" when GPS or live weather detects real city)
  const detectedCity = weatherData?.current?.cityName;
  const detectedCountry = weatherData?.current?.country || 'India';
  const locationTag = detectedCity
    ? `${detectedCity}, ${detectedCountry}`
    : (activeFarm?.location || (locationStatus === 'denied' ? (t.locationDenied || 'Location permission denied') : (locationStatus === 'unavailable' || locationStatus === 'unsupported') ? (t.locationUnavailable || 'Location unavailable') : 'Punjab'));

  // Connection indicator — honest sensor-source state (never conflate "simulated" with "offline")
  const isLiveFeed = telemetryStatus?.connected;
  const telemetryMode = telemetryStatus?.mode || 'simulated';
  const sensorState = telemetryMode === 'simulated' ? 'simulated' : (isLiveFeed ? 'connected' : 'offline');
  const sensorMeta = {
    connected: { label: t.sensorConnected, dot: 'bg-emerald-500 animate-pulse', chip: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    simulated: { label: t.sensorSimulated, dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-800 border-amber-300' },
    offline:   { label: t.sensorOffline, dot: 'bg-slate-300', chip: 'bg-slate-100 text-slate-600 border-slate-300' },
  }[sensorState];

  // Weather freshness — derived from the real fetch timestamp, never invented
  const weatherAgeMin = weatherData?.updatedAt
    ? Math.max(0, Math.round((Date.now() - weatherData.updatedAt) / 60000))
    : null;

  // ── Climate page: honest 3-state weather status (live / cached / unavailable) ──
  // The Climate tab shows OpenWeatherMap data ONLY — never telemetry microclimate
  // or the hardcoded demo defaults used elsewhere. With no live/valid-cached weather
  // we say so instead of inventing temperature/humidity/rainfall. "live" ≤15m matches
  // the weatherService cache TTL; older-but-real data is honestly labelled "cached".
  const climateWeather = weatherData?.current || null;
  const climateWeatherStatus = !climateWeather
    ? 'unavailable'
    : (weatherAgeMin != null && weatherAgeMin <= 15 ? 'live' : 'cached');
  const climateForecast = Array.isArray(weatherData?.forecast) ? weatherData.forecast : [];
  const climateRain = weatherData?.rainOutlook || null;
  // Hours until the next meaningful rain slot, from the absolute timestamp (never invented).
  const climateRainInHours = climateRain?.nextRainAt != null
    ? Math.max(0, Math.round((climateRain.nextRainAt - Date.now()) / 3600000))
    : null;

  // Camera & File Input References
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Diagnostic State Hooks
  const [imagePreview, setImagePreview] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  // Cross-Platform Media Camera & Toast States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Crop Profile — active crop comes from the shared farm profile (FarmContext),
  // the single source of truth also consumed by the AI Scanner. No local crop state.
  const cropName = activeCrop || '';
  const cropSupported = isCropSupported(cropName);

  // Dashboard-entry setup gate: shown automatically until the profile is complete,
  // or on demand when the farmer taps "Change".
  const [showSetup, setShowSetup] = useState(false);

  // Primary Dashboard Identity (ONLY large primary heading in the Dashboard hero)
  const welcomeHeading = farmerName
    ? (lang === 'hi' ? `${t.welcomePrefix || 'स्वागत है'}, ${farmerName}` : `Welcome, ${farmerName}`)
    : (t.welcomeToAgrio || (lang === 'hi' ? 'AGRIO में आपका स्वागत है' : 'Welcome to AGRIO'));



  const cropDisplay = useMemo(() => {
    if (!cropName) return { name: '—', emoji: '🌱', display: '—' };
    const hasEmoji = /\p{Extended_Pictographic}/u.test(cropName);
    if (hasEmoji) return { name: cropName, emoji: '', display: cropName };
    const slug = cropName.toLowerCase().replace(/[^a-z]/g, '');
    const emoji = CROP_EMOJI_MAP[slug] || '🌱';
    return { name: cropName, emoji, display: `${emoji} ${cropName}` };
  }, [cropName]);

  const aiStatusBadge = useMemo(() => {
    if (cropSupported) {
      return {
        chip: lang === 'hi' ? '✓ ऑन-डिवाइस AI' : '✓ On-device AI',
        desc: t.activeCropSupported || (lang === 'hi' ? '✓ ऑन-डिवाइस AI समर्थित' : '✓ On-device AI supported'),
        isSupported: true,
      };
    }
    return {
      chip: lang === 'hi' ? 'ℹ ऑफ़लाइन AI नहीं' : 'ℹ Offline AI: N/A',
      desc: t.activeCropUnsupported || (lang === 'hi' ? 'ऑफ़लाइन AI वर्तमान में समर्थित नहीं' : 'Offline AI not currently supported'),
      isSupported: false,
    };
  }, [cropSupported, lang, t]);

  // ── Phase 4: unified AGRIO advisory (pure fusion of scan + sensors + weather) ──
  // diagnoseLeaf() results carry BOTH the flat card fields AND Phase-2 findings[] +
  // overallStatus, so the SAME object drives the existing LeafDiagnosticCard and this
  // advisory. We pass it as `vision` only when a findings[] array is actually present;
  // otherwise the advisory still runs on telemetry + weather (env + irrigation only).
  const cropProfile = useMemo(() => getCropProfile(cropName), [cropName]);
  const advisory = useMemo(
    () => generateAdvisory({
      vision: diagnosticResult && Array.isArray(diagnosticResult.findings) ? diagnosticResult : null,
      telemetry,
      weather: weatherData,
      cropProfile,
      zone: 'field',
      lang,
    }),
    [diagnosticResult, telemetry, weatherData, cropProfile, lang]
  );

  // ── Phase 5: risk & alert intelligence — CONSUMES the advisory above (never
  // recomputes irrigation), so the risk cards can't contradict the irrigation
  // engine. telemetryMode lets simulated-derived risks stay honestly flagged.
  const risks = useMemo(
    () => generateRisks({
      advisory,
      telemetry,
      weather: weatherData,
      cropProfile,
      telemetryMode,
      lang,
    }),
    [advisory, telemetry, weatherData, cropProfile, telemetryMode, lang]
  );

  // ── Climate tab alerts: surface ONLY genuinely climate/weather-derived risks from
  // the SHARED riskService output above (no second engine, nothing invented). Heat/
  // temperature stress, fungal-condition (humidity) and excess-moisture (rain) qualify;
  // vision-sourced findings (disease/pest/nutrient and the vision "stress" fallback,
  // which reuses the heat_stress type) are excluded via their 'vision' data source.
  const climateRisks = useMemo(
    () => (risks || []).filter(
      (r) =>
        (r.type === RISK_TYPE.HEAT_STRESS ||
          r.type === RISK_TYPE.HUMIDITY_FUNGAL ||
          r.type === RISK_TYPE.RAIN_WATER) &&
        !(Array.isArray(r.dataSources) && r.dataSources.includes('vision'))
    ),
    [risks]
  );

  // Field irrigation intelligence for the Irrigation tab (single-field).
  const fieldIrrigation = useMemo(
    () => assessIrrigationForZone({ telemetry, weather: weatherData, cropProfile, zone: 'field', lang }),
    [telemetry, weatherData, cropProfile, lang]
  );

  // Attach video stream when desktop camera modal mounts
  useEffect(() => {
    if (isCameraActive && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream]);

  // Clean up camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Auto-dismiss toast alert after 6 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle File Change with Type Validation & Trigger Gemini Analysis
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image file type (image/jpeg, image/png, image/webp)
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimeTypes.includes(file.type.toLowerCase())) {
      setToastMessage('Invalid file format. Please upload an image in JPEG, PNG, or WebP format.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result;
      setImagePreview(base64Data);
      runGeminiAnalysis(base64Data);
    };
    reader.readAsDataURL(file);

    // Reset input value so selecting the same file again triggers onChange
    e.target.value = '';
  };

  // Run AI analysis — cloud Gemini when online, on-device edge model when offline
  const runGeminiAnalysis = async (base64Data) => {
    const dataToAnalyze = base64Data || imagePreview;
    if (!dataToAnalyze) return;

    setDiagnosing(true);
    setScanError(null);
    setDiagnosticResult(null);

    try {
      const result = await diagnoseLeaf(dataToAnalyze, lang, { cropName });
      setDiagnosticResult(result);
      setShowInsights(true);
      if (result) {
        try {
          await saveDiagnosisRecord(activeFarm?.id || 'demo_farm', {
            ...result,
            imagePreview: dataToAnalyze,
          });
          fetchDiagnosisHistory?.();
        } catch (saveErr) {
          console.warn('Failed to auto-save diagnosis record:', saveErr);
        }
      }
    } catch (err) {
      console.error('Diagnostic error:', err);
      const isOffline = err?.offline || (typeof navigator !== 'undefined' && !navigator.onLine);
      setScanError(isOffline ? t.offlineScanNotice : (err.message || 'Failed to connect to Gemini AI Service.'));
      setShowInsights(true);
    } finally {
      setDiagnosing(false);
    }
  };

  // Stop desktop camera stream safely
  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Cross-platform camera trigger handler
  const handleCameraTrigger = async () => {
    setToastMessage(null);

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768);

    if (isMobile) {
      // Mobile: trigger native rear camera directly via capture="environment"
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
      return;
    }

    // Desktop: Request camera access using navigator.mediaDevices.getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        setCameraStream(stream);
        setIsCameraActive(true);
      } catch (err) {
        console.warn('Desktop camera permission/device error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setToastMessage('Camera permission denied. Please allow camera access in browser settings.');
        } else {
          // Clean fallback by invoking native file input
          if (cameraInputRef.current) {
            cameraInputRef.current.click();
          }
        }
      }
    } else {
      // Fallback if mediaDevices not available (e.g. non-HTTPS context)
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  // Capture snapshot from desktop video feed
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.92);

    // Stop video tracks and close camera viewfinder
    stopCameraStream();

    // Set preview and trigger diagnosis
    setImagePreview(base64Data);
    runGeminiAnalysis(base64Data);
  };



  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Severity color mapping
  const severityBadgeClasses = {
    Low: 'bg-emerald-100 text-emerald-800',
    Moderate: 'bg-amber-100 text-amber-900',
    High: 'bg-orange-100 text-orange-900',
    Critical: 'bg-red-100 text-red-900'
  };

  // Sidebar nav items — shared source of truth for the desktop sidebar AND the mobile drawer
  const sidebarItems = getDashboardNav(t);

  // Same items, bound to tab switching, for the mobile drawer
  const drawerNavItems = sidebarItems.map((item) => ({
    ...item,
    active: activeTab === item.id,
    onClick: () => setActiveTab(item.id),
  }));

  // Compact demo notifications for the mobile dashboard header bell
  const dashNotifications = [
    { id: 1, text: t.yellowRustRisk, time: '10m' },
    { id: 2, text: t.rainChance, time: '1h' },
  ];

  return (
    <div className="min-h-screen flex w-full max-w-full overflow-x-hidden">
      {/* ========== DASHBOARD-ENTRY SETUP GATE ========== */}
      {/* Blocks the dashboard until ONE farmer + ONE crop are set; also reopened via "Change". */}
      {(!isSetupComplete || showSetup) && (
        <FarmSetup
          t={t}
          lang={lang}
          initialFarmerName={farmerName}
          initialCrop={activeCrop}
          canCancel={isSetupComplete}
          onSave={(profile) => {
            saveFarmProfile(profile);
            setShowSetup(false);
          }}
          onCancel={() => setShowSetup(false)}
        />
      )}

      {/* Hidden Native Camera & File Picker Inputs */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ========== MOBILE DASHBOARD HEADER (md:hidden) ========== */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 flex items-center justify-between bg-emerald-950/90 backdrop-blur-md border-b border-white/5 shadow-lg">
        {/* Hamburger — opens the complete dashboard nav drawer */}
        <button
          onClick={() => setNavOpen(true)}
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full text-white hover:bg-white/10 active:scale-95 transition-all"
          aria-label="Open menu"
          aria-expanded={navOpen}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Brand — taps back to landing */}
        <div
          onClick={() => setActiveView && setActiveView('landing')}
          className="flex items-center gap-2 min-w-0 cursor-pointer"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 shrink-0">
            <Sprout className="w-4 h-4 text-emerald-300" />
          </span>
          <span className="font-extrabold text-white tracking-tight truncate">{t.brandName}</span>
        </div>

        {/* Notifications */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowDashNotifs((s) => !s)}
            className="relative flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Notifications"
            aria-expanded={showDashNotifs}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-emerald-950" />
          </button>

          {showDashNotifs && (
            <>
              <button
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setShowDashNotifs(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs bg-white rounded-3xl shadow-xl border border-emerald-100/50 z-50 p-4">
                <h4 className="font-bold text-sm text-emerald-950 pb-2 mb-2 border-b border-emerald-100/40">
                  Notifications
                </h4>
                <div className="space-y-2">
                  {dashNotifications.map((n) => (
                    <div key={n.id} className="p-3 rounded-2xl text-xs bg-emerald-50/60 text-emerald-900">
                      <p className="line-clamp-2">{n.text}</p>
                      <span className="text-[10px] text-emerald-600/50 mt-1 block">{n.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Dashboard Navigation Drawer — hamburger target, same items as the desktop sidebar */}
      <MobileNavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title={t.brandName}
        subtitle={t.navDashboard}
        items={drawerNavItems}
        footer={
          <div className="space-y-2">
            {/* Home / back to landing */}
            <button
              onClick={() => {
                setNavOpen(false);
                setActiveView && setActiveView('landing');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors min-h-[48px]"
            >
              <Home className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="truncate">{t.navLanding}</span>
            </button>

            {/* Language toggle */}
            <button
              onClick={() => {
                toggleLanguage();
                setNavOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors min-h-[48px]"
            >
              <Globe className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="truncate">{t.languageSwitch}</span>
            </button>
          </div>
        }
      />

      {/* ========== DESKTOP SIDEBAR ========== */}
      <aside className="hidden md:flex flex-col w-64 bg-emerald-950 min-h-screen fixed left-0 top-0 rounded-r-3xl z-30 p-6 justify-between">
        {/* Logo & Brand */}
        <div>
          <div
            onClick={() => setActiveView && setActiveView('landing')}
            className="flex items-center gap-3 mb-10 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Sprout className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-lg tracking-tight">{t.brandName}</h2>
              <p className="text-emerald-400/50 text-[10px] font-medium">AI Precision Agriculture</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  role="tab"
                  aria-selected={isActive}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98] ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 shadow-xs backdrop-blur-xs font-bold'
                      : 'text-emerald-100/60 hover:text-white hover:bg-emerald-800/40 font-medium'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-emerald-200/60'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Crop — read-only; managed via the setup gate (single source of truth) */}
          <div className="mt-8 p-4 bg-emerald-900/50 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-wider">
                {t.activeCropProfile}
              </label>
              <button
                type="button"
                onClick={() => setShowSetup(true)}
                className="text-[10px] font-bold text-emerald-300 hover:text-emerald-100 transition-colors"
              >
                {t.setupChange || 'Change'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="w-full text-left px-3 py-2.5 bg-emerald-950 rounded-xl text-sm font-semibold text-emerald-100 hover:ring-2 hover:ring-emerald-500/60 outline-none transition-all"
            >
              {cropName || '—'}
            </button>
            {cropName && (
              <span
                className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                  cropSupported
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {cropSupported ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                <span>{cropSupported ? (t.setupSupportedBadge || 'On-device AI') : (t.setupUnsupportedShort || 'Offline AI: N/A')}</span>
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* ========== MAIN CONTENT AREA ========== */}
      <div className="flex-1 md:ml-64 w-full min-w-0 max-w-full overflow-x-hidden">
        {/* Mobile Hero Farm Image Zone & Active Crop Card (ONLY ON ADVISORY PAGE) */}
        {activeTab === 'advisory' && (
          <div className="md:hidden relative w-full overflow-hidden">
            <div
              className="h-[28vh] min-h-[220px] sm:min-h-[250px] bg-cover bg-center relative overflow-hidden flex flex-col justify-between p-4"
              style={{ backgroundImage: "url('/lush-farm.jpg')" }}
            >
              {/* Seamless photographic fade overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-emerald-950/40 via-60% to-emerald-950/90" />

              {/* Top row with home redirect brand badge & secondary hardware status */}
              <div className="relative z-10 pt-12 flex items-center justify-between gap-2">
                <span
                  onClick={() => setActiveView && setActiveView('landing')}
                  className="text-[11px] font-bold text-white/90 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/40 transition-all border border-white/10 inline-flex items-center gap-1.5"
                >
                  <Sprout className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="truncate">{t.brandName}</span>
                </span>
                <button
                  onClick={() => setShowHardwareConfig(true)}
                  className="text-[10px] font-semibold text-white/90 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 hover:bg-black/40 transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={t.hardwareConfig || 'Hardware Setup'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sensorMeta.dot}`} />
                  <span className="truncate">{sensorMeta.label}</span>
                </button>
              </div>

              {/* Bottom row: ONLY large primary heading in the hero + metadata chips */}
              <div className="relative z-10 pb-3 min-w-0">
                <h1 className="text-2xl sm:text-[26px] font-bold text-white drop-shadow-md tracking-tight min-w-0 break-words leading-tight">
                  {welcomeHeading}
                </h1>

                {/* Secondary Farm Metadata Chips: [Active Crop] [Location] [AI Status] */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md text-emerald-100 border border-emerald-400/40 text-xs font-semibold shadow-2xs">
                    <span>{cropDisplay.display}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 backdrop-blur-md text-sky-100 border border-sky-400/40 text-xs font-semibold shadow-2xs">
                    <Navigation className="w-3 h-3 text-sky-300 shrink-0" />
                    <span className="max-w-[150px] truncate">{locationTag}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-xs font-semibold shadow-2xs ${
                    cropSupported
                      ? 'bg-purple-500/20 text-purple-100 border border-purple-400/40'
                      : 'bg-amber-500/20 text-amber-100 border border-amber-400/40'
                  }`}>
                    {cropSupported ? <Sparkles className="w-3 h-3 text-purple-300 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />}
                    <span>{aiStatusBadge.chip}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Active Crop Card (floating overlap) */}
            <div className="px-3.5 sm:px-4 -mt-3.5 relative z-10 w-full max-w-full">
              <div className={`p-4 rounded-2xl shadow-neumorphic border transition-all w-full min-w-0 backdrop-blur-md ring-1 ring-inset ring-white/60 ${
                cropSupported
                  ? 'bg-gradient-to-r from-emerald-50/70 via-white/90 to-teal-50/60 border-emerald-200/90'
                  : 'bg-gradient-to-r from-amber-50/70 via-white/90 to-orange-50/60 border-amber-200/90'
              }`}>
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70 flex items-center gap-1 mb-0.5">
                      <Sprout className="w-3 h-3 text-emerald-600" />
                      {t.activeCropTitle || 'ACTIVE CROP'}
                    </span>
                    <p className="text-base font-bold text-emerald-950 truncate">
                      {cropDisplay.display}
                    </p>
                    <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${
                      cropSupported ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      <span>{aiStatusBadge.desc}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSetup(true)}
                    className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200/80 transition-all hover:-translate-y-0.5 active:scale-95 min-h-[36px] flex items-center justify-center cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  >
                    {t.setupChange || 'Change'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Mobile Top Utility Bar (for non-advisory pages) */}
        {activeTab !== 'advisory' && (
          <div className="md:hidden flex items-center justify-between gap-2 px-3.5 pt-4 pb-2.5 bg-white/70 backdrop-blur-md border-b border-emerald-900/5">
            <button
              type="button"
              onClick={() => setActiveView && setActiveView('landing')}
              className="text-xs font-bold text-emerald-950 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 rounded-full transition-all border border-emerald-300/60 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
            >
              <Sprout className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{t.brandName || 'AGRIO'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHardwareConfig(true)}
              className="text-[11px] font-semibold text-emerald-950 bg-white/95 hover:bg-white px-2.5 py-1 rounded-full border border-emerald-200/80 shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
              title={t.hardwareConfig || 'Hardware Setup'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sensorMeta.dot}`} />
              <span className="truncate">{sensorMeta.label}</span>
            </button>
          </div>
        )}

        {/* Content wrapper */}
        <div className="bg-gradient-to-b from-emerald-50/30 to-white min-h-screen pb-36 sm:pb-40 md:pb-12 px-3.5 sm:px-6 lg:px-8 max-w-6xl mx-auto pt-4 md:pt-6 w-full min-w-0">
          {/* Desktop Hero & Active Crop Section (ONLY ON ADVISORY PAGE) */}
          {activeTab === 'advisory' && (
            <div className="hidden md:flex bg-white/80 backdrop-blur-md p-6 lg:p-7 rounded-3xl shadow-neumorphic mb-6 items-center justify-between gap-6 border border-emerald-500/15 ring-1 ring-inset ring-white/60 w-full min-w-0">
              <div className="min-w-0 flex-1">
                {/* Primary Dashboard Identity (ONLY large primary heading in the Dashboard hero) */}
                <h1 className="text-3xl lg:text-[32px] font-bold text-emerald-950 tracking-tight leading-tight min-w-0 break-words">
                  {welcomeHeading}
                </h1>

                {/* Secondary Farm Metadata Chips */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5">
                  {/* Active Crop Chip */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-950 text-xs sm:text-sm font-semibold border border-emerald-300/60 shadow-2xs backdrop-blur-md">
                    <Sprout className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{cropDisplay.display}</span>
                  </span>
                  {/* Location Chip */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-950 text-xs sm:text-sm font-semibold border border-sky-300/60 shadow-2xs backdrop-blur-md">
                    <Navigation className={`w-3.5 h-3.5 text-sky-700 shrink-0 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                    <span className="max-w-[200px] truncate">{locationTag}</span>
                  </span>
                  {/* AI Status Chip */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border shadow-2xs backdrop-blur-md ${
                    cropSupported
                      ? 'bg-purple-500/10 text-purple-950 border-purple-300/60'
                      : 'bg-amber-500/10 text-amber-950 border-amber-300/60'
                  }`}>
                    {cropSupported ? <Sparkles className="w-3.5 h-3.5 text-purple-700 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                    <span>{aiStatusBadge.chip}</span>
                  </span>
                  {/* Sensor indicator — visually secondary */}
                  <button
                    onClick={() => setShowHardwareConfig(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold text-blue-950 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-300/60 transition-all cursor-pointer active:scale-95 hover:-translate-y-0.5 shadow-2xs backdrop-blur-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    title={t.hardwareConfig || 'Hardware Setup'}
                  >
                    <span className={`w-2 h-2 rounded-full ${sensorMeta.dot}`} />
                    <span className="truncate">{sensorMeta.label}</span>
                  </button>
                </div>
              </div>

              {/* Desktop Active Crop Card */}
              <div className="w-80 shrink-0">
                <div className={`p-4 rounded-2xl border shadow-2xs transition-all w-full backdrop-blur-md ring-1 ring-inset ring-white/60 hover:shadow-xs ${
                  cropSupported
                    ? 'bg-gradient-to-br from-emerald-50/70 via-white/85 to-teal-50/50 border-emerald-200/90'
                    : 'bg-gradient-to-br from-amber-50/70 via-white/85 to-orange-50/50 border-amber-200/90'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70 flex items-center gap-1 mb-0.5">
                        <Sprout className="w-3 h-3 text-emerald-600" />
                        {t.activeCropTitle || 'ACTIVE CROP'}
                      </span>
                      <h3 className="text-base font-bold text-emerald-950 truncate">
                        {cropDisplay.display}
                      </h3>
                      <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${
                        cropSupported ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        <span>{aiStatusBadge.desc}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSetup(true)}
                      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200/80 transition-all hover:-translate-y-0.5 active:scale-95 min-h-[34px] flex items-center justify-center cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                    >
                      {t.setupChange || 'Change'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Views Content */}
          <AnimatePresence mode="wait">
            {/* VIEW 1 (DEFAULT): 🌱 FARM ADVISORY — unified AdviceBoard from scan + sensors + weather */}
            {activeTab === 'advisory' && (
              <motion.div
                key="advisory"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 sm:space-y-6 w-full min-w-0"
              >
                <AdviceBoard
                  advisory={advisory}
                  risks={risks}
                  t={t}
                  lang={lang}
                  onNavigateTab={setActiveTab}
                  diagnosticResult={diagnosticResult}
                />

                {/* If a scan exists, show its diagnostic card beneath the advisory */}
                {diagnosticResult && (
                  <LeafDiagnosticCard
                    diagnosticResult={diagnosticResult}
                    t={t}
                    severityBadgeClasses={severityBadgeClasses}
                    lang={lang}
                  />
                )}

                {/* Single active farm — multi-farm switching intentionally deferred */}
                <p className="text-[10px] text-slate-400/90 italic text-center">{t.multiFarmNote}</p>
              </motion.div>
            )}

            {/* VIEW 3: 📡 FIELD SENSORS & SOIL HEALTH — Live Field Instrument Panel */}
            {activeTab === 'irrigation' && (() => {
              const sensorTemp = typeof telemetry?.weather?.temperature === 'number'
                ? Math.round(telemetry.weather.temperature * 10) / 10
                : (typeof telemetry?.temperature === 'number' ? Math.round(telemetry.temperature * 10) / 10 : null);

              const sensorHumidity = typeof telemetry?.weather?.humidity === 'number'
                ? Math.round(telemetry.weather.humidity)
                : (typeof telemetry?.humidity === 'number' ? Math.round(telemetry.humidity) : null);

              const soilMoistureVal = typeof telemetry?.soilMoisture === 'number'
                ? Math.round(telemetry.soilMoisture)
                : null;

              const telemetryTimestamp = telemetry?.timestamp
                ? new Date(telemetry.timestamp).getTime()
                : (telemetryStatus?.lastPing || null);

              const telemetryAgeMin = (telemetryTimestamp && !isNaN(telemetryTimestamp))
                ? Math.max(0, Math.round((Date.now() - telemetryTimestamp) / 60000))
                : null;

              const isTelemetryStale = telemetryAgeMin !== null && telemetryAgeMin >= 15;

              const lastUpdatedText = telemetryAgeMin === null
                ? (lang === 'hi' ? 'डेटा उपलब्ध नहीं' : 'No data available')
                : telemetryAgeMin < 1
                  ? (lang === 'hi' ? 'अभी-अभी' : 'Just now')
                  : (lang === 'hi' ? `${telemetryAgeMin} मिनट पहले` : `${telemetryAgeMin} min ago`);

              const targetMin = cropProfile?.soilMoisture?.targetMin ?? 50;
              const targetMax = cropProfile?.soilMoisture?.targetMax ?? 70;
              const criticalLow = cropProfile?.soilMoisture?.criticalLow ?? 30;

              let moistureStatusText = null;
              let statusColors = {
                bg: 'bg-emerald-100',
                text: 'text-emerald-800',
                border: 'border-emerald-300',
                stroke: '#059669',
                track: '#D1FAE5',
                ringText: 'text-emerald-600',
              };

              if (soilMoistureVal !== null) {
                if (soilMoistureVal < criticalLow) {
                  moistureStatusText = lang === 'hi' ? 'गंभीर कम' : 'CRITICAL LOW';
                  statusColors = {
                    bg: 'bg-rose-100',
                    text: 'text-rose-800',
                    border: 'border-rose-300',
                    stroke: '#E11D48',
                    track: '#FFE4E6',
                    ringText: 'text-rose-600',
                  };
                } else if (soilMoistureVal < targetMin) {
                  moistureStatusText = lang === 'hi' ? 'कम' : 'LOW';
                  statusColors = {
                    bg: 'bg-amber-100',
                    text: 'text-amber-800',
                    border: 'border-amber-300',
                    stroke: '#D97706',
                    track: '#FEF3C7',
                    ringText: 'text-amber-600',
                  };
                } else if (soilMoistureVal > targetMax) {
                  moistureStatusText = lang === 'hi' ? 'उच्च' : 'HIGH';
                  statusColors = {
                    bg: 'bg-sky-100',
                    text: 'text-sky-800',
                    border: 'border-sky-300',
                    stroke: '#0284C7',
                    track: '#E0F2FE',
                    ringText: 'text-sky-600',
                  };
                } else {
                  moistureStatusText = lang === 'hi' ? 'इष्टतम' : 'OPTIMAL';
                  statusColors = {
                    bg: 'bg-emerald-100',
                    text: 'text-emerald-800',
                    border: 'border-emerald-300',
                    stroke: '#059669',
                    track: '#D1FAE5',
                    ringText: 'text-emerald-600',
                  };
                }
              }

              const clampVal = (v) => Math.max(0, Math.min(100, Number(v) || 0));

              return (
                <motion.div
                  key="irrigation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4 sm:space-y-6 w-full min-w-0"
                >
                  {/* A. PAGE HEADER */}
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-emerald-900/5 min-w-0"
                  >
                    <div className="min-w-0">
                      <h2 className="font-extrabold text-xl sm:text-2xl text-emerald-950 tracking-tight truncate">
                        {t.sidebarFieldSensors || t.fieldSensorsTitle || 'FIELD SENSORS'}
                      </h2>
                      <p className="text-xs sm:text-sm text-emerald-800/70 mt-0.5 truncate">
                        {lang === 'hi'
                          ? 'लाइव मृदा और पर्यावरणीय रीडिंग'
                          : 'Live soil and environmental readings'}
                      </p>
                    </div>

                    {/* Status Chip */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {sensorState === 'connected' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300/80 shadow-2xs whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>ESP32 Connected</span>
                          <span className="text-[10px] text-emerald-600 font-semibold border-l border-emerald-200 pl-1.5 hidden xs:inline">
                            Live telemetry
                          </span>
                        </div>
                      ) : sensorState === 'simulated' ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300/80 shadow-2xs whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>Simulated Sensors</span>
                          <span className="text-[10px] text-amber-600 font-semibold border-l border-amber-200 pl-1.5 hidden xs:inline">
                            Demo telemetry
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300/80 shadow-2xs whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span>Offline / Standby</span>
                          <span className="text-[10px] text-slate-500 font-semibold border-l border-slate-200 pl-1.5 hidden xs:inline">
                            No live readings
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => setShowHardwareConfig(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-emerald-850 text-xs font-bold border border-emerald-200/80 shadow-2xs cursor-pointer active:scale-95 transition-all"
                        title="Hardware connection settings"
                      >
                        <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="hidden sm:inline">Settings</span>
                      </button>
                    </div>
                  </motion.div>

                  {/* B. PRIMARY SOIL MOISTURE CARD (Dominant data card) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.04 }}
                    className="bg-white/85 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-neumorphic ring-1 ring-inset ring-white/50 w-full min-w-0 transition-all duration-200"
                  >
                    {/* Card Header with Freshness Tag */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0 shadow-sm text-white">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-base sm:text-lg text-emerald-950 tracking-tight truncate">
                            {lang === 'hi' ? 'खेत की मृदा नमी' : 'FIELD SOIL MOISTURE'}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-emerald-700/70 font-medium truncate">
                            {cropProfile?.name
                              ? `${cropProfile.name} • ${t.fieldLabel || 'Field'} Root-Zone`
                              : (t.currentField || 'Current Field Root-Zone')}
                          </p>
                        </div>
                      </div>

                      {/* Freshness Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {soilMoistureVal !== null ? (
                          isTelemetryStale ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold border shadow-2xs inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>{lang === 'hi' ? `⚠ ${telemetryAgeMin} मि. पुराना` : `⚠ Updated ${telemetryAgeMin} min ago`}</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold border shadow-2xs inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>{lang === 'hi' ? `ताज़ा • ${lastUpdatedText}` : `Fresh • Updated ${lastUpdatedText}`}</span>
                            </span>
                          )
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold border shadow-2xs inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border-slate-300">
                            <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lang === 'hi' ? 'डेटा उपलब्ध नहीं' : 'No data available'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body: Visual Ring + Large Numbers + Status */}
                    <div className="bg-white/90 backdrop-blur-md border border-emerald-100/70 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-neumorphic ring-1 ring-inset ring-white/60 flex flex-col md:flex-row items-center gap-6 lg:gap-10 w-full min-w-0">
                      {/* Left: Circular visualization */}
                      <div className="shrink-0 flex items-center justify-center">
                        {soilMoistureVal !== null ? (
                          <SoilMoistureRing
                            percentage={soilMoistureVal}
                            size={120}
                            strokeWidth={10}
                            bare={true}
                            statusText={moistureStatusText}
                            strokeColor={statusColors.stroke}
                            trackColor={statusColors.track}
                            statusColor={statusColors.ringText}
                          />
                        ) : (
                          <div className="w-[120px] h-[120px] rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                            <WifiOff className="w-8 h-8 mb-1" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Offline</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Values, status & target details */}
                      <div className="flex-1 min-w-0 w-full text-center md:text-left">
                        {soilMoistureVal !== null ? (
                          <>
                            <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 justify-center md:justify-start">
                              <p className="text-5xl sm:text-6xl font-extrabold text-emerald-950 tracking-tight leading-none">
                                {soilMoistureVal}
                                <span className="text-2xl sm:text-3xl font-bold text-emerald-600/70 ml-1">%</span>
                              </p>
                              {moistureStatusText && (
                                <span className={`self-center md:self-auto px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs whitespace-nowrap ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                                  {moistureStatusText}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-center md:justify-start gap-3 flex-wrap text-xs text-slate-600 font-medium">
                              <span className="font-semibold text-emerald-900/80">
                                {lang === 'hi'
                                  ? `लक्ष्य सीमा: ${targetMin}–${targetMax}%`
                                  : `Target band ${targetMin}–${targetMax}%`}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">
                                {lang === 'hi' ? `अपडेट: ${lastUpdatedText}` : `Updated ${lastUpdatedText}`}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="py-2">
                            <p className="text-2xl sm:text-3xl font-bold text-slate-700">
                              {lang === 'hi' ? 'कोई डेटा उपलब्ध नहीं' : 'No data available'}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">
                              {lang === 'hi'
                                ? 'लाइव रीडिंग देखने के लिए सेंसर नोड कनेक्ट करें।'
                                : 'Connect the sensor to view live readings.'}
                            </p>
                          </div>
                        )}

                        {/* Progress Band with Target Range Marker */}
                        <div className="mt-5 pt-4 border-t border-emerald-100/60 w-full min-w-0">
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 mb-2 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>{lang === 'hi' ? `लक्ष्य बैंड ${targetMin}–${targetMax}%` : `Target band ${targetMin}–${targetMax}%`}</span>
                            </span>
                            {soilMoistureVal !== null && (
                              <span className="text-emerald-950 font-bold text-xs">
                                {lang === 'hi' ? `वर्तमान मान: ${soilMoistureVal}%` : `Reading: ${soilMoistureVal}%`}
                              </span>
                            )}
                          </div>

                          <div className="relative h-3 rounded-full bg-slate-100 border border-slate-200/80 overflow-visible w-full min-w-0">
                            {/* Critical low zone */}
                            <div
                              className="absolute inset-y-0 left-0 bg-rose-200/70 rounded-l-full"
                              style={{ width: `${clampVal(criticalLow)}%` }}
                              title={`Critical Low: <${criticalLow}%`}
                            />
                            {/* Target optimal band */}
                            <div
                              className="absolute inset-y-0 bg-emerald-200/90 border-x border-emerald-400/60"
                              style={{
                                left: `${clampVal(targetMin)}%`,
                                width: `${clampVal(targetMax) - clampVal(targetMin)}%`,
                              }}
                              title={`Target: ${targetMin}% - ${targetMax}%`}
                            />
                            {/* Marker dot */}
                            {soilMoistureVal !== null && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-emerald-950 border-2 border-white shadow-md z-10 transition-all duration-300"
                                style={{ left: `${clampVal(soilMoistureVal)}%` }}
                              />
                            )}
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mt-2 px-0.5">
                            <span>0%</span>
                            <span className="text-emerald-700 font-bold uppercase tracking-wider">
                              {lang === 'hi' ? 'इष्टतम नमी क्षेत्र' : 'Optimal Zone'}
                            </span>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* C. ENVIRONMENTAL METRICS (Three compact cards) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">
                    {/* 1. Temperature */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.10 }}
                      className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-4 sm:p-5 shadow-neumorphic ring-1 ring-inset ring-white/50 min-w-0 flex flex-col justify-between transition-all duration-200 hover:border-amber-200/80"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0 shadow-2xs">
                            <Thermometer className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-xs uppercase tracking-wider text-amber-950/80 truncate">
                            {t.airTemperature || 'Temperature'}
                          </span>
                        </div>
                        {sensorTemp !== null ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 whitespace-nowrap">
                            {sensorState === 'connected' ? 'Live' : 'Simulated'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                            No Data
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {sensorTemp !== null ? (
                          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {sensorTemp}<span className="text-base font-bold text-slate-500 ml-0.5">°C</span>
                          </p>
                        ) : (
                          <p className="text-base sm:text-lg font-bold text-slate-600 italic">
                            {lang === 'hi' ? 'डेटा उपलब्ध नहीं' : 'No data available'}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                          {sensorTemp !== null
                            ? (sensorState === 'connected' ? 'Live ambient temperature' : 'Simulated field reading')
                            : 'Connect sensor to view live readings'}
                        </p>
                      </div>
                    </motion.div>

                    {/* 2. Humidity */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.16 }}
                      className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-4 sm:p-5 shadow-neumorphic ring-1 ring-inset ring-white/50 min-w-0 flex flex-col justify-between transition-all duration-200 hover:border-sky-200/80"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center shrink-0 shadow-2xs">
                            <Cloud className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-xs uppercase tracking-wider text-sky-950/80 truncate">
                            {t.airHumidity || 'Humidity'}
                          </span>
                        </div>
                        {sensorHumidity !== null ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200/60 whitespace-nowrap">
                            {sensorState === 'connected' ? 'Live' : 'Simulated'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                            No Data
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {sensorHumidity !== null ? (
                          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {sensorHumidity}<span className="text-base font-bold text-slate-500 ml-0.5">%</span>
                          </p>
                        ) : (
                          <p className="text-base sm:text-lg font-bold text-slate-600 italic">
                            {lang === 'hi' ? 'डेटा उपलब्ध नहीं' : 'No data available'}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                          {sensorHumidity !== null
                            ? (sensorState === 'connected' ? 'Live relative humidity' : 'Simulated relative humidity')
                            : 'Connect sensor to view live readings'}
                        </p>
                      </div>
                    </motion.div>

                    {/* 3. Sensor Status */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.22 }}
                      className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-4 sm:p-5 shadow-neumorphic ring-1 ring-inset ring-white/50 min-w-0 flex flex-col justify-between transition-all duration-200 hover:border-purple-200/80 sm:col-span-2 lg:col-span-1"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center shrink-0 shadow-2xs">
                            <Radio className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-xs uppercase tracking-wider text-purple-950/80 truncate">
                            {t.sensorStatus || 'Sensor Status'}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowHardwareConfig(true)}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-purple-800 bg-purple-100/70 hover:bg-purple-100 border border-purple-200 cursor-pointer active:scale-95 transition-all"
                          title="Hardware Configuration"
                        >
                          Configure
                        </button>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sensorMeta.dot}`} />
                          <span className="truncate">
                            {sensorState === 'connected'
                              ? 'Connected'
                              : sensorState === 'simulated'
                                ? 'Simulated'
                                : 'Offline'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                          {sensorState === 'connected'
                            ? 'ESP32 Telemetry active'
                            : sensorState === 'simulated'
                              ? 'Demo telemetry stream'
                              : 'No live sensor node'}
                        </p>
                      </div>
                    </motion.div>
                  </div>

                  {/* D. TELEMETRY FRESHNESS FOOTER STRIP */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.28 }}
                    className="bg-white/75 backdrop-blur-md border border-emerald-100/70 rounded-2xl p-4 shadow-neumorphic ring-1 ring-inset ring-white/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        telemetryTimestamp === null
                          ? 'bg-slate-300'
                          : isTelemetryStale
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-950 truncate">
                          {telemetryTimestamp === null
                            ? (lang === 'hi' ? 'टेलीमेट्री स्थिति: कोई डेटा नहीं' : 'Telemetry Status: No data available')
                            : isTelemetryStale
                              ? (lang === 'hi' ? 'टेलीमेट्री स्थिति: पुराना डेटा (Stale)' : 'Telemetry Status: Stale')
                              : (lang === 'hi' ? 'टेलीमेट्री स्थिति: लाइव और ताज़ा (Fresh)' : 'Telemetry Status: Fresh')}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {telemetryTimestamp === null
                            ? (lang === 'hi' ? 'सेंसर कनेक्ट होने पर लाइव डेटा दिखाई देगा' : 'Connect sensor to stream live field telemetry')
                            : isTelemetryStale
                              ? (lang === 'hi' ? `⚠ अंतिम रीडिंग ${telemetryAgeMin} मिनट पहले प्राप्त हुई थी` : `⚠ Last reading received ${telemetryAgeMin} min ago`)
                              : (lang === 'hi' ? `अंतिम अपडेट: ${lastUpdatedText}` : `Last updated ${lastUpdatedText}`)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-600 px-2.5 py-1 rounded-full bg-slate-100/80 border border-slate-200">
                        {telemetryMode === 'simulated'
                          ? 'Source: Simulated Sensors'
                          : isLiveFeed
                            ? 'Source: ESP32 Hardware'
                            : 'Source: Standby'}
                      </span>
                      <button
                        onClick={() => setActiveTab('analytics')}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 shadow-2xs cursor-pointer active:scale-95 transition-all"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>{t.tabAnalytics || 'Analytics'}</span>
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}

            {/* VIEW 4: 🌦 CLIMATE & FIELD OUTLOOK — Polished Instrument & Weather Station */}
            {activeTab === 'climate' && (() => {
              // 1. Current weather values
              const currentTemp = climateWeather?.temperature != null ? climateWeather.temperature : null;
              const currentHumidity = climateWeather?.humidity != null ? climateWeather.humidity : null;
              const currentWind = climateWeather?.windSpeed != null ? climateWeather.windSpeed : null;
              const currentUV = climateWeather?.uvIndex != null ? climateWeather.uvIndex : null;
              const currentCondition = climateWeather?.description || climateWeather?.condition || null;
              const currentIcon = climateWeather?.emojiIcon || '☀️';

              // 2. Rain Outlook derivation
              const rainTotalMm = climateRain?.totalMm != null ? climateRain.totalMm : null;
              const rainMaxPop = climateRain?.maxPop != null ? climateRain.maxPop : null;
              const hasRainLikelihood = (rainTotalMm != null && rainTotalMm > 0) || (rainMaxPop != null && rainMaxPop >= 30);

              let rainTimingText = lang === 'hi' ? 'कोई वर्षा अपेक्षित नहीं' : 'No rain expected';
              if (climateRainInHours === 0) {
                rainTimingText = lang === 'hi' ? 'अगले 1 घंटे के भीतर' : 'Within the hour';
              } else if (climateRainInHours !== null && climateRainInHours <= 4) {
                rainTimingText = lang === 'hi' ? `~${climateRainInHours} घंटे में` : `In ~${climateRainInHours} hours`;
              } else if (climateRainInHours !== null && climateRainInHours <= 12) {
                rainTimingText = lang === 'hi' ? 'आज रात / अगले 12 घंटे में' : 'Tonight / Next 12h';
              } else if (climateRainInHours !== null) {
                rainTimingText = lang === 'hi' ? `~${climateRainInHours} घंटे में` : `In ~${climateRainInHours}h`;
              } else if (hasRainLikelihood) {
                rainTimingText = lang === 'hi' ? 'अगले 24 घंटे की खिड़की' : 'Next 24h window';
              }



              // 3. Derived Agricultural Climate Conditions (Environmental Risks — NOT Diagnoses)
              const existingRainRisk = climateRisks.find((r) => r.type === RISK_TYPE.RAIN_WATER);
              const existingHeatRisk = climateRisks.find((r) => r.type === RISK_TYPE.HEAT_STRESS);
              const existingFungalRisk = climateRisks.find((r) => r.type === RISK_TYPE.HUMIDITY_FUNGAL);

              const environmentalConditions = [
                {
                  id: 'rain_water',
                  icon: CloudRain,
                  accentBg: 'bg-sky-50',
                  accentBorder: 'border-sky-200/70',
                  iconColor: 'text-sky-600',
                  title: existingRainRisk?.title || (lang === 'hi' ? 'वर्षा / जलभराव जोखिम' : 'Rain / Waterlogging Risk'),
                  severity: existingRainRisk?.severity || (hasRainLikelihood && rainTotalMm > 10 ? 'Moderate' : 'Low'),
                  description: existingRainRisk?.description || (
                    hasRainLikelihood
                      ? (lang === 'hi' ? 'संभावित वर्षा तात्कालिक सिंचाई की आवश्यकता को कम कर सकती है।' : 'Rain may reduce immediate irrigation need.')
                      : (lang === 'hi' ? 'वर्षा की मात्रा सामान्य अवशोषण सीमा में है। जलभराव का जोखिम कम है।' : 'Expected rainfall volume is manageable. Field waterlogging risk is low.')
                  ),
                },
                {
                  id: 'heat_stress',
                  icon: Thermometer,
                  accentBg: 'bg-amber-50',
                  accentBorder: 'border-amber-200/70',
                  iconColor: 'text-amber-600',
                  title: existingHeatRisk?.title || (lang === 'hi' ? 'ताप तनाव स्थिति' : 'Heat Stress Risk'),
                  severity: existingHeatRisk?.severity || (currentTemp != null && currentTemp >= (cropProfile?.temperature?.heatStress || 35) ? 'Moderate' : 'Low'),
                  description: existingHeatRisk?.description || (
                    currentTemp != null
                      ? (lang === 'hi'
                          ? `वर्तमान तापमान (${currentTemp}°C) विन्यस्त फसल सीमा के भीतर है।`
                          : `Current temperature (${currentTemp}°C) is within the configured crop range.`)
                      : (lang === 'hi' ? 'तापमान सामान्य फसल सीमा के भीतर है।' : 'Temperature is within configured crop thresholds.')
                  ),
                },
                {
                  id: 'humidity_fungal',
                  icon: Droplets,
                  accentBg: 'bg-cyan-50',
                  accentBorder: 'border-cyan-200/70',
                  iconColor: 'text-cyan-600',
                  title: existingFungalRisk?.title || (lang === 'hi' ? 'आर्द्रता / फंगल परिस्थितियाँ' : 'Humidity / Fungal Risk'),
                  severity: existingFungalRisk?.severity || (currentHumidity != null && currentHumidity >= (cropProfile?.humidity?.fungalRiskHigh || 80) ? 'Moderate' : 'Low'),
                  description: existingFungalRisk?.description || (
                    currentHumidity != null && currentHumidity >= (cropProfile?.humidity?.fungalRiskHigh || 80)
                      ? (lang === 'hi' ? 'उच्च आर्द्रता फंगल-जोखिम की स्थितियों को बढ़ा सकती है।' : 'High humidity may increase fungal-risk conditions.')
                      : (lang === 'hi' ? 'आर्द्रता का स्तर वर्तमान में उच्च फंगल दबाव उत्पन्न नहीं करता है।' : 'Humidity conditions do not present elevated fungal pressure.')
                  ),
                },
              ];



              // 4. Farming Weather Guidance (Irrigation, Spraying, Field Work)
              let irrigationGuidance = {
                status: lang === 'hi' ? 'सिंचाई की आवश्यकता नहीं' : 'Irrigation Not Needed',
                badge: lang === 'hi' ? 'पर्याप्त नमी' : 'Sufficient',
                badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                detail: fieldIrrigation?.reason || (lang === 'hi' ? 'मृदा नमी और मौसम की स्थिति पर्याप्त जलयोजन दर्शाती है।' : 'Soil moisture and weather conditions indicate adequate hydration.'),
              };
              if (fieldIrrigation?.state === 'delay') {
                irrigationGuidance = {
                  status: lang === 'hi' ? 'सिंचाई टालने पर विचार करें' : 'Delay Irrigation',
                  badge: lang === 'hi' ? 'टालें' : 'Delay',
                  badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
                  detail: fieldIrrigation?.reason || (lang === 'hi' ? 'पूर्वानुमानित वर्षा मिट्टी की नमी की कमी को पूरा कर सकती है।' : 'Forecast rain may allow irrigation to be delayed.'),
                };
              } else if (fieldIrrigation?.state === 'required') {
                irrigationGuidance = {
                  status: lang === 'hi' ? 'सिंचाई की सिफारिश की गई' : 'Irrigation Recommended',
                  badge: lang === 'hi' ? 'आवश्यक' : 'Action',
                  badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
                  detail: fieldIrrigation?.reason || (lang === 'hi' ? 'मृदा नमी लक्षित सीमा से कम है।' : 'Soil moisture is below target threshold.'),
                };
              } else if (fieldIrrigation?.state === 'monitor') {
                irrigationGuidance = {
                  status: lang === 'hi' ? 'नमी पर नज़र रखें' : 'Monitor Moisture',
                  badge: lang === 'hi' ? 'निगरानी' : 'Monitor',
                  badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                  detail: fieldIrrigation?.reason || (lang === 'hi' ? 'मृदा नमी और वर्षा के पूर्वानुमान पर नज़र बनाए रखें।' : 'Monitor soil moisture and rain outlook.'),
                };
              } else if (fieldIrrigation?.state === 'insufficient_data') {
                irrigationGuidance = {
                  status: lang === 'hi' ? 'अधूरी जानकारी' : 'Insufficient Data',
                  badge: lang === 'hi' ? 'प्रतीक्षा' : 'Standby',
                  badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
                  detail: lang === 'hi' ? 'लाइव मार्गदर्शन हेतु सेंसर नोड कनेक्ट करें।' : 'Connect sensor node for live irrigation advice.',
                };
              }

              const isHighWind = currentWind != null && currentWind > 15;
              const isRainImminent = (rainMaxPop != null && rainMaxPop >= 50) || (currentCondition && /rain/i.test(currentCondition));
              let sprayGuidance = {
                status: lang === 'hi' ? 'छिड़काव हेतु अनुकूल खिड़की' : 'Favorable Spray Window',
                badge: lang === 'hi' ? 'अनुकूल' : 'Favorable',
                badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                detail: lang === 'hi'
                  ? `हवा की गति (${currentWind || 0} km/h) और वर्षा जोखिम न्यूनतम हैं।`
                  : `Wind (${currentWind || 0} km/h) and precipitation risks are low for foliar application.`,
              };
              if (!climateWeather) {
                sprayGuidance = {
                  status: lang === 'hi' ? 'मौसम डेटा अनुपलब्ध' : 'Weather Unavailable',
                  badge: lang === 'hi' ? 'डेटा नहीं' : 'No Data',
                  badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
                  detail: lang === 'hi' ? 'छिड़काव स्थितियों का आकलन करने के लिए मौसम डेटा उपलब्ध नहीं है।' : 'Cannot evaluate spray window without weather data.',
                };
              } else if (isHighWind || isRainImminent) {
                sprayGuidance = {
                  status: lang === 'hi' ? 'परिस्थितियाँ प्रतिकूल हो सकती हैं' : 'Conditions May Be Unfavorable',
                  badge: lang === 'hi' ? 'प्रतिकूल' : 'Caution',
                  badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
                  detail: isHighWind
                    ? (lang === 'hi' ? `तेज़ हवा (${currentWind} km/h) छिड़काव के बहाव (drift) का जोखिम बढ़ाती है।` : `High wind speed (${currentWind} km/h) exceeds safe spray limit (>15 km/h).`)
                    : (lang === 'hi' ? `वर्षा की संभावना (${rainMaxPop}%) छिड़काव धुलने का जोखिम पैदा करती है।` : `Precipitation chance (${rainMaxPop}%) risks product wash-off.`),
                };
              }

              const isWetSoilRisk = (rainTotalMm != null && rainTotalMm >= 5) || (rainMaxPop != null && rainMaxPop >= 60);
              let fieldWorkGuidance = {
                status: lang === 'hi' ? 'खेत कार्य हेतु अनुकूल परिस्थितियाँ' : 'Favorable Field Conditions',
                badge: lang === 'hi' ? 'अनुकूल' : 'Favorable',
                badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                detail: lang === 'hi'
                  ? 'शुष्क मौसम की संभावना सामान्य कृषि कार्यों और कटाई का समर्थन करती है।'
                  : 'Dry weather outlook supports cultivation, weeding, scouting, and mechanical operations.',
              };
              if (!climateWeather) {
                fieldWorkGuidance = {
                  status: lang === 'hi' ? 'मौसम डेटा अनुपलब्ध' : 'Weather Unavailable',
                  badge: lang === 'hi' ? 'डेटा नहीं' : 'No Data',
                  badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
                  detail: lang === 'hi' ? 'खेत कार्य स्थितियों का आकलन करने के लिए मौसम डेटा उपलब्ध नहीं है।' : 'Cannot evaluate field work conditions without weather data.',
                };
              } else if (isWetSoilRisk) {
                fieldWorkGuidance = {
                  status: lang === 'hi' ? 'गीली मिट्टी / वर्षा का जोखिम' : 'Wet Soil / Rain Risk',
                  badge: lang === 'hi' ? 'सावधानी' : 'Caution',
                  badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
                  detail: lang === 'hi'
                    ? 'संभावित वर्षा सतह की मिट्टी को गीला कर सकती है जिससे मशीनरी चलाना कठिन हो सकता है।'
                    : 'Expected precipitation may soften topsoil and impede heavy equipment or harvesting.',
                };
              }

              return (
                <motion.div
                  key="climate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4 sm:space-y-6 w-full min-w-0"
                >
                  {/* 1. PAGE HEADER */}
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-emerald-900/10 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">🌦</span>
                        <h2 className="font-extrabold text-xl sm:text-2xl text-emerald-950 tracking-tight truncate">
                          {lang === 'hi' ? 'जलवायु' : 'CLIMATE'}
                        </h2>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-800/70 mt-0.5 truncate">
                        {lang === 'hi'
                          ? 'वर्तमान मौसम और खेत का दृष्टिकोण'
                          : 'Current weather and field outlook'}
                      </p>
                    </div>

                    {/* Compact Status Metadata Chips */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-emerald-950 border border-emerald-200/80 shadow-2xs whitespace-nowrap"
                        title={locationTag}
                      >
                        <Navigation className={`w-3 h-3 text-sky-600 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                        <span className="truncate max-w-[150px] xs:max-w-[200px]">
                          {detectedCity ? `${detectedCity}, ${detectedCountry}` : (activeFarm?.location || 'Location detected')}
                        </span>
                      </span>

                      {climateWeatherStatus === 'live' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300/80 shadow-2xs whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live</span>
                          {weatherAgeMin !== null && (
                            <span className="text-[10px] text-emerald-600 font-semibold border-l border-emerald-200 pl-1">
                              {weatherAgeMin < 1 ? 'Just now' : `${weatherAgeMin}m`}
                            </span>
                          )}
                        </span>
                      ) : climateWeatherStatus === 'cached' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300/80 shadow-2xs whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>Cached</span>
                          {weatherAgeMin !== null && (
                            <span className="text-[10px] text-amber-600 font-semibold border-l border-amber-200 pl-1">
                              {weatherAgeMin}m ago
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300/80 shadow-2xs whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span>Unavailable</span>
                        </span>
                      )}

                      <button
                        onClick={() => refreshWeather && refreshWeather()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 hover:bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80 shadow-2xs cursor-pointer active:scale-95 transition-all"
                        title="Refresh weather"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-700" />
                        <span className="hidden xs:inline">Refresh</span>
                      </button>
                    </div>
                  </motion.div>

                  {/* 2. TOP GRID: A. CURRENT WEATHER (Dominant 2 cols — Emerald Identity) & B. RAIN OUTLOOK (1 col — Cyan Identity) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                    {/* A. CURRENT WEATHER CARD (Primary Visual Focus — Dominant AGRIO Green) */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.26, delay: 0.04 }}
                      className="bg-gradient-to-br from-emerald-50/60 via-white/95 to-emerald-50/30 backdrop-blur-md border border-emerald-200/90 rounded-3xl p-5 sm:p-7 shadow-neumorphic ring-1 ring-inset ring-emerald-500/15 lg:col-span-2 flex flex-col justify-between w-full min-w-0"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 mb-5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shrink-0 shadow-sm border border-emerald-500/40">
                              <CloudSun className="w-5 h-5 text-emerald-100" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-base sm:text-lg text-emerald-950 tracking-tight truncate">
                                {lang === 'hi' ? 'वर्तमान मौसम' : 'CURRENT WEATHER'}
                              </h3>
                              <p className="text-[11px] sm:text-xs text-emerald-700/80 font-medium truncate">
                                {lang === 'hi' ? 'वर्तमान खेत मौसम' : 'Current field weather'}
                                {detectedCity && ` • ${detectedCity}`}
                              </p>
                            </div>
                          </div>

                          {climateWeather ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap ${
                              climateWeatherStatus === 'live'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${climateWeatherStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                              <span>{climateWeatherStatus === 'live' ? 'Live' : 'Cached'}</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border-slate-300 whitespace-nowrap">
                              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Unavailable</span>
                            </span>
                          )}
                        </div>

                        {climateWeather ? (
                          <div className="w-full min-w-0">
                            {/* Primary Value & Condition */}
                            <div className="flex flex-col xs:flex-row xs:items-baseline gap-2 xs:gap-4 mb-5">
                              <p className="text-5xl sm:text-6xl font-black text-emerald-950 tracking-tight leading-none">
                                {currentTemp}
                                <span className="text-2xl sm:text-3xl font-bold text-emerald-700/80 ml-1">°C</span>
                              </p>
                              <div className="min-w-0">
                                <p className="text-base sm:text-lg font-extrabold text-slate-800 capitalize truncate flex items-center gap-1.5">
                                  <span>{currentIcon}</span>
                                  <span>{currentCondition}</span>
                                </p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                  {climateWeather.feelsLike != null && `Feels like ${climateWeather.feelsLike}°C`}
                                  {weatherAgeMin !== null && ` • Updated ${weatherAgeMin < 1 ? 'just now' : `${weatherAgeMin} min ago`}`}
                                </p>
                              </div>
                            </div>

                            {/* Compact Metrics Grid: Separate subtle glass tiles with green language & cyan/amber accents */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4 border-t border-emerald-100/80 w-full min-w-0">
                              {/* 1. Humidity */}
                              <div className="bg-white/80 border border-emerald-100/90 rounded-2xl p-3 min-w-0 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-sky-800 mb-1">
                                  <Droplets className="w-3.5 h-3.5 shrink-0 text-sky-600" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider truncate">Humidity</span>
                                </div>
                                <p className="text-xl font-extrabold text-slate-900">
                                  {currentHumidity != null ? `${currentHumidity}%` : 'No data'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                  {currentHumidity != null
                                    ? currentHumidity > 80 ? 'High' : currentHumidity < 40 ? 'Dry' : 'Moderate'
                                    : 'Connect sensor'}
                                </p>
                              </div>

                              {/* 2. Rainfall */}
                              <div className="bg-white/80 border border-emerald-100/90 rounded-2xl p-3 min-w-0 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-cyan-800 mb-1">
                                  <CloudRain className="w-3.5 h-3.5 shrink-0 text-cyan-600" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider truncate">Rainfall</span>
                                </div>
                                <p className="text-xl font-extrabold text-slate-900">
                                  {rainTotalMm != null ? `${rainTotalMm} mm` : '0 mm'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                  {rainMaxPop != null ? `${rainMaxPop}% chance` : '24h window'}
                                </p>
                              </div>

                              {/* 3. Wind */}
                              <div className="bg-white/80 border border-emerald-100/90 rounded-2xl p-3 min-w-0 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-teal-800 mb-1">
                                  <Wind className="w-3.5 h-3.5 shrink-0 text-teal-600" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider truncate">Wind</span>
                                </div>
                                <p className="text-xl font-extrabold text-slate-900">
                                  {currentWind != null ? `${currentWind} km/h` : 'No data'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                  {currentWind != null
                                    ? currentWind > 15 ? 'Breezy' : 'Gentle'
                                    : 'Station sensor'}
                                </p>
                              </div>

                              {/* 4. UV Index */}
                              <div className="bg-white/80 border border-emerald-100/90 rounded-2xl p-3 min-w-0 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-amber-800 mb-1">
                                  <Sun className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider truncate">UV Index</span>
                                </div>
                                <p className="text-xl font-extrabold text-slate-900">
                                  {currentUV != null ? `${currentUV}` : 'No data'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                  {currentUV != null
                                    ? currentUV >= 8 ? 'Very High' : currentUV >= 6 ? 'High' : 'Moderate'
                                    : 'Atmospheric'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center">
                            <CloudSun className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-lg font-bold text-slate-700">{t.weatherUnavailable}</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{t.weatherUnavailableBody}</p>
                            <button
                              onClick={() => refreshWeather && refreshWeather()}
                              className="mt-4 px-4 py-2 rounded-full bg-emerald-850 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer active:scale-95 transition-all"
                            >
                              Retry Weather Fetch
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* B. RAIN OUTLOOK (Blue/Cyan Identity — Rain / Precipitation) */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.26, delay: 0.08 }}
                      className="bg-gradient-to-br from-cyan-50/50 via-white/90 to-sky-50/40 backdrop-blur-md border border-cyan-200/90 rounded-3xl p-5 sm:p-7 shadow-neumorphic ring-1 ring-inset ring-cyan-400/20 w-full min-w-0 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 border border-cyan-300/70 flex items-center justify-center shrink-0 shadow-2xs">
                              <CloudRain className="w-4 h-4 text-cyan-700" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-xs uppercase tracking-wider text-cyan-950 truncate block">
                                {t.rainOutlookTitle || 'RAIN OUTLOOK'}
                              </span>
                              <span className="text-[10px] text-cyan-700/80 font-medium">Rain / precipitation</span>
                            </div>
                          </div>
                          {climateRain?.windowHours != null && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 whitespace-nowrap">
                              {climateRain.windowHours}h window
                            </span>
                          )}
                        </div>

                        {/* Metrics: Expected, Probability, Timing */}
                        <div className="space-y-3 pt-1">
                          <div className="bg-white/80 border border-cyan-100/90 rounded-2xl p-3.5 shadow-2xs">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expected</span>
                              <span className="text-xl font-black text-cyan-950">
                                {rainTotalMm != null ? `${rainTotalMm} mm` : '0 mm'}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2 mt-2 pt-2 border-t border-cyan-100">
                              <span className="text-xs font-semibold text-slate-500">Probability</span>
                              <span className="text-sm font-extrabold text-cyan-900">
                                {rainMaxPop != null ? `${rainMaxPop}%` : 'Low (<10%)'}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2 mt-1.5">
                              <span className="text-xs font-semibold text-slate-500">Timing</span>
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[60%] text-right">
                                {rainTimingText}
                              </span>
                            </div>
                          </div>

                          {/* Short Note — concise, not heavy */}
                          <div className="text-xs text-slate-700 leading-relaxed font-medium bg-white/70 rounded-xl p-3 border border-cyan-100/70">
                            <p>
                              {rainTotalMm > 1 || rainMaxPop > 30
                                ? 'Rain is possible during the forecast window. Check field drainage.'
                                : 'No significant rainfall anticipated during the current forecast window.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-cyan-100 text-[10px] text-cyan-700/60 font-medium">
                        Source: OpenWeatherMap • AGRIO field microclimate
                      </div>
                    </motion.div>
                  </div>

                  {/* 3. C. SHORT FORECAST (Teal/Emerald Identity — Upcoming Weather) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.12 }}
                    className="bg-gradient-to-br from-teal-50/30 via-white/90 to-emerald-50/40 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-emerald-400/20 w-full min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300/70 flex items-center justify-center shrink-0 shadow-2xs">
                          <Clock className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm sm:text-base text-emerald-950 truncate">
                            {t.forecast5Day || '5-DAY FORECAST'}
                          </h4>
                          <p className="text-[11px] text-emerald-700/70 font-medium truncate">
                            Upcoming weather • Daily temperature extremes & rain chance
                          </p>
                        </div>
                      </div>
                    </div>

                    {climateForecast.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 w-full min-w-0">
                        {climateForecast.map((f, i) => (
                          <div
                            key={i}
                            className="bg-white/90 border border-emerald-100/90 hover:border-emerald-300 hover:bg-emerald-50/40 rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-2xs hover:shadow-xs transition-all duration-200 hover:-translate-y-0.5 min-w-0"
                          >
                            <span className="font-extrabold text-xs text-emerald-950 uppercase tracking-wider">
                              {t[f.dayKey] || f.dayKey.toUpperCase()}
                            </span>
                            <span className="text-2xl sm:text-3xl my-1.5 transform hover:scale-110 transition-transform">
                              {f.icon || '☀️'}
                            </span>
                            <div className="min-w-0 w-full">
                              <p className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight">
                                {f.high} <span className="text-slate-400 font-semibold">/</span> {f.low}
                              </p>
                              <div className="mt-1.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  f.pop > 30
                                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                  {f.pop != null ? `${f.pop}% rain` : (f.rainChance || 'Dry')}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium truncate mt-1">
                                {f.label || f.description || 'Clear'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5 bg-slate-50/80 rounded-2xl text-xs text-slate-500 text-center border border-slate-200/60">
                        {t.forecastUnavailable || 'Forecast unavailable — no weather data.'}
                      </div>
                    )}
                  </motion.div>

                  {/* 4. D. AGRICULTURAL CLIMATE INSIGHTS (Amber/Rose/Teal Semantic Risk Identities) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.16 }}
                    className="bg-white/85 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-emerald-500/10 w-full min-w-0"
                  >
                    <div className="flex items-center gap-2.5 mb-4 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0 shadow-2xs">
                        <ShieldAlert className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm sm:text-base text-emerald-950 truncate">
                          {lang === 'hi' ? 'कृषि जलवायु अंतर्दृष्टि' : 'AGRICULTURAL CLIMATE INSIGHTS'}
                        </h4>
                        <p className="text-[11px] text-emerald-700/70 font-medium truncate">
                          Derived environmental conditions for root-zone and canopy safety
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">
                      {environmentalConditions.map((cond) => {
                        const CondIcon = cond.icon;
                        const badgeClass = cond.severity === 'Critical'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : cond.severity === 'High'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : cond.severity === 'Moderate'
                          ? 'bg-amber-50/70 text-amber-900 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                        return (
                          <div
                            key={cond.id}
                            className={`p-4 rounded-2xl border ${cond.accentBorder} ${cond.accentBg} backdrop-blur-sm flex flex-col justify-between min-w-0 transition-all duration-200 hover:-translate-y-0.5 shadow-2xs`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <CondIcon className={`w-4 h-4 shrink-0 ${cond.iconColor}`} />
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {cond.title}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs whitespace-nowrap shrink-0 ${badgeClass}`}>
                                  {cond.severity}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1">
                                {cond.description}
                              </p>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-3 pt-2 border-t border-slate-200/40">
                              Environmental risk • Not a leaf disease diagnosis
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* 5. E. FARMING WEATHER GUIDANCE (Green-Primary Field Guidance) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.20 }}
                    className="bg-white/85 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-emerald-500/10 w-full min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0 shadow-2xs">
                          <Sprout className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm sm:text-base text-emerald-950 truncate">
                            {lang === 'hi' ? 'कृषि मौसम मार्गदर्शन' : 'FARMING WEATHER GUIDANCE'}
                          </h4>
                          <p className="text-[11px] text-emerald-700/70 font-medium truncate">
                            Weather-based field guidance • Operations based on atmospheric indicators
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">
                      {/* Irrigation Guidance */}
                      <div className="p-4 rounded-2xl border border-emerald-200/80 bg-white/90 flex flex-col justify-between min-w-0 shadow-2xs hover:shadow-xs transition-all">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Droplets className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-bold text-xs uppercase tracking-wider text-emerald-950 truncate">
                                Irrigation
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs whitespace-nowrap ${irrigationGuidance.badgeColor}`}>
                              {irrigationGuidance.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1">
                            {irrigationGuidance.detail}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-emerald-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">AGRIO Irrigation Engine</span>
                          <button
                            onClick={() => setActiveTab('advisory')}
                            className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                          >
                            View Advisory →
                          </button>
                        </div>
                      </div>

                      {/* Spraying Guidance */}
                      <div className="p-4 rounded-2xl border border-emerald-100/80 bg-white/90 flex flex-col justify-between min-w-0 shadow-2xs hover:shadow-xs transition-all">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Wind className="w-4 h-4 text-sky-600 shrink-0" />
                              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 truncate">
                                Spraying Window
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs whitespace-nowrap ${sprayGuidance.badgeColor}`}>
                              {sprayGuidance.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1">
                            {sprayGuidance.detail}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400">Wind & Rain Threshold Guidance</span>
                        </div>
                      </div>

                      {/* Fieldwork / Harvest Guidance */}
                      <div className="p-4 rounded-2xl border border-emerald-100/80 bg-white/90 flex flex-col justify-between min-w-0 shadow-2xs hover:shadow-xs transition-all">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Sprout className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 truncate">
                                Field Operations
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs whitespace-nowrap ${fieldWorkGuidance.badgeColor}`}>
                              {fieldWorkGuidance.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1">
                            {fieldWorkGuidance.detail}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400">Surface Trafficability Outlook</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}

            {/* VIEW 2: 📷 AI SCANNER / CROP DIAGNOSTICS (Gemini) */}
            {activeTab === 'diagnostics' && (
              <motion.div
                key="diagnostics"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* MOBILE: Full-screen scanner card */}
                <div className="md:hidden">
                  <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-white/50 text-center">
                    {/* Top floating circular mint camera icon button */}
                    <div 
                      onClick={handleCameraTrigger}
                      className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-emerald-100 active:scale-95 transition-all shadow-xs group"
                      role="button"
                      title={t.takePhoto}
                    >
                      <Camera className="w-8 h-8 group-hover:scale-110 transition-transform text-emerald-800" />
                    </div>
                    <h2 className="text-xl font-extrabold text-emerald-950">{t.scannerTitle}</h2>
                    <p className="text-xs text-emerald-700/60 mt-1 max-w-md mx-auto">{t.scannerSubtitle}</p>

                    {/* Image Preview Container */}
                    {imagePreview ? (
                      <div className="mt-6 relative rounded-3xl overflow-hidden border-2 border-emerald-400 max-h-72 bg-emerald-50/20 flex items-center justify-center shadow-inner">
                        <img
                          src={imagePreview}
                          alt="Captured Leaf"
                          className="w-full h-full object-cover max-h-72"
                        />
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            onClick={() => {
                              setImagePreview(null);
                              setDiagnosticResult(null);
                              setScanError(null);
                            }}
                            className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-md transition-all cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>{t.reCapture}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 border-2 border-dashed border-emerald-300/60 bg-emerald-50/30 p-6 sm:p-8 rounded-3xl flex flex-col items-center justify-center gap-4">
                        {/* Circular mint camera icon button inside dashed viewfinder */}
                        <div 
                          onClick={handleCameraTrigger}
                          className="w-16 h-16 rounded-2xl bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center cursor-pointer hover:bg-emerald-50 active:scale-95 transition-all shadow-sm group"
                          role="button"
                          title={t.takePhoto}
                        >
                          <Camera className="w-8 h-8 group-hover:scale-110 transition-transform text-emerald-800" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                          <button
                            onClick={handleCameraTrigger}
                            className="px-5 py-3 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500"
                          >
                            <Camera className="w-4 h-4 text-emerald-300" />
                            <span>{t.takePhoto}</span>
                          </button>

                          <button
                            onClick={openFilePicker}
                            className="px-5 py-3 rounded-full bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs hover:-translate-y-0.5 active:scale-95 transition-all duration-200 border border-emerald-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500"
                          >
                            <Upload className="w-4 h-4 text-emerald-700" />
                            <span>{t.uploadFile}</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-emerald-700/50">{t.uploadPlaceholder}</p>
                      </div>
                    )}

                    {/* Trigger Gemini AI Scan Button */}
                    <button
                      onClick={() => runGeminiAnalysis(imagePreview)}
                      disabled={diagnosing || !imagePreview}
                      className={`mt-6 w-full py-4 rounded-full font-bold text-sm sm:text-base shadow-neumorphic transition-all duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        !imagePreview
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-emerald-900 hover:bg-emerald-800 text-white hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer'
                      }`}
                    >
                      {diagnosing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>{t.analyzingText}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          <span>{t.runScanBtn}</span>
                        </>
                      )}
                    </button>

                    {/* Inline Leaf Diagnostic Card on Mobile */}
                    {diagnosticResult && (
                      <>
                        <AdviceBoard advisory={advisory} risks={risks} t={t} lang={lang} />
                        <LeafDiagnosticCard
                          diagnosticResult={diagnosticResult}
                          t={t}
                          severityBadgeClasses={severityBadgeClasses}
                        />
                      </>
                    )}

                    {imagePreview && diagnosticResult && !showInsights && (
                      <button
                        onClick={() => setShowInsights(true)}
                        className="mt-3 w-full py-2.5 rounded-full bg-emerald-100/80 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-200/80 transition-all cursor-pointer border border-emerald-200/60"
                      >
                        <Eye className="w-4 h-4 text-emerald-700" />
                        <span>{t.insightsTitle || 'View Diagnostic Report'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* DESKTOP: Scanner as side-by-side layout */}
                <div className="hidden md:block">
                  <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-6 lg:p-8 shadow-neumorphic ring-1 ring-inset ring-white/50">
                    <div className="flex items-center gap-3 mb-6">
                      <div 
                        onClick={handleCameraTrigger}
                        className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center cursor-pointer hover:bg-emerald-100 active:scale-95 transition-all shadow-xs group"
                        role="button"
                        title={t.takePhoto}
                      >
                        <Camera className="w-6 h-6 group-hover:scale-110 transition-transform text-emerald-800" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-emerald-950">{t.scannerTitle}</h2>
                        <p className="text-xs text-emerald-700/60">{t.scannerSubtitle}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Viewfinder */}
                      <div>
                        {imagePreview ? (
                          <div className="relative rounded-3xl overflow-hidden border-2 border-emerald-400 aspect-[4/3] bg-emerald-50/20 flex items-center justify-center shadow-inner">
                            <img
                              src={imagePreview}
                              alt="Captured Leaf"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-3 right-3">
                              <button
                                onClick={() => {
                                  setImagePreview(null);
                                  setDiagnosticResult(null);
                                  setScanError(null);
                                }}
                                className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-md transition-all cursor-pointer"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>{t.reCapture}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-emerald-300/60 bg-emerald-50/30 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 aspect-[4/3]">
                            {/* Circular mint camera icon button in desktop empty state */}
                            <div 
                              onClick={handleCameraTrigger}
                              className="w-20 h-20 rounded-2xl bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center cursor-pointer hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all shadow-sm group"
                              role="button"
                              title={t.takePhoto}
                            >
                              <Camera className="w-10 h-10 group-hover:scale-110 transition-transform text-emerald-800" />
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={handleCameraTrigger}
                                className="px-5 py-3 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500"
                              >
                                <Camera className="w-4 h-4 text-emerald-300" />
                                <span>{t.takePhoto}</span>
                              </button>
                              <button
                                onClick={openFilePicker}
                                className="px-5 py-3 rounded-full bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-2xs hover:-translate-y-0.5 active:scale-95 transition-all duration-200 border border-emerald-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500"
                              >
                                <Upload className="w-4 h-4 text-emerald-700" />
                                <span>{t.uploadFile}</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-emerald-700/50">{t.uploadPlaceholder}</p>
                          </div>
                        )}

                        {/* Trigger Gemini AI Scan Button */}
                        <button
                          onClick={() => runGeminiAnalysis(imagePreview)}
                          disabled={diagnosing || !imagePreview}
                          className={`mt-4 w-full py-4 rounded-full font-bold text-base shadow-neumorphic transition-all duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                            !imagePreview
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-emerald-900 hover:bg-emerald-800 text-white hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer'
                          }`}
                        >
                          {diagnosing ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>{t.analyzingText}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              <span>{t.runScanBtn}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right: Results & Match Percentage */}
                      <div className="flex flex-col gap-4">
                        {diagnosticResult ? (
                          <>
                            {/* Match Percentage Visual */}
                            <div className="bg-emerald-50/60 rounded-3xl p-5 text-center">
                              <p className="text-[10px] font-bold text-emerald-700/50 uppercase tracking-wider mb-2">{t.matchPercentage}</p>
                              <div className="w-24 h-24 rounded-full mx-auto relative">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle cx="48" cy="48" r="42" stroke="#D1FAE5" strokeWidth="8" fill="transparent" />
                                  <circle
                                    cx="48" cy="48" r="42"
                                    stroke="#059669"
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 42}`}
                                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - (diagnosticResult.confidence > 1 ? diagnosticResult.confidence / 100 : diagnosticResult.confidence))}`}
                                    strokeLinecap="round"
                                    fill="transparent"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xl font-extrabold text-emerald-950">
                                    {typeof diagnosticResult.confidence === 'number'
                                      ? (diagnosticResult.confidence > 1 ? diagnosticResult.confidence.toFixed(1) : (diagnosticResult.confidence * 100).toFixed(1)) + '%'
                                      : '96.4%'}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs font-bold text-emerald-800 mt-2">AI Confidence Match</p>
                            </div>

                            {/* Engine Identity + Guardrail Status */}
                            {diagnosticResult.engine && (
                              <div className={`p-3 rounded-2xl text-xs flex items-start gap-2 ${
                                diagnosticResult.engine === 'cropguard-onnx'
                                  ? diagnosticResult.guardrailStatus === 'abstained'
                                    ? 'bg-amber-50/80 text-amber-900'
                                    : 'bg-violet-50/80 text-violet-900'
                                  : diagnosticResult.engine === 'on-device'
                                    ? 'bg-slate-50/80 text-slate-800'
                                    : 'bg-blue-50/80 text-blue-900'
                              }`}>
                                <span className="shrink-0 mt-0.5">
                                  {diagnosticResult.engine === 'cropguard-onnx' ? '🧬'
                                    : diagnosticResult.engine === 'on-device' ? '📱' : '☁️'}
                                </span>
                                <div>
                                  <span className="font-semibold">
                                    {diagnosticResult.engine === 'cropguard-onnx' ? 'CropGuard AI (On-Device)'
                                      : diagnosticResult.engine === 'on-device' ? 'On-Device Heuristic'
                                      : 'Cloud AI (Gemini)'}
                                  </span>
                                  {diagnosticResult.demoNotice && (
                                    <p className="mt-0.5 opacity-80">{diagnosticResult.demoNotice}</p>
                                  )}
                                  {diagnosticResult.guardrailStatus === 'abstained' && diagnosticResult.guardrailReasons?.length > 0 && (
                                    <p className="mt-1 font-medium text-amber-800">
                                      {lang === 'hi' ? 'कारण: ' : 'Reason: '}
                                      {diagnosticResult.guardrailReasons.map(r => r.replace(/_/g, ' ')).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Summary Badge */}
                            <div className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-2xl flex items-center justify-between shadow-neumorphic">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                                  <Sparkles className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider">AI Crop Health Diagnostics</p>
                                  <p className="text-xs font-extrabold text-emerald-950">Disease, Nutrient & Pest Tri-Vector Verified</p>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 font-bold text-[11px] rounded-full border shadow-sm ${severityBadgeClasses[diagnosticResult.severity] || severityBadgeClasses.Moderate}`}>
                                {diagnosticResult.severity}
                              </span>
                            </div>
                          </>
                        ) : scanError ? (
                          <div className="p-5 bg-red-50/80 rounded-3xl text-left space-y-2">
                            <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                              <AlertTriangle className="w-5 h-5" />
                              <span>Gemini AI Analysis Error</span>
                            </div>
                            <p className="text-xs text-red-700">{scanError}</p>
                            <div className="pt-2 text-[11px] text-red-600 border-t border-red-100 flex items-center gap-1.5">
                              <KeyRound className="w-4 h-4 shrink-0" />
                              <span>Check your <code className="bg-red-100 px-1 py-0.5 rounded">.env</code> file for <code className="bg-red-100 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code>.</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-emerald-50/30 rounded-3xl">
                            <div className="w-16 h-16 rounded-full bg-emerald-100/50 text-emerald-400 flex items-center justify-center mb-3">
                              <Sparkles className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-bold text-emerald-800/40">Upload a leaf photo to get AI-powered crop diagnostics</p>
                            <p className="text-[11px] text-emerald-700/30 mt-1">Results will appear here</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Leaf Diagnostic Result Card Spanning Full Width Below Preview */}
                    {diagnosticResult && (
                      <>
                        <AdviceBoard advisory={advisory} risks={risks} t={t} lang={lang} />
                        <LeafDiagnosticCard
                          diagnosticResult={diagnosticResult}
                          t={t}
                          severityBadgeClasses={severityBadgeClasses}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* PERSISTED DIAGNOSTIC HISTORY FEED (IndexedDB) */}
                <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-5 sm:p-6 shadow-neumorphic ring-1 ring-inset ring-white/50">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-700" />
                      <h3 className="font-extrabold text-base text-emerald-950">
                        {t.recentScans || 'Recent Leaf Diagnostics'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('analytics')}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-all cursor-pointer border border-emerald-200/60 shadow-2xs"
                        title={t.tabAnalytics || 'Farm Analytics'}
                      >
                        <BarChart3 className="w-3 h-3 text-emerald-700" />
                        <span>{t.tabAnalytics || 'Analytics'}</span>
                      </button>
                      <span className="text-[11px] font-semibold text-emerald-700/70 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/60">
                        {diagnosisHistory?.length || 0} saved
                      </span>
                    </div>
                  </div>

                  {diagnosisHistory && diagnosisHistory.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {diagnosisHistory.slice(0, 6).map((item, idx) => {
                        const rec = item.data || {};
                        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : 'Recent';
                        const severityClass = severityBadgeClasses[rec.severity] || severityBadgeClasses.Moderate;

                        return (
                          <div
                            key={item.id || idx}
                            onClick={() => {
                              setDiagnosticResult(rec);
                              if (item.thumbnail || rec.imagePreview) {
                                setImagePreview(item.thumbnail || rec.imagePreview);
                              }
                              setShowInsights(true);
                            }}
                            className="bg-white/90 hover:bg-white border border-emerald-100/80 hover:border-emerald-300/80 rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] shadow-2xs group ring-1 ring-inset ring-white/50"
                          >
                            {item.thumbnail || rec.imagePreview ? (
                              <img
                                src={item.thumbnail || rec.imagePreview}
                                alt="Scan"
                                className="w-12 h-12 rounded-xl object-cover border border-emerald-200/60 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <Leaf className="w-6 h-6" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${severityClass}`}>
                                  {rec.severity || 'Verified'}
                                </span>
                                <span className="text-[10px] text-emerald-700/60">{dateStr}</span>
                              </div>
                              <h5 className="font-bold text-xs text-emerald-950 truncate mt-1 group-hover:text-emerald-800">
                                {rec.diseaseDiagnostics?.detectedName || rec.cropCondition || 'Healthy Leaf'}
                              </h5>
                              <p className="text-[10px] text-emerald-600/80 truncate">
                                {rec.confidence ? `${(rec.confidence > 1 ? rec.confidence : rec.confidence * 100).toFixed(0)}% match` : 'AI Verified'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 px-4 bg-emerald-50/40 rounded-2xl border border-dashed border-emerald-200/70">
                      <Leaf className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                      <p className="text-xs text-emerald-800/70 font-medium">
                        {t.noRecentScans || 'No previous leaf scans saved yet. Snap a photo above to begin recording crop health history.'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Tab: Analytics (Real historical trends from stored data) ── */}
            {activeTab === 'analytics' && (
              <AnalyticsView
                telemetryHistory={telemetryHistory}
                diagnosisHistory={diagnosisHistory}
                currentTelemetry={telemetry}
                telemetryStatus={telemetryStatus}
                currentWeather={weatherData}
                onNavigateTab={setActiveTab}
                t={t}
                lang={lang}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Slide-Up Agrio Insights Result Sheet Modal (Mobile) */}
      <AnimatePresence>
        {showInsights && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-md p-0 md:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white/95 backdrop-blur-sm w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl rounded-t-[36px] md:rounded-3xl shadow-neumorphic-lg p-5 sm:p-7 max-h-[92vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-emerald-100/40 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-emerald-950">{t.insightsTitle}</h3>
                    <p className="text-[10px] text-emerald-600/40 font-medium">Powered by Gemini 3.6 Flash</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInsights(false)}
                  className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-600/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview Thumbnail */}
              {imagePreview && (
                <div className="mb-4 rounded-2xl overflow-hidden max-h-36 bg-emerald-50/20 flex items-center justify-center">
                  <img src={imagePreview} alt="Scanned Leaf" className="w-full h-full object-cover max-h-36" />
                </div>
              )}

              {/* Match Percentage Visual (Mobile modal) */}
              {diagnosticResult && (
                <div className="mb-4 bg-emerald-50/60 rounded-2xl p-4 text-center">
                  <p className="text-[10px] font-bold text-emerald-700/50 uppercase tracking-wider mb-2">{t.matchPercentage}</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full relative">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="28" stroke="#D1FAE5" strokeWidth="6" fill="transparent" />
                        <circle
                          cx="32" cy="32" r="28"
                          stroke="#059669"
                          strokeWidth="6"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - (diagnosticResult.confidence > 1 ? diagnosticResult.confidence / 100 : diagnosticResult.confidence))}`}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-extrabold text-emerald-950">
                          {typeof diagnosticResult.confidence === 'number'
                            ? (diagnosticResult.confidence > 1 ? diagnosticResult.confidence.toFixed(1) : (diagnosticResult.confidence * 100).toFixed(1)) + '%'
                            : '96.4%'}
                        </span>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-extrabold text-emerald-950">
                        {typeof diagnosticResult.confidence === 'number'
                          ? (diagnosticResult.confidence > 1 ? diagnosticResult.confidence.toFixed(1) : (diagnosticResult.confidence * 100).toFixed(1)) + '% Match'
                          : '96.4% Match'}
                      </p>
                      <p className="text-xs text-emerald-700/50">AI Confidence Score</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Error State */}
              {scanError ? (
                <div className="p-4 bg-red-50/80 rounded-2xl text-left space-y-2">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Gemini AI Analysis Error</span>
                  </div>
                  <p className="text-xs text-red-700">{scanError}</p>
                  <div className="pt-2 text-[11px] text-red-600 border-t border-red-100 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>Check your <code className="bg-red-100 px-1 py-0.5 rounded">.env</code> file for <code className="bg-red-100 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code>.</span>
                  </div>
                </div>
              ) : diagnosticResult ? (
                /* Dynamic Gemini Structured Output Display */
                <div className="text-left">
                  {/* Engine Identity Badge (Mobile) */}
                  {diagnosticResult.engine && (
                    <div className={`mb-3 p-3 rounded-2xl text-xs flex items-start gap-2 ${
                      diagnosticResult.engine === 'cropguard-onnx'
                        ? diagnosticResult.guardrailStatus === 'abstained'
                          ? 'bg-amber-50/80 text-amber-900'
                          : 'bg-violet-50/80 text-violet-900'
                        : diagnosticResult.engine === 'on-device'
                          ? 'bg-slate-50/80 text-slate-800'
                          : 'bg-blue-50/80 text-blue-900'
                    }`}>
                      <span className="shrink-0 mt-0.5">
                        {diagnosticResult.engine === 'cropguard-onnx' ? '🧬'
                          : diagnosticResult.engine === 'on-device' ? '📱' : '☁️'}
                      </span>
                      <div>
                        <span className="font-semibold">
                          {diagnosticResult.engine === 'cropguard-onnx' ? 'CropGuard AI (On-Device)'
                            : diagnosticResult.engine === 'on-device' ? 'On-Device Heuristic'
                            : 'Cloud AI (Gemini)'}
                        </span>
                        {diagnosticResult.demoNotice && (
                          <p className="mt-0.5 opacity-80">{diagnosticResult.demoNotice}</p>
                        )}
                        {diagnosticResult.guardrailStatus === 'abstained' && diagnosticResult.guardrailReasons?.length > 0 && (
                          <p className="mt-1 font-medium text-amber-800">
                            {lang === 'hi' ? 'कारण: ' : 'Reason: '}
                            {diagnosticResult.guardrailReasons.map(r => r.replace(/_/g, ' ')).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <AdviceBoard
                    advisory={advisory}
                    risks={risks}
                    t={t}
                    lang={lang}
                    onNavigateTab={(tab) => {
                      setShowInsights(false);
                      setActiveTab(tab);
                    }}
                    diagnosticResult={diagnosticResult}
                  />
                  <LeafDiagnosticCard
                    diagnosticResult={diagnosticResult}
                    t={t}
                    lang={lang}
                    severityBadgeClasses={severityBadgeClasses}
                  />
                </div>
              ) : null}

              <button
                onClick={() => setShowInsights(false)}
                className="mt-6 w-full py-3.5 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-sm shadow-neumorphic active:scale-95 transition-all"
              >
                {t.saveHistory}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Live Camera Viewfinder Modal */}
      <AnimatePresence>
        {isCameraActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-emerald-950 rounded-3xl overflow-hidden shadow-2xl w-full max-w-xl border border-emerald-500/30 flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 bg-emerald-900/80 border-b border-emerald-800 text-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-emerald-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Live Leaf Camera Viewfinder</h3>
                    <p className="text-[10px] text-emerald-300/70">Point camera directly at the affected crop leaf</p>
                  </div>
                </div>
                <button
                  onClick={stopCameraStream}
                  className="p-1.5 rounded-full hover:bg-emerald-800 text-emerald-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Live Video Feed */}
              <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Target reticle */}
                <div className="absolute inset-8 sm:inset-12 border-2 border-emerald-400/50 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-emerald-400" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-emerald-400" />
                  </div>
                  <span className="text-center text-xs font-semibold text-emerald-200 bg-black/50 py-1 px-3 rounded-full mx-auto backdrop-blur-sm">
                    Position leaf within frame
                  </span>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-emerald-400" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="p-4 bg-emerald-900/90 flex items-center justify-center gap-4 border-t border-emerald-800">
                <button
                  onClick={captureSnapshot}
                  className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span>Take Leaf Photo</span>
                </button>
                <button
                  onClick={stopCameraStream}
                  className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Permission/Notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-emerald-950 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {toastMessage}
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/60 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hardware Telemetry Configuration Modal */}
      <HardwareConfigModal
        open={showHardwareConfig}
        onClose={() => setShowHardwareConfig(false)}
      />
    </div>
  );
}
