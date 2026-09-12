/**
 * AGRIO Telemetry Schema
 * ──────────────────────
 * Canonical single-zone telemetry shape representing:
 *  - ONE active farm
 *  - ONE field / zone
 *  - ONE ESP32 / PCB node
 *
 * All hardware transport adapters (Simulated, HTTP polling, WebSocket, BLE stub, USB)
 * normalize incoming payloads through this canonical contract.
 *
 * DATA HONESTY:
 * Soil moisture represents a single field reading. Missing or disconnected sensor
 * data is normalized as `current: null` (never 0%). 0% is a valid physical measurement.
 *
 * VALVE SCOPE:
 * Valve control is NOT part of the current MVP (AGRIO advises, farmer acts).
 * The legacy `valves` structure is preserved internally solely for backward compatibility.
 */

// ── Standard single-zone telemetry snapshot shape ────────────────────────────
/**
 * @typedef {Object} TelemetrySnapshot
 * @property {string}       farmId
 * @property {string}       timestamp      – ISO-8601
 * @property {Object}       soilMoisture   – { current: number | null, zoneA?: number | null, value?: number | null }
 * @property {Object}       waterLevel     – { current: number, capacity: number }
 * @property {Object}       weather        – { temperature, humidity, windSpeed, uvIndex, pressure }
 * @property {Object}       valves         – { active: bool, zoneA?: bool } (internal legacy compatibility only)
 * @property {string}       source         – 'simulated' | 'rest_poll' | 'websocket' | 'ble' | 'hardware' | 'hardware-test'
 */

/**
 * Create an empty / default snapshot so the UI never sees `undefined`.
 * Missing soil moisture defaults to `null` — NOT zero.
 */
export function createEmptySnapshot(farmId = '') {
  return {
    farmId,
    timestamp: new Date().toISOString(),
    soilMoisture: {
      current: null, // Authoritative single-field reading (null = no sensor reading)
      zoneA: null,   // Legacy internal compatibility alias
      value: null,   // Legacy internal compatibility alias
    },
    waterLevel: { current: 0, capacity: 10000 },
    weather: { temperature: 0, humidity: 0, windSpeed: 0, uvIndex: 0, pressure: 1013 },
    valves: { active: false, zoneA: false }, // Internal legacy compatibility only
    source: 'simulated',
  };
}

// ── Key aliases: maps microcontroller & legacy naming to canonical keys ──
const SOIL_CURRENT_ALIASES = [
  'current',
  'moisture',
  'soil_moisture',
  'sm',
  'soil',
  'soilMoisture',
  'value',
  'val',
  'reading',
  'soil_m1',
  'zoneA',
  'zone_a',
  'zone1',
];

const WEATHER_ALIASES = {
  temperature: ['temperature', 'temp', 'temp_c', 'temperature_c', 'air_temp'],
  humidity: ['humidity', 'hum', 'humidity_pct', 'rh'],
  windSpeed: ['windSpeed', 'wind_speed', 'wind', 'wind_kph'],
  uvIndex: ['uvIndex', 'uv_index', 'uv', 'uvi'],
  pressure: ['pressure', 'atm_pressure', 'baro', 'pressure_hpa'],
};

const WATER_ALIASES = {
  current: ['current', 'level', 'water_level', 'tank_level', 'water_current'],
  capacity: ['capacity', 'max', 'tank_capacity', 'water_max'],
};

const VALVE_ALIASES = {
  active: ['active', 'state', 'valve', 'valve_1', 'v1', 'valve1', 'zoneA', 'zone_a'],
};

/**
 * Resolve a value from a raw object using a list of possible key names.
 * Returns the value of the first matching key, or fallback.
 */
function resolveAlias(raw, aliases, fallback = undefined) {
  if (!raw || typeof raw !== 'object') return fallback;
  for (const alias of aliases) {
    if (raw[alias] !== undefined && raw[alias] !== null) return raw[alias];
  }
  return fallback;
}

