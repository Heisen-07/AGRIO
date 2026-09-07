import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, CloudSun, BarChart3, ScanLine, AlertTriangle, CheckCircle, Power, 
  Wind, Thermometer, CloudRain, Sun, Upload, Camera, Sparkles, X, RefreshCw, Eye, KeyRound
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import StatCard from '../components/StatCard';
import SoilMoistureRing from '../components/SoilMoistureRing';
import WaterTankGauge from '../components/WaterTankGauge';
import { analyzeLeafImage } from '../services/geminiService';

export default function Dashboard({ activeTab, setActiveTab }) {
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

  // Diagnostic State Hooks
  const [imagePreview, setImagePreview] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  // Handle File Change & Trigger Gemini 2.5 Flash API
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        setImagePreview(base64Data);
        runGeminiAnalysis(base64Data);
      };
      reader.readAsDataURL(file);
    }
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

  const openCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Severity color mapping
  const severityBadgeClasses = {
    Low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Moderate: 'bg-amber-100 text-amber-900 border-amber-300',
    High: 'bg-orange-100 text-orange-900 border-orange-300',
    Critical: 'bg-red-100 text-red-900 border-red-300'
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 md:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-6">
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

      {/* Farm Location Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-surface-border shadow-soft-glow mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            {t.welcomeFarmer}
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-forest mt-2">
            {t.farmLocation}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-surface-muted px-3 py-2 rounded-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span>AGRIO Telemetry Live</span>
        </div>
      </div>

      {/* Desktop Navigation Tabs */}
      <div className="hidden md:flex items-center gap-2 mb-6 border-b border-surface-border pb-3">
        {[
          { id: 'irrigation', label: t.tabIrrigation, icon: Droplets },
          { id: 'climate', label: t.tabClimate, icon: CloudSun },
          { id: 'analytics', label: t.tabAnalytics, icon: BarChart3 },
          { id: 'diagnostics', label: t.tabDiagnostics, icon: ScanLine }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-soft-glow scale-[1.02]'
                  : 'bg-white text-gray-600 border border-surface-border hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={t.activeValves}
                value={`${activeValvesCount} / 3 ON`}
                subtext={t.activeValvesSub}
                icon={Droplets}
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
                icon={Droplets}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-soft-glow lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-extrabold text-lg text-forest">{t.irrigationTitle}</h3>
                    <p className="text-xs text-gray-500">{t.moistureTarget}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                    {t.autoMode}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                  <div className="flex flex-col items-center p-3 bg-surface-muted rounded-2xl">
                    <SoilMoistureRing percentage={68} label={t.zoneA} />
                    <button
                      onClick={() => toggleValve('zoneA')}
                      className={`mt-3 w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        valves.zoneA
                          ? 'bg-emerald-600 text-white shadow-soft-glow'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <Power className={`w-4 h-4 ${valves.zoneA ? 'text-white' : 'text-gray-500'}`} />
                      <span>{valves.zoneA ? t.valveOn : t.valveOff}</span>
                    </button>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-surface-muted rounded-2xl">
                    <SoilMoistureRing percentage={54} label={t.zoneB} />
                    <button
                      onClick={() => toggleValve('zoneB')}
                      className={`mt-3 w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        valves.zoneB
                          ? 'bg-emerald-600 text-white shadow-soft-glow'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <Power className={`w-4 h-4 ${valves.zoneB ? 'text-white' : 'text-gray-500'}`} />
                      <span>{valves.zoneB ? t.valveOn : t.valveOff}</span>
                    </button>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-surface-muted rounded-2xl">
                    <SoilMoistureRing percentage={72} label={t.zoneC} />
                    <button
                      onClick={() => toggleValve('zoneC')}
                      className={`mt-3 w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        valves.zoneC
                          ? 'bg-emerald-600 text-white shadow-soft-glow'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <Power className={`w-4 h-4 ${valves.zoneC ? 'text-white' : 'text-gray-500'}`} />
                      <span>{valves.zoneC ? t.valveOn : t.valveOff}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <WaterTankGauge capacity={10000} current={8500} label={t.waterReservoir} />

                <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-soft-glow">
                  <h4 className="font-bold text-sm text-forest mb-3">Live Flow Telemetry</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">{t.waterFlowRate}:</span>
                      <span className="font-bold text-emerald-700">{currentFlowRate} L/min</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Active Zones:</span>
                      <span className="font-bold text-forest">{activeValvesCount} / 3</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-gray-500">Main Line Pressure:</span>
                      <span className="font-bold text-blue-600">2.8 BAR (Optimal)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            className="space-y-6"
          >
            <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-soft-glow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-500 text-white rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-amber-950">{t.frostAlertTitle}</h3>
                  <p className="text-xs font-semibold text-amber-900 mt-1">{t.yellowRustRisk}</p>
                  <p className="text-xs text-amber-800 mt-0.5">{t.pestRecommendation}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-forest to-emerald-800 text-white p-6 rounded-2xl shadow-lift lg:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">AGRIO Weather Station</p>
                      <h2 className="text-4xl font-extrabold mt-2 tracking-tight">28°C</h2>
                      <p className="text-sm text-emerald-100 font-medium">{t.weatherDesc}</p>
                    </div>
                    <CloudSun className="w-16 h-16 text-emerald-300 opacity-90" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-8 pt-6 border-t border-emerald-600/60 text-center">
                  <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <Wind className="w-5 h-5 mx-auto mb-1 text-emerald-200" />
                    <span className="text-xs block font-bold">14 km/h</span>
                    <span className="text-[10px] text-emerald-200">Wind Speed</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <Droplets className="w-5 h-5 mx-auto mb-1 text-emerald-200" />
                    <span className="text-xs block font-bold">72%</span>
                    <span className="text-[10px] text-emerald-200">Humidity</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <Sun className="w-5 h-5 mx-auto mb-1 text-emerald-200" />
                    <span className="text-xs block font-bold">6.2 UV</span>
                    <span className="text-[10px] text-emerald-200">UV Index</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-soft-glow">
                <h4 className="font-bold text-sm text-forest mb-4">{t.forecast5Day}</h4>
                <div className="space-y-3">
                  {[
                    { day: t.mon, temp: "29°C / 19°C", icon: Sun, label: "Sunny" },
                    { day: t.tue, temp: "26°C / 18°C", icon: CloudRain, label: "65% Rain" },
                    { day: t.wed, temp: "27°C / 17°C", icon: CloudSun, label: "Partly Cloudy" },
                    { day: t.thu, temp: "30°C / 20°C", icon: Sun, label: "Clear" },
                    { day: t.fri, temp: "28°C / 19°C", icon: CloudSun, label: "Humid" }
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-surface-muted rounded-xl text-xs">
                        <span className="font-bold text-forest w-12">{item.day}</span>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-emerald-600" />
                          <span className="text-gray-600">{item.label}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.temp}</span>
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
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-soft-glow space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-lg text-forest">{t.analyticsTitle}</h3>
                  <p className="text-xs text-gray-500">Seasonal NDVI & Soil Moisture Historical Trend</p>
                </div>
              </div>

              <div className="h-64 w-full bg-surface-muted rounded-xl p-4 flex items-end justify-between gap-2 relative overflow-hidden">
                {[40, 55, 62, 58, 75, 82, 88, 92, 85].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.05 }}
                      className="w-full max-w-[28px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg relative group"
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-forest text-white text-[10px] py-1 px-2 rounded font-bold transition-opacity whitespace-nowrap">
                        {val}%
                      </div>
                    </motion.div>
                    <span className="text-[10px] font-semibold text-gray-500">W{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
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
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-surface-border shadow-soft-glow max-w-2xl mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <ScanLine className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-forest">{t.scannerTitle}</h2>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{t.scannerSubtitle}</p>

              {/* Image Preview Container */}
              {imagePreview ? (
                <div className="mt-6 relative rounded-2xl overflow-hidden border-2 border-emerald-500 max-h-72 bg-black/5 flex items-center justify-center">
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
                      className="bg-black/70 hover:bg-black text-white p-2 rounded-xl text-xs font-bold flex items-center gap-1 backdrop-blur-sm transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t.reCapture}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center gap-4">
                  <div className="flex gap-3">
                    <button
                      onClick={openCamera}
                      className="px-5 py-3 rounded-xl bg-forest hover:bg-forest/90 text-white text-xs font-bold flex items-center gap-2 shadow-soft-glow active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>{t.takePhoto}</span>
                    </button>

                    <button
                      onClick={openFilePicker}
                      className="px-5 py-3 rounded-xl bg-white hover:bg-gray-50 text-forest border border-surface-border text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <Upload className="w-4 h-4 text-emerald-600" />
                      <span>{t.uploadFile}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">{t.uploadPlaceholder}</p>
                </div>
              )}

              {/* Trigger Gemini AI Scan Button */}
              <button
                onClick={() => runGeminiAnalysis(imagePreview)}
                disabled={diagnosing || !imagePreview}
                className={`mt-6 w-full py-4 rounded-2xl font-bold text-base shadow-lift transition-all flex items-center justify-center gap-2 ${
                  !imagePreview
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
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

              {imagePreview && diagnosticResult && !showInsights && (
                <button
                  onClick={() => setShowInsights(true)}
                  className="mt-3 w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-all"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Diagnostic Report</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-Up Agrio Insights Result Sheet Modal */}
      <AnimatePresence>
        {showInsights && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl border border-surface-border shadow-lift p-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-forest">{t.insightsTitle}</h3>
                    <p className="text-[10px] text-gray-400 font-medium">Powered by Gemini 3.6 Flash</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInsights(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview Thumbnail */}
              {imagePreview && (
                <div className="mb-4 rounded-xl overflow-hidden max-h-36 bg-black/5 flex items-center justify-center">
                  <img src={imagePreview} alt="Scanned Leaf" className="w-full h-full object-cover max-h-36" />
                </div>
              )}

              {/* Dynamic Error State */}
              {scanError ? (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-left space-y-2">
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
                <div className="space-y-4 text-left">
                  {/* Demo key Notice Banner if applicable */}
                  {diagnosticResult.demoNotice && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                      <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{diagnosticResult.demoNotice}</span>
                    </div>
                  )}

                  {/* Disease & Severity Card */}
                  <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2.5 py-0.5 font-bold text-[11px] rounded-full border ${severityBadgeClasses[diagnosticResult.severity] || severityBadgeClasses.Moderate}`}>
                        Severity: {diagnosticResult.severity}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-full shadow-xs border border-emerald-100">
                        {typeof diagnosticResult.confidence === 'number'
                          ? (diagnosticResult.confidence > 1 ? diagnosticResult.confidence.toFixed(1) : (diagnosticResult.confidence * 100).toFixed(1)) + '%'
                          : '96.4%'} AI Confidence
                      </span>
                    </div>
                    <h4 className="font-extrabold text-lg text-amber-950 mb-1">
                      {diagnosticResult.disease}
                    </h4>
                  </div>

                  {/* Dynamic Treatment Steps */}
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <h4 className="font-bold text-sm text-forest mb-3">{t.treatmentTitle}</h4>
                    <ul className="space-y-2.5 text-xs text-emerald-950 font-medium">
                      {diagnosticResult.treatment_steps && diagnosticResult.treatment_steps.length > 0 ? (
                        diagnosticResult.treatment_steps.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{step}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 italic">No specific treatment steps required.</li>
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}

              <button
                onClick={() => setShowInsights(false)}
                className="mt-6 w-full py-3.5 rounded-xl bg-forest hover:bg-forest/90 text-white font-bold text-sm shadow-soft-glow active:scale-95 transition-all"
              >
                {t.saveHistory}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
