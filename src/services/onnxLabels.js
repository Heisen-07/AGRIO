/**
 * ONNX Label Mapping — CropGuard 38-class PlantVillage model.
 *
 * IMPORTANT: The index order EXACTLY matches the model's output tensor.
 * This mapping was verified against the classes.json used during training
 * and confirmed via model-test/test_inference.py.
 *
 * DO NOT reorder, insert, or remove entries without re-verifying
 * against the actual model output.
 *
 * Each entry maps a model output index to:
 *   - id:          unique snake_case identifier
 *   - label:       bilingual display name { en, hi }
 *   - category:    'disease' | 'healthy'
 *   - crop:        canonical crop name (used for crop-compatibility filtering)
 *   - cropKey:     normalized key matching cropProfiles.js
 *   - description: bilingual short description { en, hi }
 *
 * Rules:
 *   • category is ONLY 'disease' or 'healthy' — the model was not trained
 *     on pest, nutrient, or stress classes
 *   • no chemical dosage or pesticide prescriptions — treatment flows
 *     through AGRIO's advisory layer
 *   • do NOT add classes not present in the trained model
 */

/**
 * @typedef {Object} ModelClass
 * @property {number}  index       - Output tensor index (0-based)
 * @property {string}  id          - Unique string identifier (snake_case)
 * @property {{ en: string, hi: string }} label - Bilingual display name
 * @property {string}  category    - 'healthy' | 'disease'
 * @property {string}  crop        - Crop name (e.g. 'Apple', 'Tomato')
 * @property {string}  cropKey     - Normalized crop key for cropProfiles
 * @property {{ en: string, hi: string }} description - Bilingual short description
 */

