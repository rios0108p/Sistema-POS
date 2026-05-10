/**
 * syncManager.cjs — Bidirectional sync between SQLite (local) and MySQL (VPS)
 *
 * FLOW:
 *   fullSync()      → push pending local changes, then pull all remote data
 *   pushToMySQL()   → send pending local records to the VPS API
 *   pullFromMySQL() → download all records from VPS and upsert locally
 */

const API_URL = 'https://tendopos.cloud/api';

// Maps each local table to its VPS endpoint and download config
const TABLE_PULL_CONFIG = [
  { table: 'products',            endpoint: '/productos',    paginated: false,  idField: 'id' },
  { table: 'categories',          endpoint: '/categorias',   paginated: false, idField: 'id' },
  { table: 'customers',           endpoint: '/clientes',     paginated: false, idField: 'id' },
  { table: 'suppliers',           endpoint: '/proveedores',  paginated: false, idField: 'id' },
  { table: 'users',               endpoint: '/usuarios',     paginated: false, idField: 'id' },
  { table: 'stores',              endpoint: '/tiendas',      paginated: false, idField: 'id' },
  { table: 'cash_registers',      endpoint: '/turnos',       paginated: false, idField: 'id', appendOnly: true },
  { table: 'inventory_movements', endpoint: '/movimientos',  paginated: false, idField: 'id', appendOnly: true },
  { table: 'expenses',            endpoint: '/gastos',       paginated: false, idField: 'id', appendOnly: true },
  { table: 'pedidos',             endpoint: '/pedidos',      paginated: false, idField: 'id', appendOnly: true },
];

// Tables that can be pushed up to the VPS
const TABLE_PUSH_CONFIG = {
  products:            { endpoint: '/productos',   method: 'POST' },
  categories:          { endpoint: '/categorias',  method: 'POST' },
  customers:           { endpoint: '/clientes',    method: 'POST' },
  suppliers:           { endpoint: '/proveedores', method: 'POST' },
  sales:               { endpoint: '/ventas',      method: 'POST', appendOnly: true },
  expenses:            { endpoint: '/gastos',      method: 'POST', appendOnly: true },
  cash_registers:      { endpoint: '/turnos',      method: 'POST', appendOnly: true },
  inventory_movements: { endpoint: '/movimientos', method: 'POST', appendOnly: true },
  pedidos:             { endpoint: '/pedidos',     method: 'POST', appendOnly: true },
};

