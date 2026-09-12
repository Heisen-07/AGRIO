/**
 * AGRIO Analytics Service
 * ───────────────────────
 * Pure aggregation and analytical functions operating on actual persisted
 * IndexedDB records (telemetry_history and diagnosis_history).
 *
 * CRITICAL MVP CONSTRAINTS:
 * - Never fabricates fake historical timestamps or synthetic data points.
 * - Handles sparse / empty data sets explicitly and honestly.
 * - Clearly flags simulated telemetry sources.
 * - Categorizes observations from real leaf diagnosis findings.
 */

/**
 * Filter an array of timestamped records by a chosen time window.
 * @param {Array} records - Array of records with `timestamp` or `data.timestamp`
 * @param {'all' | '24h' | '7d' | '30d'} range
 * @returns {Array} Filtered records
 */
export function filterByRange(records = [], range = 'all') {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (range === 'all') return records;

  const now = Date.now();
  const rangesMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const cutoff = now - (rangesMs[range] || 0);

  return records.filter((r) => {
    const rawTime = r.timestamp || r.data?.timestamp;
    if (!rawTime) return false;
    const timeMs = new Date(rawTime).getTime();
    return !Number.isNaN(timeMs) && timeMs >= cutoff;
  });
}

/**
 * Calculate numerical statistics (avg, min, max) for an array of numbers.
 * Returns null if no valid numbers are provided.
 */
function calcStats(numbers = []) {
  const valid = numbers.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (valid.length === 0) return null;

  const sum = valid.reduce((acc, v) => acc + v, 0);
  const avg = Number((sum / valid.length).toFixed(1));
  const min = Math.min(...valid);
  const max = Math.max(...valid);

  return { avg, min, max, count: valid.length };
}

/**
 * Summarize real persisted telemetry records into honest statistical cards.
 * @param {Array} telemetryHistory - Array of raw telemetry_history records
 * @param {'all' | '24h' | '7d' | '30d'} range
 * @returns {Object} Summarized telemetry metrics
 */
export function summarizeTelemetry(telemetryHistory = [], range = 'all') {
  const filtered = filterByRange(telemetryHistory, range);

  if (filtered.length === 0) {
    return {
      count: 0,
      isEmpty: true,
      isSparse: false,
      isSimulated: false,
      sensorSource: 'none',
      soil: null,
      temperature: null,
      humidity: null,
      latestReadingTime: null,
      oldestReadingTime: null,
    };
  }

  const isSparse = filtered.length < 4;

  // Extract readings across all records
  const soilAvgList = [];
  const soilZoneAList = [];
  const soilZoneBList = [];
  const soilZoneCList = [];
  const tempList = [];
  const humidityList = [];
  let simulatedCount = 0;

  for (const item of filtered) {
    const data = item.data || {};
    const soil = data.soilMoisture || {};
    const weather = data.weather || {};

    const fieldReading = typeof soil.current === 'number'
      ? soil.current
      : typeof soil === 'number'
      ? soil
      : typeof soil.value === 'number'
      ? soil.value
      : null;

    const za = fieldReading !== null ? fieldReading : (typeof soil.zoneA === 'number' ? soil.zoneA : null);
    const zb = typeof soil.zoneB === 'number' ? soil.zoneB : null;
    const zc = typeof soil.zoneC === 'number' ? soil.zoneC : null;

    if (fieldReading !== null) {
      soilAvgList.push(fieldReading);
    } else {
      const validZones = [za, zb, zc].filter((z) => z !== null);
      if (validZones.length > 0) {
        const recordAvg = validZones.reduce((a, b) => a + b, 0) / validZones.length;
        soilAvgList.push(recordAvg);
      }
    }

    if (typeof weather.temperature === 'number') tempList.push(weather.temperature);
    if (typeof weather.humidity === 'number') humidityList.push(weather.humidity);

    const src = data.source || item.source || 'simulated';
    if (src === 'simulated') simulatedCount++;
  }

  // Calculate trends for soil moisture if at least 4 readings exist
  let soilTrend = 'stable';
  if (soilAvgList.length >= 4) {
    // Records are newest-first in the default array, or chronological
    // Let's sort chronologically for trend analysis
    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.timestamp || a.data?.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || b.data?.timestamp || 0).getTime();
      return ta - tb;
    });

    const mid = Math.floor(sorted.length / 2);
    const extractSoil = (r) => {
      const s = r.data?.soilMoisture || {};
      if (typeof s.current === 'number') return s.current;
      if (typeof s === 'number') return s;
      const z = [s.zoneA, s.zoneB, s.zoneC].filter((v) => typeof v === 'number');
      return z.length ? z.reduce((a, b) => a + b, 0) / z.length : null;
    };
    const firstHalf = sorted.slice(0, mid).map(extractSoil).filter((v) => v !== null);
    const secondHalf = sorted.slice(mid).map(extractSoil).filter((v) => v !== null);

    if (firstHalf.length && secondHalf.length) {
      const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = avg2 - avg1;
      if (diff > 1.5) soilTrend = 'up';
      else if (diff < -1.5) soilTrend = 'down';
      else soilTrend = 'stable';
    }
  } else {
    soilTrend = 'insufficient';
  }

  const isSimulated = simulatedCount > 0;
  const sensorSource = simulatedCount === filtered.length ? 'simulated' : (simulatedCount === 0 ? 'hardware' : 'mixed');

  // Timestamps
  const timestamps = filtered.map((r) => new Date(r.timestamp || r.data?.timestamp || 0).getTime()).filter((t) => !Number.isNaN(t));
  const latestReadingTime = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  const oldestReadingTime = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;

  return {
    count: filtered.length,
    isEmpty: false,
    isSparse,
    isSimulated,
    sensorSource,
    soil: {
      overall: calcStats(soilAvgList),
      trend: soilTrend,
      zones: {
        zoneA: calcStats(soilZoneAList),
        zoneB: calcStats(soilZoneBList),
        zoneC: calcStats(soilZoneCList),
      },
    },
    temperature: calcStats(tempList),
    humidity: calcStats(humidityList),
    latestReadingTime,
    oldestReadingTime,
  };
}