/** @type {ModelClass[]} */
export const MODEL_CLASSES = [
  // ── Apple (indices 0–3) ─────────────────────────────────────────────────────
  {
    index: 0,
    id: 'apple_scab',
    label: { en: 'Apple Scab', hi: 'सेब पपड़ी रोग' },
    category: 'disease',
    crop: 'Apple',
    cropKey: 'apple',
    description: {
      en: 'Dark olive-green to brown velvety lesions on leaves and fruit.',
      hi: 'पत्तियों और फल पर गहरे जैतूनी-हरे से भूरे मखमली घाव।',
    },
  },
  {
    index: 1,
    id: 'apple_black_rot',
    label: { en: 'Apple Black Rot', hi: 'सेब काला सड़न' },
    category: 'disease',
    crop: 'Apple',
    cropKey: 'apple',
    description: {
      en: 'Brown expanding lesions with concentric rings on leaves; fruit rot.',
      hi: 'पत्तियों पर संकेंद्रित वलय वाले भूरे फैलते घाव; फल सड़न।',
    },
  },
  {
    index: 2,
    id: 'apple_cedar_rust',
    label: { en: 'Cedar Apple Rust', hi: 'सेब देवदार रतुआ' },
    category: 'disease',
    crop: 'Apple',
    cropKey: 'apple',
    description: {
      en: 'Bright orange-yellow spots on leaf upper surface with tube-like structures beneath.',
      hi: 'पत्ती की ऊपरी सतह पर चमकीले नारंगी-पीले धब्बे, नीचे नलिकाकार संरचनाएँ।',
    },
  },
  {
    index: 3,
    id: 'apple_healthy',
    label: { en: 'Apple — Healthy', hi: 'सेब — स्वस्थ' },
    category: 'healthy',
    crop: 'Apple',
    cropKey: 'apple',
    description: {
      en: 'No disease symptoms detected on apple leaf.',
      hi: 'सेब की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Blueberry (index 4) ─────────────────────────────────────────────────────
  {
    index: 4,
    id: 'blueberry_healthy',
    label: { en: 'Blueberry — Healthy', hi: 'ब्लूबेरी — स्वस्थ' },
    category: 'healthy',
    crop: 'Blueberry',
    cropKey: 'blueberry',
    description: {
      en: 'No disease symptoms detected on blueberry leaf.',
      hi: 'ब्लूबेरी की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Cherry (indices 5–6) ────────────────────────────────────────────────────
  {
    index: 5,
    id: 'cherry_powdery_mildew',
    label: { en: 'Cherry Powdery Mildew', hi: 'चेरी चूर्णिल फफूंद' },
    category: 'disease',
    crop: 'Cherry',
    cropKey: 'cherry',
    description: {
      en: 'White powdery coating on leaf surfaces and young shoots.',
      hi: 'पत्ती की सतह और नई शाखाओं पर सफ़ेद चूर्णिल परत।',
    },
  },
  {
    index: 6,
    id: 'cherry_healthy',
    label: { en: 'Cherry — Healthy', hi: 'चेरी — स्वस्थ' },
    category: 'healthy',
    crop: 'Cherry',
    cropKey: 'cherry',
    description: {
      en: 'No disease symptoms detected on cherry leaf.',
      hi: 'चेरी की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Corn / Maize (indices 7–10) ─────────────────────────────────────────────
  {
    index: 7,
    id: 'corn_cercospora_gray_leaf_spot',
    label: { en: 'Corn Gray Leaf Spot', hi: 'मक्का भूरा पत्ती धब्बा' },
    category: 'disease',
    crop: 'Corn',
    cropKey: 'corn',
    description: {
      en: 'Rectangular gray-tan lesions running parallel to leaf veins.',
      hi: 'पत्ती की शिराओं के समांतर आयताकार भूरे-धूसर घाव।',
    },
  },
  {
    index: 8,
    id: 'corn_common_rust',
    label: { en: 'Corn Common Rust', hi: 'मक्का सामान्य रतुआ' },
    category: 'disease',
    crop: 'Corn',
    cropKey: 'corn',
    description: {
      en: 'Small, circular to elongate reddish-brown pustules on both leaf surfaces.',
      hi: 'पत्ती की दोनों सतहों पर छोटे, गोल से लम्बे लाल-भूरे फफोले।',
    },
  },
  {
    index: 9,
    id: 'corn_northern_leaf_blight',
    label: { en: 'Corn Northern Leaf Blight', hi: 'मक्का उत्तरी पत्ती झुलसा' },
    category: 'disease',
    crop: 'Corn',
    cropKey: 'corn',
    description: {
      en: 'Long, elliptical gray-green to tan lesions on leaves.',
      hi: 'पत्तियों पर लम्बे, अण्डाकार भूरे-हरे से भूरे घाव।',
    },
  },
  {
    index: 10,
    id: 'corn_healthy',
    label: { en: 'Corn — Healthy', hi: 'मक्का — स्वस्थ' },
    category: 'healthy',
    crop: 'Corn',
    cropKey: 'corn',
    description: {
      en: 'No disease symptoms detected on corn leaf.',
      hi: 'मक्का की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Grape (indices 11–14) ───────────────────────────────────────────────────
  {
    index: 11,
    id: 'grape_black_rot',
    label: { en: 'Grape Black Rot', hi: 'अंगूर काला सड़न' },
    category: 'disease',
    crop: 'Grape',
    cropKey: 'grape',
    description: {
      en: 'Circular tan spots with dark borders on leaves; shrivelled black fruit.',
      hi: 'पत्तियों पर गहरे किनारे वाले गोल भूरे धब्बे; सिकुड़े काले फल।',
    },
  },
  {
    index: 12,
    id: 'grape_esca',
    label: { en: 'Grape Esca (Black Measles)', hi: 'अंगूर एस्का (काला खसरा)' },
    category: 'disease',
    crop: 'Grape',
    cropKey: 'grape',
    description: {
      en: 'Interveinal striping and drying of leaf tissue; dark speckling on berries.',
      hi: 'शिराओं के बीच धारीदार सूखापन; जामुन पर गहरे धब्बे।',
    },
  },
  {
    index: 13,
    id: 'grape_leaf_blight',
    label: { en: 'Grape Leaf Blight', hi: 'अंगूर पत्ती झुलसा' },
    category: 'disease',
    crop: 'Grape',
    cropKey: 'grape',
    description: {
      en: 'Dark brown irregular necrotic lesions on leaf margins and surface.',
      hi: 'पत्ती के किनारों और सतह पर गहरे भूरे अनियमित परिगलित घाव।',
    },
  },
  {
    index: 14,
    id: 'grape_healthy',
    label: { en: 'Grape — Healthy', hi: 'अंगूर — स्वस्थ' },
    category: 'healthy',
    crop: 'Grape',
    cropKey: 'grape',
    description: {
      en: 'No disease symptoms detected on grape leaf.',
      hi: 'अंगूर की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Orange (index 15) ──────────────────────────────────────────────────────
  {
    index: 15,
    id: 'orange_huanglongbing',
    label: { en: 'Citrus Greening (Huanglongbing)', hi: 'सिट्रस ग्रीनिंग (हुआंगलोंगबिंग)' },
    category: 'disease',
    crop: 'Orange',
    cropKey: 'orange',
    description: {
      en: 'Asymmetric blotchy mottling and yellowing of leaves; lopsided fruit.',
      hi: 'पत्तियों पर असममित धब्बेदार पीलापन; विषम फल।',
    },
  },

  // ── Peach (indices 16–17) ──────────────────────────────────────────────────
  {
    index: 16,
    id: 'peach_bacterial_spot',
    label: { en: 'Peach Bacterial Spot', hi: 'आड़ू जीवाणु धब्बा' },
    category: 'disease',
    crop: 'Peach',
    cropKey: 'peach',
    description: {
      en: 'Small, dark, water-soaked spots on leaves that may coalesce and cause defoliation.',
      hi: 'पत्तियों पर छोटे, गहरे, पानी-भीगे धब्बे जो मिल सकते हैं और पत्ती गिरा सकते हैं।',
    },
  },
  {
    index: 17,
    id: 'peach_healthy',
    label: { en: 'Peach — Healthy', hi: 'आड़ू — स्वस्थ' },
    category: 'healthy',
    crop: 'Peach',
    cropKey: 'peach',
    description: {
      en: 'No disease symptoms detected on peach leaf.',
      hi: 'आड़ू की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Pepper / Bell Pepper (indices 18–19) ───────────────────────────────────
  {
    index: 18,
    id: 'pepper_bacterial_spot',
    label: { en: 'Pepper Bacterial Spot', hi: 'शिमला मिर्च जीवाणु धब्बा' },
    category: 'disease',
    crop: 'Pepper',
    cropKey: 'pepper',
    description: {
      en: 'Small, raised, water-soaked spots on leaves that turn brown and papery.',
      hi: 'पत्तियों पर छोटे, उभरे, पानी-भीगे धब्बे जो भूरे और कागज़ जैसे हो जाते हैं।',
    },
  },
  {
    index: 19,
    id: 'pepper_healthy',
    label: { en: 'Pepper — Healthy', hi: 'शिमला मिर्च — स्वस्थ' },
    category: 'healthy',
    crop: 'Pepper',
    cropKey: 'pepper',
    description: {
      en: 'No disease symptoms detected on pepper leaf.',
      hi: 'शिमला मिर्च की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Potato (indices 20–22) ─────────────────────────────────────────────────
  {
    index: 20,
    id: 'potato_early_blight',
    label: { en: 'Potato Early Blight', hi: 'आलू अगेती झुलसा' },
    category: 'disease',
    crop: 'Potato',
    cropKey: 'potato',
    description: {
      en: 'Dark brown concentric-ringed target-like spots on older leaves.',
      hi: 'पुरानी पत्तियों पर गहरे भूरे संकेंद्रित-वलय वाले निशान जैसे धब्बे।',
    },
  },
  {
    index: 21,
    id: 'potato_late_blight',
    label: { en: 'Potato Late Blight', hi: 'आलू पछेती झुलसा' },
    category: 'disease',
    crop: 'Potato',
    cropKey: 'potato',
    description: {
      en: 'Large, pale-green to brown water-soaked lesions; white mold on leaf undersides.',
      hi: 'बड़े, हल्के हरे से भूरे पानी-भीगे घाव; पत्ती के नीचे सफ़ेद फफूंद।',
    },
  },
  {
    index: 22,
    id: 'potato_healthy',
    label: { en: 'Potato — Healthy', hi: 'आलू — स्वस्थ' },
    category: 'healthy',
    crop: 'Potato',
    cropKey: 'potato',
    description: {
      en: 'No disease symptoms detected on potato leaf.',
      hi: 'आलू की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Raspberry (index 23) ───────────────────────────────────────────────────
  {
    index: 23,
    id: 'raspberry_healthy',
    label: { en: 'Raspberry — Healthy', hi: 'रसभरी — स्वस्थ' },
    category: 'healthy',
    crop: 'Raspberry',
    cropKey: 'raspberry',
    description: {
      en: 'No disease symptoms detected on raspberry leaf.',
      hi: 'रसभरी की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Soybean (index 24) ─────────────────────────────────────────────────────
  {
    index: 24,
    id: 'soybean_healthy',
    label: { en: 'Soybean — Healthy', hi: 'सोयाबीन — स्वस्थ' },
    category: 'healthy',
    crop: 'Soybean',
    cropKey: 'soybean',
    description: {
      en: 'No disease symptoms detected on soybean leaf.',
      hi: 'सोयाबीन की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Squash (index 25) ──────────────────────────────────────────────────────
  {
    index: 25,
    id: 'squash_powdery_mildew',
    label: { en: 'Squash Powdery Mildew', hi: 'कद्दू वर्गीय चूर्णिल फफूंद' },
    category: 'disease',
    crop: 'Squash',
    cropKey: 'squash',
    description: {
      en: 'White to gray powdery spots on leaf surfaces and stems.',
      hi: 'पत्ती की सतह और तनों पर सफ़ेद से भूरे चूर्णिल धब्बे।',
    },
  },

  // ── Strawberry (indices 26–27) ─────────────────────────────────────────────
  {
    index: 26,
    id: 'strawberry_leaf_scorch',
    label: { en: 'Strawberry Leaf Scorch', hi: 'स्ट्रॉबेरी पत्ती झुलसन' },
    category: 'disease',
    crop: 'Strawberry',
    cropKey: 'strawberry',
    description: {
      en: 'Irregular purple to dark brown spots that enlarge and merge; scorched appearance.',
      hi: 'अनियमित बैंगनी से गहरे भूरे धब्बे जो बड़े होकर मिल जाते हैं; झुलसा दिखाव।',
    },
  },
  {
    index: 27,
    id: 'strawberry_healthy',
    label: { en: 'Strawberry — Healthy', hi: 'स्ट्रॉबेरी — स्वस्थ' },
    category: 'healthy',
    crop: 'Strawberry',
    cropKey: 'strawberry',
    description: {
      en: 'No disease symptoms detected on strawberry leaf.',
      hi: 'स्ट्रॉबेरी की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },

  // ── Tomato (indices 28–37) ─────────────────────────────────────────────────
  {
    index: 28,
    id: 'tomato_bacterial_spot',
    label: { en: 'Tomato Bacterial Spot', hi: 'टमाटर जीवाणु धब्बा' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Small, dark, greasy-looking spots on leaves, stems and fruit.',
      hi: 'पत्तियों, तनों और फल पर छोटे, गहरे, चिकने दिखने वाले धब्बे।',
    },
  },
  {
    index: 29,
    id: 'tomato_early_blight',
    label: { en: 'Tomato Early Blight', hi: 'टमाटर अगेती झुलसा' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Dark concentric-ringed target-like spots starting on lower leaves.',
      hi: 'निचली पत्तियों पर शुरू होने वाले गहरे संकेंद्रित-वलय वाले निशान जैसे धब्बे।',
    },
  },
  {
    index: 30,
    id: 'tomato_late_blight',
    label: { en: 'Tomato Late Blight', hi: 'टमाटर पछेती झुलसा' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Large, irregular, water-soaked lesions turning brown-black; white mold possible.',
      hi: 'बड़े, अनियमित, पानी-भीगे घाव जो भूरे-काले होते हैं; सफ़ेद फफूंद संभव।',
    },
  },
  {
    index: 31,
    id: 'tomato_leaf_mold',
    label: { en: 'Tomato Leaf Mold', hi: 'टमाटर पत्ती फफूंद' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Pale-green to yellow spots on upper leaf surface; olive-brown mold beneath.',
      hi: 'ऊपरी पत्ती सतह पर हल्के हरे से पीले धब्बे; नीचे जैतूनी-भूरी फफूंद।',
    },
  },
  {
    index: 32,
    id: 'tomato_septoria_leaf_spot',
    label: { en: 'Tomato Septoria Leaf Spot', hi: 'टमाटर सेप्टोरिया पत्ती धब्बा' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Numerous small circular spots with dark borders and tan centers on lower leaves.',
      hi: 'निचली पत्तियों पर गहरे किनारे और भूरे केंद्र वाले अनेक छोटे गोल धब्बे।',
    },
  },
  {
    index: 33,
    id: 'tomato_spider_mites',
    label: { en: 'Tomato Spider Mites', hi: 'टमाटर मकड़ी कीट' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Fine stippling and bronzing of leaves; tiny webbing on leaf undersides.',
      hi: 'पत्तियों पर महीन बिंदुकित और कांस्य रंग; पत्ती के नीचे सूक्ष्म जाले।',
    },
  },
  {
    index: 34,
    id: 'tomato_target_spot',
    label: { en: 'Tomato Target Spot', hi: 'टमाटर लक्ष्य धब्बा' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Brown spots with concentric rings and yellow halos on leaves.',
      hi: 'पत्तियों पर संकेंद्रित वलय और पीले प्रभामंडल वाले भूरे धब्बे।',
    },
  },
  {
    index: 35,
    id: 'tomato_yellow_leaf_curl_virus',
    label: { en: 'Tomato Yellow Leaf Curl Virus', hi: 'टमाटर पीला पत्ती मरोड़ विषाणु' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Severe upward leaf curling, yellowing, and stunted growth.',
      hi: 'पत्तियों का गंभीर ऊपरी मरोड़, पीलापन, और बौना विकास।',
    },
  },
  {
    index: 36,
    id: 'tomato_mosaic_virus',
    label: { en: 'Tomato Mosaic Virus', hi: 'टमाटर मोज़ेक विषाणु' },
    category: 'disease',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'Light and dark green mottled mosaic pattern on leaves; leaf distortion.',
      hi: 'पत्तियों पर हल्के और गहरे हरे मिश्रित मोज़ेक पैटर्न; पत्ती विरूपण।',
    },
  },
  {
    index: 37,
    id: 'tomato_healthy',
    label: { en: 'Tomato — Healthy', hi: 'टमाटर — स्वस्थ' },
    category: 'healthy',
    crop: 'Tomato',
    cropKey: 'tomato',
    description: {
      en: 'No disease symptoms detected on tomato leaf.',
      hi: 'टमाटर की पत्ती पर कोई रोग लक्षण नहीं पाया गया।',
    },
  },
];

/**
 * The 14 crops CropGuard was trained on.
 * Used by visionGuardService for supported-crop validation.
 */
export const SUPPORTED_CROPS = [
  'apple', 'blueberry', 'cherry', 'corn', 'grape', 'orange',
  'peach', 'pepper', 'potato', 'raspberry', 'soybean', 'squash',
  'strawberry', 'tomato',
];

/**
 * Build a quick lookup: cropKey → array of class indices for that crop.
 * Used by the crop-compatibility filter in visionGuardService.
 */
export const CROP_CLASS_INDICES = (() => {
  const map = {};
  for (const cls of MODEL_CLASSES) {
    if (!map[cls.cropKey]) map[cls.cropKey] = [];
    map[cls.cropKey].push(cls.index);
  }
  return map;
})();

/**
 * Look up a class entry by its output-tensor index.
 * Returns null if the index is out of range or MODEL_CLASSES is empty.
 *
 * @param {number} index
 * @returns {ModelClass|null}
 */
export function getClassByIndex(index) {
  if (!MODEL_CLASSES.length || index < 0 || index >= MODEL_CLASSES.length) {
    return null;
  }
  return MODEL_CLASSES.find((c) => c.index === index) || null;
}

/**
 * Look up a class entry by its string id.
 * Returns null if not found or MODEL_CLASSES is empty.
 *
 * @param {string} id
 * @returns {ModelClass|null}
 */
export function getClassById(id) {
  if (!MODEL_CLASSES.length || !id) return null;
  return MODEL_CLASSES.find((c) => c.id === id) || null;
}

/**
 * Returns true when the label mapping has been populated with at least one class.
 * Used by onnxVisionService to guard against decoding with an empty mapping.
 */
export function hasLabels() {
  return MODEL_CLASSES.length > 0;
}
