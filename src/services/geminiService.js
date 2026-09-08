import { GoogleGenAI, Type } from '@google/genai';

// Initialize the Google Gen AI client with the Vite environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const isApiKeyValid = apiKey && apiKey !== 'your_api_key_here' && apiKey.trim() !== '';

const ai = new GoogleGenAI({ apiKey: isApiKeyValid ? apiKey : undefined });

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

  // If no valid API key is set, return a rich demo diagnostic result with all 3 health vectors
  if (!isApiKeyValid) {
    console.warn('VITE_GEMINI_API_KEY is missing or set to placeholder. Returning demo structured output.');
    return {
      disease: lang === 'hi'
        ? 'पीला रतुआ (येलो रस्ट - Puccinia striiformis)'
        : 'Yellow Rust (Puccinia striiformis)',
      confidence: 96.4,
      severity: 'Moderate',
      description: lang === 'hi'
        ? 'पत्तियों पर समानांतर कतारों में चमकीले पीले से नारंगी रंग के फफोले (पुस्ट्यूल) दिखाई दे रहे हैं।'
        : 'Yellow to orange streak-like pustules arranged in stripe patterns across leaf veins, typical of early stripe rust.',
      treatment_steps: lang === 'hi'
        ? [
            '1. प्रोपिकोनाज़ोल 25% EC @ 1 मिली/लीटर पानी सुबह के समय छिड़कें।',
            '2. अतिरिक्त आर्द्रता से बचने के लिए खेत में जल निकासी व्यवस्था सुधारें।',
            '3. अगले 48 घंटों में आसपास के 50 मीटर क्षेत्र की निगरानी करें।'
          ]
        : [
            '1. Spray Propiconazole 25% EC @ 1 ml/Liter water in early morning.',
            '2. Ensure field drainage to prevent excess humidity buildup.',
            '3. Monitor adjacent 50m radius plots over next 48 hours.'
          ],
      nutrientDeficiency: {
        status: lang === 'hi'
          ? 'नाइट्रोजन (N) की कमी - शिराओं के बीच पीलापन'
          : 'Nitrogen (N) Deficiency - Interveinal Chlorosis',
        confidence: 88.5,
        symptoms: lang === 'hi'
          ? 'पुरानी पत्तियों पर पीलापन एवं हल्का क्लोरोसिस'
          : 'Pale green to yellowish lower leaves with slight chlorosis',
        recommendation: lang === 'hi'
          ? 'सुबह के समय 1.5% यूरिया का पर्णीय छिड़काव करें।'
          : 'Apply foliar urea spray (1.5%) during early morning.'
      },
      pestPressure: {
        status: lang === 'hi'
          ? 'माहू (एफिड) का प्रकोप देखा गया (सेक्टर 2)'
          : 'Early Aphid Cluster Detected (Sector 2)',
        severity: 'Moderate',
        action: lang === 'hi'
          ? 'स्थानीय रूप से नीम तेल घोल (5 मिली/लीटर) का छिड़काव करें; अंधाधुंध कीटनाशक से बचें।'
          : 'Apply Neem oil emulsion (5ml/L) locally; avoid blanket pesticide usage.'
      },
      advisory: {
        sprayStatus: lang === 'hi'
          ? 'स्प्रे स्थिति: लक्षित हस्तक्षेप आवश्यक'
          : 'Spray Status: Targeted Intervention Needed',
        fertilizerAction: lang === 'hi'
          ? 'उर्वरक: एनपीके अनुपात समायोजित करें'
          : 'Fertilizer: Adjust NPK Ratio',
        nextInspection: lang === 'hi'
          ? 'अगला निरीक्षण: 48 घंटे'
          : 'Next Inspection: 48 Hours'
      },
      isDemo: true,
      demoNotice: lang === 'hi'
        ? 'लाइव AI विश्लेषण के लिए .env फ़ाइल में VITE_GEMINI_API_KEY दर्ज करें।'
        : 'To enable live Gemini 3.6 Flash analysis, please set VITE_GEMINI_API_KEY in your .env file.'
    };
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
      return {
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
    } else {
      throw new Error('No structured response received from Gemini API');
    }
  } catch (error) {
    console.error('Gemini 3.6 Flash API Error:', error);
    throw error;
  }
}
