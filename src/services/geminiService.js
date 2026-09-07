import { GoogleGenAI, Type } from '@google/genai';

// Initialize the Google Gen AI client with the Vite environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const isApiKeyValid = apiKey && apiKey !== 'your_api_key_here' && apiKey.trim() !== '';

const ai = new GoogleGenAI({ apiKey: isApiKeyValid ? apiKey : undefined });

/**
 * Analyzes a leaf image using Gemini 3.6 Flash model with Structured Outputs.
 * @param {string} base64Data - Base64 encoded image string (with or without data URI prefix)
 * @param {string} lang - Selected language ('en' | 'hi')
 * @returns {Promise<{ disease: string, confidence: number, severity: string, treatment_steps: string[] }>}
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

  // If no valid API key is set, return a demo diagnostic result with a friendly note
  if (!isApiKeyValid) {
    console.warn('VITE_GEMINI_API_KEY is missing or set to placeholder. Returning demo structured output.');
    return {
      disease: lang === 'hi'
        ? 'पीला रतुआ (येलो रस्ट - Puccinia striiformis)'
        : 'Yellow Rust (Puccinia striiformis)',
      confidence: 96.4,
      severity: 'Moderate',
      treatment_steps: lang === 'hi'
        ? [
            '1. प्रोपिकोनाज़ोल 25% EC @ 1 मिली/लीटर पानी छिड़कें (Propiconazole 25% EC @ 1ml/L).',
            '2. अतिरिक्त आर्द्रता से बचने के लिए खेत में जल निकासी व्यवस्था सुधारें।',
            '3. अगले 48 घंटों में आसपास के 50 मीटर क्षेत्र की निगरानी करें।'
          ]
        : [
            '1. Spray Propiconazole 25% EC @ 1 ml/Liter water in early morning.',
            '2. Ensure field drainage to prevent excess humidity buildup.',
            '3. Monitor adjacent 50m radius plots over next 48 hours.'
          ],
      isDemo: true,
      demoNotice: lang === 'hi'
        ? 'लाइव AI विश्लेषण के लिए .env फ़ाइल में VITE_GEMINI_API_KEY दर्ज करें।'
        : 'To enable live Gemini 3.6 Flash analysis, please set VITE_GEMINI_API_KEY in your .env file.'
    };
  }

  try {
    const prompt = lang === 'hi'
      ? 'आप एग्रियो (AGRIO) विशेषज्ञ कृषि वैज्ञानिक हैं। दी गई पत्ती की तस्वीर का विश्लेषण करें और किसी भी रोग, कीट या पोषक तत्वों की कमी की पहचान करें। रोग का नाम हिंदी में दें।'
      : 'Act as AGRIO expert agronomist. Analyze the provided leaf image to diagnose any crop disease, pest infestation, or nutrient deficiency. Provide concise, actionable organic & chemical treatment steps.';

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
            treatment_steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['disease', 'confidence', 'severity', 'treatment_steps']
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return result;
    } else {
      throw new Error('No structured response received from Gemini API');
    }
  } catch (error) {
    console.error('Gemini 3.6 Flash API Error:', error);
    throw error;
  }
}