/**
 * Normalize a raw hardware payload into the canonical single-zone TelemetrySnapshot.
 *
 * @param {Object} raw      – the raw payload from any adapter (USB, BLE, HTTP, Simulated)
 * @param {string} farmId   – farm ID
 * @param {string} source   – adapter identifier ('simulated' | 'rest_poll' | 'websocket' | 'ble' | 'hardware' | 'hardware-test')
 * @returns {TelemetrySnapshot}
 */
export function normalizeTelemetry(raw, farmId = '', source = 'simulated') {
  if (!raw || typeof raw !== 'object') return createEmptySnapshot(farmId);

  // Extract soil moisture raw signal
  const rawSoil = raw.soilMoisture !== undefined ? raw.soilMoisture
    : raw.soil_moisture !== undefined ? raw.soil_moisture
    : raw.soil !== undefined ? raw.soil
    : raw.moisture !== undefined ? raw.moisture
    : raw;

  let moistureValue = null;
  if (typeof rawSoil === 'number') {
    moistureValue = clampPercentOrNull(rawSoil);
  } else if (rawSoil && typeof rawSoil === 'object') {
    const candidate = resolveAlias(rawSoil, SOIL_CURRENT_ALIASES);
    moistureValue = clampPercentOrNull(candidate);
  }

  const rawWeather = raw.weather || raw.env || raw;
  const rawWater = raw.waterLevel || raw.water_level || raw.water || raw.tank || raw;
  const rawValves = raw.valves || raw.valve || raw;

  const valveActive = toBool(resolveAlias(rawValves, VALVE_ALIASES.active, false));

  return {
    farmId: raw.farmId || raw.farm_id || farmId,
    timestamp: raw.timestamp || raw.ts || new Date().toISOString(),
    soilMoisture: {
      current: moistureValue,     // Authoritative single-field moisture (number or null)
      zoneA: moistureValue,       // Internal legacy compatibility
      value: moistureValue,       // Internal legacy compatibility
    },
    waterLevel: {
      current: Math.max(0, Number(resolveAlias(rawWater, WATER_ALIASES.current, 0)) || 0),
      capacity: Math.max(1, Number(resolveAlias(rawWater, WATER_ALIASES.capacity, 10000)) || 10000),
    },
    weather: {
      temperature: Number(resolveAlias(rawWeather, WEATHER_ALIASES.temperature, 0)) || 0,
      humidity: clampPercentOrZero(resolveAlias(rawWeather, WEATHER_ALIASES.humidity, 0)),
      windSpeed: Math.max(0, Number(resolveAlias(rawWeather, WEATHER_ALIASES.windSpeed, 0)) || 0),
      uvIndex: Math.max(0, Number(resolveAlias(rawWeather, WEATHER_ALIASES.uvIndex, 0)) || 0),
      pressure: Number(resolveAlias(rawWeather, WEATHER_ALIASES.pressure, 1013)) || 1013,
    },
    valves: {
      active: valveActive, // Internal legacy compatibility only
      zoneA: valveActive,  // Internal legacy compatibility only
    },
    source,
  };
}

/**
 * Quick validation: returns true if snapshot looks structurally correct.
 * Accepts `soilMoisture.current` as either a number (0-100) or `null` (missing reading).
 */
export function isValidSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (typeof snapshot.timestamp !== 'string') return false;
  if (!snapshot.soilMoisture) return false;
  const val = snapshot.soilMoisture.current !== undefined ? snapshot.soilMoisture.current : snapshot.soilMoisture.zoneA;
  if (val !== null && typeof val !== 'number') return false;
  if (val !== null && (val < 0 || val > 100 || Number.isNaN(val))) return false;
  if (!snapshot.waterLevel || typeof snapshot.waterLevel.current !== 'number') return false;
  if (!snapshot.weather || typeof snapshot.weather.temperature !== 'number') return false;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────
/**
 * Normalizes a percentage, or returns null if missing / unparseable.
 * Ensures 0 is preserved as 0, but null/undefined/NaN stays null.
 */
function clampPercentOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function clampPercentOrZero(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'on';
  return false;
}
