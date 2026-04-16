/**
 * electron/server/index.cjs — Embedded Express.js Server for TENDO-POS
 * 
 * This Express server runs as a child process within Electron (NOT an external server).
 * It bridges the local SQLite database with the remote MySQL VPS.
 * 
 * Architecture:
 *   [React UI] ←→ [This Express server] ←→ [MySQL en VPS]
 *                       ↕
 *               [Better-SQLite3 local]
 * 
 * Endpoints:
 *   /health        → Local server health check
 *   /sync/push     → Push pending local records to VPS MySQL
 *   /sync/pull     → Pull remote changes from VPS MySQL
 *   /sync/full     → Full bidirectional sync
 *   /sync/status   → Current sync status / pending ops count
 */

const express = require('express');
const cors = require('cors');

let localDB = null;
let syncManager = null;
let conflictResolver = null;

function createSyncServer(db, syncer, resolver) {
  localDB = db;
  syncManager = syncer;
  conflictResolver = resolver;

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      message: 'TENDO-POS Sync Server running',
      timestamp: new Date().toISOString(),
      dbReady: !!localDB?.isInitialized
    });
  });

  // Sync status
  app.get('/sync/status', (req, res) => {
    try {
      const pendingOps = localDB ? localDB.countPendingOps() : 0;
      const lastSync = localDB ? localDB.getSyncMeta('last_sync_timestamp') : null;

      res.json({
        pendingOps,
        lastSync,
        isReady: !!localDB?.isInitialized
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Push pending to MySQL
  app.post('/sync/push', async (req, res) => {
    try {
      if (!localDB || !syncManager) {
        return res.status(503).json({ error: 'Sync not initialized' });
      }

      const results = await syncManager.pushToMySQL(localDB);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Pull from MySQL
  app.post('/sync/pull', async (req, res) => {
    try {
      if (!localDB || !syncManager || !conflictResolver) {
        return res.status(503).json({ error: 'Sync not initialized' });
      }

      const results = await syncManager.pullFromMySQL(localDB, conflictResolver);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Full sync (push + pull)
  app.post('/sync/full', async (req, res) => {
    try {
      if (!localDB || !syncManager || !conflictResolver) {
        return res.status(503).json({ error: 'Sync not initialized' });
      }

      const results = await syncManager.fullSync(localDB, conflictResolver);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
}

function startSyncServer(port = 3002) {
  // This function is called from main.cjs AFTER localDB is initialized
  // For now, it's a placeholder — the sync logic runs via IPC, not HTTP
  console.log(`📡 Sync server ready on port ${port} (standby mode)`);
}

module.exports = { createSyncServer, startSyncServer };
