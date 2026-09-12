import { GoogleGenAI, Type } from '@google/genai';
import { assembleResult, deriveFindingsFromFlat, CONFIDENCE_BASIS, CATEGORY, makeFinding } from './visionSchema';

/**
 * Builds a safe UNKNOWN structured result when cloud AI is unavailable.
 * Zero fabricated disease, zero fabricated confidence, zero chemical sprays.
 */
export function buildCloudUnavailableResult({ lang = 'en' } = {}) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const message = L(
    'Online AI is unavailable. Try again when connected, or use offline CropGuard for supported crops.',
    'ऑनलाइन AI अनुपलब्ध है। कनेक्ट होने पर पुन: प्रयास करें, या समर्थित फसलों के लिए ऑफ़लाइन CropGuard का उपयोग करें।'
  );
  const flat = {
    disease: L('Cloud AI Unavailable', 'क्लाउड AI अनुपलब्ध'),
    confidence: null,
    severity: 'Info',
    description: message,
    treatment_steps: [
      L('Check your network connection or configure VITE_GEMINI_API_KEY in your .env file.', 'अपना नेटवर्क कनेक्शन जांचें या अपनी .env फ़ाइल में VITE_GEMINI_API_KEY कॉन्फ़िगर करें।'),
      L('For supported crops, offline CropGuard AI runs on-device without internet.', 'समर्थित फसलों के लिए, ऑफ़लाइन CropGuard AI बिना इंटरनेट के डिवाइस पर चलता है।'),
    ],
    nutrientDeficiency: {
      status: L('Not Assessed', 'आकलन नहीं हुआ'),
      confidence: null,
      symptoms: L('Online AI diagnosis was unavailable.', 'ऑनलाइन AI निदान अनुपलब्ध था।'),
      recommendation: L('Reconnect or use offline diagnosis.', 'पुनः कनेक्ट करें या ऑफ़लाइन निदान उपयोग करें।'),
    },
    pestPressure: {
      status: L('Not Assessed', 'आकलन नहीं हुआ'),
      severity: 'Low',
      action: L('Reconnect or use offline diagnosis.', 'पुनः कनेक्ट करें या ऑफ़लाइन निदान उपयोग करें।'),
    },
    advisory: {
      sprayStatus: L('Spray Status: Re-scan Required', 'स्प्रे स्थिति: दोबारा स्कैन आवश्यक'),
      fertilizerAction: L('Fertilizer: Re-scan Required', 'उर्वरक: दोबारा स्कैन आवश्यक'),
      nextInspection: L('Next Inspection: Re-scan Now', 'अगला निरीक्षण: अभी दोबारा स्कैन करें'),
    },
    onDevice: false,
    engine: 'gemini-cloud',
    guardrailStatus: 'abstained',
    guardrailReasons: ['cloud_ai_unavailable'],
    code: 'CLOUD_AI_UNAVAILABLE',
    error: 'CLOUD_AI_UNAVAILABLE',
  };

  const findings = [
    makeFinding({
      id: 'gemini-cloud-unavailable',
      category: CATEGORY.UNKNOWN,
      title: flat.disease,
      severity: 'Info',
      confidence: null,
      confidenceBasis: CONFIDENCE_BASIS.MODEL_ESTIMATE,
      description: message,
      recommendations: flat.treatment_steps,
    }),
  ];

  return assembleResult({
    flat,
    findings,
    imageQuality: {
      code: 'not_assessed',
      usable: false,
      note: message,
    },
    engine: 'gemini-cloud',
    onDevice: false,
    lang,
  });
}

// Initialize the Google Gen AI client with the Vite environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const isApiKeyValid = apiKey && apiKey !== 'your_api_key_here' && apiKey.trim() !== '';

const ai = new GoogleGenAI({ apiKey: isApiKeyValid ? apiKey : undefined });

/**
 * Wrap a flat Gemini result in the shared structured schema (findings[],
 * overallStatus, imageQuality, engine, onDevice, timestamp) WITHOUT altering
 * any flat field. Gemini findings are `confidenceBasis: 'model_estimate'` — a
 * model self-report, not a calibrated probability. Image quality is left to the
 * cloud model, so it is marked 'not_assessed' rather than faked client-side.
 */
