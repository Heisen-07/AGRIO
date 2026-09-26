/**
 * AGRIO Telemetry Manager
 * ───────────────────────
 * Single orchestrator that:
 *  1. Selects the active hardware adapter based on user choice / env config.
 *  2. Normalizes all incoming data through the telemetry schema.
 *  3. Exposes subscribe/unsubscribe for React hooks to consume.
 *  4. Persists configuration to localStorage for session continuity.
 *
 * Usage from React:
 *   import telemetryManager from './telemetry/telemetryManager';
 *   telemetryManager.start({ mode: 'simulated', farmId: 'farm_001' });
 *   const unsub = telemetryManager.subscribe((snapshot) => setTelemetry(snapshot));
 *   // later: unsub();  telemetryManager.stop();
 */

import { SimulatedAdapter, HttpPollingAdapter, WebSocketAdapter, BleAdapterStub, UsbAdapterStub } from './hardwareAdapters';

const STORAGE_KEY = 'agrio_telemetry_config';

const ADAPTERS = {
  simulated: SimulatedAdapter,
  rest_poll: HttpPollingAdapter,
  websocket: WebSocketAdapter,
  ble: BleAdapterStub,
  usb: UsbAdapterStub,
};

class TelemetryManager {
  constructor() {
    this._adapter = null;
    this._mode = 'simulated';
    this._config = {};
    this._subscribers = new Set();
    this._statusSubscribers = new Set();
    this._latestSnapshot = null;
    this._status = { connected: false, mode: 'simulated', lastPing: null, error: null };
    this._simulatedFallback = null; // active only when hardware is offline
  }

  /**
   * Start (or restart) the telemetry feed.
   *
   * @param {Object} config
   * @param {string} config.mode      – 'simulated' | 'rest_poll' | 'websocket' | 'ble'
   * @param {string} config.farmId    – active farm ID
   * @param {string} [config.url]     – endpoint URL for rest_poll or websocket
   * @param {number} [config.intervalMs] – polling interval (default 5000)
   */
  start(config = {}) {
    // Stop any existing adapter first
    this.stop();

    const mode = config.mode || this._loadConfig()?.mode || this._getEnvMode() || 'simulated';
    const mergedConfig = {
      ...this._loadConfig(),
      ...config,
      mode,
    };

    this._mode = mode;
    this._config = mergedConfig;
    this._saveConfig(mergedConfig);

    const AdapterClass = ADAPTERS[mode];
    if (!AdapterClass) {
      console.error(`[TelemetryManager] Unknown mode: ${mode}, falling back to simulated`);
      this._mode = 'simulated';
      this._adapter = new SimulatedAdapter();
    } else {
      this._adapter = new AdapterClass();
    }

    this._adapter.start(
      mergedConfig,
      (snapshot) => this._handleData(snapshot),
      (status) => this._handleStatus(status)
    );
  }

  /**
   * Stop the active adapter.
   */
  stop() {
    this._stopSimulatedFallback();
    if (this._adapter) {
      this._adapter.stop();
      this._adapter = null;
    }
  }

  /**
   * Switch to a different mode without full restart (preserves farmId).
   */
  switchMode(mode, modeConfig = {}) {
    this.start({
      ...this._config,
      ...modeConfig,
      mode,
    });
  }

  /**
   * Send a command to the active adapter (e.g. valve toggle).
   */
  sendCommand(cmd) {
    this._adapter?.sendCommand(cmd);
  }

  /**
   * Subscribe to telemetry snapshots.
   * @param {function} callback – receives TelemetrySnapshot
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    // Immediately emit latest if available
    if (this._latestSnapshot) {
      try { callback(this._latestSnapshot); } catch (e) { /* noop */ }
    }
    return () => this._subscribers.delete(callback);
  }

  /**
   * Subscribe to connection status changes.
   * @param {function} callback – receives { connected, mode, lastPing, error }
   * @returns {function} unsubscribe
   */
  subscribeStatus(callback) {
    this._statusSubscribers.add(callback);
    try { callback(this._status); } catch (e) { /* noop */ }
    return () => this._statusSubscribers.delete(callback);
  }

  /** Get current connection status */
  getStatus() {
    return { ...this._status };
  }

  /** Get latest snapshot without subscribing */
  getLatest() {
    return this._latestSnapshot;
  }

  /** Get current mode */
  getMode() {
    return this._mode;
  }

  /** Get saved config */
  getConfig() {
    return { ...this._config };
  }

  // ── Internal ──────────────────────────────────────────────────

  _handleData(snapshot) {
    this._latestSnapshot = snapshot;
    for (const cb of this._subscribers) {
      try { cb(snapshot); } catch (e) { console.error('[TelemetryManager] subscriber error:', e); }
    }
  }

  _handleStatus(status) {
    // When hardware adapter reports the ESP32 is offline, auto-start
    // the existing simulated adapter as a fallback so telemetry keeps
    // flowing but mark status clearly as hardware-offline + simulated.
    if (status.hardwareOffline && this._mode !== 'simulated') {
      this._startSimulatedFallback();
      this._status = {
        ...status,
        mode: 'rest_poll',
        hardwareOffline: true,
        simulatedFallback: true,
      };
    } else {
      // Hardware came back online or user is in simulated mode
      if (this._simulatedFallback && status.connected) {
        this._stopSimulatedFallback();
      }
      this._status = status;
    }
    for (const cb of this._statusSubscribers) {
      try { cb(this._status); } catch (e) { console.error('[TelemetryManager] status subscriber error:', e); }
    }
  }

  /** Start the simulated fallback adapter (does nothing if already running) */
  _startSimulatedFallback() {
    if (this._simulatedFallback) return;
    this._simulatedFallback = new SimulatedAdapter();
    this._simulatedFallback.start(
      { ...this._config, mode: 'simulated' },
      (snapshot) => {
        // Tag as simulated-fallback so consumers can distinguish
        snapshot.source = 'simulated';
        this._handleData(snapshot);
      },
      () => { /* status updates come from the primary adapter, not fallback */ }
    );
  }

  /** Stop and tear down the simulated fallback adapter */
  _stopSimulatedFallback() {
    if (this._simulatedFallback) {
      this._simulatedFallback.stop();
      this._simulatedFallback = null;
    }
  }

  _getEnvMode() {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_TELEMETRY_WS_URL) return 'websocket';
      if (import.meta.env.VITE_TELEMETRY_API_URL) return 'rest_poll';
    }
    return null;
  }

  _loadConfig() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveConfig(config) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: config.mode,
        url: config.url || '',
        intervalMs: config.intervalMs || 5000,
      }));
    } catch (e) {
      console.warn('[TelemetryManager] Failed to persist config:', e);
    }
  }
}

// Singleton instance — the whole app shares one manager
const telemetryManager = new TelemetryManager();
export { TelemetryManager };
export default telemetryManager;