// Event emitter
const listeners = new Map();
function emit(event, data) {
  (listeners.get(event) || []).forEach(fn => fn(data));
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
 * Build Authorization headers.
 * token MUST be passed explicitly — this runs in Node.js (main process)
 * where localStorage does not exist.
 */
function getAuthHeaders(token = null) {
  if (!token) {
    // This warning fires when callers forget to pass the token.
    // Every sync call from the renderer must supply localStorage.getItem('token').
    console.warn('⚠️  syncManager: no token provided — requests will be unauthorized (401)');
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * Fetch all pages from a paginated endpoint
 */
async function fetchAllPages(endpoint, token) {
  const results = [];
  let page = 1;
  const limit = 200;

  while (true) {
    const url = `${API_URL}${endpoint}?page=${page}&limit=${limit}`;
    const response = await fetch(url, { headers: getAuthHeaders(token) });
    if (!response.ok) break;

    const data = await response.json();
    const records = data.data || data;

    if (!Array.isArray(records) || records.length === 0) break;
    results.push(...records);

    // Stop if we got fewer than the limit (last page)
    if (records.length < limit) break;
    page++;
  }

  return results;
}

/**
 * Fetch a non-paginated endpoint
 */
async function fetchAll(endpoint, token) {
  const response = await fetch(`${API_URL}${endpoint}`, { headers: getAuthHeaders(token) });
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * PULL: Download ALL records from VPS and upsert into local SQLite
 */
async function pullFromMySQL(localDB, _conflictResolver, token = null, onProgress = null) {
  const results = { pulled: 0, errors: 0, tables: {} };

  console.log('⬇️  Pulling data from VPS...');
  if (onProgress) onProgress({ step: 'pull_start' });

  for (let i = 0; i < TABLE_PULL_CONFIG.length; i++) {
    const config = TABLE_PULL_CONFIG[i];
    
    if (onProgress) {
        onProgress({ 
            step: 'pulling_table', 
            table: config.table,
            current: i + 1,
            total: TABLE_PULL_CONFIG.length
        });
    }
    try {
      console.log(`  Downloading ${config.table}...`);

      const records = config.paginated
        ? await fetchAllPages(config.endpoint, token)
        : await fetchAll(config.endpoint, token);

      if (!Array.isArray(records)) continue;

      results.tables[config.table] = { pulled: 0 };

      for (const remoteRecord of records) {
        try {
          // Use the remote numeric id as mysql_id, generate a stable local id
          const mysqlId = remoteRecord.id;
          const localId  = remoteRecord.uuid || `mysql-${mysqlId}`;

          const localRecord = {
            ...remoteRecord,
            id:          localId,
            mysql_id:    mysqlId,
            sync_status: 'synced'
          };

          // Sanitize values: better-sqlite3 v9+ cannot bind undefined or boolean
          for (const key of Object.keys(localRecord)) {
            const v = localRecord[key];
            if (v === undefined) {
              localRecord[key] = null;
            } else if (typeof v === 'boolean') {
              localRecord[key] = v ? 1 : 0;
            } else if (v !== null && typeof v === 'object') {
              localRecord[key] = JSON.stringify(v);
            }
          }

          // Table-specific guards for NOT NULL columns the API may omit
          if (config.table === 'users' && !localRecord.password) {
            localRecord.password = '';
          }
          if (config.table === 'inventory_movements' && !localRecord.producto_id) {
            continue; // Skip movements with no product reference
          }

          localDB.upsert(config.table, localRecord);

          // Extract nested product variants if present
          if (config.table === 'products' && remoteRecord.variaciones) {
            let variaciones = remoteRecord.variaciones;
            if (typeof variaciones === 'string') {
              try { variaciones = JSON.parse(variaciones); } catch (e) { variaciones = []; }
            }
            if (Array.isArray(variaciones)) {
              for (const v of variaciones) {
                localDB.upsert('product_variants', {
                  ...v,
                  id:          v.uuid || `mysql-var-${v.id}`,
                  mysql_id:    v.id,
                  producto_id: localId,
                  sync_status: 'synced'
                });
              }
            }
          }

          results.tables[config.table].pulled++;
          results.pulled++;
        } catch (recordErr) {
          console.warn(`  ⚠️ Skipping record in ${config.table}:`, recordErr.message);
          results.errors++;
        }
      }

      console.log(`  ✅ ${config.table}: ${results.tables[config.table].pulled} records`);
    } catch (tableErr) {
      console.error(`  ❌ Error pulling ${config.table}:`, tableErr.message);
      results.errors++;
    }
  }

  // Mark sync timestamp
  localDB.setSyncMeta('last_sync_timestamp', new Date().toISOString());

  emit('pull:complete', results);
  return results;
}

/**
 * PUSH: Send locally pending records up to the VPS
 */
async function pushToMySQL(localDB, token = null) {
  const results = { synced: 0, errors: 0, tables: {} };

  for (const [tableName, config] of Object.entries(TABLE_PUSH_CONFIG)) {
    try {
      const pending = localDB.getPendingSync(tableName);
      const pendingDeletes = localDB.getPendingDeletes(tableName);

      if (pending.length === 0 && pendingDeletes.length === 0) continue;

      results.tables[tableName] = { synced: 0, errors: 0 };

      for (const record of pending) {
        try {
          const { sync_status, local_created_at, is_deleted, mysql_id, ...payload } = record;

          // Parse back JSON fields
          for (const key of ['caracteristicas', 'imagenes', 'permisos', 'variaciones', 'impuestos', 'barcodes_agrupados']) {
            if (payload[key] && typeof payload[key] === 'string') {
              try { payload[key] = JSON.parse(payload[key]); } catch (e) {}
            }
          }

          // Al sincronizar una venta offline, adjuntar sus ítems como 'productos'
          // El servidor requiere este array para procesar la venta y descontar stock
          if (tableName === 'sales' && !mysql_id) {
            try {
              const items = localDB.db.prepare(
                `SELECT * FROM sale_items WHERE venta_id = ? AND is_deleted = 0`
              ).all(record.id);

              payload.productos = items.map(item => {
                let productId = item.producto_id;

                // Convertir formato local 'mysql-N' → número MySQL
                if (typeof productId === 'string' && productId.startsWith('mysql-')) {
                  productId = parseInt(productId.replace('mysql-', ''), 10);
                } else {
                  // Buscar mysql_id en tabla products por si el id es UUID local
                  try {
                    const prod = localDB.db.prepare(
                      `SELECT mysql_id FROM products WHERE id = ? OR mysql_id = ?`
                    ).get(item.producto_id, parseInt(item.producto_id, 10) || 0);
                    if (prod?.mysql_id) productId = prod.mysql_id;
                    else productId = parseInt(productId, 10);
                  } catch (_) {
                    productId = parseInt(productId, 10);
                  }
                }

                // Resolver variacion_id de la misma manera
                let varId = item.variacion_id || null;
                if (typeof varId === 'string' && varId.startsWith('mysql-')) {
                  varId = parseInt(varId.replace('mysql-', ''), 10);
                } else if (varId) {
                  varId = parseInt(varId, 10) || null;
                }

                return {
                  id:          productId,
                  variacion_id: varId,
                  cantidad:    item.cantidad,
                  precio:      item.precio_unitario
                };
              }).filter(item => item.id && !isNaN(item.id));

              if (payload.productos.length === 0) {
                console.warn(`  ⚠️ Venta ${record.id} sin ítems válidos — omitiendo push`);
                continue;
              }

              // Asegurar que turno_id y tienda_id sean numéricos para el servidor
              if (payload.turno_id) payload.turno_id = parseInt(payload.turno_id, 10) || payload.turno_id;
              if (payload.tienda_id) payload.tienda_id = parseInt(payload.tienda_id, 10) || payload.tienda_id;
              if (payload.usuario_id) payload.usuario_id = parseInt(payload.usuario_id, 10) || payload.usuario_id;
            } catch (itemsErr) {
              console.warn(`  ⚠️ No se pudieron cargar sale_items para venta ${record.id}:`, itemsErr.message);
              continue;
            }
          }

          const method = mysql_id ? 'PUT' : 'POST';
          const url = mysql_id
            ? `${API_URL}${config.endpoint}/${mysql_id}`
            : `${API_URL}${config.endpoint}`;

          const response = await fetch(url, {
            method,
            headers: getAuthHeaders(token),
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            localDB.markSynced(tableName, record.id, data?.id || data?.insertId);
            // Cuando una venta se sincroniza, marcar sus sale_items como synced también
            if (tableName === 'sales') {
              try {
                localDB.db.prepare(
                  `UPDATE sale_items SET sync_status = 'synced' WHERE venta_id = ? AND sync_status = 'pending'`
                ).run(record.id);
              } catch (_) {}
            }
            results.synced++;
            results.tables[tableName].synced++;
          } else {
            const errText = await response.text();
            localDB.markSyncError(tableName, record.id, errText);
            results.errors++;
            results.tables[tableName].errors++;
          }
        } catch (err) {
          console.warn(`  ⚠️ Push error for record in ${tableName}:`, err.message);
          results.errors++;
          results.tables[tableName].errors++;
        }
      }

      // Push soft-deletes
      for (const record of pendingDeletes) {
        if (record.mysql_id) {
          try {
            const delRes = await fetch(`${API_URL}${config.endpoint}/${record.mysql_id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
            });
            if (delRes.ok) {
              localDB.markSynced(tableName, record.id);
            } else {
              console.warn(`  ⚠️ DELETE failed for ${tableName}/${record.mysql_id}: HTTP ${delRes.status}`);
            }
          } catch (e) {
            console.warn(`  ⚠️ DELETE network error for ${tableName}/${record.mysql_id}:`, e.message);
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error processing push for ${tableName}:`, err.message);
    }
  }

  emit('push:complete', results);
  return results;
}

/**
 * FULL SYNC: Push local → Pull remote
 */
async function fullSync(localDB, conflictResolver, token = null, onProgress = null) {
  emit('sync:start');
  try {
    console.log('🔄 Starting full sync...');
    if (onProgress) onProgress({ step: 'push_start' });

    const pushResults = await pushToMySQL(localDB, token);
    console.log(`  Push: ${pushResults.synced} synced, ${pushResults.errors} errors`);

    const pullResults = await pullFromMySQL(localDB, conflictResolver, token, onProgress);
    console.log(`  Pull: ${pullResults.pulled} pulled, ${pullResults.errors} errors`);

    const results = { push: pushResults, pull: pullResults, timestamp: new Date().toISOString() };
    if (onProgress) onProgress({ step: 'done', results });
    
    emit('sync:complete', results);
    console.log('✅ Full sync complete');
    return results;
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    emit('sync:error', error);
    throw error;
  }
}

module.exports = { pushToMySQL, pullFromMySQL, fullSync, on, off, emit };
