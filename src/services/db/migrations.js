/**
 * migrations.js — Schema Version Control for Local SQLite
 * 
 * Each migration has a version number and a function that applies changes.
 * Migrations run once and are tracked in the schema_version table.
 */

const migrations = [
  {
    version: 1,
    description: 'Initial schema — all base tables',
    up: (db) => {
      // The base schema is applied via schema.sql during init
      // This migration just marks it as applied
      console.log('  Migration 1: Base schema applied');
    }
  },
  {
    version: 2,
    description: 'Add ventas_pagos table for split payments',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ventas_pagos (
          id TEXT PRIMARY KEY,
          mysql_id INTEGER,
          venta_id TEXT NOT NULL,
          metodo TEXT NOT NULL,
          monto REAL NOT NULL,
          referencia TEXT,
          sync_status TEXT DEFAULT 'pending',
          local_created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          is_deleted INTEGER DEFAULT 0
        );
      `);
      console.log('  Migration 2: ventas_pagos table created');
    }
  },
  {
    version: 3,
    description: 'Add compras table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS compras (
          id TEXT PRIMARY KEY,
          mysql_id INTEGER,
          producto_id TEXT NOT NULL,
          variacion_id TEXT,
          producto_nombre TEXT NOT NULL,
          proveedor_id TEXT,
          tienda_id TEXT,
          usuario_id TEXT,
          turno_id TEXT,
          cantidad INTEGER NOT NULL,
          precio_unitario REAL NOT NULL,
          total REAL NOT NULL,
          fecha TEXT DEFAULT (datetime('now')),
          sync_status TEXT DEFAULT 'pending',
          local_created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          is_deleted INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_compras_sync ON compras(sync_status);
      `);
      console.log('  Migration 3: compras table created');
    }
  }
];

/**
 * Run all pending migrations
 */
function runMigrations(db) {
  // Ensure schema_version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now')),
      description TEXT
    );
  `);

  // Get current version
  const currentVersion = db.prepare(
    'SELECT MAX(version) as ver FROM schema_version'
  ).get();
  const startVersion = currentVersion?.ver || 0;

  console.log(`📋 Current schema version: ${startVersion}`);

  // Apply pending migrations
  const pending = migrations.filter(m => m.version > startVersion);

  if (pending.length === 0) {
    console.log('✅ Schema is up to date');
    return;
  }

  console.log(`🔄 Running ${pending.length} migration(s)...`);

  for (const migration of pending) {
    try {
      migration.up(db);

      db.prepare(
        'INSERT INTO schema_version (version, description) VALUES (?, ?)'
      ).run(migration.version, migration.description);

      console.log(`  ✅ Migration ${migration.version}: ${migration.description}`);
    } catch (error) {
      console.error(`  ❌ Migration ${migration.version} failed:`, error);
      throw error; // Stop on first failure
    }
  }

  console.log(`✅ Schema updated to version ${pending[pending.length - 1].version}`);
}

module.exports = { runMigrations, migrations };
