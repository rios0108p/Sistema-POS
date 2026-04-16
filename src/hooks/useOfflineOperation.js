/**
 * useOfflineOperation.js — OBLIGATORIO EN TODA OPERACIÓN DE DATOS
 * 
 * Hook que implementa la Regla de Oro:
 *   1. Siempre guardar en SQLite primero
 *   2. Si hay internet, intentar sync inmediato en background
 *   3. Retornar éxito inmediatamente sin esperar sync
 * 
 * Uso:
 *   const { execute } = useOfflineOperation('products');
 *   const result = await execute('insert', { nombre: 'Test', precio_venta: 100 });
 */

import { useCallback } from 'react';
import { useNetwork } from '../context/NetworkContext';

// UUID v4 generator (browser-compatible)
function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

/**
 * Check if we're running in Electron with SQLite available
 */
function isDesktopWithDB() {
  return !!window.electronAPI?.isDesktop && !!window.electronAPI?.localDB;
}

export function useOfflineOperation(tableName) {
  const { isOnline, updatePendingOps } = useNetwork();

  /**
   * Execute a data operation (local-first)
   * @param {'insert'|'update'|'delete'} operation - Type of operation
   * @param {Object} data - The data to operate on
   * @param {string} [id] - Record ID (for update/delete)
   * @returns {Promise<{success: boolean, id: string}>}
   */
  const execute = useCallback(async (operation, data, id = null) => {
    // Fix #33: If we're NOT in Electron (web mode), just pass through.
    // The caller (API functions) will handle the actual API call.
    if (!isDesktopWithDB()) {
      return { success: true, id: id || generateUUID(), mode: 'api' };
    }

    try {
      const localDB = window.electronAPI.localDB;

      // STEP 1: Always save to SQLite first (Fix #34-37: await all IPC calls)
      let localId;

      switch (operation) {
        case 'insert': {
          localId = generateUUID();
          await localDB.insert(tableName, {
            ...data,
            id: localId,
            sync_status: 'pending',
            updated_at: new Date().toISOString()
          });
          break;
        }

        case 'update': {
          localId = id;
          await localDB.update(tableName, id, {
            ...data,
            sync_status: 'pending',
            updated_at: new Date().toISOString()
          });
          break;
        }

        case 'delete': {
          localId = id;
          await localDB.softDelete(tableName, id);
          break;
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Fix #37: await the pending count
      const pendingCount = await localDB.countPendingOps();
      updatePendingOps(pendingCount);

      // STEP 2: If online, trigger background sync (non-blocking)
      if (isOnline && window.electronAPI?.sync?.full) {
        // Fire and forget — don't await
        window.electronAPI.sync.full().catch(err => {
          console.warn('Background sync failed (will retry):', err.message);
        });
      }

      // STEP 3: Return success immediately
      return { success: true, id: localId, mode: 'offline' };

    } catch (error) {
      console.error(`Offline operation failed [${operation}] on ${tableName}:`, error);
      return { success: false, error: error.message, mode: 'offline' };
    }
  }, [tableName, isOnline, updatePendingOps]);

  return { execute, isOnline, isSyncing: false, pendingSales: [] };
}

export default useOfflineOperation;

