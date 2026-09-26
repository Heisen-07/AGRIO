/**
 * AGRIO Hardware Adapters
 * ───────────────────────
 * Transport implementations connecting physical or simulated nodes to the AGRIO pipeline.
 * All adapters normalize raw incoming payloads through `normalizeTelemetry()` to produce
 * the canonical single-zone TelemetrySnapshot.
 *
 * HARDWARE TRANSPORTS CONTRACT (Phase 8A Software-Readiness):
 * 1. USB:
 *    - Transport: USB
 *    - Purpose: direct local configuration / direct data transfer
 *    - Protocol: TBD (Phase 8B physical board inspection)
 *    - Firmware interface: TBD
 *
 * 2. Bluetooth / BLE:
 *    - Transport: Bluetooth / BLE
 *    - Purpose: offline/local configuration and communication
 *    - GATT specification: TBD (Phase 8B physical board inspection)
 *    - Payload: TBD
 *
 * 3. HTTP:
 *    - Transport: HTTP (REST polling)
 *    - Purpose: online telemetry when internet / Wi-Fi is available
 *    - Endpoint: TBD
 *    - Authentication: TBD
 *    - Payload: TBD
 *
 * PHYSICAL BOARD STATUS:
 * Physical ESP32/PCB integration is NOT complete because the hardware is not yet available.
 */

import { normalizeTelemetry } from './telemetrySchema';
import { getCachedWeather } from '../weatherService';

// ═══════════════════════════════════════════════════════════════
// 1. SIMULATED ADAPTER  (Single-Zone Field Simulation)
// ═══════════════════════════════════════════════════════════════

export class SimulatedAdapter {
  constructor() {
    this._timer = null;
    this._state = null;
    this._onData = null;
    this._onStatus = null;
    this._tickCount = 0;
  }

  start(config, onData, onStatus) {
    this._onData = onData;
    this._onStatus = onStatus;
    const farmId = config?.farmId || '';
    const interval = config?.intervalMs || 5000;

    const liveW = getCachedWeather()?.current;

    // Seed realistic initial single-zone state
    this._state = {
      soilMoisture: { current: 64, zoneA: 64, value: 64 },
      waterLevel: { current: 8500, capacity: 10000 },
      weather: {
        temperature: liveW?.temperature ?? 28,
        humidity: liveW?.humidity ?? 72,
        windSpeed: liveW?.windSpeed ?? 14,
        uvIndex: liveW?.uvIndex ?? 6.2,
        pressure: liveW?.pressure ?? 1013,
        condition: liveW?.condition ?? 'Partly Cloudy',
      },
      valves: { active: false, zoneA: false }, // Internal legacy compatibility only
    };
    this._tickCount = 0;

    this._onStatus?.({ connected: true, mode: 'simulated', lastPing: Date.now(), error: null });

    // Emit initial reading immediately
    this._emit(farmId);

    this._timer = setInterval(() => {
      this._tickCount++;
      this._evolveState();
      this._emit(farmId);
    }, interval);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._onStatus?.({ connected: false, mode: 'simulated', lastPing: null, error: null });
  }

  /** Legacy stub — valve control is NOT part of current MVP */
  sendCommand(_cmd) {
    /* Legacy no-op: Valve control is not part of AGRIO MVP */
  }

  getStatus() {
    return {
      connected: !!this._timer,
      mode: 'simulated',
      lastPing: this._timer ? Date.now() : null,
      error: null,
    };
  }

  // ── Internal ──

  _emit(farmId) {
    const snapshot = normalizeTelemetry(
      { ...this._state, timestamp: new Date().toISOString() },
      farmId,
      'simulated'
    );
    this._onData?.(snapshot);
  }

