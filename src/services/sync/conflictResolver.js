/**
 * conflictResolver.js — Resolves sync conflicts between local SQLite and remote MySQL
 * 
 * Strategy: "Last Write Wins" based on updated_at timestamp
 * Exception: Sales and cash register movements are ALWAYS append-only (never overwrite)
 */

// Tables that are append-only — data is never overwritten, only added
const APPEND_ONLY_TABLES = ['sales', 'sale_items', 'cash_registers', 'cash_register_movements', 'inventory_movements'];

/**
 * Resolve a conflict between a local and remote record
 * @param {Object} localRecord - The local SQLite record
 * @param {Object} remoteRecord - The record from MySQL VPS
 * @param {string} tableName - The table name (optional, for append-only check)
 * @returns {'local' | 'remote'} Which version wins
 */
function resolve(localRecord, remoteRecord, tableName = null) {
  // Append-only tables: local always wins (never overwrite local data)
  if (tableName && APPEND_ONLY_TABLES.includes(tableName)) {
    return 'local';
  }

  // Compare timestamps — Last Write Wins
  const localTime = new Date(localRecord.updated_at).getTime();
  const remoteTime = new Date(remoteRecord.updated_at).getTime();

  if (remoteTime > localTime) {
    return 'remote'; // MySQL has newer data — overwrite local
  } else {
    return 'local';  // Local has newer data — push to MySQL on next sync
  }
}

/**
 * Check if a table is append-only
 */
function isAppendOnly(tableName) {
  return APPEND_ONLY_TABLES.includes(tableName);
}

module.exports = {
  resolve,
  isAppendOnly,
  APPEND_ONLY_TABLES
};
