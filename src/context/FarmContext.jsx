import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  saveTelemetrySnapshot,
  getTelemetryHistory as getStoredTelemetryHistory,
  saveDiagnosisRecord,
  getDiagnosisHistory as getStoredDiagnosisHistory,
} from '../services/storageService';
import telemetryManager from '../services/telemetry/telemetryManager';
import { fetchLiveWeather, subscribeWeather, detectBrowserLocation } from '../services/weatherService';

const FarmContext = createContext();

// ── Farm-profile persistence (MVP: ONE active farmer + ONE active crop) ──
// Stored client-side so the dashboard-entry setup survives reloads without a
// backend or authentication. This is the single source of truth for the
// farmer name + active crop consumed across the Dashboard and AI Scanner.
const FARM_PROFILE_KEY = 'agrio_farm_profile';

function loadFarmProfile() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FARM_PROFILE_KEY) : null;
    if (!raw) return { farmerName: '', crop: '' };
    const parsed = JSON.parse(raw);
    return {
      farmerName: typeof parsed?.farmerName === 'string' ? parsed.farmerName : '',
      crop: typeof parsed?.crop === 'string' ? parsed.crop : '',
    };
  } catch {
    return { farmerName: '', crop: '' };
  }
}

export function FarmProvider({ children }) {
  const [farms, setFarms] = useState([]);
  const [activeFarm, setActiveFarm] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryStatus, setTelemetryStatus] = useState({
    connected: false, mode: 'simulated', lastPing: null, error: null,
  });
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [diagnosisHistory, setDiagnosisHistory] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState(null);

  // ── Farm profile: ONE active farmer + ONE active crop (MVP, no auth) ──
  const [farmProfile, setFarmProfileState] = useState(loadFarmProfile);

  // Refs for cleanup
  const telemetryUnsubRef = useRef(null);
  const statusUnsubRef = useRef(null);
  const weatherUnsubRef = useRef(null);
  const snapshotCountRef = useRef(0);

  // Diagnosis History loader
  const refreshDiagnosisHistory = useCallback(async (farmId = 'demo_farm') => {
    try {
      const history = await getStoredDiagnosisHistory(farmId, 50);
      setDiagnosisHistory(history || []);
      return history || [];
    } catch {
      return [];
    }
  }, []);

  // ── Live Telemetry & Weather Streaming ────────────────────────
  useEffect(() => {
    telemetryUnsubRef.current?.();
    statusUnsubRef.current?.();
    weatherUnsubRef.current?.();

    const farmId = activeFarm?.id || 'demo_farm';

    weatherUnsubRef.current = subscribeWeather((w) => {
      setWeatherData(w);
    });
    fetchLiveWeather({
      city: activeFarm?.location || 'Ludhiana,IN',
    }).catch(() => {});

    telemetryManager.start({ farmId });

    snapshotCountRef.current = 0;
    telemetryUnsubRef.current = telemetryManager.subscribe((snapshot) => {
      setTelemetry(snapshot);
      snapshotCountRef.current++;
      if (snapshotCountRef.current % 12 === 0) {
        saveTelemetrySnapshot(farmId, snapshot).then(() => {
          getStoredTelemetryHistory(farmId, 100).then(setTelemetryHistory).catch(() => {});
        }).catch(() => {});
      }
    });

    statusUnsubRef.current = telemetryManager.subscribeStatus((status) => {
      setTelemetryStatus(status);
    });

    getStoredTelemetryHistory(farmId, 100).then(history => {
      setTelemetryHistory(history);
    }).catch(() => {});

    refreshDiagnosisHistory(farmId);

    return () => {
      telemetryUnsubRef.current?.();
      statusUnsubRef.current?.();
      weatherUnsubRef.current?.();
      telemetryManager.stop();
    };
  }, [activeFarm?.id, activeFarm?.location, refreshDiagnosisHistory]);

  // ── Farm CRUD (Local / MVP) ───────────────────────────────────
  const switchFarm = useCallback(async (farmId) => {
    const farm = farms.find(f => f.id === farmId) || null;
    setActiveFarm(farm);
  }, [farms]);

  const addFarm = useCallback(async (data) => {
    const newFarm = { id: `farm_${Date.now()}`, ...data };
    setFarms(prev => [...prev, newFarm]);
    if (!activeFarm) setActiveFarm(newFarm);
    return newFarm;
  }, [activeFarm]);

  const editFarm = useCallback(async (farmId, updates) => {
    setFarms(prev => prev.map(f => f.id === farmId ? { ...f, ...updates } : f));
    if (activeFarm?.id === farmId) {
      setActiveFarm(prev => ({ ...prev, ...updates }));
    }
  }, [activeFarm]);

  const removeFarm = useCallback(async (farmId) => {
    setFarms(prev => prev.filter(f => f.id !== farmId));
    if (activeFarm?.id === farmId) {
      setActiveFarm(null);
    }
  }, [activeFarm]);

  // ── Telemetry Controls ────────────────────────────────────────
  const fetchTelemetry = useCallback(async () => {
    return telemetry;
  }, [telemetry]);

  const setTelemetrySource = useCallback((mode, modeConfig = {}) => {
    telemetryManager.switchMode(mode, {
      ...modeConfig,
      farmId: activeFarm?.id,
    });
  }, [activeFarm?.id]);

  // ── Diagnosis ─────────────────────────────────────────────────
  const submitDiagnosis = useCallback(async (fieldId, record) => {
    const farmId = activeFarm?.id || 'demo_farm';
    const result = await saveDiagnosisRecord(farmId, record);
    await refreshDiagnosisHistory(farmId);
    return result;
  }, [activeFarm?.id, refreshDiagnosisHistory]);

  const fetchDiagnosisHistory = useCallback(async () => {
    const farmId = activeFarm?.id || 'demo_farm';
    return refreshDiagnosisHistory(farmId);
  }, [activeFarm?.id, refreshDiagnosisHistory]);

  // ── Location & Weather ────────────────────────────────────────
  const detectLocation = useCallback(async () => {
    setIsDetectingLocation(true);
    setLocationStatus('detecting');
    setLocationError(null);
    try {
      const coords = await detectBrowserLocation();
      const updated = await fetchLiveWeather({
        lat: coords.lat,
        lon: coords.lon,
        forceRefresh: true,
      });
      if (updated) {
        setWeatherData(updated);
      }
      setLocationStatus('available');
      return updated;
    } catch (err) {
      const msg = err?.message || 'Unable to retrieve location';
      if (msg.includes('permission denied') || msg.includes('Permission denied')) {
        setLocationStatus('denied');
      } else if (msg.includes('not supported')) {
        setLocationStatus('unsupported');
      } else {
        setLocationStatus('unavailable');
      }
      setLocationError(msg);
      return null;
    } finally {
      setIsDetectingLocation(false);
    }
  }, []);

  const isSetupComplete = Boolean(farmProfile.farmerName && farmProfile.crop);

  const saveFarmProfile = useCallback(({ farmerName, crop }) => {
    const next = {
      farmerName: String(farmerName || '').trim(),
      crop: String(crop || '').trim(),
    };
    setFarmProfileState(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FARM_PROFILE_KEY, JSON.stringify(next));
      }
    } catch {
      /* ignore storage quota */
    }
    return next;
  }, []);

  const value = {
    // Farm state
    farms,
    activeFarm,
    loading: false,
    error: null,
    // Farm profile
    farmerName: farmProfile.farmerName,
    activeCrop: farmProfile.crop,
    isSetupComplete,
    saveFarmProfile,
    // Farm CRUD
    switchFarm,
    addFarm,
    editFarm,
    removeFarm,
    // Live telemetry
    telemetry,
    telemetryStatus,
    telemetryHistory,
    fetchTelemetry,
    setTelemetrySource,
    // Diagnosis
    diagnosisHistory,
    submitDiagnosis,
    fetchDiagnosisHistory,
    // Live Weather
    weatherData,
    refreshWeather: fetchLiveWeather,
    detectLocation,
    isDetectingLocation,
    locationStatus,
    locationError,
  };

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
}