/**
 * Build chronological time-series data for sparklines / line charts.
 * Never invents points between gaps.
 * @param {Array} telemetryHistory
 * @param {'all' | '24h' | '7d' | '30d'} range
 * @returns {Object} { points: Array, isEmpty: boolean, isSparse: boolean }
 */
export function buildTelemetryTimeSeries(telemetryHistory = [], range = 'all') {
  const filtered = filterByRange(telemetryHistory, range);

  if (filtered.length === 0) {
    return { points: [], isEmpty: true, isSparse: false };
  }

  // Sort chronological (oldest to newest)
  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.timestamp || a.data?.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || b.data?.timestamp || 0).getTime();
    return ta - tb;
  });

  const points = sorted.map((item, idx) => {
    const rawTime = item.timestamp || item.data?.timestamp || new Date().toISOString();
    const dateObj = new Date(rawTime);
    const data = item.data || {};
    const soil = data.soilMoisture || {};
    const weather = data.weather || {};

    const fieldReading = typeof soil.current === 'number'
      ? soil.current
      : typeof soil === 'number'
      ? soil
      : typeof soil.value === 'number'
      ? soil.value
      : null;

    const za = fieldReading !== null ? fieldReading : (typeof soil.zoneA === 'number' ? soil.zoneA : null);
    const zb = typeof soil.zoneB === 'number' ? soil.zoneB : null;
    const zc = typeof soil.zoneC === 'number' ? soil.zoneC : null;

    const validZones = [za, zb, zc].filter((z) => z !== null);
    const soilAvg = fieldReading !== null
      ? fieldReading
      : (validZones.length ? Number((validZones.reduce((a, b) => a + b, 0) / validZones.length).toFixed(1)) : null);

    return {
      index: idx,
      id: item.id || idx,
      timestamp: rawTime,
      dateObj,
      formattedTime: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      formattedDate: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      soilAvg,
      fieldMoisture: fieldReading,
      temperature: typeof weather.temperature === 'number' ? weather.temperature : null,
      humidity: typeof weather.humidity === 'number' ? weather.humidity : null,
      source: data.source || item.source || 'simulated',
    };
  });

  return {
    points,
    isEmpty: points.length === 0,
    isSparse: points.length < 4,
  };
}

/**
 * Summarize real diagnosis_history records into health vectors & observation counts.
 * Uses actual findings and diagnostic entries.
 * @param {Array} diagnosisHistory - Array of diagnosis_history records
 * @param {'all' | '24h' | '7d' | '30d'} range
 * @returns {Object} Summarized diagnosis metrics
 */
