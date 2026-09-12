import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Droplets, Thermometer, Wind, Database,
  Leaf, CheckCircle, HelpCircle, HardDrive,
  ShieldAlert, Bug, FlaskConical, Radio
} from 'lucide-react';

/**
 * Simple Responsive SVG Line Chart for Real Telemetry
 * - Uses ONLY real recorded points
 * - No synthetic interpolation or fake forecasts
 * - Tooltip on hover/touch
 * - Fallback if < 2 points
 */
function SimpleSoilMoistureChart({ points = [], t }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (points.length < 2) {
    return (
      <div className="py-10 px-4 text-center rounded-2xl bg-emerald-50/40 border border-dashed border-emerald-200/70">
        <Droplets className="w-8 h-8 text-emerald-600/50 mx-auto mb-2" />
        <h4 className="font-extrabold text-sm text-emerald-950">
          {t.notEnoughHistoryYet || 'Not enough historical data yet'}
        </h4>
        <p className="text-xs text-emerald-700/70 mt-1 max-w-sm mx-auto leading-relaxed">
          {t.continueUsingAgrio || 'Continue using AGRIO to build your local history. At least 2 sensor readings are required to plot a trend.'}
        </p>
      </div>
    );
  }

  const values = points.map((p) => p.moisture);
  const minVal = Math.max(0, Math.min(...values) - 5);
  const maxVal = Math.min(100, Math.max(...values) + 5);
  const valRange = Math.max(1, maxVal - minVal);

  const width = 600;
  const height = 200;
  const pad = { top: 25, right: 30, bottom: 40, left: 45 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const coords = points.map((p, i) => {
    const x = pad.left + (i / (points.length - 1)) * innerW;
    const y = pad.top + innerH - ((p.moisture - minVal) / valRange) * innerH;
    return { ...p, x, y };
  });

  const lineD = coords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
  const areaD = `${lineD} L ${coords[coords.length - 1].x} ${pad.top + innerH} L ${coords[0].x} ${pad.top + innerH} Z`;

  const hoveredPoint = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="relative w-full select-none">
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible touch-none"
          style={{ maxHeight: '240px' }}
        >
          <defs>
            <linearGradient id="moistureAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Minimal Gridlines */}
          <line
            x1={pad.left}
            y1={pad.top}
            x2={width - pad.right}
            y2={pad.top}
            stroke="#E2E8F0"
            strokeDasharray="4 4"
          />
          <line
            x1={pad.left}
            y1={pad.top + innerH / 2}
            x2={width - pad.right}
            y2={pad.top + innerH / 2}
            stroke="#E2E8F0"
            strokeDasharray="4 4"
          />
          <line
            x1={pad.left}
            y1={pad.top + innerH}
            x2={width - pad.right}
            y2={pad.top + innerH}
            stroke="#CBD5E1"
          />

          {/* Y Axis Values */}
          <text x={pad.left - 8} y={pad.top + 4} textAnchor="end" className="text-[10px] fill-slate-600 font-bold">
            {Math.round(maxVal)}%
          </text>
          <text x={pad.left - 8} y={pad.top + innerH / 2 + 4} textAnchor="end" className="text-[10px] fill-slate-600 font-bold">
            {Math.round((maxVal + minVal) / 2)}%
          </text>
          <text x={pad.left - 8} y={pad.top + innerH + 4} textAnchor="end" className="text-[10px] fill-slate-600 font-bold">
            {Math.round(minVal)}%
          </text>

          {/* Area Fill */}
          <path d={areaD} fill="url(#moistureAreaGradient)" />

          {/* Line Path */}
          <path
            d={lineD}
            fill="none"
            stroke="#059669"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active / Hovered Guide Line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={pad.top}
              x2={hoveredPoint.x}
              y2={pad.top + innerH}
              stroke="#047857"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Data Points */}
          {coords.map((pt, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(isHovered ? null : i)}
              >
                {/* Hit area */}
                <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4}
                  className={`transition-all duration-150 ${
                    isHovered
                      ? 'fill-emerald-800 stroke-white stroke-2'
                      : 'fill-emerald-600 stroke-white stroke-2'
                  }`}
                />
              </g>
            );
          })}

          {/* X Axis Timestamps (Start & End) */}
          <text x={coords[0].x} y={height - 12} textAnchor="start" className="text-[10px] fill-slate-600 font-medium">
            {coords[0].dateFormatted} {coords[0].timeFormatted}
          </text>
          <text
            x={coords[coords.length - 1].x}
            y={height - 12}
            textAnchor="end"
            className="text-[10px] fill-slate-600 font-medium"
          >
            {coords[coords.length - 1].dateFormatted} {coords[coords.length - 1].timeFormatted}
          </text>
        </svg>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredPoint && (
        <div className="mt-3 p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700 text-xs flex items-center justify-between gap-4 max-w-sm mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-300">
              {hoveredPoint.moisture}% Moisture
            </span>
          </div>
          <div className="text-[11px] text-slate-300">
            {hoveredPoint.dateFormatted} at {hoveredPoint.timeFormatted}
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {hoveredPoint.source}
          </span>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsView({
  telemetryHistory = [],
  diagnosisHistory = [],
  currentTelemetry = null,
  telemetryStatus = 'offline',
  currentWeather = null,
  onNavigateTab,
  t = {},
  lang: _lang = 'en',
}) {
  // 1. Parse Real Telemetry Points
  const telemetryPoints = useMemo(() => {
    if (!Array.isArray(telemetryHistory) || telemetryHistory.length === 0) return [];

    return telemetryHistory
      .map((item, idx) => {
        const rawTime = item.timestamp || item.data?.timestamp;
        const dateObj = rawTime ? new Date(rawTime) : null;
        const data = item.data || {};
        const soil = data.soilMoisture;
        let moisture = null;

        if (typeof soil === 'number') {
          moisture = soil;
        } else if (soil && typeof soil.current === 'number') {
          moisture = soil.current;
        } else if (soil && typeof soil.value === 'number') {
          moisture = soil.value;
        }

        const weather = data.weather || {};
        const temp = typeof weather.temperature === 'number' ? weather.temperature : null;
        const humidity = typeof weather.humidity === 'number' ? weather.humidity : null;

        return {
          index: idx,
          timestamp: rawTime,
          dateObj,
          timeFormatted: dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          dateFormatted: dateObj ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—',
          moisture,
          temp,
          humidity,
          source: data.source || item.source || 'simulated',
        };
      })
      .filter((p) => p.dateObj !== null && p.moisture !== null && !Number.isNaN(p.moisture))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [telemetryHistory]);

  // 2. Parse Diagnosis History Counts
  const diagnosisCounts = useMemo(() => {
    if (!Array.isArray(diagnosisHistory) || diagnosisHistory.length === 0) {
      return { total: 0, healthy: 0, disease: 0, pest: 0, nutrient: 0, unknown: 0 };
    }

    let healthy = 0;
    let disease = 0;
    let pest = 0;
    let nutrient = 0;
    let unknown = 0;

    for (const item of diagnosisHistory) {
      const data = item.data || {};
      const condition = (data.diseaseDiagnostics?.detectedName || data.cropCondition || '').toLowerCase();
      const guardrail = data.guardrailStatus || '';

      if (guardrail === 'abstained' || condition.includes('unknown') || condition.includes('unable')) {
        unknown++;
      } else if (condition.includes('healthy') || condition.includes('स्वस्थ')) {
        healthy++;
      } else {
        disease++;
      }

      // Secondary pest / nutrient detection
      const pestSev = data.pestPressure?.severity;
      if (pestSev && pestSev !== 'Low' && pestSev !== 'None') {
        pest++;
      }

      const nutStatus = (data.nutrientDeficiency?.status || '').toLowerCase();
      if (nutStatus && !nutStatus.includes('optimal') && !nutStatus.includes('none') && !nutStatus.includes('अनुकूल')) {
        nutrient++;
      }
    }

    return {
      total: diagnosisHistory.length,
      healthy,
      disease,
      pest,
      nutrient,
      unknown,
    };
  }, [diagnosisHistory]);

  // 3. Field Summary Values (Latest Real Telemetry)
  const latestMoisture = useMemo(() => {
    if (currentTelemetry?.soilMoisture) {
      const s = currentTelemetry.soilMoisture;
      if (typeof s.current === 'number') return s.current;
      if (typeof s.value === 'number') return s.value;
      if (typeof s === 'number') return s;
    }
    if (telemetryPoints.length > 0) {
      return telemetryPoints[telemetryPoints.length - 1].moisture;
    }
    return null;
  }, [currentTelemetry, telemetryPoints]);

  const latestTemp = useMemo(() => {
    if (currentWeather?.temperature != null) return currentWeather.temperature;
    if (telemetryPoints.length > 0) {
      const withTemp = telemetryPoints.filter((p) => p.temp !== null);
      if (withTemp.length > 0) return withTemp[withTemp.length - 1].temp;
    }
    return null;
  }, [currentWeather, telemetryPoints]);

  const latestHumidity = useMemo(() => {
    if (currentWeather?.humidity != null) return currentWeather.humidity;
    if (telemetryPoints.length > 0) {
      const withHum = telemetryPoints.filter((p) => p.humidity !== null);
      if (withHum.length > 0) return withHum[withHum.length - 1].humidity;
    }
    return null;
  }, [currentWeather, telemetryPoints]);

  const isSimulated = useMemo(() => {
    if (telemetryStatus === 'simulated') return true;
    return telemetryPoints.some((p) => p.source === 'simulated');
  }, [telemetryStatus, telemetryPoints]);

  const hasAnyData = telemetryPoints.length > 0 || diagnosisHistory.length > 0;

  // 4. Fresh Installation / No History Empty State
  if (!hasAnyData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl mx-auto py-6 sm:py-10"
      >
        <div className="bg-white/80 backdrop-blur-md border border-emerald-100/80 rounded-3xl p-8 sm:p-12 shadow-neumorphic ring-1 ring-inset ring-white/50 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
            <BarChart3 className="w-8 h-8 text-emerald-700" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-emerald-950">
            {t.noHistoricalDataYet || 'No historical data yet'}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-800/70 max-w-md mx-auto leading-relaxed">
            {t.localDeviceDataExpl || 'AGRIO records telemetry and scan results locally on this device as you use it. Historical trends will automatically appear here once readings are recorded.'}
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.dataRecordedOnDevice || 'Based on data recorded on this device'}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => onNavigateTab && onNavigateTab('irrigation')}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm hover:-translate-y-0.5 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4 text-emerald-300" />
              <span>{t.checkFieldSensors || 'Check Field Sensors'}</span>
            </button>
            <button
              onClick={() => onNavigateTab && onNavigateTab('diagnostics')}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs font-bold transition-all shadow-2xs hover:-translate-y-0.5 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Leaf className="w-4 h-4 text-emerald-600" />
              <span>{t.scanALeaf || 'Scan a Leaf'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto w-full min-w-0 pb-6"
    >
      {/* ── Page Header & Data Source Badge ──────────────────────── */}
      <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-2xs">
              <BarChart3 className="w-4 h-4 text-emerald-700" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight truncate">
              {t.analyticsTitle || 'Farm Analytics'}
            </h1>
          </div>
          <p className="text-xs text-emerald-700/70 font-medium">
            {t.analyticsSubtitleSimple || 'Observed telemetry readings & crop diagnosis findings recorded on this device'}
          </p>
        </div>

        {/* Device Data Source Label */}
        <div className="flex flex-col sm:items-end gap-1 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-2xs">
            <HardDrive className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{t.dataRecordedOnDevice || 'Based on data recorded on this device'}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium sm:text-right">
            {telemetryPoints.length} {t.telemetryRecordsRecorded || 'readings'} · {diagnosisCounts.total} {t.diagnosisScansAvailable || 'scans'}
          </span>
        </div>
      </div>

      {/* ── A. FIELD SUMMARY (What has the field been doing?) ───── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Radio className="w-4 h-4 text-emerald-700" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-950">
            {t.fieldSummaryTitle || 'Field Summary'}
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Soil Moisture */}
          <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50">
            <div className="flex items-center justify-between text-emerald-700 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/60">
                {t.soilMoistureAvg || 'Soil Moisture'}
              </span>
              <Droplets className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-950">
              {latestMoisture !== null ? `${latestMoisture}%` : '—'}
            </p>
            <p className="text-[11px] text-emerald-700/60 font-medium mt-1 truncate">
              {telemetryPoints.length > 0
                ? `${t.latestReading || 'Latest observation'}`
                : t.noSensorReading || 'No telemetry recorded'}
            </p>
          </div>

          {/* Temperature */}
          <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50">
            <div className="flex items-center justify-between text-emerald-700 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/60">
                {t.airTemperature || 'Temperature'}
              </span>
              <Thermometer className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-950">
              {latestTemp !== null ? `${latestTemp}°C` : '—'}
            </p>
            <p className="text-[11px] text-emerald-700/60 font-medium mt-1 truncate">
              {latestTemp !== null ? (t.ambientReading || 'Ambient telemetry') : (t.noReading || 'No reading')}
            </p>
          </div>

          {/* Humidity */}
          <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50">
            <div className="flex items-center justify-between text-emerald-700 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/60">
                {t.airHumidity || 'Humidity'}
              </span>
              <Wind className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-950">
              {latestHumidity !== null ? `${latestHumidity}%` : '—'}
            </p>
            <p className="text-[11px] text-emerald-700/60 font-medium mt-1 truncate">
              {latestHumidity !== null ? (t.relativeHumidity || 'Relative humidity') : (t.noReading || 'No reading')}
            </p>
          </div>

          {/* Telemetry Status */}
          <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-700 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/60">
                {t.telemetryStatus || 'Hardware'}
              </span>
              <Radio className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              {telemetryStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ESP32 Hardware</span>
                </span>
              ) : isSimulated ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Simulated Probes</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Offline / Standby</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1.5 truncate">
              {telemetryPoints.length} snapshots saved
            </p>
          </div>
        </div>
      </div>

      {/* ── B. SOIL MOISTURE TREND (One simple responsive line chart) ── */}
      <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base text-emerald-950 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-emerald-700" />
              <span>{t.soilMoistureTrendTitle || 'Soil Moisture Trend'}</span>
            </h3>
            <p className="text-xs text-emerald-700/60 font-medium mt-0.5">
              {telemetryPoints.length} {t.actualRecordedReadings || 'actual recorded readings from local storage'}
            </p>
          </div>

          <span className="self-start sm:self-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/70">
            {t.noSyntheticInterpolation || 'No synthetic data'}
          </span>
        </div>

        <SimpleSoilMoistureChart points={telemetryPoints} t={t} />
      </div>

      {/* ── C. RECENT DIAGNOSIS (What has AGRIO detected?) ──────── */}
      <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-3xl shadow-neumorphic border border-emerald-100/80 ring-1 ring-inset ring-white/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base text-emerald-950 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-700" />
              <span>{t.recentAiFindings || 'Recent AI Diagnosis Findings'}</span>
            </h3>
            <p className="text-xs text-emerald-700/60 font-medium mt-0.5">
              {diagnosisCounts.total} {t.totalLeafScansRecorded || 'leaf scans recorded on this device'}
            </p>
          </div>
        </div>

        {diagnosisCounts.total === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl bg-emerald-50/40 border border-dashed border-emerald-200/70">
            <Leaf className="w-8 h-8 text-emerald-600/50 mx-auto mb-2" />
            <h4 className="font-extrabold text-sm text-emerald-950">
              {t.noDiagnosisHistoryYet || 'No diagnosis history yet'}
            </h4>
            <p className="text-xs text-emerald-700/70 mt-1 max-w-sm mx-auto leading-relaxed">
              {t.performLeafScanPrompt || 'Perform leaf scans in the AI Crop Scanner to record observed crop conditions.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Healthy */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-1.5 text-emerald-800 text-[11px] font-bold uppercase mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.obsHealthy || 'Healthy'}</span>
              </div>
              <p className="text-2xl font-black text-emerald-950">
                {diagnosisCounts.healthy}
              </p>
            </div>

            {/* Disease */}
            <div className="p-3.5 bg-red-50/70 border border-red-200/80 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-1.5 text-red-800 text-[11px] font-bold uppercase mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                <span>{t.obsDisease || 'Disease'}</span>
              </div>
              <p className="text-2xl font-black text-red-950">
                {diagnosisCounts.disease}
              </p>
            </div>

            {/* Pest */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-bold uppercase mb-1">
                <Bug className="w-3.5 h-3.5 text-amber-600" />
                <span>{t.obsPest || 'Pest'}</span>
              </div>
              <p className="text-2xl font-black text-amber-950">
                {diagnosisCounts.pest}
              </p>
            </div>

            {/* Nutrient */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-1.5 text-blue-800 text-[11px] font-bold uppercase mb-1">
                <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.obsNutrient || 'Nutrient'}</span>
              </div>
              <p className="text-2xl font-black text-blue-950">
                {diagnosisCounts.nutrient}
              </p>
            </div>

            {/* Unknown / Abstained */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-bold uppercase mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.obsUnknown || 'Unknown'}</span>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {diagnosisCounts.unknown}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── D. DATA COVERAGE & TRANSPARENCY NOTE ─────────────────── */}
      <div className="bg-slate-50/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/80 ring-1 ring-inset ring-white/50 flex items-start gap-3 text-slate-700 shadow-2xs">
        <Database className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-extrabold text-slate-900 block mb-0.5">
            {t.localDataIntegrityTitle || 'Data Integrity & Privacy'}
          </span>
          <p className="text-slate-600">
            {t.localDataIntegrityBody || 'Historical records are stored locally in your browser (IndexedDB). AGRIO never fabricates missing telemetry, weather forecasts, or crop health trends. No remote telemetry database is queried.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
