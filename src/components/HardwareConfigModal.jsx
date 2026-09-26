import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Wifi, WifiOff, Radio, Activity, Bluetooth, Globe, Cpu,
  ChevronRight, Check, AlertCircle, Clock
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';

const MODES = [
  {
    id: 'simulated',
    label: 'Simulated Live Feed',
    desc: 'Realistic sensor simulation — single field reading',
    icon: Cpu,
    color: 'emerald',
    needsUrl: false,
  },
  {
    id: 'usb',
    label: 'Direct USB',
    desc: 'Hardware specification TBD in Phase 8B',
    icon: Radio,
    color: 'amber',
    needsUrl: false,
    disabled: true,
  },
  {
    id: 'ble',
    label: 'Bluetooth / BLE',
    desc: 'GATT specification TBD in Phase 8B',
    icon: Bluetooth,
    color: 'indigo',
    needsUrl: false,
    disabled: true,
  },
  {
    id: 'rest_poll',
    label: 'HTTP',
    desc: 'Online hardware endpoint TBD in Phase 8B',
    icon: Globe,
    color: 'blue',
    needsUrl: true,
    urlPlaceholder: '/api/telemetry',
    urlLabel: 'Telemetry Endpoint URL',
  },
];

const INTERVAL_OPTIONS = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
];

