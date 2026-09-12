/**
 * AGRIO Weather Service
 * ────────────────────
 * Integrates OpenWeatherMap REST APIs for real-time localized agricultural weather:
 *  - Current conditions (temperature, humidity, wind speed, pressure, condition, cloud cover)
 *  - 5-day / 3-hour forecast aggregated into daily high/low forecasts
 *  - In-memory + localStorage caching (15 min TTL) to stay well within free-tier rate limits
 *  - Graceful fallback when offline or API key is absent
 */

const CACHE_KEY = 'agrio_weather_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const DEFAULT_LOCATION = {
  city: 'Ludhiana,IN', // Default agricultural hub in Punjab
  lat: 30.90,
  lon: 75.85,
};

// Weather icon map for OpenWeatherMap icon codes
const ICON_MAP = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};

// Day name keys for i18n
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

let weatherSubscribers = new Set();
let cachedData = loadFromStorage();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return parsed.data;
    }
  } catch {
    // Ignore cache parse errors
  }
  return null;
}

function saveToStorage(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Get OpenWeatherMap API key from Vite environment
 */
export function getApiKey() {
  return import.meta.env.VITE_OPENWEATHER_API_KEY || '';
}

/**
 * Check if OpenWeatherMap is configured with a valid key
 */
export function isWeatherConfigured() {
  const key = getApiKey();
  return Boolean(key && key.trim().length > 10);
}

/**
 * Transform OpenWeatherMap current weather payload to AGRIO format
 */
function parseCurrentWeather(raw) {
  const main = raw.main || {};
  const weather0 = (raw.weather && raw.weather[0]) || {};
  const wind = raw.wind || {};

  const tempC = Math.round(main.temp);
  const humidity = main.humidity ?? 60;
  const windKmH = Math.round((wind.speed || 0) * 3.6); // m/s to km/h

  // Agricultural UV estimate based on cloud cover & time of day if not in API
  const clouds = raw.clouds?.all ?? 20;
  const estimatedUV = Math.max(1.0, Number(((100 - clouds) / 15).toFixed(1)));

  return {
    temperature: tempC,
    feelsLike: Math.round(main.feels_like ?? tempC),
    humidity,
    windSpeed: windKmH,
    windDegree: wind.deg ?? 0,
    uvIndex: estimatedUV,
    pressure: main.pressure ?? 1013,
    condition: weather0.main || 'Clear',
    description: weather0.description || 'Clear sky',
    iconCode: weather0.icon || '01d',
    emojiIcon: ICON_MAP[weather0.icon] || '☀️',
    cityName: raw.name || 'Punjab Farm',
    country: raw.sys?.country || 'IN',
    timestamp: Date.now(),
  };
}

/**
 * Transform OpenWeatherMap 5-day / 3-hr forecast into daily summaries
 */
function parseForecast(list = []) {
  if (!Array.isArray(list) || list.length === 0) return [];

  // Group readings by date (YYYY-MM-DD)
  const byDate = {};
  for (const item of list) {
    const dtTxt = item.dt_txt || '';
    const dateKey = dtTxt.split(' ')[0] || new Date(item.dt * 1000).toISOString().split('T')[0];
    if (!byDate[dateKey]) {
      byDate[dateKey] = [];
    }
    byDate[dateKey].push(item);
  }

  const days = Object.entries(byDate).slice(0, 5).map(([dateStr, items]) => {
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let middayItem = items[Math.floor(items.length / 2)] || items[0];
    let dayRainMm = 0; // summed forecast precipitation for the day (mm)
    let dayMaxPop = 0; // strongest chance of rain across the day (%)

    for (const it of items) {
      const t = it.main?.temp;
      if (typeof t === 'number') {
        if (t < minTemp) minTemp = t;
        if (t > maxTemp) maxTemp = t;
      }
      // OWM only includes rain.3h when precipitation is expected in that slot.
      const slotMm = it.rain?.['3h'];
      if (typeof slotMm === 'number' && Number.isFinite(slotMm)) dayRainMm += slotMm;
      const slotPop = typeof it.pop === 'number' ? Math.round(it.pop * 100) : 0;
      if (slotPop > dayMaxPop) dayMaxPop = slotPop;
      // Prefer reading close to 12:00
      if (it.dt_txt?.includes('12:00')) {
        middayItem = it;
      }
    }

    const d = new Date(dateStr);
    const dayKey = DAY_KEYS[d.getDay()] || 'mon';
    const weather0 = middayItem.weather?.[0] || {};
    const iconCode = weather0.icon || '01d';
    const pop = Math.round((middayItem.pop || 0) * 100); // probability of precipitation

    const high = Math.round(maxTemp === -Infinity ? 28 : maxTemp);
    const low = Math.round(minTemp === Infinity ? 18 : minTemp);

    return {
      date: dateStr,
      dayKey,
      high: `${high}°`,
      low: `${low}°`,
      tempRange: `${high}°C / ${low}°C`,
      icon: ICON_MAP[iconCode] || '☀️',
      iconCode,
      label: weather0.main || 'Clear',
      description: weather0.description || '',
      rainChance: pop > 0 ? `${pop}% Rain` : 'Low Rain',
      pop,
      // Additive fields (Phase 4): forecast rain AMOUNT + strongest chance for the day.
      rainMm: Number(dayRainMm.toFixed(1)),
      maxPop: dayMaxPop,
    };
  });

  return days;
}

/**
 * Summarize near-term rainfall from the raw 3-hour forecast list so the advisory
 * engine can prefer AMOUNT + timing + probability over probability alone.
 *
 * Reads OWM's `rain['3h']` (mm) and `pop` per slot within a look-ahead window and
 * returns { windowHours, maxPop, totalMm, nextRainAt (epoch ms|null), slots }.
 * Nothing is fabricated: slots with no rain channel simply contribute 0 mm, and
 * an empty/absent list returns null so downstream code falls back to `forecast[0].pop`.
 *
 * @param {Array}  list        OWM forecast.list (3-hourly)
 * @param {number} nowMs       reference "now" (epoch ms)
 * @param {number} windowHours look-ahead horizon (default 24h)
 */
function summarizeUpcomingRain(list = [], nowMs = Date.now(), windowHours = 24) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const windowEnd = nowMs + windowHours * 3600 * 1000;

  let maxPop = 0;
  let totalMm = 0;
  let nextRainAt = null;
  let counted = 0;

  for (const it of list) {
    const atMs = typeof it.dt === 'number' ? it.dt * 1000 : Date.parse(it.dt_txt || '');
    if (!Number.isFinite(atMs)) continue;
    // Only slots between now and the window edge inform an irrigation decision.
    if (atMs < nowMs || atMs > windowEnd) continue;
    counted += 1;

    const pop = typeof it.pop === 'number' ? Math.round(it.pop * 100) : 0;
    const mm = it.rain?.['3h'];
    const slotMm = typeof mm === 'number' && Number.isFinite(mm) ? mm : 0;

    if (pop > maxPop) maxPop = pop;
    totalMm += slotMm;

    // First slot that looks like real rain (measurable amount or a decent chance).
    if (nextRainAt == null && (slotMm >= 0.5 || pop >= 50)) {
      nextRainAt = atMs;
    }
  }

  if (counted === 0) return null;

  return {
    windowHours,
    maxPop,
    totalMm: Number(totalMm.toFixed(1)),
    nextRainAt, // epoch ms of first meaningful slot, or null
    source: 'OpenWeatherMap',
  };
}

