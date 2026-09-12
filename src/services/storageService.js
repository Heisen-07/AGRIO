/**
 * AGRIO Storage Service  (IndexedDB)
 * ────────────────────────────────────
 * Offline-first persistence for:
 *   1. telemetry_history  – timestamped sensor snapshots
 *   2. diagnosis_history  – leaf scan results (disease, severity, advisory, thumbnail)
 *
 * No external dependencies — uses the native IndexedDB API directly.
 * Works 100% offline and in all modern browsers + PWA.
 */

const DB_NAME = 'agrio_db';
const DB_VERSION = 1;

const STORES = {
  TELEMETRY: 'telemetry_history',
  DIAGNOSIS: 'diagnosis_history',
};

let _dbPromise = null;

/**
 * Open (or create) the database. Cached as a singleton promise.
 */
function getDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Telemetry history store
      if (!db.objectStoreNames.contains(STORES.TELEMETRY)) {
        const telStore = db.createObjectStore(STORES.TELEMETRY, { keyPath: 'id', autoIncrement: true });
        telStore.createIndex('farmId', 'farmId', { unique: false });
        telStore.createIndex('timestamp', 'timestamp', { unique: false });
        telStore.createIndex('farmId_timestamp', ['farmId', 'timestamp'], { unique: false });
      }

      // Diagnosis history store
      if (!db.objectStoreNames.contains(STORES.DIAGNOSIS)) {
        const diagStore = db.createObjectStore(STORES.DIAGNOSIS, { keyPath: 'id', autoIncrement: true });
        diagStore.createIndex('farmId', 'farmId', { unique: false });
        diagStore.createIndex('timestamp', 'timestamp', { unique: false });
        diagStore.createIndex('farmId_timestamp', ['farmId', 'timestamp'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[StorageService] Failed to open IndexedDB:', request.error);
      _dbPromise = null;
      reject(request.error);
    };
  });

  return _dbPromise;
}

// ═══════════════════════════════════════════════════════════════
//  TELEMETRY HISTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Save a telemetry snapshot to history.
 * @param {string} farmId
 * @param {Object} telemetryData – canonical TelemetrySnapshot
 */
export async function saveTelemetrySnapshot(farmId, telemetryData) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.TELEMETRY, 'readwrite');
    const store = tx.objectStore(STORES.TELEMETRY);

    store.add({
      farmId,
      timestamp: telemetryData.timestamp || new Date().toISOString(),
      data: telemetryData,
    });

    await promisifyTransaction(tx);
  } catch (err) {
    console.warn('[StorageService] Failed to save telemetry snapshot:', err);
  }
}

/**
 * Get recent telemetry history for a farm.
 * @param {string} farmId
 * @param {number} limit – max records to return (newest first)
 * @returns {Promise<Array>}
 */
export async function getTelemetryHistory(farmId, limit = 50) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.TELEMETRY, 'readonly');
    const store = tx.objectStore(STORES.TELEMETRY);

    const fetchFromIndex = (index, range) => {
      return new Promise((resolve, reject) => {
        const results = [];
        const request = index.openCursor(range, 'prev');
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });
    };

    if (farmId) {
      const index = store.index('farmId_timestamp');
      const range = IDBKeyRange.bound([farmId, ''], [farmId, '\uffff']);
      const results = await fetchFromIndex(index, range);
      if (results.length > 0) return results;
    }

    // Fallback: query newest across the store via timestamp index
    const tsIndex = store.index('timestamp');
    return await fetchFromIndex(tsIndex, null);
  } catch (err) {
    console.warn('[StorageService] Failed to get telemetry history:', err);
    return [];
  }
}

/**
 * Prune old telemetry records, keeping only the most recent `keepCount`.
 */
export async function pruneTelemetryHistory(farmId, keepCount = 500) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.TELEMETRY, 'readwrite');
    const store = tx.objectStore(STORES.TELEMETRY);
    const index = store.index('farmId_timestamp');
    const range = IDBKeyRange.bound([farmId, ''], [farmId, '\uffff']);

    const allKeys = [];
    const keysReq = index.openCursor(range, 'prev');

    await new Promise((resolve, reject) => {
      keysReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          allKeys.push(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      keysReq.onerror = () => reject(keysReq.error);
    });

    // Delete everything beyond keepCount
    if (allKeys.length > keepCount) {
      const toDelete = allKeys.slice(keepCount);
      const delTx = db.transaction(STORES.TELEMETRY, 'readwrite');
      const delStore = delTx.objectStore(STORES.TELEMETRY);
      for (const key of toDelete) {
        delStore.delete(key);
      }
      await promisifyTransaction(delTx);
    }
  } catch (err) {
    console.warn('[StorageService] Failed to prune telemetry history:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
//  DIAGNOSIS HISTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Save a leaf diagnosis result.
 * @param {string} farmId
 * @param {Object} diagnosisData – full diagnosis result from Gemini / edge model
 * @returns {Promise<number>} – the auto-generated record ID
 */
export async function saveDiagnosisRecord(farmId, diagnosisData) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.DIAGNOSIS, 'readwrite');
    const store = tx.objectStore(STORES.DIAGNOSIS);

    const record = {
      farmId,
      timestamp: new Date().toISOString(),
      data: diagnosisData,
      // Store a small thumbnail if image is available (limit to ~50KB)
      thumbnail: diagnosisData.thumbnail || diagnosisData.imagePreview || null,
    };

    const req = store.add(record);
    await promisifyTransaction(tx);
    return req.result;
  } catch (err) {
    console.warn('[StorageService] Failed to save diagnosis record:', err);
    return null;
  }
}

/**
 * Get diagnosis history for a farm.
 * @param {string} farmId
 * @param {number} limit – max records (newest first)
 * @returns {Promise<Array>}
 */
export async function getDiagnosisHistory(farmId, limit = 20) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.DIAGNOSIS, 'readonly');
    const store = tx.objectStore(STORES.DIAGNOSIS);

    const fetchFromIndex = (index, range) => {
      return new Promise((resolve, reject) => {
        const results = [];
        const request = index.openCursor(range, 'prev');
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });
    };

    if (farmId) {
      const index = store.index('farmId_timestamp');
      const range = IDBKeyRange.bound([farmId, ''], [farmId, '\uffff']);
      const results = await fetchFromIndex(index, range);
      if (results.length > 0) return results;
    }

    // Fallback: query newest across the store via timestamp index
    const tsIndex = store.index('timestamp');
    return await fetchFromIndex(tsIndex, null);
  } catch (err) {
    console.warn('[StorageService] Failed to get diagnosis history:', err);
    return [];
  }
}

/**
 * Delete a single diagnosis record by ID.
 */
export async function deleteDiagnosisRecord(id) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.DIAGNOSIS, 'readwrite');
    tx.objectStore(STORES.DIAGNOSIS).delete(id);
    await promisifyTransaction(tx);
  } catch (err) {
    console.warn('[StorageService] Failed to delete diagnosis record:', err);
  }
}

/**
 * Get total counts for display badges.
 */
export async function getDiagnosisCount(farmId) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.DIAGNOSIS, 'readonly');
    const index = tx.objectStore(STORES.DIAGNOSIS).index('farmId');
    const req = index.count(IDBKeyRange.only(farmId));
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// ── Helper ──────────────────────────────────────────────────────
function promisifyTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}
