import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, CloudSun, BarChart3, ScanLine, AlertTriangle, CheckCircle, Power, 
  Wind, Thermometer, CloudRain, Sun, Upload, Camera, Sparkles, X, RefreshCw, Eye, KeyRound,
  Sprout, Home, Leaf, Cloud, Sliders, Database, Bug, ShieldAlert, FlaskConical, Clock, Activity
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import StatCard from '../components/StatCard';
import SoilMoistureRing from '../components/SoilMoistureRing';
import WaterTankGauge from '../components/WaterTankGauge';
import { analyzeLeafImage } from '../services/geminiService';

/**
 * Leaf Diagnostic Result Component rendering 3 distinct agricultural health vectors:
 * 1. Disease Diagnostics Badge (name, severity, treatment plan)
 * 2. Nutrient Deficiency Badge & Tag (status, symptoms, 1-sentence fertilizer advice)
 * 3. Pest Infestation & Pressure Badge (risk badge, pattern, targeted action)
 * 4. Actionable Farmer Advisory Protocol (Spray status, Fertilizer, Next inspection)
 */
function LeafDiagnosticCard({ diagnosticResult, t, severityBadgeClasses }) {
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

  return (
    <div className="space-y-4 w-full text-left mt-5">
      {/* 3 Dedicated Visual Blocks (Single-column on mobile, 3 columns on tablet/desktop) */}
      <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3">
        {/* 1. Disease Diagnostics Badge */}
        <div className="bg-amber-50/70 border border-amber-200/70 rounded-3xl p-4 sm:p-5 shadow-neumorphic flex flex-col justify-between transition-all hover:shadow-neumorphic-lg">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold text-amber-900/60 uppercase tracking-wider flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-amber-700" />
                {t.diseaseDiagTitle || 'Disease Diagnostics'}
              </span>
              <span className={`px-2.5 py-0.5 font-bold text-[11px] rounded-full border shadow-sm ${severityBadgeClasses[diagnosticResult.severity] || severityBadgeClasses.Moderate}`}>
                {diagnosticResult.severity}
              </span>
            </div>

            <h4 className="font-extrabold text-base text-amber-950 mb-1.5 leading-snug">
              {diagnosticResult.disease}
            </h4>

            {diagnosticResult.description ? (
              <p className="text-xs text-amber-900/80 mb-3 leading-relaxed">
                {diagnosticResult.description}
              </p>
            ) : null}
          </div>

          <div className="border-t border-amber-200/60 pt-3 mt-2">
            <p className="font-bold text-[11px] text-amber-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>{t.treatmentTitle || 'Recommended Action Plan:'}</span>
            </p>
            <ul className="space-y-1.5 text-xs text-amber-950 font-medium">
              {diagnosticResult.treatment_steps && diagnosticResult.treatment_steps.length > 0 ? (
                diagnosticResult.treatment_steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 leading-snug">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))
              ) : (
                <li className="text-amber-800/60 italic text-[11px]">No specific treatment steps required.</li>
              )}
            </ul>
          </div>
        </div>

        {/* 2. Nutrient Deficiency Badge & Tag */}
        <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-3xl p-4 sm:p-5 shadow-neumorphic flex flex-col justify-between transition-all hover:shadow-neumorphic-lg">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold text-emerald-900/60 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-emerald-700" />
                {t.nutrientDeficiencyTitle || 'Nutrient Deficiency'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm ${
                isNutrientOptimal 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {isNutrientOptimal ? 'Optimal' : 'Deficiency'}
              </span>
            </div>

            <h4 className="font-extrabold text-base text-emerald-950 mb-1.5 leading-snug">
              {diagnosticResult.nutrientDeficiency?.status || (isNutrientOptimal ? 'Nutrient Levels: Optimal' : 'Nutrient Deficiency Detected')}
            </h4>

            <p className="text-xs text-emerald-900/80 mb-3 leading-relaxed">
              {diagnosticResult.nutrientDeficiency?.symptoms || 'No visible deficiency symptoms observed across foliage.'}
            </p>
          </div>

          <div className="border-t border-emerald-200/60 pt-3 mt-2 bg-emerald-100/50 -mx-2 -mb-2 p-3 rounded-2xl">
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t.fertilizerRecLabel || 'Targeted Fertilizer Advice:'}</span>
            </p>
            <p className="text-xs font-semibold text-emerald-950 leading-snug">
              {diagnosticResult.nutrientDeficiency?.recommendation || 'Apply foliar urea spray (1.5%) during early morning.'}
            </p>
          </div>
        </div>

        {/* 3. Pest Infestation & Pressure Badge */}
        <div className="bg-slate-50/80 border border-slate-200/70 rounded-3xl p-4 sm:p-5 shadow-neumorphic flex flex-col justify-between transition-all hover:shadow-neumorphic-lg">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold text-slate-700/70 uppercase tracking-wider flex items-center gap-1.5">
                <Bug className="w-3.5 h-3.5 text-slate-700" />
                {t.pestPressureTitle || 'Pest Pressure'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm ${pestBadgeStyle}`}>
                {pestSeverity} Risk
              </span>
            </div>

            <h4 className="font-extrabold text-base text-slate-900 mb-1.5 leading-snug">
              {diagnosticResult.pestPressure?.status || 'None Detected'}
            </h4>

            <p className="text-xs text-slate-700/80 mb-3 leading-relaxed">
              {pestSeverity === 'Low' || pestSeverity === 'None' || pestSeverity === 'None Detected'
                ? 'No active colonies or critical foliar bite damage detected in scan zone.'
                : 'Active pest pattern detected requiring immediate local containment.'}
            </p>
          </div>

          <div className="border-t border-slate-200/60 pt-3 mt-2 bg-slate-100/80 -mx-2 -mb-2 p-3 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-700" />
              <span>{t.pestActionLabel || 'Intervention Advice:'}</span>
            </p>
            <p className="text-xs font-semibold text-slate-900 leading-snug">
              {diagnosticResult.pestPressure?.action || 'Apply Neem oil emulsion (5ml/L) locally; avoid blanket pesticide usage.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Actionable Farmer Advisory Badges (Quick-Action Banner) */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 p-4 sm:p-5 rounded-3xl shadow-neumorphic-lg border border-emerald-800/60 text-white">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h5 className="font-extrabold text-sm text-white tracking-wide">
                {t.actionableAdvisoryTitle || 'Actionable Farmer Advisory Protocol'}
              </h5>
              <p className="text-[10px] text-emerald-300/60">Real-time field action steps recommended by AGRIO AI</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Action Pill 1: Spray Status */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex items-center gap-3 transition-colors shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <Droplets className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider">
                {t.sprayStatusLabel || 'Spray Status'}
              </p>
              <p className="text-xs font-extrabold text-white truncate">
                {diagnosticResult.advisory?.sprayStatus || 'Targeted Intervention Needed'}
              </p>
            </div>
          </div>

          {/* Action Pill 2: Fertilizer */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex items-center gap-3 transition-colors shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-amber-300/80 tracking-wider">
                {t.fertilizerActionLabel || 'Fertilizer'}
              </p>
              <p className="text-xs font-extrabold text-white truncate">
                {diagnosticResult.advisory?.fertilizerAction || 'Adjust NPK Ratio'}
              </p>
            </div>
          </div>

          {/* Action Pill 3: Next Inspection */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex items-center gap-3 transition-colors shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-cyan-300/80 tracking-wider">
                {t.nextInspectionLabel || 'Next Inspection'}
              </p>
              <p className="text-xs font-extrabold text-white truncate">
                {diagnosticResult.advisory?.nextInspection || '48 Hours'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ activeTab, setActiveTab, setActiveView }) {
  const { lang, t } = useLanguage();

  // Smart Valves State
  const [valves, setValves] = useState({
    zoneA: true,
    zoneB: false,
    zoneC: true
  });

  const toggleValve = (zone) => {
    setValves((prev) => ({ ...prev, [zone]: !prev[zone] }));
  };

  const activeValvesCount = Object.values(valves).filter(Boolean).length;
  const currentFlowRate = activeValvesCount * 21;

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

  // Crop Profile State
  const [cropName, setCropName] = useState('Wheat 🌾');

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

  // Run AI Analysis using Gemini 2.5 Flash
  const runGeminiAnalysis = async (base64Data) => {
    const dataToAnalyze = base64Data || imagePreview;
    if (!dataToAnalyze) return;

    setDiagnosing(true);
    setScanError(null);
    setDiagnosticResult(null);

    try {
      const result = await analyzeLeafImage(dataToAnalyze, lang);
      setDiagnosticResult(result);
      setShowInsights(true);
    } catch (err) {
      console.error('Diagnostic error:', err);
      setScanError(err.message || 'Failed to connect to Gemini AI Service.');
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

  const openCamera = () => {
    handleCameraTrigger();
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

  // Sidebar nav items
  const sidebarItems = [
    { id: 'irrigation', label: t.sidebarIrrigation, icon: Droplets },
    { id: 'climate', label: t.sidebarClimate, icon: CloudSun },
    { id: 'analytics', label: t.sidebarAnalytics, icon: BarChart3 },
    { id: 'diagnostics', label: t.sidebarScanner, icon: ScanLine },
  ];

  // 7-day weather forecast data
  const weeklyForecast = [
    { day: t.mon, high: "29°", low: "19°", icon: "☀️", label: "Sunny" },
    { day: t.tue, high: "26°", low: "18°", icon: "🌧️", label: "Rain" },
    { day: t.wed, high: "27°", low: "17°", icon: "⛅", label: "Cloudy" },
    { day: t.thu, high: "30°", low: "20°", icon: "☀️", label: "Clear" },
    { day: t.fri, high: "28°", low: "19°", icon: "⛅", label: "Humid" },
    { day: t.sat, high: "31°", low: "21°", icon: "☀️", label: "Sunny" },
    { day: t.sun, high: "27°", low: "18°", icon: "🌦️", label: "Showers" },
  ];

  return (
    <div className="min-h-screen flex w-full max-w-full overflow-x-hidden">
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-emerald-100/40 hover:text-emerald-200 hover:bg-emerald-900/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Crop Profile Input */}
          <div className="mt-8 p-4 bg-emerald-900/50 rounded-2xl">
            <label className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-wider block mb-2">
              {t.activeCropProfile}
            </label>
            <input
              type="text"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              placeholder={t.cropNamePlaceholder}
              className="w-full px-3 py-2.5 bg-emerald-950 rounded-xl text-sm font-medium text-emerald-100 placeholder-emerald-600/40 border-0 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Bottom user badge */}
        <div
          onClick={() => setActiveView && setActiveView('landing')}
          className="flex items-center gap-3 mt-6 p-3 bg-emerald-900/30 rounded-2xl cursor-pointer hover:bg-emerald-900/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
            R
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-100">Farmer Ramesh</p>
            <p className="text-[10px] text-emerald-400/40">Punjab, Sector 4</p>
          </div>
        </div>
      </aside>

      {/* ========== MAIN CONTENT AREA ========== */}
      <div className="flex-1 md:ml-64 w-full min-w-0 max-w-full overflow-x-hidden">
        {/* Mobile Hero Farm Image Zone */}
        <div className="md:hidden relative w-full overflow-hidden">
          <div 
            className="h-[26vh] min-h-[190px] sm:min-h-[220px] bg-cover bg-center relative overflow-hidden flex flex-col justify-between p-4"
            style={{ backgroundImage: "url('/lush-farm.jpg')" }}
          >
            {/* Seamless photographic fade overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-emerald-950/25 via-50% to-emerald-50" />
            
            {/* Top row with home redirect welcome badge */}
            <div className="relative z-10 pt-1 sm:pt-2">
              <span
                onClick={() => setActiveView && setActiveView('landing')}
                className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full cursor-pointer hover:bg-white transition-all shadow-sm inline-flex items-center gap-1.5"
              >
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.welcomeFarmer}</span>
              </span>
            </div>

            {/* Bottom row with farm location header */}
            <div className="relative z-10 pb-5 sm:pb-6">
              <h1 className="text-xl sm:text-2xl font-black text-white drop-shadow-md tracking-tight truncate">
                {t.farmLocation}
              </h1>
              <p className="text-[11px] sm:text-xs font-medium text-emerald-100/90 drop-shadow truncate">
                Real-Time Precision Telemetry & Soil Health
              </p>
            </div>
          </div>

          {/* Mobile Crop Profile Input — Overlaid on the photographic transition zone */}
          <div className="px-3.5 sm:px-4 -mt-5 sm:-mt-6 relative z-10 w-full max-w-full">
            <div className="bg-white/95 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl shadow-neumorphic flex items-center gap-3 border border-white/80 w-full min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                <Leaf className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider block">
                  {t.activeCropProfile}
                </label>
                <input
                  type="text"
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  placeholder={t.cropNamePlaceholder}
                  className="w-full bg-transparent text-sm font-bold text-emerald-950 placeholder-emerald-600/30 border-0 outline-none p-0 truncate"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content wrapper */}
        <div className="bg-gradient-to-b from-emerald-50/30 to-white min-h-screen pb-32 md:pb-12 px-3.5 sm:px-6 lg:px-8 max-w-6xl mx-auto pt-4 md:pt-6 w-full min-w-0">
          {/* Desktop Farm Location Header Banner */}
          <div className="hidden md:flex bg-white/80 backdrop-blur-sm p-5 rounded-3xl shadow-neumorphic mb-6 items-center justify-between">
            <div>
              <span
                onClick={() => setActiveView && setActiveView('landing')}
                className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2.5 py-1 rounded-full cursor-pointer hover:bg-emerald-100 transition-colors inline-block"
              >
                {t.welcomeFarmer}
              </span>
              <h1 className="text-xl font-extrabold text-emerald-950 mt-2">
                {t.farmLocation}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700/40 bg-emerald-50/50 px-3 py-2 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>AGRIO Telemetry Live</span>
            </div>
          </div>

          {/* Tab Views Content */}
          <AnimatePresence mode="wait">
            {/* VIEW 1: IRRIGATION & WATER CONTROL */}
            {activeTab === 'irrigation' && (
              <motion.div
                key="irrigation"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 sm:space-y-6 w-full min-w-0"
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
                  <StatCard
                    title={t.activeValves}
                    value={`${activeValvesCount} / 3 ON`}
                    subtext={t.activeValvesSub}
                    icon={Sliders}
                    badgeText={activeValvesCount > 0 ? t.optimal : t.warning}
                    badgeColor={activeValvesCount > 0 ? 'emerald' : 'amber'}
                  />
                  <StatCard
                    title={t.soilMoistureAvg}
                    value="64.6%"
                    subtext={t.soilMoistureStatus}
                    icon={Droplets}
                    badgeText={t.optimal}
                    badgeColor="emerald"
                  />
                  <StatCard
                    title={t.waterReservoir}
                    value="8,500 L"
                    subtext={t.waterReservoirSub}
                    icon={Database}
                    badgeText="85% Full"
                    badgeColor="blue"
                  />
                  <StatCard
                    title={t.weatherToday}
                    value="28°C"
                    subtext={t.weatherDesc}
                    icon={CloudSun}
                    badgeText="Partly Cloudy"
                    badgeColor="amber"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                  <div className="bg-white/85 backdrop-blur-sm p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-neumorphic lg:col-span-2 border border-white/60 w-full min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-base sm:text-lg text-emerald-950 truncate">{t.irrigationTitle}</h3>
                        <p className="text-[11px] sm:text-xs text-emerald-700/40 truncate">{t.moistureTarget}</p>
                      </div>
                      <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-100 text-emerald-800 text-[11px] sm:text-xs font-bold rounded-full shrink-0">
                        {t.autoMode}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 border-t border-emerald-100/40 pt-4 sm:pt-5 w-full min-w-0">
                      {/* Zone A Card */}
                      <div className="bg-white/90 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-emerald-100/40 flex items-center gap-3 sm:gap-4 transition-all hover:shadow-neumorphic w-full min-w-0">
                        {/* Left Column: Refined circular moisture progress ring */}
                        <div className="shrink-0">
                          <SoilMoistureRing percentage={68} size={76} strokeWidth={7} bare={true} />
                        </div>

                        {/* Right Column: Zone Name, Target Moisture, and Valve Toggle Button */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-extrabold text-sm text-emerald-950 truncate">
                                {t.zoneA}
                              </h4>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                                68%
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-emerald-700/60 font-medium mt-0.5 truncate">
                              {t.moistureTarget} (60–75%)
                            </p>
                          </div>

                          <button
                            onClick={() => toggleValve('zoneA')}
                            className={`mt-2 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 w-full ${
                              valves.zoneA
                                ? 'bg-emerald-800 text-white shadow-md hover:bg-emerald-900'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                          >
                            <Power className={`w-3.5 h-3.5 shrink-0 ${valves.zoneA ? 'text-emerald-200' : 'text-emerald-700'}`} />
                            <span className="truncate">{valves.zoneA ? t.valveOn : t.valveOff}</span>
                          </button>
                        </div>
                      </div>

                      {/* Zone B Card */}
                      <div className="bg-white/90 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-emerald-100/40 flex items-center gap-3 sm:gap-4 transition-all hover:shadow-neumorphic w-full min-w-0">
                        {/* Left Column: Refined circular moisture progress ring */}
                        <div className="shrink-0">
                          <SoilMoistureRing percentage={54} size={76} strokeWidth={7} bare={true} />
                        </div>

                        {/* Right Column: Zone Name, Target Moisture, and Valve Toggle Button */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-extrabold text-sm text-emerald-950 truncate">
                                {t.zoneB}
                              </h4>
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0">
                                54%
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-emerald-700/60 font-medium mt-0.5 truncate">
                              {t.moistureTarget} (50–65%)
                            </p>
                          </div>

                          <button
                            onClick={() => toggleValve('zoneB')}
                            className={`mt-2 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 w-full ${
                              valves.zoneB
                                ? 'bg-emerald-800 text-white shadow-md hover:bg-emerald-900'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                          >
                            <Power className={`w-3.5 h-3.5 shrink-0 ${valves.zoneB ? 'text-emerald-200' : 'text-emerald-700'}`} />
                            <span className="truncate">{valves.zoneB ? t.valveOn : t.valveOff}</span>
                          </button>
                        </div>
                      </div>

                      {/* Zone C Card */}
                      <div className="bg-white/90 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-emerald-100/40 flex items-center gap-3 sm:gap-4 transition-all hover:shadow-neumorphic w-full min-w-0">
                        {/* Left Column: Refined circular moisture progress ring */}
                        <div className="shrink-0">
                          <SoilMoistureRing percentage={72} size={76} strokeWidth={7} bare={true} />
                        </div>

                        {/* Right Column: Zone Name, Target Moisture, and Valve Toggle Button */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-extrabold text-sm text-emerald-950 truncate">
                                {t.zoneC}
                              </h4>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                                72%
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-emerald-700/60 font-medium mt-0.5 truncate">
                              {t.moistureTarget} (65–80%)
                            </p>
                          </div>

                          <button
                            onClick={() => toggleValve('zoneC')}
                            className={`mt-2 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 w-full ${
                              valves.zoneC
                                ? 'bg-emerald-800 text-white shadow-md hover:bg-emerald-900'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                          >
                            <Power className={`w-3.5 h-3.5 shrink-0 ${valves.zoneC ? 'text-emerald-200' : 'text-emerald-700'}`} />
                            <span className="truncate">{valves.zoneC ? t.valveOn : t.valveOff}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                    <WaterTankGauge capacity={10000} current={8500} label={t.waterReservoir} />

                    <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic border border-white/60 w-full min-w-0">
                      <h4 className="font-bold text-sm text-emerald-950 mb-3">Live Flow Telemetry</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-emerald-100/40">
                          <span className="text-emerald-700/40">{t.waterFlowRate}:</span>
                          <span className="font-bold text-emerald-700">{currentFlowRate} L/min</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-emerald-100/40">
                          <span className="text-emerald-700/40">Active Zones:</span>
                          <span className="font-bold text-emerald-950">{activeValvesCount} / 3</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-emerald-700/40">Main Line Pressure:</span>
                          <span className="font-bold text-blue-600">2.8 BAR (Optimal)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weekly Weather Forecast Card */}
                <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic border border-white/60 w-full min-w-0 overflow-hidden">
                  <h4 className="font-bold text-sm text-emerald-950 mb-3 sm:mb-4">{t.weeklyForecast}</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {weeklyForecast.map((day, i) => (
                      <div key={i} className="flex-shrink-0 flex flex-col items-center p-2.5 sm:p-3 bg-emerald-50/40 rounded-2xl min-w-[66px] sm:min-w-[72px] hover:bg-emerald-100/60 transition-colors">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase">{day.day}</span>
                        <span className="text-xl sm:text-2xl my-1">{day.icon}</span>
                        <span className="text-xs font-extrabold text-emerald-950">{day.high}</span>
                        <span className="text-[10px] text-emerald-600/50">{day.low}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generate AI Insights CTA */}
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className="w-full py-4 sm:py-5 rounded-2xl sm:rounded-3xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-base sm:text-lg shadow-neumorphic-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3"
                >
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />
                  <span>{t.generateAIInsights}</span>
                </button>
              </motion.div>
            )}

            {/* VIEW 2: CLIMATE & EARLY WARNING */}
            {activeTab === 'climate' && (
              <motion.div
                key="climate"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 sm:space-y-6 w-full min-w-0"
              >
                <div className="bg-amber-50/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic border border-amber-100/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full min-w-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-3 bg-amber-500 text-white rounded-full shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-amber-950 truncate">{t.frostAlertTitle}</h3>
                      <p className="text-xs font-semibold text-amber-900 mt-1">{t.yellowRustRisk}</p>
                      <p className="text-xs text-amber-800/70 mt-0.5">{t.pestRecommendation}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                  <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-neumorphic-lg lg:col-span-2 flex flex-col justify-between w-full min-w-0">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/70">AGRIO Weather Station</p>
                          <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">28°C</h2>
                          <p className="text-xs sm:text-sm text-emerald-100/70 font-medium">{t.weatherDesc}</p>
                        </div>
                        <CloudSun className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-300/40 shrink-0" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-emerald-700/30 text-center">
                      <div className="bg-white/10 p-2.5 sm:p-3 rounded-2xl backdrop-blur-sm">
                        <Wind className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-emerald-300/70" />
                        <span className="text-xs block font-bold">14 km/h</span>
                        <span className="text-[9px] sm:text-[10px] text-emerald-300/50">Wind Speed</span>
                      </div>
                      <div className="bg-white/10 p-2.5 sm:p-3 rounded-2xl backdrop-blur-sm">
                        <Droplets className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-emerald-300/70" />
                        <span className="text-xs block font-bold">72%</span>
                        <span className="text-[9px] sm:text-[10px] text-emerald-300/50">Humidity</span>
                      </div>
                      <div className="bg-white/10 p-2.5 sm:p-3 rounded-2xl backdrop-blur-sm">
                        <Sun className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-emerald-300/70" />
                        <span className="text-xs block font-bold">6.2 UV</span>
                        <span className="text-[9px] sm:text-[10px] text-emerald-300/50">UV Index</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic border border-white/60 w-full min-w-0">
                    <h4 className="font-bold text-sm text-emerald-950 mb-3 sm:mb-4">{t.forecast5Day}</h4>
                    <div className="space-y-2 sm:space-y-2.5">
                      {[
                        { day: t.mon, temp: "29°C / 19°C", icon: Sun, label: "Sunny" },
                        { day: t.tue, temp: "26°C / 18°C", icon: CloudRain, label: "65% Rain" },
                        { day: t.wed, temp: "27°C / 17°C", icon: CloudSun, label: "Partly Cloudy" },
                        { day: t.thu, temp: "30°C / 20°C", icon: Sun, label: "Clear" },
                        { day: t.fri, temp: "28°C / 19°C", icon: CloudSun, label: "Humid" }
                      ].map((item, i) => {
                        const Icon = item.icon;
                        return (
                          <div key={i} className="flex items-center justify-between p-2 sm:p-2.5 bg-emerald-50/40 rounded-xl sm:rounded-2xl text-xs">
                            <span className="font-bold text-emerald-950 w-12">{item.day}</span>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-emerald-700/50 truncate">{item.label}</span>
                            </div>
                            <span className="font-bold text-emerald-900 shrink-0">{item.temp}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW 3: FARM ANALYTICS */}
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 sm:space-y-6 w-full min-w-0"
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
                  <StatCard
                    title={t.expectedYield}
                    value={t.expectedYieldVal}
                    subtext={t.yieldTrend}
                    icon={BarChart3}
                    badgeText="+12%"
                    badgeColor="emerald"
                  />
                  <StatCard
                    title={t.waterSaved}
                    value={t.waterSavedVal}
                    subtext="Seasonal Cumulative"
                    icon={Droplets}
                    badgeText="35% Saver"
                    badgeColor="blue"
                  />
                  <StatCard
                    title={t.fertilizerEfficiency}
                    value={t.efficiencyScore}
                    subtext="NPK Balance Optimized"
                    icon={Sparkles}
                    badgeText="Optimal"
                    badgeColor="emerald"
                  />
                  <StatCard
                    title={t.cropHealthIndex}
                    value={t.healthScore}
                    subtext="Satellite NDVI Score"
                    icon={CheckCircle}
                    badgeText="High Health"
                    badgeColor="emerald"
                  />
                </div>

                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-neumorphic space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-lg text-emerald-950">{t.analyticsTitle}</h3>
                      <p className="text-xs text-emerald-700/40">Seasonal NDVI & Soil Moisture Historical Trend</p>
                    </div>
                  </div>

                  <div className="h-64 w-full bg-emerald-50/40 rounded-2xl p-4 flex items-end justify-between gap-2 relative overflow-hidden">
                    {[40, 55, 62, 58, 75, 82, 88, 92, 85].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${val}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                          className="w-full max-w-[28px] bg-gradient-to-t from-emerald-700 to-emerald-400 rounded-t-xl relative group"
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-950 text-white text-[10px] py-1 px-2 rounded-full font-bold transition-opacity whitespace-nowrap">
                            {val}%
                          </div>
                        </motion.div>
                        <span className="text-[10px] font-semibold text-emerald-700/40">W{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generate AI Insights CTA */}
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className="w-full py-5 rounded-3xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-lg shadow-neumorphic-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3"
                >
                  <Sparkles className="w-6 h-6 text-emerald-300" />
                  <span>{t.generateAIInsights}</span>
                </button>
              </motion.div>
            )}

            {/* VIEW 4: MOBILE CROP DIAGNOSTICS / SCANNER WITH GEMINI 2.5 FLASH */}
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
                  <div className="bg-white/85 backdrop-blur-sm p-5 sm:p-6 rounded-3xl shadow-neumorphic text-center border border-white/60">
                    {/* Top floating circular mint camera icon button */}
                    <div 
                      onClick={handleCameraTrigger}
                      className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-emerald-200 active:scale-95 transition-all shadow-sm group"
                      role="button"
                      title={t.takePhoto}
                    >
                      <Camera className="w-8 h-8 group-hover:scale-110 transition-transform text-emerald-800" />
                    </div>
                    <h2 className="text-xl font-extrabold text-emerald-950">{t.scannerTitle}</h2>
                    <p className="text-xs text-emerald-700/40 mt-1 max-w-md mx-auto">{t.scannerSubtitle}</p>

                    {/* Image Preview Container */}
                    {imagePreview ? (
                      <div className="mt-6 relative rounded-3xl overflow-hidden border-2 border-emerald-400 max-h-72 bg-emerald-50/20 flex items-center justify-center">
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
                            className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>{t.reCapture}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 border-2 border-dashed border-emerald-300/50 bg-emerald-50/20 p-6 sm:p-8 rounded-3xl flex flex-col items-center justify-center gap-4">
                        {/* Circular mint camera icon button inside dashed viewfinder */}
                        <div 
                          onClick={handleCameraTrigger}
                          className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center cursor-pointer hover:bg-emerald-200 active:scale-95 transition-all shadow-sm group"
                          role="button"
                          title={t.takePhoto}
                        >
                          <Camera className="w-8 h-8 group-hover:scale-110 transition-transform text-emerald-800" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                          <button
                            onClick={handleCameraTrigger}
                            className="px-5 py-3 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-neumorphic active:scale-95 transition-all"
                          >
                            <Camera className="w-4 h-4 text-emerald-300" />
                            <span>{t.takePhoto}</span>
                          </button>

                          <button
                            onClick={openFilePicker}
                            className="px-5 py-3 rounded-full bg-white/90 hover:bg-white text-emerald-900 text-xs font-bold flex items-center justify-center gap-2 shadow-neumorphic active:scale-95 transition-all border border-emerald-100"
                          >
                            <Upload className="w-4 h-4 text-emerald-600" />
                            <span>{t.uploadFile}</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-emerald-600/40">{t.uploadPlaceholder}</p>
                      </div>
                    )}

                    {/* Trigger Gemini AI Scan Button */}
                    <button
                      onClick={() => runGeminiAnalysis(imagePreview)}
                      disabled={diagnosing || !imagePreview}
                      className={`mt-6 w-full py-4 rounded-full font-bold text-base shadow-neumorphic-lg transition-all flex items-center justify-center gap-2 ${
                        !imagePreview
                          ? 'bg-emerald-100 text-emerald-400 cursor-not-allowed'
                          : 'bg-emerald-800 hover:bg-emerald-900 text-white active:scale-95'
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
                      <LeafDiagnosticCard
                        diagnosticResult={diagnosticResult}
                        t={t}
                        severityBadgeClasses={severityBadgeClasses}
                      />
                    )}

                    {imagePreview && diagnosticResult && !showInsights && (
                      <button
                        onClick={() => setShowInsights(true)}
                        className="mt-3 w-full py-2.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-200 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{t.insightsTitle || 'View Diagnostic Report'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* DESKTOP: Scanner as side-by-side layout */}
                <div className="hidden md:block">
                  <div className="bg-white/85 backdrop-blur-sm p-8 rounded-3xl shadow-neumorphic border border-white/60">
                    <div className="flex items-center gap-3 mb-6">
                      <div 
                        onClick={handleCameraTrigger}
                        className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center cursor-pointer hover:bg-emerald-200 active:scale-95 transition-all shadow-sm group"
                        role="button"
                        title={t.takePhoto}
                      >
                        <Camera className="w-6 h-6 group-hover:scale-110 transition-transform text-emerald-800" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-emerald-950">{t.scannerTitle}</h2>
                        <p className="text-xs text-emerald-700/40">{t.scannerSubtitle}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Viewfinder */}
                      <div>
                        {imagePreview ? (
                          <div className="relative rounded-3xl overflow-hidden border-2 border-emerald-400 aspect-[4/3] bg-emerald-50/20 flex items-center justify-center">
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
                                className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm transition-all"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>{t.reCapture}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-emerald-300/50 bg-emerald-50/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 aspect-[4/3]">
                            {/* Circular mint camera icon button in desktop empty state */}
                            <div 
                              onClick={handleCameraTrigger}
                              className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center cursor-pointer hover:bg-emerald-200 hover:scale-105 active:scale-95 transition-all shadow-sm group"
                              role="button"
                              title={t.takePhoto}
                            >
                              <Camera className="w-10 h-10 group-hover:scale-110 transition-transform text-emerald-800" />
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={handleCameraTrigger}
                                className="px-5 py-3 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-neumorphic active:scale-95 transition-all"
                              >
                                <Camera className="w-4 h-4 text-emerald-300" />
                                <span>{t.takePhoto}</span>
                              </button>
                              <button
                                onClick={openFilePicker}
                                className="px-5 py-3 rounded-full bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-neumorphic active:scale-95 transition-all border border-emerald-100"
                              >
                                <Upload className="w-4 h-4 text-emerald-600" />
                                <span>{t.uploadFile}</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-emerald-600/40">{t.uploadPlaceholder}</p>
                          </div>
                        )}

                        {/* Trigger Gemini AI Scan Button */}
                        <button
                          onClick={() => runGeminiAnalysis(imagePreview)}
                          disabled={diagnosing || !imagePreview}
                          className={`mt-4 w-full py-4 rounded-full font-bold text-base shadow-neumorphic-lg transition-all flex items-center justify-center gap-2 ${
                            !imagePreview
                              ? 'bg-emerald-100 text-emerald-400 cursor-not-allowed'
                              : 'bg-emerald-800 hover:bg-emerald-900 text-white active:scale-95'
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

                            {/* Demo Notice */}
                            {diagnosticResult.demoNotice && (
                              <div className="p-3 bg-blue-50/80 rounded-2xl text-xs text-blue-900 flex items-start gap-2">
                                <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <span>{diagnosticResult.demoNotice}</span>
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
                      <LeafDiagnosticCard
                        diagnosticResult={diagnosticResult}
                        t={t}
                        severityBadgeClasses={severityBadgeClasses}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
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
                  {/* Demo key Notice Banner if applicable */}
                  {diagnosticResult.demoNotice && (
                    <div className="mb-3 p-3 bg-blue-50/80 rounded-2xl text-xs text-blue-900 flex items-start gap-2">
                      <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{diagnosticResult.demoNotice}</span>
                    </div>
                  )}

                  <LeafDiagnosticCard
                    diagnosticResult={diagnosticResult}
                    t={t}
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
    </div>
  );
}
