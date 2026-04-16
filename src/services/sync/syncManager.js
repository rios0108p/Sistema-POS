/**
 * syncManager.js — Orchestrates bidirectional sync between SQLite (local) and MySQL (VPS)
 * 
 * REGLA DE ORO: SIEMPRE escribir primero en SQLite, luego sincronizar con MySQL.
 * 
 * Flow:
 *   pushToMySQL()  → Local pending records → POST/PUT to VPS API → mark synced
 *   pullFromMySQL() → GET from VPS API since last_sync → upsert into SQLite
 *   fullSync()     → push + pull + emit sync:complete
 */

// API base URL for the VPS
const API_URL = 'https://tendopos.cloud/api';

// Table mapping: local SQLite table name → VPS API endpoint
const TABLE_API_MAP = {
  products:               { endpoint: '/productos',    method: 'POST', pullable: true },
  product_variants:       { endpoint: '/productos',    method: 'POST', pullable: false },
  categories:             { endpoint: '/categorias',   method: 'POST', pullable: true },
  customers:              { endpoint: '/clientes',     method: 'POST', pullable: true },
  suppliers:              { endpoint: '/proveedores',  method: 'POST', pullable: true },
  sales:                  { endpoint: '/ventas',       method: 'POST', pullable: true, appendOnly: true },
  sale_items:             { endpoint: '/ventas',       method: 'POST', pullable: false, appendOnly: true },
  expenses:               { endpoint: '/gastos',       method: 'POST', pullable: true },
  cash_registers:         { endpoint: '/turnos',       method: 'POST', pullable: true, appendOnly: true },
  inventory_movements:    { endpoint: '/movimientos',  method: 'POST', pullable: true, appendOnly: true },
  users:                  { endpoint: '/usuarios',     method: 'POST', pullable: true },
};

// Listeners for sync events
const listeners = new Map();

function emit(event, data) {
  const handlers = listeners.get(event) || [];
  handlers.forEach(fn => fn(data));
}

function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
}

function off(event, fn) {
  const handlers = listeners.get(event) || [];
  listeners.set(event, handlers.filter(h => h !== fn));
}

/**
 * Get auth token from localStorage
 */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('token') 
    : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * PUSH: Send locally pending records to MySQL via VPS API
 */