export default function HardwareConfigModal({ open, onClose }) {
  const { telemetryStatus, setTelemetrySource } = useFarm();
  const { lang } = useLanguage();

  const [selectedMode, setSelectedMode] = useState(telemetryStatus?.mode || 'simulated');
  const [url, setUrl] = useState('/api/telemetry');
  const [intervalMs, setIntervalMs] = useState(5000);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Sync state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMode(telemetryStatus?.mode || 'simulated');
      // Load saved config from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('agrio_telemetry_config') || '{}');
        setUrl(saved.url || '/api/telemetry');
        setIntervalMs(saved.intervalMs || 5000);
      } catch {
        /* noop */
      }
      setTestResult(null);
    }
  }, [open, telemetryStatus?.mode]);

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(null);

  const handleApply = async () => {
    const config = {};
    const mode = MODES.find(m => m.id === selectedMode);
    if (mode?.needsUrl) {
      config.url = url.trim() || (selectedMode === 'rest_poll' ? '/api/telemetry' : '');
      config.intervalMs = intervalMs;
    }

    setApplyError(null);

    // For rest_poll, probe hardware online status before applying
    if (selectedMode === 'rest_poll') {
      setApplying(true);
      const targetUrl = config.url || '/api/telemetry';
      try {
        const res = await fetch(targetUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.hwOnline === false) {
          // Hardware offline! Do NOT treat the connection as successful.
          setTelemetrySource(selectedMode, config);
          setApplyError(lang === 'hi'
            ? 'हार्डवेयर ऑफ़लाइन — ESP32 उपकरण ऑफ़लाइन है। कनेक्शन स्थापित नहीं हो सका।'
            : 'Hardware Offline — ESP32 device is offline. Connection could not be established.');
          setApplying(false);
          return;
        }
      } catch (err) {
        setTelemetrySource(selectedMode, config);
        setApplyError(lang === 'hi'
          ? `हार्डवेयर ऑफ़लाइन — कनेक्शन विफल: ${err.message}`
          : `Hardware Offline — Connection failed: ${err.message}`);
        setApplying(false);
        return;
      }
      setApplying(false);
    }

    setTelemetrySource(selectedMode, config);
    onClose();
  };

  const handleTestConnection = async () => {
    const targetUrl = url.trim() || (selectedMode === 'rest_poll' ? '/api/telemetry' : '');
    if (!targetUrl) {
      setTestResult({ ok: false, msg: lang === 'hi' ? 'कृपया पहले URL दर्ज करें' : 'Please enter a URL first' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      if (selectedMode === 'websocket') {
        // Quick WebSocket connectivity test
        await new Promise((resolve, reject) => {
          const ws = new WebSocket(url.trim());
          const timeout = setTimeout(() => { ws.close(); reject(new Error('Connection timed out (5s)')); }, 5000);
          ws.onopen = () => { clearTimeout(timeout); ws.close(); resolve(); };
          ws.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed')); };
        });
        setTestResult({ ok: true, msg: 'WebSocket connected successfully!' });
      } else {
        // HTTP test — also check hardware online status
        const res = await fetch(targetUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.hwOnline === false) {
          // Server reachable but ESP32 hardware is offline
          setTestResult({
            ok: false,
            msg: lang === 'hi'
              ? 'हार्डवेयर ऑफ़लाइन — सर्वर पहुँच योग्य है, लेकिन ESP32 उपकरण ऑफ़लाइन है।'
              : 'Hardware Offline — Server is reachable, but ESP32 device is offline.',
          });
        } else {
          const keys = Object.keys(data).slice(0, 5).join(', ');
          setTestResult({ ok: true, msg: `Connected! Response keys: ${keys}` });
        }
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (!open) return null;

  const activeModeConfig = MODES.find(m => m.id === selectedMode);
  const statusIcon = telemetryStatus?.connected ? Wifi : WifiOff;
  const statusColor = telemetryStatus?.connected ? 'text-emerald-500' : 'text-red-400';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-emerald-100/50 p-5 flex items-center justify-between rounded-t-3xl z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-emerald-950">Hardware Connection</h3>
                <p className="text-[10px] text-emerald-700/50 font-medium uppercase tracking-wider">
                  Telemetry Source Configuration
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Current Status Banner */}
            <div className={`flex items-center gap-3 p-3 rounded-2xl ${telemetryStatus?.hardwareOffline ? 'bg-red-50/60' : 'bg-emerald-50/60'}`}>
              {React.createElement(statusIcon, { className: `w-5 h-5 ${statusColor} shrink-0` })}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-950">
                  {telemetryStatus?.hardwareOffline
                    ? (lang === 'hi' ? 'हार्डवेयर ऑफ़लाइन' : 'Hardware Offline')
                    : telemetryStatus?.connected ? 'Connected' : 'Disconnected'}
                  {' · '}
                  <span className="text-emerald-700/60 font-medium capitalize">
                    {telemetryStatus?.hardwareOffline
                      ? (lang === 'hi' ? 'सिम्युलेटेड फ़ॉलबैक' : 'Simulated Fallback')
                      : telemetryStatus?.mode?.replace('_', ' ')}
                  </span>
                </p>
                {telemetryStatus?.error && (
                  <p className="text-[10px] text-red-600 mt-0.5 truncate">{telemetryStatus.error}</p>
                )}
                {telemetryStatus?.lastPing && (
                  <p className="text-[10px] text-emerald-600/40 mt-0.5">
                    Last ping: {new Date(telemetryStatus.lastPing).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <Activity className={`w-4 h-4 shrink-0 ${telemetryStatus?.hardwareOffline ? 'text-red-400' : 'text-emerald-400 animate-pulse'}`} />
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider">
                Select Data Source
              </p>
              {MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = selectedMode === mode.id;
                const colorMap = {
                  emerald: 'border-emerald-400 bg-emerald-50/60',
                  amber: 'border-amber-400 bg-amber-50/60',
                  blue: 'border-blue-400 bg-blue-50/60',
                  violet: 'border-violet-400 bg-violet-50/60',
                  indigo: 'border-indigo-300 bg-indigo-50/40',
                };
                const iconColorMap = {
                  emerald: 'bg-emerald-100 text-emerald-700',
                  amber: 'bg-amber-100 text-amber-700',
                  blue: 'bg-blue-100 text-blue-700',
                  violet: 'bg-violet-100 text-violet-700',
                  indigo: 'bg-indigo-100 text-indigo-400',
                };

                return (
                  <button
                    key={mode.id}
                    onClick={() => !mode.disabled && setSelectedMode(mode.id)}
                    disabled={mode.disabled}
                    className={`w-full p-3 rounded-2xl border-2 flex items-center gap-3 transition-all text-left ${mode.disabled
                      ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50/30'
                      : isSelected
                        ? colorMap[mode.color]
                        : 'border-transparent bg-emerald-50/30 hover:bg-emerald-50/50'
                      }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColorMap[mode.color]}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-950">{mode.label}</p>
                      <p className="text-[10px] text-emerald-700/50 font-medium">{mode.desc}</p>
                    </div>
                    {isSelected && !mode.disabled && (
                      <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    {mode.disabled && (
                      <span className="text-[9px] font-bold text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                        SOON
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* URL Input (for rest_poll and websocket) */}
            {activeModeConfig?.needsUrl && (
              <div className="space-y-3 p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100/50">
                <label className="block">
                  <span className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider block mb-1.5">
                    {activeModeConfig.urlLabel}
                  </span>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={activeModeConfig.urlPlaceholder}
                    className="w-full px-3 py-2.5 bg-white rounded-xl text-sm font-mono text-emerald-950 border border-emerald-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 placeholder:text-emerald-400/40"
                  />
                </label>

                {/* Polling Interval (for rest_poll) */}
                {selectedMode === 'rest_poll' && (
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Polling Interval
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {INTERVAL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setIntervalMs(opt.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${intervalMs === opt.value
                            ? 'bg-emerald-700 text-white shadow-sm'
                            : 'bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Connection Button */}
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !url.trim()}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${testing || !url.trim()
                    ? 'bg-emerald-100 text-emerald-400 cursor-not-allowed'
                    : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60 active:scale-[0.98]'
                    }`}
                >
                  {testing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                {/* Test Result */}
                {testResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-2 ${testResult.ok
                    ? 'bg-emerald-100/80 text-emerald-800'
                    : 'bg-red-100/80 text-red-800'
                    }`}>
                    {testResult.ok
                      ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      : <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    }
                    <span>{testResult.msg}</span>
                  </div>
                )}
              </div>
            )}

            {/* Apply Error Banner */}
            {applyError && (
              <div className="p-3 rounded-2xl text-xs font-medium flex items-start gap-2.5 bg-red-100/90 text-red-900 border border-red-200 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{lang === 'hi' ? 'हार्डवेयर ऑफ़लाइन' : 'Hardware Offline'}</p>
                  <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">{applyError}</p>
                </div>
              </div>
            )}

            {/* Apply Button */}
            <button
              onClick={handleApply}
              disabled={applying}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${
                applying
                  ? 'bg-emerald-800/80 text-white/80 cursor-wait'
                  : 'bg-emerald-800 hover:bg-emerald-900 text-white'
              }`}
            >
              {applying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{lang === 'hi' ? 'कनेक्ट हो रहा है...' : 'Connecting...'}</span>
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'लागू करें और कनेक्ट करें' : 'Apply & Connect'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
