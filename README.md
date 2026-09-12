# 🌱 AGRIO — Smart Farming Intelligence Platform

<p align="center">
  <strong>AI-powered, offline-first crop intelligence for farmers</strong>
</p>

<p align="center">
  <a href="YOUR_VERCEL_URL">🚀 Live Demo</a> •
  <a href="https://github.com/Heisen-07/AGRIO">💻 GitHub Repository</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/ONNX-Offline%20AI-005CED?style=for-the-badge" alt="ONNX" />
  <img src="https://img.shields.io/badge/PWA-Offline%20First-5A0FC8?style=for-the-badge" alt="PWA" />
  <img src="https://img.shields.io/badge/ESP32-IoT-E7352C?style=for-the-badge&logo=espressif&logoColor=white" alt="ESP32" />
</p>

---

## 🌾 About AGRIO

**AGRIO** is an offline-first smart agriculture platform that combines **AI-based crop vision, field sensor telemetry, weather intelligence, risk analysis, and agricultural advisory** into a single farmer-facing application.

AGRIO is designed around a simple principle:

> **Camera tells AGRIO what the crop looks like. Sensors tell AGRIO what is happening in the field. Weather tells AGRIO what may happen next. AGRIO combines these signals into actionable farming guidance.**

The platform is designed for environments where Internet connectivity may be unreliable or unavailable, with on-device AI and local data storage enabling important functionality to continue offline.

---

## 🚀 Live Project

### 🌐 Live Demo

👉 **[Open AGRIO](YOUR_VERCEL_URL)**

> Replace `YOUR_VERCEL_URL` with the actual Vercel deployment URL.

### 💻 GitHub

👉 **https://github.com/Heisen-07/AGRIO**

---

# ✨ Core Features

## 1. 📷 AI Crop Disease Scanner

AGRIO provides image-based crop health analysis through a hybrid AI architecture.

The scanner can analyze supported crop images for disease-related findings and can abstain when the available evidence is insufficient.

### 🧠 Offline CropGuard AI

AGRIO integrates a real ONNX plant-disease classification model that runs locally in the browser.

**CropGuard characteristics:**

- ResNet50 architecture
- 38 PlantVillage classes
- 14 supported crops
- ONNX model format
- ONNX Runtime Web
- WebAssembly execution
- Local/on-device inference
- No API required for CropGuard inference
- Image preprocessing aligned with the model requirements

### 🌱 Supported Crops

CropGuard currently supports:

| Crop | Offline AI |
|---|---|
| 🍎 Apple | ✅ Supported |
| 🫐 Blueberry | ✅ Supported |
| 🍒 Cherry | ✅ Supported |
| 🌽 Corn / Maize | ✅ Supported |
| 🍇 Grape | ✅ Supported |
| 🍊 Orange | ✅ Supported |
| 🍑 Peach | ✅ Supported |
| 🫑 Bell Pepper | ✅ Supported |
| 🥔 Potato | ✅ Supported |
| 🫐 Raspberry | ✅ Supported |
| 🌱 Soybean | ✅ Supported |
| 🎃 Squash | ✅ Supported |
| 🍓 Strawberry | ✅ Supported |
| 🍅 Tomato | ✅ Supported |

AGRIO does not relabel unsupported crops into one of the supported CropGuard classes.

---

# 🛡️ 2. AI Safety & Abstention

A key AGRIO design principle is:

> **When the system cannot establish a reliable diagnosis, it should abstain rather than guess.**

CropGuard uses multiple validation gates before accepting a prediction.

### Guardrails include

- Supported crop whitelist
- Crop/class compatibility
- Image-quality validation
- Confidence threshold
- Top-1 / Top-2 prediction margin
- Prediction entropy
- Invalid logits detection
- Unknown-result handling
- Cross-crop mismatch rejection
- Malformed output handling

### CropGuard acceptance policy