async function pushToMySQL(localDB) {
  const results = { synced: 0, errors: 0, tables: {} };

  for (const [tableName, config] of Object.entries(TABLE_API_MAP)) {
    try {
      const pending = localDB.getPendingSync(tableName);
      const pendingDeletes = localDB.getPendingDeletes(tableName);

      if (pending.length === 0 && pendingDeletes.length === 0) continue;

      results.tables[tableName] = { pending: pending.length, synced: 0, errors: 0 };

      // Push new/updated records
      for (const record of pending) {
        try {
          // Remove local-only fields before sending
          const { sync_status, local_created_at, is_deleted, mysql_id, ...payload } = record;

          // Parse JSON fields back to objects
          for (const key of ['caracteristicas', 'imagenes', 'permisos']) {
            if (payload[key] && typeof payload[key] === 'string') {
              try { payload[key] = JSON.parse(payload[key]); } catch (e) {}
            }
          }

          const response = await fetch(`${API_URL}${config.endpoint}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            localDB.markSynced(tableName, record.id, data?.id || data?.insertId);
            localDB.logSync(tableName, 'push', record.id, 'success');
            results.synced++;
            results.tables[tableName].synced++;
          } else {
            const errorData = await response.text();
            console.error(`Sync push error for ${tableName}/${record.id}:`, errorData);
            localDB.markSyncError(tableName, record.id, errorData);
            localDB.logSync(tableName, 'push', record.id, 'error', errorData);
            results.errors++;
            results.tables[tableName].errors++;
          }
        } catch (error) {
          console.error(`Network error pushing ${tableName}/${record.id}:`, error.message);
          // Leave as 'pending' — will retry next cycle
          localDB.logSync(tableName, 'push', record.id, 'network_error', error.message);
          results.errors++;
          results.tables[tableName].errors++;
        }
      }

      // Push soft-deletes
      for (const record of pendingDeletes) {
        try {
          if (record.mysql_id) {
            const response = await fetch(`${API_URL}${config.endpoint}/${record.mysql_id}`, {
              method: 'DELETE',
              headers: getAuthHeaders()
            });

            if (response.ok) {
              localDB.markSynced(tableName, record.id);
              localDB.logSync(tableName, 'delete', record.id, 'success');
            }
          }
        } catch (error) {
          console.error(`Error syncing delete for ${tableName}/${record.id}:`, error.message);
        }
      }

    } catch (error) {
      console.error(`Error processing table ${tableName}:`, error);
    }
  }

  emit('push:complete', results);
  return results;
}

/**
 * PULL: Download records from MySQL VPS that are newer than our last sync
 */
async function pullFromMySQL(localDB, conflictResolver) {
  const lastSync = localDB.getSyncMeta('last_sync_timestamp') || '1970-01-01T00:00:00.000Z';
  const results = { pulled: 0, conflicts: 0, tables: {} };

  const pullableTables = Object.entries(TABLE_API_MAP).filter(([_, c]) => c.pullable);

  for (const [tableName, config] of pullableTables) {
    try {
      const response = await fetch(
        `${API_URL}${config.endpoint}?updated_since=${encodeURIComponent(lastSync)}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) continue;

      let records = await response.json();

      // Handle paginated responses
      if (records.data && Array.isArray(records.data)) {
        records = records.data;
      }

      if (!Array.isArray(records) || records.length === 0) continue;

      results.tables[tableName] = { pulled: 0, conflicts: 0 };

      for (const remoteRecord of records) {
        try {
          // Map MySQL id to our mysql_id field
          const localRecord = {
            ...remoteRecord,
            mysql_id: remoteRecord.id,
            id: remoteRecord.uuid || `mysql-${remoteRecord.id}`,
            sync_status: 'synced'
          };

          // Check for conflicts
          const existing = localDB.getById(tableName, localRecord.id);

          if (existing && existing.sync_status === 'pending') {
            // This record was modified locally AND remotely — conflict!
            if (config.appendOnly) {
              // For append-only tables (sales, shifts), never overwrite
              continue;
            }

            const resolution = conflictResolver.resolve(existing, localRecord);
            if (resolution === 'remote') {
              localDB.upsert(tableName, localRecord);
              results.tables[tableName].conflicts++;
              results.conflicts++;
            }
            // If 'local' wins, we don't overwrite — push will handle it
          } else {
            // No conflict — upsert
            localDB.upsert(tableName, localRecord);
            results.tables[tableName].pulled++;
            results.pulled++;
          }
        } catch (error) {
          console.error(`Error pulling record for ${tableName}:`, error);
        }
      }

    } catch (error) {
      console.error(`Error pulling table ${tableName}:`, error.message);
    }
  }

  // Update last sync timestamp
  localDB.setSyncMeta('last_sync_timestamp', new Date().toISOString());

  emit('pull:complete', results);
  return results;
}

/**
 * FULL SYNC: Push local changes, then pull remote changes
 */
async function fullSync(localDB, conflictResolver) {
  emit('sync:start');

  try {
    console.log('🔄 Starting full sync...');

    const pushResults = await pushToMySQL(localDB);
    console.log(`  Push: ${pushResults.synced} synced, ${pushResults.errors} errors`);

    const pullResults = await pullFromMySQL(localDB, conflictResolver);
    console.log(`  Pull: ${pullResults.pulled} pulled, ${pullResults.conflicts} conflicts`);

    const results = {
      push: pushResults,
      pull: pullResults,
      timestamp: new Date().toISOString()
    };

    emit('sync:complete', results);
    console.log('✅ Full sync complete');

    return results;
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    emit('sync:error', error);
    throw error;
  }
}

module.exports = {
  pushToMySQL,
  pullFromMySQL,
  fullSync,
  on,
  off,
  emit
};
