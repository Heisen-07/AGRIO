/**
 * AGRIO Crop Profiles — minimal agronomic configuration model
 * ───────────────────────────────────────────────────────────
 * The advisoryService needs a little per-crop context that the sensor/weather
 * feeds cannot supply on their own: what soil-moisture band a crop wants, and
 * the rough temperature / humidity points at which stress or disease pressure
 * rises. That context lives here, deliberately small — only what the advisory
 * engine actually reads today (req: "only information we actually need now").
 *
 * ⚠️  DEMO / CONFIGURABLE DEFAULTS — NOT AGRONOMIST-CALIBRATED  ⚠️
 * ---------------------------------------------------------------------------
 * Every number below is a *reasonable placeholder* for a demo, not a validated
 * agronomic recommendation. Real deployments MUST:
 *   • have these ranges reviewed by an agronomist,
 *   • make them region- / soil- / season- / variety-specific, and
 *   • ideally let the farmer (or a backend) override them per field.
 * The `isDemoDefault: true` flag is carried through into the advisory output so
 * the UI can honestly label advice that rests on these placeholders. Growth
 * stage is NOT detected by the app yet, so it defaults to 'unknown' and is
 * treated as configurable rather than measured.
 *
 * Units are chosen to match the live feeds exactly, so no conversion is needed:
 *   • soilMoisture.* → percent (0–100), same scale as telemetry.soilMoisture.*
 *   • temperature.*  → °C, same scale as telemetry.weather.temperature / OWM
 *   • humidity.*     → percent RH, same scale as telemetry.weather.humidity / OWM
 */

/** Irrigation-relevant + stress thresholds shared shape (all DEMO defaults). */
export const DEFAULT_CROP_PROFILE = {
  cropKey: 'generic',
  cropName: 'Generic Crop',
  // Growth stage is not yet detected from imagery/telemetry — configurable only.
  growthStage: 'unknown',
  soilMoisture: {
    // Target band the crop is comfortable in (sensor %). Below targetMin → dry.
    targetMin: 45,
    targetMax: 65,
    // Below this the crop is at real water-stress risk → irrigate regardless.
    criticalLow: 30,
  },
  temperature: {
    heatStress: 38, // °C — above this, water demand climbs / heat stress risk
    coldStress: 5, // °C — below this, cold stress risk
  },
  humidity: {
    // Sustained RH above this raises fungal disease pressure (advisory note only).
    fungalRiskHigh: 80,
  },
  isDemoDefault: true,
};

/**
 * Per-crop overrides. Keys are normalized crop slugs (see normalizeCropKey).
 * Only fields that differ from DEFAULT_CROP_PROFILE need to be listed; they are
 * shallow-merged over the default. Still DEMO values.
 */
const CROP_OVERRIDES = {
  wheat: {
    cropName: 'Wheat',
    soilMoisture: { targetMin: 40, targetMax: 60, criticalLow: 28 },
    temperature: { heatStress: 35, coldStress: 3 },
    humidity: { fungalRiskHigh: 85 },
  },
  mustard: {
    cropName: 'Mustard',
    soilMoisture: { targetMin: 40, targetMax: 55, criticalLow: 28 },
    temperature: { heatStress: 34, coldStress: 2 },
    humidity: { fungalRiskHigh: 85 },
  },
  rice: {
    cropName: 'Rice (Paddy)',
    // Paddy is grown flooded — sensors read very high; "dry" happens much higher.
    soilMoisture: { targetMin: 75, targetMax: 95, criticalLow: 60 },
    temperature: { heatStress: 38, coldStress: 10 },
    humidity: { fungalRiskHigh: 88 },
  },
  citrus: {
    cropName: 'Citrus',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 35 },
    temperature: { heatStress: 40, coldStress: 2 },
    humidity: { fungalRiskHigh: 80 },
  },
  // ── CropGuard-supported crops (demo agronomic thresholds) ─────────────────
  apple: {
    cropName: 'Apple',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 35 },
    temperature: { heatStress: 35, coldStress: -2 },
    humidity: { fungalRiskHigh: 80 },
  },
  tomato: {
    cropName: 'Tomato',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 30 },
    temperature: { heatStress: 38, coldStress: 5 },
    humidity: { fungalRiskHigh: 80 },
  },
  potato: {
    cropName: 'Potato',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 35 },
    temperature: { heatStress: 30, coldStress: 2 },
    humidity: { fungalRiskHigh: 85 },
  },
  grape: {
    cropName: 'Grape',
    soilMoisture: { targetMin: 45, targetMax: 65, criticalLow: 30 },
    temperature: { heatStress: 38, coldStress: -1 },
    humidity: { fungalRiskHigh: 75 },
  },
  corn: {
    cropName: 'Corn (Maize)',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 35 },
    temperature: { heatStress: 38, coldStress: 8 },
    humidity: { fungalRiskHigh: 85 },
  },
  pepper: {
    cropName: 'Bell Pepper',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 30 },
    temperature: { heatStress: 35, coldStress: 8 },
    humidity: { fungalRiskHigh: 80 },
  },
  strawberry: {
    cropName: 'Strawberry',
    soilMoisture: { targetMin: 55, targetMax: 75, criticalLow: 35 },
    temperature: { heatStress: 30, coldStress: -2 },
    humidity: { fungalRiskHigh: 80 },
  },
  peach: {
    cropName: 'Peach',
    soilMoisture: { targetMin: 45, targetMax: 65, criticalLow: 30 },
    temperature: { heatStress: 38, coldStress: -3 },
    humidity: { fungalRiskHigh: 80 },
  },
  cherry: {
    cropName: 'Cherry',
    soilMoisture: { targetMin: 45, targetMax: 65, criticalLow: 30 },
    temperature: { heatStress: 35, coldStress: -5 },
    humidity: { fungalRiskHigh: 80 },
  },
  soybean: {
    cropName: 'Soybean',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 30 },
    temperature: { heatStress: 38, coldStress: 5 },
    humidity: { fungalRiskHigh: 85 },
  },
  squash: {
    cropName: 'Squash',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 30 },
    temperature: { heatStress: 38, coldStress: 8 },
    humidity: { fungalRiskHigh: 80 },
  },
  blueberry: {
    cropName: 'Blueberry',
    soilMoisture: { targetMin: 55, targetMax: 75, criticalLow: 35 },
    temperature: { heatStress: 32, coldStress: -5 },
    humidity: { fungalRiskHigh: 80 },
  },
  raspberry: {
    cropName: 'Raspberry',
    soilMoisture: { targetMin: 50, targetMax: 70, criticalLow: 30 },
    temperature: { heatStress: 32, coldStress: -5 },
    humidity: { fungalRiskHigh: 80 },
  },
};