```text
Confidence ≥ 0.55
Margin ≥ 0.10
Entropy ≤ 2.5 bits
        +
Supported Crop
        +
Crop/Class Compatible
        +
Image Quality Acceptable
        ↓
     ACCEPT
☁️ 3. Online Gemini AI

When Internet connectivity is available, AGRIO can use Gemini multimodal vision for cloud-assisted crop analysis.

The cloud response is normalized into AGRIO's structured vision schema and passed through the application's validation/safety policy.

Hybrid AI architecture
                  Crop Image
                      │
                      ▼
             ┌─────────────────┐
             │ AGRIO AI Router │
             └────────┬────────┘
                      │
             ┌────────┴────────┐
             │                 │
          Online             Offline
             │                 │
             ▼                 ▼
          Gemini          CropGuard ONNX
             │                 │
             └────────┬────────┘
                      │
                      ▼
               Safety / Schema
                  Validation
                      │
                      ▼
                 AI Finding

If cloud AI is unavailable, AGRIO can continue using the on-device pathway for supported crops.

If advanced AI inference is unavailable, the application retains a deterministic computer-vision fallback for graceful operation.

🌱 4. Unified Farm Advisory

AGRIO goes beyond disease classification.

The Advisory Board combines available information from:

📷 Crop Image
      +
📡 Field Sensors
      +
🌦 Weather
      +
🧠 AI Findings
      ↓
🌱 AGRIO Advisory

The farmer receives a single decision-support view containing:

Overall crop status
Detected issues
Disease observations
Pest observations
Physical damage observations
Nutrient-related visual observations
Risk level
Evidence
Treatment/control guidance
Irrigation recommendation
Prevention guidance
Next actions
Data freshness
Warnings
Uncertainty information
⚠️ 5. Risk Intelligence

AGRIO evaluates multiple factors to identify potential agricultural risks.

Risk categories include:

💧 Soil moisture stress
🌧 Rain / water-related risk
🌡 Temperature / heat stress
💦 Humidity / fungal pressure
🐛 Pest risk
🦠 Disease findings
🌿 Nutrient-related observations
📡 Data-quality risk

AGRIO distinguishes between:

Observed diagnosis

and

Environmental risk factor

For example, high humidity may increase fungal risk, but high humidity alone is not presented as proof that a disease exists.

💧 6. Irrigation Intelligence

AGRIO provides irrigation recommendations using available field and weather information.

Possible recommendation states are:

💧 Required
🌱 Not Required
⏳ Delay
👀 Monitor
⚠️ Insufficient Data

The recommendation can consider:

Soil moisture
Crop moisture target bands
Current moisture status
Rainfall amount
Rainfall timing
Rain probability
Weather freshness
Available telemetry

AGRIO deliberately avoids inventing exact water volumes when the required field information is unavailable.

Important

AGRIO's current MVP provides irrigation recommendations, not automatic valve or pump control.

📡 7. ESP32 Field Sensors

AGRIO contains a telemetry architecture designed to integrate physical ESP32-based agricultural sensors.

Potential telemetry includes:

Soil moisture
Temperature
Relative humidity
VPD
Solar/environmental measurements
Other normalized field measurements
Telemetry architecture
ESP32 PCB
   │
   ├── Soil Moisture
   ├── Temperature
   ├── Humidity
   └── Other Sensors
          │
          ▼
      Wi-Fi / BLE
          │
          ▼
     AGRIO Telemetry
          │
          ▼
    Field Sensors View
          │
          ▼
   Advisory / Risk Engine

The project includes telemetry adapters for the configured communication approaches, including HTTP polling, WebSocket and BLE architecture.

Sensor status

AGRIO distinguishes between:

🟢 ESP32 Connected
🟡 Simulated Sensors
⚪ Not Connected
⚠️ Stale Telemetry

Simulated sensor values are clearly identified and are not presented as real physical measurements.

🌦 8. Climate Intelligence

AGRIO integrates weather information into farm decision support.

Climate functionality includes:

Current weather
Temperature
Humidity
Rain outlook
Forecast
Climate risks
Farming guidance
Weather freshness

Weather state is explicitly represented as:

🟢 Live
🟡 Cached
⚪ Unavailable

AGRIO does not fabricate weather values when live weather information is unavailable.

📍 9. Automatic Location Detection

AGRIO can use the browser's geolocation capabilities to determine the farmer's current location.

The location workflow handles:

Location detection
Permission granted
Permission denied
Location unavailable
Timeout
Unsupported browser
Offline conditions
Cached location

Location detection is designed to occur automatically when entering the dashboard rather than requiring repeated manual GPS actions.

📊 10. Local Farm Analytics

AGRIO stores relevant local history using IndexedDB.

Stored information can include:

Telemetry history
Soil moisture
Environmental measurements
Timestamps
Source information
Diagnosis history
Findings
Disease observations
Pest pressure
Nutrient observations
Severity
Confidence
AI engine
On-device/cloud attribution

Analytics can show:

Soil moisture trends
Moisture statistics
Diagnosis history
Finding categories
Severity
AI engine usage
Data coverage

AGRIO avoids fabricated analytics such as:

Fake yield
Fake growth rates
Fake water savings
Fake fertilizer efficiency
Fake NDVI
Fake historical weather

When insufficient historical data exists, AGRIO shows an honest sparse/empty state.

📱 11. Offline-First Progressive Web App

AGRIO is built as a Progressive Web App (PWA).

The offline architecture uses:

Service Worker
Cache Storage
IndexedDB
ONNX Runtime Web
WebAssembly
Offline application shell
ONNX model caching
Runtime asset caching
Offline architecture
                    AGRIO PWA
                        │
             ┌──────────┴──────────┐
             │                     │
          ONLINE                 OFFLINE
             │                     │
          Gemini               CropGuard
             │                   ONNX
             │                     │
             └──────────┬──────────┘
                        │
                        ▼
                Advisory Engine
                        │
                        ▼
                  Farmer Guidance
Offline capabilities

After required assets and the model have been cached:

Application shell → Offline
IndexedDB → Offline
CropGuard inference → Offline
Advisory calculations → Offline
Risk calculations → Offline

Cloud Gemini and live weather naturally require network access.

The CropGuard model is approximately 94 MB, so the first model download and browser storage availability should be considered when testing on mobile devices.

🇮🇳 12. Farmer-Friendly Interface

AGRIO is designed for practical field use.

Languages
🇬🇧 English
🇮🇳 Hindi
Main Dashboard
🌱 Advisory
📷 AI Scanner
📡 Field Sensors
🌦 Climate
📊 Analytics

The Advisory page is the default dashboard experience.

The interface is designed to work across:

Desktop
Tablet
Mobile
Touch devices
👨‍🌾 13. Farmer & Crop Setup

AGRIO currently supports one active farm/field context for the MVP.

The setup allows the farmer to provide:

Farmer name
Active crop

The profile is stored locally and used to personalize the dashboard.

Example:

Welcome, Vaibhav

Active Crop
🍅 Tomato
🏗️ Technology Stack
Frontend
React 18
Vite 5
Tailwind CSS
Framer Motion
Lucide React
AI / Machine Learning
ONNX
ONNX Runtime Web
WebAssembly
ResNet50
PlantVillage-trained CropGuard
Gemini Multimodal AI
Deterministic computer-vision fallback
Storage
IndexedDB
LocalStorage
IoT / Hardware
ESP32
HTTP polling
WebSocket architecture
BLE architecture
Telemetry normalization
Weather
OpenWeather-based weather service
PWA
Service Worker
Cache Storage
Web App Manifest
Offline-first application shell
Testing
Vitest
ESLint
Python ONNX Runtime validation
📂 Project Structure
AGRIO/
│
├── public/
│   ├── models/
│   │   └── cropguard.onnx
│   ├── sw.js
│   ├── manifest.webmanifest
│   └── ...
│
├── model-test/
│   ├── test_inference.py
│   └── inspect_model.py
│
├── scripts/
│
├── src/
│   ├── components/
│   ├── config/
│   ├── context/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   │   └── telemetry/
│   └── utils/
│
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
⚙️ Installation
Prerequisites

Install the following before running AGRIO:

Node.js 18+
npm
Git

Python is required only for the optional ONNX model validation scripts.

1. Clone the Repository
git clone https://github.com/Heisen-07/AGRIO.git

Enter the project directory:

cd AGRIO
2. Install Dependencies
npm install
3. Configure Environment Variables

Create a .env file in the project root.

VITE_GEMINI_API_KEY=your_gemini_api_key

You can use .env.example as a reference.

⚠️ Important

Never commit .env to GitHub.

The .gitignore configuration should exclude environment files containing secrets.

▶️ Run AGRIO Locally

Start the Vite development server:

npm run dev

Open:

http://localhost:5173
🧪 Testing
Run ESLint
npm run lint

Expected result:

0 errors
0 warnings
Run Vitest
npx vitest run

The test suite includes validation of:

CropGuard safety policies
Supported crop checks
Crop mismatch handling
Image-quality rejection
Confidence handling
Ambiguous predictions
Gemini structured-result validation
Unsupported crop handling
Missing API-key behavior
Safe abstention
Treatment/risk safety
Test the ONNX Model

Python-based validation can be run with:

python model-test/test_inference.py

The model inspection utility can be used to inspect ONNX metadata:

python model-test/inspect_model.py
🏭 Production Build

Create a production build:

npm run build

The output will be generated in:

dist/

Preview the production build locally:

npm run preview
☁️ Deploy to Vercel

AGRIO is configured for Vercel deployment.

Option 1 — GitHub Integration
Push the repository to GitHub.
Open Vercel.
Import the Heisen-07/AGRIO repository.
Configure the required environment variable:
VITE_GEMINI_API_KEY
Deploy the project.

Vercel will automatically build the Vite application.

Option 2 — Vercel CLI

Install the Vercel CLI:

npm install -g vercel

Deploy:

vercel

For production:

vercel --prod
🔌 ESP32 Integration

AGRIO's telemetry layer is separated from the frontend so physical hardware can be integrated independently.

A typical deployment can look like:

              FARM FIELD
                  │
                  ▼
             ┌─────────┐
             │ ESP32   │
             │   PCB   │
             └────┬────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
      Moisture  Temp     Humidity
        │         │         │
        └─────────┼─────────┘
                  │
              Wi-Fi/BLE
                  │
                  ▼
             AGRIO PWA
                  │
         ┌────────┼────────┐
         ▼        ▼        ▼
      Sensors   Risk    Advisory

For local ESP32 connectivity, the farmer's device running AGRIO must be able to communicate with the ESP32 over the configured network or supported browser communication mechanism.

🔒 Data Integrity & Safety Principles

AGRIO follows several important data and safety principles.

No fabricated sensor data

Sensor values are not presented as real measurements unless they originate from the configured telemetry source.

No fabricated weather

When live weather is unavailable, AGRIO uses cached data where appropriate or clearly reports unavailable data.

No fabricated NPK measurements

Image analysis cannot establish actual soil nitrogen, phosphorus, or potassium concentration.

Visual symptoms are presented only as observations that may be consistent with nutrient deficiency.

No universal pesticide dosage

AGRIO avoids hardcoded universal pesticide/fungicide dosage recommendations.

Treatment guidance should be verified against crop-specific and locally approved agricultural guidance.

No automatic valve control

The current MVP recommends irrigation actions but does not automatically activate pumps or valves.

Safe AI uncertainty

When AGRIO cannot reliably determine a supported diagnosis, it can return:

UNKNOWN / ABSTAINED

rather than forcing a disease classification.

🔐 Security Considerations

AGRIO currently uses a Vite client-side environment variable for Gemini configuration:

VITE_GEMINI_API_KEY

Because Vite VITE_* variables are exposed to the client bundle, this approach should be considered suitable for development, controlled demonstrations, and MVP deployment—not as a secure long-term architecture for a public high-traffic production service.

For a hardened public deployment, Gemini requests should eventually be routed through a secure server-side backend/proxy where the API key remains private.

⚠️ Current Limitations
CropGuard Training Domain

CropGuard is trained using PlantVillage-based imagery.

PlantVillage images are primarily controlled/laboratory-style images and may differ significantly from real farm environments.

Real-world images may contain:

Soil
Weeds
Multiple leaves
Complex backgrounds
Shadows
Motion blur
Different lighting
Different camera quality
Multiple plant parts

Therefore, laboratory model performance should not be interpreted as guaranteed field accuracy.

Supported Crop Limitation

Offline CropGuard currently supports only its defined 14-crop taxonomy.

Unsupported crops should not be mapped into an unrelated CropGuard class.

Model Confidence

CropGuard uses model confidence together with additional acceptance criteria.

Model confidence is not equivalent to calibrated real-world diagnostic probability.

Gemini confidence is also treated as a model estimate rather than a scientifically calibrated probability.

PWA Storage

The CropGuard ONNX model is approximately:

~94 MB

ONNX Runtime Web also requires WASM runtime assets.

Depending on the browser and device, storage quotas may affect first-time model caching.

Internet Dependency

Gemini requires Internet connectivity.

Live weather requires Internet connectivity.

Cached weather and local data can remain available according to their freshness and storage state.

ESP32 Hardware

The telemetry architecture is ESP32-ready, but actual field behavior depends on:

Physical sensors
ESP32 firmware
Network connectivity
Communication protocol
Browser capabilities
Hardware adapter configuration

Physical hardware validation is required before claiming field-level hardware reliability.

🗺️ Roadmap
Completed
 Offline-first PWA architecture
 CropGuard ONNX integration
 ResNet50 CropGuard model
 14 supported CropGuard crops
 AI safety and abstention layer
 Crop compatibility validation
 Image-quality validation
 Confidence and ambiguity gates
 Gemini cloud AI
 Gemini safety validation
 Unified farm advisory
 Risk intelligence
 Irrigation recommendations
 Weather integration
 Automatic location detection
 IndexedDB history
 Local analytics
 ESP32 telemetry architecture
 English/Hindi localization
 Mobile-responsive interface
 PWA service-worker caching
 Offline CropGuard inference architecture
 Automated AI safety tests
 Production build validation
 ESLint validation
Future
 Extensive real-world field-image validation
 Full physical ESP32 field validation
 Larger field-specific crop/disease dataset
 Secure server-side Gemini proxy
 Additional crop support with validated models
 Further edge-model optimization for lower-end devices
🧪 Current Engineering Validation

The current codebase has been validated through:

npm run lint
        ↓
      PASS

npx vitest run
        ↓
   24 / 24 PASS

npm run build
        ↓
      PASS

Python ONNX inference
        ↓
      PASS

The production build includes:

AGRIO application bundle
ONNX Runtime Web
WASM runtime
CropGuard ONNX model
Service Worker
PWA assets

Physical mobile/PWA validation remains important before claiming complete field validation.

🎯 AGRIO Architecture

AGRIO combines four major information sources:

                  ┌─────────────────┐
                  │   📷 CAMERA     │
                  │  Crop Vision    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   🧠 AI ENGINE  │
                  │ CropGuard/Gemini│
                  └────────┬────────┘
                           │
                           │
┌─────────────────┐        │        ┌─────────────────┐
│ 📡 ESP32        │────────┼────────│ 🌦 WEATHER      │
│ Field Sensors   │        │        │ Climate Data    │
└─────────────────┘        │        └─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ ⚠️ RISK ENGINE  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ 🌱 AGRIO        │
                  │    ADVISORY     │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         What is       What is       What to
         happening?    the risk?     do now?
🌾 Why AGRIO?

Traditional farming applications often expose individual pieces of information:

Sensor → Reading
Weather → Forecast
AI → Disease

AGRIO attempts to connect those signals into a single decision-support workflow:

Crop
  +
Field
  +
Environment
  +
Weather
  +
AI
  ↓
Actionable Advisory

This enables the farmer to move from:

"What does my crop look like?"

to:

"What is happening, what is the risk, and what should I do next?"

🧑‍💻 Development Philosophy

AGRIO focuses on:

🌱 Farmer-first design
🧠 Edge AI
📡 IoT integration
🌦 Environmental intelligence
📱 Mobile-first usability
🌐 Offline resilience
🔎 Transparent AI uncertainty
🔒 Data integrity
⚠️ Safe abstention
🇮🇳 Local-language accessibility

The system prioritizes trustworthy recommendations over forced predictions.

🤝 Contributing

Contributions, ideas, and technical improvements are welcome.

Suggested workflow:

git clone https://github.com/Heisen-07/AGRIO.git
cd AGRIO
npm install
npm run dev

Before submitting changes:

npm run lint
npx vitest run
npm run build

Please avoid committing:

.env
node_modules/
dist/
.vercel/

and other generated or secret files.

📄 License

Add the project's selected open-source license here.

If AGRIO is being submitted as part of a competition, academic program, or institutional project, include the applicable attribution and usage requirements here.

👨‍💻 Project

AGRIO — Smart Farming Intelligence Platform

GitHub:

https://github.com/Heisen-07/AGRIO

Live Demo:

Open AGRIO

<p align="center"> 🌱 <strong>AGRIO</strong> <br /> <em>Smarter Farming. Actionable Intelligence. Offline Resilience.</em> </p> ```
