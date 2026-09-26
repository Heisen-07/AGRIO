import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpPollingAdapter } from '../telemetry/hardwareAdapters';
import { TelemetryManager } from '../telemetry/telemetryManager';
import { translations } from '../../utils/i18n';

describe('Hardware Offline Telemetry Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('HttpPollingAdapter', () => {
    it('reports hardwareOffline: true and does not emit fresh telemetry when ESP32 is offline (hwOnline: false)', async () => {
      // Mock fetch returning hwOnline: false from api/telemetry
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hwOnline: false,
          error: 'ESP32 hardware is offline',
        }),
      });

      const onData = vi.fn();
      const onStatus = vi.fn();

      const adapter = new HttpPollingAdapter();
      adapter.start({ url: '/api/telemetry', intervalMs: 5000, farmId: 'farm-1' }, onData, onStatus);

      // Trigger first poll
      await vi.advanceTimersByTimeAsync(10);

      expect(onData).not.toHaveBeenCalled();
      expect(onStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          connected: false,
          mode: 'rest_poll',
          hardwareOffline: true,
          error: 'ESP32 hardware is offline',
        })
      );

      adapter.stop();
    });

    it('emits live telemetry when ESP32 is online (hwOnline: true)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hwOnline: true,
          soilMoisture: 45,
          rain: 0,
          temperature: 28.5,
          humidity: 62,
        }),
      });

      const onData = vi.fn();
      const onStatus = vi.fn();

      const adapter = new HttpPollingAdapter();
      adapter.start({ url: '/api/telemetry', intervalMs: 5000, farmId: 'farm-1' }, onData, onStatus);

      await vi.advanceTimersByTimeAsync(10);

      expect(onData).toHaveBeenCalledTimes(1);
      const snapshot = onData.mock.calls[0][0];
      expect(snapshot.source).toBe('rest_poll');
      expect(snapshot.soilMoisture.current).toBe(45);
      expect(onStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          connected: true,
          mode: 'rest_poll',
          hardwareOffline: false,
          error: null,
        })
      );

      adapter.stop();
    });
  });

  describe('TelemetryManager offline fallback', () => {
    it('activates simulated fallback when hardware reports hardwareOffline, maintaining disconnected live state', async () => {
      // Return offline on first poll
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hwOnline: false,
          error: 'ESP32 hardware is offline',
        }),
      });

      const manager = new TelemetryManager();
      const statusUpdates = [];
      const dataUpdates = [];

      manager.subscribeStatus((st) => statusUpdates.push(st));
      manager.subscribe((data) => dataUpdates.push(data));

      manager.switchMode('rest_poll', { url: '/api/telemetry', intervalMs: 5000, farmId: 'farm-1' });

      // Run poll cycle
      await vi.advanceTimersByTimeAsync(100);

      const latestStatus = manager.getStatus();
      expect(latestStatus.connected).toBe(false);
      expect(latestStatus.hardwareOffline).toBe(true);
      expect(latestStatus.simulatedFallback).toBe(true);

      // Advance time for simulated fallback adapter to tick
      await vi.advanceTimersByTimeAsync(3500);

      // Data should be streaming via simulated fallback
      expect(dataUpdates.length).toBeGreaterThan(0);
      const lastSnapshot = dataUpdates[dataUpdates.length - 1];
      expect(lastSnapshot.source).toBe('simulated');

      manager.stop();
    });
  });

  describe('i18n translations for hardware offline', () => {
    it('has English and Hindi translations for hardware offline state', () => {
      expect(translations.en.sensorHardwareOffline).toBe('Hardware Offline');
      expect(translations.hi.sensorHardwareOffline).toBe('हार्डवेयर ऑफ़लाइन');
      expect(translations.en.sensorSimulatedFallback).toBe('Simulated Fallback');
      expect(translations.hi.sensorSimulatedFallback).toBe('सिम्युलेटेड फ़ॉलबैक');
    });
  });
});