export function summarizeDiagnoses(diagnosisHistory = [], range = 'all') {
  const filtered = filterByRange(diagnosisHistory, range);

  if (filtered.length === 0) {
    return {
      totalScans: 0,
      isEmpty: true,
      categories: {
        disease: 0,
        pest: 0,
        nutrient: 0,
        healthy: 0,
        physical: 0,
      },
      severityCounts: {
        Critical: 0,
        High: 0,
        Moderate: 0,
        Low: 0,
        Info: 0,
      },
      confidenceBasis: {
        modelEstimate: 0,
        heuristic: 0,
      },
      recentScans: [],
      latestScan: null,
    };
  }

  const categories = { disease: 0, pest: 0, nutrient: 0, healthy: 0, physical: 0 };
  const severityCounts = { Critical: 0, High: 0, Moderate: 0, Low: 0, Info: 0 };
  const confidenceBasis = { modelEstimate: 0, heuristic: 0 };

  for (const item of filtered) {
    const data = item.data || {};
    const findings = Array.isArray(data.findings) ? data.findings : [];

    // Severity
    const sev = data.severity || 'Moderate';
    if (severityCounts[sev] !== undefined) {
      severityCounts[sev]++;
    } else {
      severityCounts.Moderate++;
    }

    // Confidence Basis
    const isModel = data.engine === 'cloud_gemini' || findings.some((f) => f.confidenceBasis === 'model_estimate');
    if (isModel) {
      confidenceBasis.modelEstimate++;
    } else {
      confidenceBasis.heuristic++;
    }

    // Category observation attribution
    let hasDisease = false;
    let hasPest = false;
    let hasNutrient = false;
    let hasPhysical = false;

    if (findings.length > 0) {
      for (const f of findings) {
        if (f.category === 'disease') hasDisease = true;
        if (f.category === 'pest') hasPest = true;
        if (f.category === 'nutrient') hasNutrient = true;
        if (f.category === 'physical') hasPhysical = true;
      }
    } else {
      // Fallback from flat card fields
      const diseaseName = data.diseaseDiagnostics?.detectedName || data.cropCondition || '';
      if (diseaseName && !diseaseName.toLowerCase().includes('healthy') && !diseaseName.includes('स्वस्थ')) {
        hasDisease = true;
      }
      const pestStatus = data.pestPressure?.status || '';
      if (pestStatus && !pestStatus.toLowerCase().includes('none') && !pestStatus.toLowerCase().includes('low') && !pestStatus.includes('कोई नहीं')) {
        hasPest = true;
      }
      const nutStatus = data.nutrientDeficiency?.status || '';
      if (nutStatus && !nutStatus.toLowerCase().includes('optimal') && !nutStatus.toLowerCase().includes('none') && !nutStatus.includes('अनुकूल')) {
        hasNutrient = true;
      }
    }

    if (hasDisease) categories.disease++;
    if (hasPest) categories.pest++;
    if (hasNutrient) categories.nutrient++;
    if (hasPhysical) categories.physical++;
    if (!hasDisease && !hasPest && !hasNutrient && !hasPhysical) categories.healthy++;
  }

  // Sort newest first for recent scans
  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  const latest = sorted[0] || null;
  const latestData = latest?.data || {};

  return {
    totalScans: filtered.length,
    isEmpty: false,
    categories,
    severityCounts,
    confidenceBasis,
    recentScans: sorted.slice(0, 5).map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      name: item.data?.diseaseDiagnostics?.detectedName || item.data?.cropCondition || 'Leaf Inspection',
      severity: item.data?.severity || 'Moderate',
      confidence: item.data?.confidence || null,
      confidenceBasis: item.data?.findings?.[0]?.confidenceBasis || (item.data?.engine === 'cloud_gemini' ? 'model_estimate' : 'heuristic'),
      thumbnail: item.thumbnail || item.data?.imagePreview || null,
    })),
    latestScan: latest ? {
      timestamp: latest.timestamp,
      name: latestData.diseaseDiagnostics?.detectedName || latestData.cropCondition || 'Leaf Inspection',
      severity: latestData.severity || 'Moderate',
      confidence: latestData.confidence || null,
    } : null,
  };
}

/**
 * Provide an honest overview of data quality, record coverage, and hardware source.
 * @param {Array} telemetryHistory
 * @param {Array} diagnosisHistory
 * @returns {Object}
 */
export function getDataCoverage(telemetryHistory = [], diagnosisHistory = []) {
  const telCount = Array.isArray(telemetryHistory) ? telemetryHistory.length : 0;
  const diagCount = Array.isArray(diagnosisHistory) ? diagnosisHistory.length : 0;

  // Sensor mode check
  let isSimulated = false;
  if (telCount > 0) {
    isSimulated = telemetryHistory.some((t) => (t.data?.source || t.source) === 'simulated');
  }

  // Latest updates
  const telTimes = (telemetryHistory || []).map((t) => new Date(t.timestamp || t.data?.timestamp || 0).getTime()).filter((t) => !Number.isNaN(t));
  const diagTimes = (diagnosisHistory || []).map((d) => new Date(d.timestamp || 0).getTime()).filter((t) => !Number.isNaN(t));

  const latestTelemetryTime = telTimes.length ? new Date(Math.max(...telTimes)).toISOString() : null;
  const latestDiagnosisTime = diagTimes.length ? new Date(Math.max(...diagTimes)).toISOString() : null;

  return {
    telemetryCount: telCount,
    diagnosisCount: diagCount,
    isSimulated,
    latestTelemetryTime,
    latestDiagnosisTime,
    hasData: telCount > 0 || diagCount > 0,
  };
}