const GEO_KEY = 'agrio_user_geo';

/**
 * Get stored user coordinates from localStorage
 */
export function getStoredGeo() {
  try {
    const raw = localStorage.getItem(GEO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Trigger browser GPS to detect device latitude & longitude
 */
export function detectBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        };
        try {
          localStorage.setItem(GEO_KEY, JSON.stringify(coords));
        } catch {
          /* ignore storage availability error */
        }
        resolve(coords);
      },
      (err) => {
        let msg = 'Unable to retrieve location';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings.';
        else if (err.code === 2) msg = 'Location unavailable. Please check your GPS or internet connection.';
        else if (err.code === 3) msg = 'Location request timed out.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

/**
 * Clear stored user GPS coordinates
 */
export function clearStoredGeo() {
  try {
    localStorage.removeItem(GEO_KEY);
  } catch {
    /* ignore storage availability error */
  }
}

/**
 * Fetch live weather + 5-day forecast from OpenWeatherMap
 * @param {Object} options - { city, lat, lon, forceRefresh }
 */
export async function fetchLiveWeather(options = {}) {
  const storedGeo = getStoredGeo();
  const {
    city = (!options.lat && !storedGeo) ? DEFAULT_LOCATION.city : undefined,
    lat = options.lat ?? storedGeo?.lat,
    lon = options.lon ?? storedGeo?.lon,
    forceRefresh = false,
  } = options;

  // Check cache unless forceRefresh is true
  if (!forceRefresh && cachedData) {
    return cachedData;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[WeatherService] No VITE_OPENWEATHER_API_KEY found in .env');
    return null;
  }

  try {
    const locQuery = (lat && lon)
      ? `lat=${lat}&lon=${lon}`
      : `q=${encodeURIComponent(city || DEFAULT_LOCATION.city)}`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?${locQuery}&appid=${apiKey}&units=metric`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?${locQuery}&appid=${apiKey}&units=metric`),
    ]);

    if (!currentRes.ok) {
      throw new Error(`Current weather HTTP ${currentRes.status}`);
    }

    const currentRaw = await currentRes.json();
    const current = parseCurrentWeather(currentRaw);

    let forecast = [];
    let rainOutlook = null;
    if (forecastRes.ok) {
      const forecastRaw = await forecastRes.json();
      forecast = parseForecast(forecastRaw.list);
      rainOutlook = summarizeUpcomingRain(forecastRaw.list, Date.now());
    }

    const weatherData = {
      current,
      forecast,
      rainOutlook, // near-term rain AMOUNT + timing summary (null if forecast absent)
      source: 'OpenWeatherMap',
      updatedAt: Date.now(),
    };

    cachedData = weatherData;
    saveToStorage(weatherData);

    // Notify all subscribers
    weatherSubscribers.forEach((cb) => {
      try {
        cb(weatherData);
      } catch (err) {
        console.error('[WeatherService] Subscriber error:', err);
      }
    });

    return weatherData;
  } catch (err) {
    console.warn('[WeatherService] Failed to fetch live weather:', err);
    // Fall back to expired cache if available
    if (cachedData) return cachedData;
    return null;
  }
}

/**
 * Get the currently cached weather data synchronously
 */
export function getCachedWeather() {
  return cachedData;
}

/**
 * Subscribe to weather updates
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeWeather(callback) {
  weatherSubscribers.add(callback);
  if (cachedData) {
    callback(cachedData);
  }
  return () => {
    weatherSubscribers.delete(callback);
  };
}