  _evolveState() {
    const s = this._state;
    const hour = new Date().getHours();
    const liveW = getCachedWeather()?.current;

    if (liveW) {
      // Anchored by live weather data with gentle micro-fluctuations
      s.weather.temperature = drift(s.weather.temperature, liveW.temperature, 0.15, liveW.temperature - 2, liveW.temperature + 2);
      s.weather.humidity = drift(s.weather.humidity, liveW.humidity, 0.2, Math.max(10, liveW.humidity - 4), Math.min(100, liveW.humidity + 4));
      s.weather.windSpeed = drift(s.weather.windSpeed, liveW.windSpeed, 0.25, Math.max(0, liveW.windSpeed - 3), liveW.windSpeed + 5);
      s.weather.uvIndex = liveW.uvIndex ?? s.weather.uvIndex;
      s.weather.pressure = liveW.pressure ?? s.weather.pressure;
      s.weather.condition = liveW.condition ?? s.weather.condition;
    } else {
      // Fallback: Diurnal temperature curve
      const targetTemp = 20 + 12 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
      s.weather.temperature = drift(s.weather.temperature, targetTemp, 0.3, 15, 45);
      s.weather.humidity = drift(s.weather.humidity, 65 + 20 * Math.cos(((hour - 14) / 24) * Math.PI * 2), 0.5, 30, 98);
      s.weather.windSpeed = drift(s.weather.windSpeed, 12, 0.8, 0, 40);
      s.weather.uvIndex = hour >= 6 && hour <= 18
        ? drift(s.weather.uvIndex, 4 + 5 * Math.sin(((hour - 6) / 12) * Math.PI), 0.2, 0, 12)
        : drift(s.weather.uvIndex, 0, 0.3, 0, 12);
      s.weather.pressure = drift(s.weather.pressure, 1013, 0.2, 990, 1035);
    }

    // Single-field soil moisture: natural gradual drying curve
    const currentVal = s.soilMoisture.current ?? 64;
    const delta = rand(-0.25, -0.05); // slow natural moisture loss
    const nextVal = Math.round(clamp(currentVal + delta, 20, 92) * 10) / 10;
    s.soilMoisture.current = nextVal;
    s.soilMoisture.zoneA = nextVal;
    s.soilMoisture.value = nextVal;
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. HTTP POLLING ADAPTER  (Online Hardware Path)
// ═══════════════════════════════════════════════════════════════
/**
 * Transport: HTTP
 * Purpose: online telemetry
 * Endpoint: TBD
 * Authentication: TBD
 * Payload: TBD
 */
export class HttpPollingAdapter {
  constructor() {
    this._timer = null;
    this._onData = null;
    this._onStatus = null;
    this._url = '';
    this._farmId = '';
    this._lastPing = null;
    this._error = null;
  }

  start(config, onData, onStatus) {
    this._onData = onData;
    this._onStatus = onStatus;
    this._url = config?.url?.trim() || '/api/telemetry';
    this._farmId = config?.farmId || '';
    const interval = config?.intervalMs || 5000;

    if (!this._url) {
      this._error = 'No telemetry URL configured';
      this._onStatus?.({ connected: false, mode: 'rest_poll', lastPing: null, error: this._error });
      return;
    }

    this._onStatus?.({ connected: false, mode: 'rest_poll', lastPing: null, error: null });
    this._poll(); // immediate first poll
    this._timer = setInterval(() => this._poll(), interval);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._onStatus?.({ connected: false, mode: 'rest_poll', lastPing: this._lastPing, error: null });
  }

  /** Legacy stub — valve control is not part of current MVP */
  async sendCommand(_cmd) {
    /* No-op: Valve control is not part of current MVP */
  }

  getStatus() {
    return {
      connected: !!this._timer && !this._error,
      mode: 'rest_poll',
      lastPing: this._lastPing,
      error: this._error,
    };
  }

  async _poll() {
    try {
      const res = await fetch(this._url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      this._lastPing = Date.now();
      this._error = null;
      // All transports converge to the canonical single-zone schema
      const snapshot = normalizeTelemetry(raw, this._farmId, 'rest_poll');
      this._onData?.(snapshot);
      this._onStatus?.({ connected: true, mode: 'rest_poll', lastPing: this._lastPing, error: null });
    } catch (err) {
      this._error = err.message;
      this._onStatus?.({ connected: false, mode: 'rest_poll', lastPing: this._lastPing, error: this._error });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. WEBSOCKET ADAPTER  (Real-time push stream)
// ═══════════════════════════════════════════════════════════════
export class WebSocketAdapter {
  constructor() {
    this._ws = null;
    this._onData = null;
    this._onStatus = null;
    this._url = '';
    this._farmId = '';
    this._lastPing = null;
    this._error = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._stopped = false;
  }

  start(config, onData, onStatus) {
    this._onData = onData;
    this._onStatus = onStatus;
    this._url = config?.url || '';
    this._farmId = config?.farmId || '';
    this._stopped = false;
    this._reconnectAttempts = 0;

    if (!this._url) {
      this._error = 'No WebSocket URL configured';
      this._onStatus?.({ connected: false, mode: 'websocket', lastPing: null, error: this._error });
      return;
    }

    this._connect();
  }

  stop() {
    this._stopped = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.onclose = null; // prevent reconnect
      this._ws.close();
      this._ws = null;
    }
    this._onStatus?.({ connected: false, mode: 'websocket', lastPing: this._lastPing, error: null });
  }

  /** Legacy stub — valve control is not part of current MVP */
  sendCommand(_cmd) {
    /* No-op: Valve control is not part of current MVP */
  }

  getStatus() {
    return {
      connected: this._ws?.readyState === WebSocket.OPEN,
      mode: 'websocket',
      lastPing: this._lastPing,
      error: this._error,
    };
  }

  _connect() {
    try {
      this._ws = new WebSocket(this._url);

      this._ws.onopen = () => {
        this._reconnectAttempts = 0;
        this._error = null;
        this._onStatus?.({ connected: true, mode: 'websocket', lastPing: Date.now(), error: null });
      };

      this._ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          this._lastPing = Date.now();
          // All transports converge to the canonical single-zone schema
          const snapshot = normalizeTelemetry(raw, this._farmId, 'websocket');
          this._onData?.(snapshot);
        } catch (err) {
          console.warn('[WebSocketAdapter] Failed to parse message:', err);
        }
      };

      this._ws.onerror = () => {
        this._error = 'WebSocket connection error';
        this._onStatus?.({ connected: false, mode: 'websocket', lastPing: this._lastPing, error: this._error });
      };

      this._ws.onclose = () => {
        if (!this._stopped && this._reconnectAttempts < this._maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
          this._reconnectAttempts++;
          this._onStatus?.({
            connected: false, mode: 'websocket', lastPing: this._lastPing,
            error: `Reconnecting (attempt ${this._reconnectAttempts})...`,
          });
          this._reconnectTimer = setTimeout(() => this._connect(), delay);
        } else if (!this._stopped) {
          this._error = 'Max reconnection attempts reached';
          this._onStatus?.({ connected: false, mode: 'websocket', lastPing: this._lastPing, error: this._error });
        }
      };
    } catch (err) {
      this._error = err.message;
      this._onStatus?.({ connected: false, mode: 'websocket', lastPing: null, error: this._error });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. BLE ADAPTER STUB  (Offline/Local Hardware Path Contract)
// ═══════════════════════════════════════════════════════════════
/**
 * Transport: Bluetooth / BLE
 * Purpose: offline/local configuration and communication
 * GATT specification: TBD
 * Payload: TBD
 *
 * Actual GATT service/characteristic structure will be finalized in Phase 8B
 * after the physical PCB and firmware are available.
 */
export class BleAdapterStub {
  start(config, onData, onStatus) {
    onStatus?.({
      connected: false,
      mode: 'ble',
      lastPing: null,
      error: 'BLE contract TBD — physical board & firmware inspection required in Phase 8B.',
    });
  }

  stop() {}

  sendCommand() {
    /* No-op: Valve control is not part of current MVP */
  }

  getStatus() {
    return { connected: false, mode: 'ble', lastPing: null, error: 'Hardware pending (Phase 8B)' };
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. USB ADAPTER STUB  (Direct Local Connection Contract)
// ═══════════════════════════════════════════════════════════════
/**
 * Transport: USB
 * Purpose: local configuration / direct data transfer
 * Protocol: TBD
 * Firmware interface: TBD
 *
 * Actual USB protocol, serial commands, and endpoint framing will be finalized
 * in Phase 8B after physical PCB and firmware are available.
 */
export class UsbAdapterStub {
  start(config, onData, onStatus) {
    onStatus?.({
      connected: false,
      mode: 'usb',
      lastPing: null,
      error: 'USB contract TBD — physical board & firmware inspection required in Phase 8B.',
    });
  }

  stop() {}

  sendCommand() {
    /* No-op: Valve control is not part of current MVP */
  }

  getStatus() {
    return { connected: false, mode: 'usb', lastPing: null, error: 'Hardware pending (Phase 8B)' };
  }
}

// ── Utility helpers ─────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function drift(current, target, speed, min, max) {
  const noise = rand(-0.5, 0.5);
  const next = current + (target - current) * speed * 0.05 + noise;
  return Math.round(clamp(next, min, max) * 10) / 10;
}
