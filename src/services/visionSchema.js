/**
 * AGRIO Vision Result Schema — the shared structured shape returned by BOTH
 * crop-vision engines (the on-device edge CV engine and the Gemini cloud model).
 *
 * It layers an extensible `findings[]` model on TOP of the existing flat fields
 * the Dashboard / LeafDiagnosticCard already consume (disease, severity,
 * confidence, treatment_steps, nutrientDeficiency, pestPressure, advisory,
 * demoNotice, onDevice, engine). Those flat fields are passed through
 * UNCHANGED — this module only ADDS structure, so nothing downstream breaks.
 *
 * Honesty contract (matters — the edge engine is classical CV, not trained ML):
 *   • A finding's `confidenceBasis` states what its `confidence` number means:
 *       - 'heuristic'      → a classical-CV score derived from pixel ratios
 *                            (edge engine). NOT a calibrated ML probability.
 *       - 'model_estimate' → a model's own self-report (Gemini). Also NOT a
 *                            calibrated probability.
 *     `confidence` is `null` when the engine gave no number — we never invent one.
 *   • `evidence` (edge only) exposes the raw pixel ratios behind a heuristic
 *     finding, so the reasoning is auditable instead of a black box.
 *   • Poor / insufficient images resolve to an `unknown` finding + overallStatus
 *     code 'unknown'. They are NEVER silently reported as healthy.
 */

// Severity ladder shared by findings and overallStatus.
export const SEVERITY = { Info: 0, Low: 1, Moderate: 2, High: 3, Critical: 4 };
const SEVERITY_NAME = ['Info', 'Low', 'Moderate', 'High', 'Critical'];

/** Highest severity among the given names ('Info' when none are given). */
export function worstSeverity(...names) {
  const rank = names.reduce((m, n) => Math.max(m, SEVERITY[n] ?? 0), 0);
  return SEVERITY_NAME[rank];
}

/**
 * Finding categories the schema can represent. One image may yield several
 * simultaneously (e.g. a disease + a nutrient symptom + pest damage). The edge
 * heuristic emits a subset; richer engines may use more (e.g. physical_damage
 * distinct from pest, once they can actually be told apart).
 */
export const CATEGORY = {
  HEALTHY: 'healthy',
  DISEASE: 'disease',
  PEST: 'pest',
  PHYSICAL_DAMAGE: 'physical_damage',
  NUTRIENT: 'nutrient',
  STRESS: 'stress',
  UNKNOWN: 'unknown',
};

export const CONFIDENCE_BASIS = {
  HEURISTIC: 'heuristic',
  MODEL_ESTIMATE: 'model_estimate',
};

/** Normalise one finding into the canonical shape. */
export function makeFinding({
  id,
  category,
  title,
  severity = 'Low',
  confidence = null,
  confidenceBasis = CONFIDENCE_BASIS.HEURISTIC,
  description = '',
  recommendations = [],
  evidence = null,
}) {
  return {
    id,
    category,
    title,
    severity,
    confidence: typeof confidence === 'number' ? Math.round(confidence) : null,
    confidenceBasis,
    description,
    recommendations: Array.isArray(recommendations)
      ? recommendations
      : [recommendations].filter(Boolean),
    ...(evidence ? { evidence } : {}),
  };
}

/** Localised one-line headline for the overall-status banner. */
function statusHeadline(code, severity, lang) {
  const hi = lang === 'hi';
  if (code === 'unknown') {
    return hi ? 'अनिश्चित — स्पष्ट तस्वीर चाहिए' : 'Inconclusive — a clearer photo is needed';
  }
  if (code === 'healthy') {
    return hi ? 'स्वस्थ — कोई समस्या नहीं मिली' : 'Healthy — no issues detected';
  }
  if (severity === 'Critical' || severity === 'High') {
    return hi ? 'ध्यान दें — हस्तक्षेप आवश्यक' : 'Action needed — intervention recommended';
  }
  return hi ? 'निगरानी करें — प्रारंभिक लक्षण' : 'Monitor — early symptoms detected';
}

/**
 * Merge the (unchanged) flat fields with the new structured layer and return
 * the final result object. Computes overallStatus from the findings and stamps
 * engine / onDevice / timestamp.
 *
 * `overallStatus.code` is 'unknown' when the image was not usable, 'healthy'
 * when the only outcome is a healthy finding, else 'issues_found'.
 */
