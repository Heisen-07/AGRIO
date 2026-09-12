/**
 * AGRIO Hardware-Test Fixtures (Phase 8A Software-Readiness)
 * ─────────────────────────────────────────────────────────
 * Synthetic test fixtures simulating edge cases, missing data, and transport
 * payloads. All fixtures are explicitly labeled with `source: 'hardware-test'`.
 *
 * NOTE: Physical ESP32/PCB integration is NOT complete because the hardware is
 * not yet available. These fixtures are for software testing only.
 */

import { normalizeTelemetry } from './telemetrySchema';

export const HARDWARE_TEST_FIXTURES = {
  /**
   * Fixture A: Valid single-field telemetry with nominal readings.
   */
  validSingleField: {
    farmId: 'farm_001',
    timestamp: new Date().toISOString(),
    soilMoisture: { current: 52 },
    weather: {
      temperature: 27.5,
      humidity: 62,
      windSpeed: 11,
      uvIndex: 5.4,
      pressure: 1012,
    },
    waterLevel: { current: 8000, capacity: 10000 },
    valves: { active: false },
    source: 'hardware-test',
  },

  /**
   * Fixture B: Missing soil moisture (sensor unplugged or disconnected).
   * Verifies data-honesty rule: `current: null`, NEVER 0%.
   */
  missingSoilMoisture: {
    farmId: 'farm_001',
    timestamp: new Date().toISOString(),
    soilMoisture: { current: null },
    weather: {
      temperature: 28.0,
      humidity: 60,
      windSpeed: 10,
      uvIndex: 5.0,
      pressure: 1013,
    },
    waterLevel: { current: 8000, capacity: 10000 },
    valves: { active: false },
    source: 'hardware-test',
  },

  /**
   * Fixture C: Invalid soil moisture (out-of-range / NaN value).
   * Normalizer must reject or coerce to null.
   */
  invalidSoilMoisture: {
    farmId: 'farm_001',
    timestamp: new Date().toISOString(),
    soilMoisture: { current: 'sensor_error_code_99' },
    weather: {
      temperature: 28.0,
      humidity: 60,
      windSpeed: 10,
      uvIndex: 5.0,
      pressure: 1013,
    },
    waterLevel: { current: 8000, capacity: 10000 },
    valves: { active: false },
    source: 'hardware-test',
  },

  /**
   * Fixture D: Stale telemetry (timestamp > 2 hours old).
   */
  staleTelemetry: {
    farmId: 'farm_001',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    soilMoisture: { current: 48 },
    weather: {
      temperature: 24.0,
      humidity: 70,
      windSpeed: 8,
      uvIndex: 3.0,
      pressure: 1014,
    },
    waterLevel: { current: 7500, capacity: 10000 },
    valves: { active: false },
    source: 'hardware-test',
  },

  /**
   * Fixture E: Malformed HTTP raw payload.
   * Tests normalizer resilience against unexpected or partial JSON keys.
   */
  malformedHttpPayload: {
    sm_raw: 'corrupted',
    temp: 'NaN',
    rh: null,
    source: 'hardware-test',
  },

  /**
   * Fixture F: Synthetic BLE test payload.
   * Simulates future string-encoded JSON or raw object from Web Bluetooth.
   */
  bleTestPayload: {
    moisture: 58.4,
    temperature: 26.2,
    humidity: 65,
    source: 'hardware-test',
  },

  /**
   * Fixture G: Synthetic USB test payload.
   * Simulates future serial-delivered data packet.
   */
  usbTestPayload: {
    soil_m1: 61.2,
    air_temp: 29.1,
    rh: 55,
    source: 'hardware-test',
  },
};

/**
 * Helper to get a normalized snapshot for any test fixture.
 */
export function getNormalizedTestSnapshot(fixtureKey, farmId = 'farm_001') {
  const raw = HARDWARE_TEST_FIXTURES[fixtureKey];
  if (!raw) return null;
  return normalizeTelemetry(raw, farmId, 'hardware-test');
}

