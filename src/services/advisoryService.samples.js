/**
 * AGRIO Advisory Service — demo fixtures & sample outputs
 * ───────────────────────────────────────────────────────
 * Hypothetical, fully-deterministic inputs fed through generateAdvisory so the
 * normalized advisory shape can be INSPECTED before any UI is wired to it
 * (Phase-3 requirement 17), and reused later as test fixtures (requirement 16).
 *
 * Nothing here touches the app: no imports from React, no side effects. Import
 * `SAMPLE_ADVISORIES` (precomputed) or call `runSamples()` to regenerate.
 *
 * A FIXED clock (FIXED_NOW) is injected so every run is byte-stable — the same
 * inputs always yield the same advisory, which is the whole point of a pure
 * service.
 */

import { makeFinding, CATEGORY, CONFIDENCE_BASIS } from './visionSchema';
import { getCropProfile } from '../config/cropProfiles';
import { generateAdvisory } from './advisoryService';

// Frozen "now" for deterministic timestamps/ages.
const FIXED_NOW = Date.parse('2026-09-10T09:00:00.000Z');
const secAgo = (s) => FIXED_NOW - s * 1000;
const minAgo = (m) => FIXED_NOW - m * 60 * 1000;

// A minimal vision-result object in the exact shape the real engines emit
// (findings[] + overallStatus + engine/onDevice/timestamp). Hand-built with a
// fixed timestamp so the sample stays deterministic (assembleResult would stamp
// the real Date.now()).
function visionResult({ findings, code, timestamp }) {
  return {
    findings,
    overallStatus: { code, findingsCount: findings.filter((f) => f.category !== CATEGORY.HEALTHY && f.category !== CATEGORY.UNKNOWN).length },
    engine: 'on-device',
    onDevice: true,
    timestamp: new Date(timestamp).toISOString(),
  };
}

// ── Scenario A — Healthy crop ────────────────────────────────────
export const SCENARIO_A = {
  name: 'A · Healthy crop',
  input: {
    vision: visionResult({
      code: 'healthy',
      timestamp: secAgo(30),
      findings: [
        makeFinding({
          id: 'healthy',
          category: CATEGORY.HEALTHY,
          title: 'Healthy Leaf — No Disease Detected',
          severity: 'Info',
          confidence: 92,
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
        }),
      ],
    }),
    telemetry: {
      farmId: 'farm_001',
      timestamp: new Date(secAgo(15)).toISOString(),
      soilMoisture: { zoneA: 52, zoneB: 50, zoneC: 55 },
      waterLevel: { current: 8000, capacity: 10000 },
      weather: { temperature: 26, humidity: 60, windSpeed: 8, uvIndex: 5, pressure: 1012 },
      valves: { zoneA: false, zoneB: false, zoneC: false },
      source: 'simulated',
    },
    weather: {
      current: { temperature: 27, humidity: 58, condition: 'Clear', description: 'clear sky', timestamp: minAgo(5) },
      forecast: [{ dayKey: 'thu', pop: 10, rainChance: 'Low Rain' }],
      source: 'OpenWeatherMap',
      updatedAt: minAgo(5),
    },
    cropProfile: getCropProfile('Wheat 🌾'),
    zone: 'zoneA',
    lang: 'en',
    now: FIXED_NOW,
  },
};

// ── Scenario B — Disease + pest + nutrient symptoms ──────────────
export const SCENARIO_B = {
  name: 'B · Disease + pest + nutrient symptoms',
  input: {
    vision: visionResult({
      code: 'issues_found',
      timestamp: secAgo(60),
      findings: [
        makeFinding({
          id: 'disease-fungal',
          category: CATEGORY.DISEASE,
          title: 'Fungal Leaf Spot / Blight',
          severity: 'Moderate',
          confidence: 77,
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
          recommendations: ['Remove and destroy affected leaves.', 'Apply a recommended fungicide at the label rate.'],
          evidence: { lesionRatio: 0.15 },
        }),
        makeFinding({
          id: 'pest-damage',
          category: CATEGORY.PEST,
          title: 'Pest / Mechanical Leaf Damage',
          severity: 'High',
          confidence: 82,
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
          recommendations: ['Scout adjacent plants for pests.', 'Apply neem oil emulsion (5 ml/L) locally.'],
          evidence: { holeRatio: 0.1 },
        }),
        makeFinding({
          id: 'nutrient-chlorosis',
          category: CATEGORY.NUTRIENT,
          title: 'Interveinal chlorosis (possible N deficiency)',
          severity: 'Moderate',
          confidence: 70,
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
          recommendations: ['Consider a foliar nitrogen spray after confirmation.'],
          evidence: { yellowRatio: 0.2 },
        }),
      ],
    }),
    telemetry: {
      farmId: 'farm_001',
      timestamp: new Date(secAgo(30)).toISOString(),
      soilMoisture: { zoneA: 50, zoneB: 48, zoneC: 52 },
      waterLevel: { current: 7200, capacity: 10000 },
      weather: { temperature: 30, humidity: 88, windSpeed: 6, uvIndex: 7, pressure: 1009 },
      valves: { zoneA: false, zoneB: false, zoneC: false },
      source: 'websocket',
    },
    weather: {
      current: { temperature: 31, humidity: 80, condition: 'Clouds', description: 'overcast clouds', timestamp: minAgo(10) },
      forecast: [{ dayKey: 'thu', pop: 20, rainChance: '20% Rain' }],
      source: 'OpenWeatherMap',
      updatedAt: minAgo(10),
    },
    cropProfile: getCropProfile('Wheat 🌾'),
    zone: 'zoneA',
    lang: 'en',
    now: FIXED_NOW,
  },
};