export function assembleResult({
  flat = {},
  findings = [],
  imageQuality = null,
  engine,
  onDevice,
  lang = 'en',
}) {
  const list = (Array.isArray(findings) ? findings : []).filter(Boolean);

  const actionable = list.filter(
    (f) => f.category !== CATEGORY.HEALTHY && f.category !== CATEGORY.UNKNOWN
  );

  let code;
  if (imageQuality && imageQuality.usable === false) {
    code = 'unknown';
  } else if (list.length && list.every((f) => f.category === CATEGORY.UNKNOWN)) {
    code = 'unknown';
  } else if (actionable.length === 0) {
    code = 'healthy';
  } else {
    code = 'issues_found';
  }

  const severity =
    code === 'unknown'
      ? 'Info'
      : code === 'healthy'
        ? 'Low'
        : worstSeverity(...actionable.map((f) => f.severity));

  const overallStatus = {
    code, // 'healthy' | 'issues_found' | 'unknown'
    severity, // worst actionable severity
    findingsCount: actionable.length,
    headline: statusHeadline(code, severity, lang),
  };

  return {
    ...flat, // ← existing flat contract, untouched
    findings: list,
    overallStatus,
    imageQuality,
    engine: engine ?? flat.engine,
    onDevice: onDevice ?? flat.onDevice,
    timestamp: new Date().toISOString(),
  };
}

// ── Best-effort structured findings from an engine's FLAT fields ──────────────
// Used by the Gemini path, which returns free-text vectors rather than pixel
// ratios. This is a keyword heuristic; the flat fields remain authoritative.
const HEALTHY_HINTS = [
  'healthy', 'no disease', 'undetected', 'optimal', 'none detected', 'no visible',
  'स्वस्थ', 'कोई रोग', 'अनुकूल', 'नहीं पाया', 'पहचान नहीं', 'कोई कीट',
];
function looksHealthy(text = '') {
  const t = String(text).toLowerCase();
  return HEALTHY_HINTS.some((h) => t.includes(h));
}

export function deriveFindingsFromFlat(
  flat = {},
  { confidenceBasis = CONFIDENCE_BASIS.MODEL_ESTIMATE } = {}
) {
  const findings = [];
  const sev = flat.severity || 'Low';

  if (!(looksHealthy(flat.disease) && sev === 'Low')) {
    findings.push(
      makeFinding({
        id: 'disease',
        category: CATEGORY.DISEASE,
        title: flat.disease,
        severity: sev,
        confidence: flat.confidence,
        confidenceBasis,
        description: flat.description || flat.disease,
        recommendations: flat.treatment_steps || [],
      })
    );
  }

  const nd = flat.nutrientDeficiency;
  if (nd && nd.status && !looksHealthy(nd.status)) {
    findings.push(
      makeFinding({
        id: 'nutrient',
        category: CATEGORY.NUTRIENT,
        // Gemini gives no nutrient severity; a named deficiency defaults to Moderate.
        severity: 'Moderate',
        title: nd.status,
        confidence: nd.confidence,
        confidenceBasis,
        description: nd.symptoms || nd.status,
        recommendations: nd.recommendation ? [nd.recommendation] : [],
      })
    );
  }

  const pp = flat.pestPressure;
  if (pp && ((pp.severity && pp.severity !== 'Low') || (pp.status && !looksHealthy(pp.status)))) {
    findings.push(
      makeFinding({
        id: 'pest',
        category: CATEGORY.PEST,
        title: pp.status,
        severity: pp.severity || 'Low',
        confidence: null, // Gemini reports no pest-specific confidence — don't invent one.
        confidenceBasis,
        description: pp.status,
        recommendations: pp.action ? [pp.action] : [],
      })
    );
  }

  if (findings.length === 0) {
    findings.push(
      makeFinding({
        id: 'healthy',
        category: CATEGORY.HEALTHY,
        title: flat.disease,
        severity: 'Info',
        confidence: flat.confidence,
        confidenceBasis,
        description: flat.description || flat.disease,
        recommendations: flat.treatment_steps || [],
      })
    );
  }

  return findings;
}