/**
 * Normalize a display crop name into a profile key.
 * Handles emoji-suffixed names ('Wheat 🌾'), casing, and common synonyms.
 * Recognizes all 14 CropGuard-supported crops plus existing AGRIO crops.
 */
export function normalizeCropKey(cropName = '') {
  const slug = String(cropName)
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // strip emoji, spaces, punctuation → letters only
  if (!slug) return 'generic';
  if (slug.includes('paddy') || slug.includes('rice')) return 'rice';
  if (slug.includes('wheat')) return 'wheat';
  if (slug.includes('mustard')) return 'mustard';
  if (slug.includes('citrus') || slug.includes('orange') || slug.includes('lemon')) return 'citrus';
  if (slug.includes('tomato')) return 'tomato';
  if (slug.includes('potato')) return 'potato';
  if (slug.includes('apple')) return 'apple';
  if (slug.includes('grape')) return 'grape';
  if (slug.includes('corn') || slug.includes('maize')) return 'corn';
  if (slug.includes('pepper') || slug.includes('capsicum') || slug.includes('bellpepper') || slug.includes('shimla')) return 'pepper';
  if (slug.includes('strawberry')) return 'strawberry';
  if (slug.includes('peach')) return 'peach';
  if (slug.includes('cherry')) return 'cherry';
  if (slug.includes('soybean') || slug.includes('soya')) return 'soybean';
  if (slug.includes('squash') || slug.includes('pumpkin')) return 'squash';
  if (slug.includes('blueberry')) return 'blueberry';
  if (slug.includes('raspberry')) return 'raspberry';
  return CROP_OVERRIDES[slug] ? slug : 'generic';
}

/** Deep-ish merge for the small, fixed profile shape (two levels only). */
function mergeProfile(base, override) {
  if (!override) return { ...base };
  return {
    ...base,
    ...override,
    soilMoisture: { ...base.soilMoisture, ...(override.soilMoisture || {}) },
    temperature: { ...base.temperature, ...(override.temperature || {}) },
    humidity: { ...base.humidity, ...(override.humidity || {}) },
  };
}

/**
 * Resolve a crop profile from a display crop name.
 * Always returns a complete profile (falls back to the generic default),
 * and always keeps `isDemoDefault: true` so downstream advice is labelled honestly.
 *
 * @param {string} [cropName]  e.g. 'Wheat 🌾', 'Rice', 'citrus'
 * @param {Object} [overrides] optional caller/field-level overrides (e.g. growthStage)
 * @returns {typeof DEFAULT_CROP_PROFILE}
 */
export function getCropProfile(cropName, overrides = null) {
  const cropKey = normalizeCropKey(cropName);
  const merged = mergeProfile(DEFAULT_CROP_PROFILE, CROP_OVERRIDES[cropKey]);
  merged.cropKey = cropKey;
  if (cropKey === 'generic' && cropName) {
    // Keep the farmer's label even when we only have generic thresholds.
    merged.cropName = String(cropName).replace(/[^\p{L}\s]/gu, '').trim() || 'Generic Crop';
  }
  return mergeProfile(merged, overrides);
}

export default getCropProfile;