// ── Scenario C — Low moisture + incoming rain → delay irrigation ─
export const SCENARIO_C = {
  name: 'C · Low moisture + incoming rain → delay irrigation',
  input: {
    vision: visionResult({
      code: 'healthy',
      timestamp: secAgo(45),
      findings: [
        makeFinding({
          id: 'healthy',
          category: CATEGORY.HEALTHY,
          title: 'Healthy Leaf',
          severity: 'Info',
          confidence: 90,
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
        }),
      ],
    }),
    telemetry: {
      farmId: 'farm_001',
      timestamp: new Date(secAgo(30)).toISOString(),
      soilMoisture: { zoneA: 34, zoneB: 38, zoneC: 41 },
      waterLevel: { current: 6000, capacity: 10000 },
      weather: { temperature: 24, humidity: 65, windSpeed: 10, uvIndex: 4, pressure: 1007 },
      valves: { zoneA: false, zoneB: false, zoneC: false },
      source: 'rest_poll',
    },
    weather: {
      current: { temperature: 25, humidity: 70, condition: 'Clouds', description: 'broken clouds', timestamp: minAgo(8) },
      forecast: [{ dayKey: 'thu', pop: 80, rainChance: '80% Rain', rainMm: 6.4, maxPop: 85 }],
      // Meaningful rain: measurable AMOUNT + timing + probability within the window.
      rainOutlook: { windowHours: 24, maxPop: 85, totalMm: 6.4, nextRainAt: FIXED_NOW + 6 * 60 * 60 * 1000, source: 'OpenWeatherMap' },
      source: 'OpenWeatherMap',
      updatedAt: minAgo(8),
    },
    cropProfile: getCropProfile('Wheat 🌾'),
    zone: 'zoneA',
    lang: 'en',
    now: FIXED_NOW,
  },
};

// ── Scenario D — No sensor + stale weather (insufficient-data path) ─
// Demonstrates requirements 11 & 12: no ESP32 ⇒ insufficient-data irrigation
// (never invented), stale weather ⇒ lowered reliability + explicit warning.
export const SCENARIO_D = {
  name: 'D · No sensor + stale weather',
  input: {
    vision: visionResult({
      code: 'issues_found',
      timestamp: secAgo(90),
      findings: [
        makeFinding({
          id: 'disease-rust',
          category: CATEGORY.DISEASE,
          title: 'Yellow Rust (possible)',
          severity: 'Moderate',
          confidence: null, // engine gave no number — never invented
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
          recommendations: ['Isolate and monitor; consult extension before spraying.'],
        }),
      ],
    }),
    telemetry: null, // ← no ESP32 connected
    weather: {
      current: { temperature: 33, humidity: 45, condition: 'Clear', description: 'clear sky', timestamp: minAgo(180) },
      forecast: [{ dayKey: 'thu', pop: 5, rainChance: 'Low Rain' }],
      source: 'OpenWeatherMap',
      updatedAt: minAgo(180), // 3h old ⇒ stale
    },
    cropProfile: getCropProfile('Rice'),
    zone: 'zoneA',
    lang: 'en',
    now: FIXED_NOW,
  },
};

// ── Scenario E — Low moisture + NO meaningful rain → irrigate now ─
// Same dry soil as C, but the forecast carries a real AMOUNT channel reading
// ≈0 mm — so the engine must NOT delay on a bare chance; it returns REQUIRED.
// (User's Phase-4 test: "low moisture + no rain".)
export const SCENARIO_E = {
  name: 'E · Low moisture + no rain → irrigate now',
  input: {
    vision: visionResult({
      code: 'healthy',
      timestamp: secAgo(45),
      findings: [
        makeFinding({
          id: 'healthy',
          category: CATEGORY.HEALTHY,
          title: 'Healthy Leaf',
          severity: 'Info',
          confidence: 90,
          confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
        }),
      ],
    }),
    telemetry: {
      farmId: 'farm_001',
      timestamp: new Date(secAgo(30)).toISOString(),
      soilMoisture: { zoneA: 33, zoneB: 37, zoneC: 40 },
      waterLevel: { current: 5200, capacity: 10000 },
      weather: { temperature: 29, humidity: 42, windSpeed: 12, uvIndex: 6, pressure: 1010 },
      valves: { zoneA: false, zoneB: false, zoneC: false },
      source: 'rest_poll',
    },
    weather: {
      current: { temperature: 30, humidity: 40, condition: 'Clear', description: 'clear sky', timestamp: minAgo(6) },
      forecast: [{ dayKey: 'thu', pop: 15, rainChance: 'Low Rain', rainMm: 0, maxPop: 15 }],
      // AMOUNT channel present and ≈0 mm ⇒ no meaningful rain ⇒ do not delay.
      rainOutlook: { windowHours: 24, maxPop: 15, totalMm: 0, nextRainAt: null, source: 'OpenWeatherMap' },
      source: 'OpenWeatherMap',
      updatedAt: minAgo(6),
    },
    cropProfile: getCropProfile('Wheat 🌾'),
    zone: 'zoneA',
    lang: 'en',
    now: FIXED_NOW,
  },
};

export const SCENARIOS = [SCENARIO_A, SCENARIO_B, SCENARIO_C, SCENARIO_D, SCENARIO_E];

/** Regenerate all sample advisories (pure — safe to call anywhere). */
export function runSamples() {
  return SCENARIOS.map(({ name, input }) => ({ name, advisory: generateAdvisory(input) }));
}

// Precomputed for convenient inspection / snapshotting.
export const SAMPLE_ADVISORIES = runSamples();

export default SAMPLE_ADVISORIES;
