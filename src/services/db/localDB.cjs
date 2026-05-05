/**
 * localDB.js — Better-SQLite3 Local Database Instance
 * 
 * This module provides the local SQLite database for TENDO-POS offline-first architecture.
 * It runs synchronously (Better-SQLite3) within the Electron main process context.
 * 
 * REGLA DE ORO: SIEMPRE escribir primero aquí, luego sincronizar con MySQL. Nunca al revés.
 */

// Note: This file is designed to run in the Electron main process (Node.js context)
// and be exposed to the renderer via IPC in preload.cjs.
// For the web version, operations go directly to the API.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('⚠️ Better-SQLite3 not available (running in browser?)');
}

// Generate UUID v4
function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

class LocalDB {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the database - call once at app startup
   */
  init(userDataPath) {
    if (this.isInitialized) return;

    const dbDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'tendo-pos-local.db');
    console.log(`📦 SQLite DB path: ${dbPath}`);

    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    // Run schema
    this._initSchema();
    this.isInitialized = true;
    console.log('✅ Local SQLite database initialized');
  }

  _initSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
    } else {
      console.warn('⚠️ schema.sql not found at:', schemaPath);
    }
  }

  // ===== GENERIC CRUD =====

  /**
   * Insert a record into any table
   * @returns {string} The generated UUID
   */
  insert(tableName, data) {
    // Map alias table names to actual schema names
    tableName = this._resolveTableName(tableName);

    const id = data.id || generateUUID();
    const record = { ...data, id };

    // Only add sync control columns for tables that support them
    // (sync_log, sync_metadata, schema_version do NOT have these columns)
    const TABLES_WITHOUT_SYNC = ['sync_log', 'sync_metadata', 'schema_version'];
    if (!TABLES_WITHOUT_SYNC.includes(tableName)) {
      record.sync_status = data.sync_status || 'pending';
      record.updated_at = new Date().toISOString();
      record.local_created_at = data.local_created_at || new Date().toISOString();
      record.is_deleted = data.is_deleted ?? 0;
    }

    const keys = Object.keys(record);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => {
      const v = record[k];
      // Stringify objects/arrays for JSON storage
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
    });

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`
    );
    stmt.run(...values);
    return id;
  }

  /**
   * Update a record
   */
  update(tableName, id, data) {
    tableName = this._resolveTableName(tableName);
    const record = {
      ...data,
      sync_status: 'pending',
      updated_at: new Date().toISOString()
    };

    // Remove id from update data
    delete record.id;

    const setClauses = Object.keys(record).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(record).map(k => {
      const v = record[k];
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
    });

    const stmt = this.db.prepare(
      `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`
    );
    stmt.run(...values, id);
  }

  /**
   * Soft delete a record
   */
  softDelete(tableName, id) {
    tableName = this._resolveTableName(tableName);
    const stmt = this.db.prepare(
      `UPDATE ${tableName} SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?`
    );
    stmt.run(new Date().toISOString(), id);
  }

  /**
   * Get a single record by ID
   */
  getById(tableName, id) {
    const stmt = this.db.prepare(
      `SELECT * FROM ${tableName} WHERE id = ? AND is_deleted = 0`
    );
    return stmt.get(id);
  }

  /**
   * Get all non-deleted records from a table
   */
  getAll(tableName, options = {}) {
    tableName = this._resolveTableName(tableName);
    const { limit, offset, orderBy = 'updated_at DESC', where } = options;
    let sql = `SELECT * FROM ${tableName} WHERE is_deleted = 0`;

    if (where) {
      sql += ` AND ${where}`;
    }

    sql += ` ORDER BY ${orderBy}`;

    if (limit) {
      sql += ` LIMIT ${limit}`;
      if (offset) {
        sql += ` OFFSET ${offset}`;
      }
    }

    const stmt = this.db.prepare(sql);
    return stmt.all();
  }

  /**
   * Get all records pending sync
   */
  getPendingSync(tableName) {
    const stmt = this.db.prepare(
      `SELECT * FROM ${tableName} WHERE sync_status = 'pending' AND is_deleted = 0`
    );
    return stmt.all();
  }

  /**
   * Get all deleted records pending sync (need to push delete to MySQL)
   */
  getPendingDeletes(tableName) {
    const stmt = this.db.prepare(
      `SELECT * FROM ${tableName} WHERE sync_status = 'pending' AND is_deleted = 1`
    );
    return stmt.all();
  }

  /**
   * Mark a record as synced
   */
  markSynced(tableName, id, mysqlId = null) {
    const updates = { sync_status: 'synced' };
    if (mysqlId) updates.mysql_id = mysqlId;

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(updates).map(k => updates[k]);

    const stmt = this.db.prepare(
      `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`
    );
    stmt.run(...values, id);
  }

  /**
   * Mark a record with sync error
   */
  markSyncError(tableName, id, _errorMessage = null) {
    const stmt = this.db.prepare(
      `UPDATE ${tableName} SET sync_status = 'error' WHERE id = ?`
    );
    stmt.run(id);
  }

  /**
   * Count pending operations across all tables
   */
  countPendingOps() {
    const tables = [
      'products', 'product_variants', 'categories', 'customers',
      'suppliers', 'sales', 'sale_items', 'inventory_movements',
      'expenses', 'cash_registers', 'cash_register_movements'
    ];

    let total = 0;
    for (const table of tables) {
      try {
        const row = this.db.prepare(
          `SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 'pending'`
        ).get();
        total += row.count;
      } catch (e) {
        // Table might not exist yet
      }
    }
    return total;
  }

  /**
   * Upsert — used during pull from MySQL
   */
  upsert(tableName, data) {
    const id = data.id || generateUUID();
    const record = {
      ...data,
      id,
      sync_status: data.sync_status || 'synced', // Coming from MySQL, so already synced
      updated_at: data.updated_at || new Date().toISOString()
    };

    const keys = Object.keys(record);
    const placeholders = keys.map(() => '?').join(', ');
    const updateClauses = keys
      .filter(k => k !== 'id')
      .map(k => `${k} = excluded.${k}`)
      .join(', ');
    const values = keys.map(k => {
      const v = record[k];
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
    });

    const stmt = this.db.prepare(
      `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updateClauses}`
    );
    stmt.run(...values);
    return id;
  }

  // ===== SYNC LOG =====

  logSync(tabla, operacion, registroId, resultado, errorMessage = null) {
    this.insert('sync_log', {
      tabla,
      operacion,
      registro_id: registroId,
      resultado,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  // ===== SYNC METADATA =====

  getSyncMeta(key) {
    const row = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSyncMeta(key, value) {
    this.db.prepare(
      `INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value, new Date().toISOString());
  }

  // ===== TRANSACTIONS =====

  transaction(fn) {
    const transact = this.db.transaction(fn);
    return transact();
  }

  /**
   * Find a user by username using a parameterized query (safe from SQL injection)
   */
  getUserByUsername(username) {
    const stmt = this.db.prepare(
      `SELECT * FROM users WHERE nombre_usuario = ? AND is_deleted = 0 LIMIT 1`
    );
    return stmt.get(username);
  }

  /**
   * Find a user by security PIN using a parameterized query
   */
  getUserByPin(pin) {
    const stmt = this.db.prepare(
      `SELECT id, nombre, rol FROM users WHERE pin_seguridad = ? AND is_deleted = 0 LIMIT 1`
    );
    return stmt.get(String(pin));
  }

  /**
   * Search products by barcode or name (used in POS)
   */
  searchProducts(query) {
    // Fix #11: Use CAST to handle activo as both integer 1 and string 'true'
    const stmt = this.db.prepare(
      `SELECT * FROM products 
       WHERE is_deleted = 0 AND (activo = 1 OR activo = 'true' OR activo = 'TRUE')
       AND (nombre LIKE ? OR codigo_barras = ? OR sku = ?
            OR barcodes_agrupados LIKE ?)
       ORDER BY nombre ASC
       LIMIT 50`
    );
    return stmt.all(`%${query}%`, query, query, `%${query}%`);
  }

  /**
   * Resolve table name aliases (e.g. 'proveedores' -> 'suppliers')
   */
  _resolveTableName(name) {
    const aliases = {
      'proveedores': 'suppliers',
      // 'clients' is handled via SQL VIEW in schema.sql
    };
    return aliases[name] || name;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

// Singleton instance
const localDB = new LocalDB();

module.exports = { localDB, generateUUID };