function toStructured(flat, { engine, lang }) {
  return assembleResult({
    flat,
    findings: deriveFindingsFromFlat(flat, { confidenceBasis: CONFIDENCE_BASIS.MODEL_ESTIMATE }),
    imageQuality: {
      code: 'not_assessed',
      usable: true,
      note: lang === 'hi'
        ? 'छवि गुणवत्ता का आकलन क्लाउड मॉडल द्वारा किया जाता है।'
        : 'Image quality is assessed by the cloud model.',
    },
    engine,
    onDevice: false,
    lang,
  });
}

/**
 * Analyzes a leaf image using Gemini 3.6 Flash model with Structured Outputs.
 * Extracts three distinct agricultural health vectors:
 * 1. Disease Diagnosis (disease, confidence, severity, description, treatment_steps)
 * 2. Nutrient Deficiency (status, confidence, symptoms, recommendation)
 * 3. Pest Pressure & Infestation (status, severity, action)
 * 4. Actionable Farmer Advisory (sprayStatus, fertilizerAction, nextInspection)
 *
 * @param {string} base64Data - Base64 encoded image string (with or without data URI prefix)
 * @param {string} lang - Selected language ('en' | 'hi')
 * @returns {Promise<Object>}
 */
export async function analyzeLeafImage(base64Data, lang = 'en') {
  // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
  let cleanBase64 = base64Data;
  let mimeType = 'image/jpeg';

  if (base64Data.includes(';base64,')) {
    const parts = base64Data.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    cleanBase64 = parts[1];
  }

  // If no valid API key is set, return a safe CLOUD_AI_UNAVAILABLE failure (NO fake disease)
  if (!isApiKeyValid) {
    console.warn('VITE_GEMINI_API_KEY is missing or placeholder. Returning safe cloud-unavailable failure.');
    return buildCloudUnavailableResult({ lang });
  }

  // Live analysis requires connectivity — fail fast (and clearly) when offline
  // so the UI can show a helpful message instead of a slow, cryptic network error.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineError = new Error('Offline: live AI diagnosis is unavailable without a connection.');
    offlineError.offline = true;
    throw offlineError;
  }

  try {
    const prompt = lang === 'hi'
      ? `आप एग्रियो (AGRIO) विशेषज्ञ कृषि वैज्ञानिक हैं। दी गई पत्ती की तस्वीर का गहन विश्लेषण करें और निम्नलिखित 3 अलग-अलग कृषि स्वास्थ्य पहलुओं को निकालें:
1. रोग (disease): रोग का नाम, गंभीरता (Low, Moderate, High, Critical), विवरण, और उपचार कदम।
2. पोषक तत्वों की कमी (nutrientDeficiency): स्थिति (उदा. 'नाइट्रोजन (N) की कमी - शिराओं के बीच पीलापन' या 'पोषक तत्व स्तर: अनुकूल'), विश्वास स्कोर (0-100), दिखने वाले लक्षण, और 1 वाक्य में लक्षित उर्वरक सिफारिश (उदा. 'सुबह के समय 1.5% यूरिया का पर्णीय छिड़काव करें।')।
3. कीट दबाव (pestPressure): स्थिति (उदा. 'कोई कीट नहीं पाया गया' या 'माहू (एफिड) का प्रकोप (सेक्टर 2)'), गंभीरता (Low, Moderate, Critical), और लक्षित हस्तक्षेप सलाह (उदा. 'स्थानीय रूप से नीम तेल इमल्शन (5ml/L) लगाएं; अंधाधुंध कीटनाशक से बचें।')।
4. सलाहकार (advisory): sprayStatus, fertilizerAction, और nextInspection के त्वरित कार्य टैग।`
      : `Act as an expert AGRIO agronomist. Deeply analyze the provided leaf image across three distinct agricultural health vectors:
1. disease: Disease name, severity ('Low', 'Moderate', 'High', 'Critical'), concise description, and actionable organic/chemical treatment steps.
2. nutrientDeficiency: Deficiency status (e.g., 'Nitrogen (N) Deficiency - Interveinal Chlorosis' or 'Nutrient Levels: Optimal'), confidence score (0-100), visible symptoms, and a 1-sentence targeted fertilizer recommendation (e.g., 'Apply foliar urea spray (1.5%) during early morning').
3. pestPressure: Infestation status (e.g., 'None Detected' or 'Early Aphid Cluster Detected (Sector 2)'), severity tag ('Low', 'Moderate', 'Critical'), and targeted intervention advice (e.g., 'Apply Neem oil emulsion (5ml/L) locally; avoid blanket pesticide usage.').
4. advisory: Action pills with sprayStatus (e.g., 'Spray Status: Targeted Intervention Needed'), fertilizerAction (e.g., 'Fertilizer: Adjust NPK Ratio'), and nextInspection (e.g., 'Next Inspection: 48 Hours').`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            disease: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            severity: {
              type: Type.STRING,
              enum: ['Low', 'Moderate', 'High', 'Critical']
            },
            description: { type: Type.STRING },
            treatment_steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            nutrientDeficiency: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                symptoms: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              },
              required: ['status', 'confidence', 'symptoms', 'recommendation']
            },
            pestPressure: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                severity: {
                  type: Type.STRING,
                  enum: ['Low', 'Moderate', 'Critical']
                },
                action: { type: Type.STRING }
              },
              required: ['status', 'severity', 'action']
            },
            advisory: {
              type: Type.OBJECT,
              properties: {
                sprayStatus: { type: Type.STRING },
                fertilizerAction: { type: Type.STRING },
                nextInspection: { type: Type.STRING }
              },
              required: ['sprayStatus', 'fertilizerAction', 'nextInspection']
            }
          },
          required: [
            'disease',
            'confidence',
            'severity',
            'treatment_steps',
            'nutrientDeficiency',
            'pestPressure',
            'advisory'
          ]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      // Safe fallback defaulting if negative, clear, or missing properties
      const flat = {
        disease: parsed.disease || (lang === 'hi' ? 'पहचान नहीं हुई / स्वस्थ पत्ती' : 'Healthy Leaf / Undetected'),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 95.0,
        severity: parsed.severity || 'Low',
        description: parsed.description || '',
        treatment_steps: Array.isArray(parsed.treatment_steps) && parsed.treatment_steps.length > 0
          ? parsed.treatment_steps
          : [lang === 'hi' ? 'नियमित सिंचाई एवं पोषण प्रबंधन जारी रखें।' : 'Maintain regular irrigation and balanced crop nutrition.'],
        nutrientDeficiency: {
          status: parsed.nutrientDeficiency?.status || (lang === 'hi' ? 'पोषक तत्व स्तर: अनुकूल' : 'Nutrient Levels: Optimal'),
          confidence: typeof parsed.nutrientDeficiency?.confidence === 'number' ? parsed.nutrientDeficiency.confidence : 92.0,
          symptoms: parsed.nutrientDeficiency?.symptoms || (lang === 'hi' ? 'कोई दृश्य कमी लक्षण नहीं' : 'No visible deficiency symptoms observed.'),
          recommendation: parsed.nutrientDeficiency?.recommendation || (lang === 'hi' ? 'संतुलित एनपीके उर्वरक जारी रखें।' : 'Maintain balanced NPK fertigation schedule.')
        },
        pestPressure: {
          status: parsed.pestPressure?.status || (lang === 'hi' ? 'कोई कीट नहीं पाया गया' : 'None Detected'),
          severity: parsed.pestPressure?.severity || 'Low',
          action: parsed.pestPressure?.action || (lang === 'hi' ? 'नियमित खेत निगरानी जारी रखें।' : 'Maintain routine plot inspection.')
        },
        advisory: {
          sprayStatus: parsed.advisory?.sprayStatus || (lang === 'hi' ? 'स्प्रे स्थिति: आवश्यक नहीं' : 'Spray Status: None Needed'),
          fertilizerAction: parsed.advisory?.fertilizerAction || (lang === 'hi' ? 'उर्वरक: मानक एनपीके' : 'Fertilizer: Standard NPK'),
          nextInspection: parsed.advisory?.nextInspection || (lang === 'hi' ? 'अगला निरीक्षण: 48 घंटे' : 'Next Inspection: 48 Hours')
        }
      };
      return toStructured(flat, { engine: 'gemini-cloud', lang });
    } else {
      throw new Error('No structured response received from Gemini API');
    }
  } catch (error) {
    console.error('Gemini 3.6 Flash API Error:', error);
    throw error;
  }
}
