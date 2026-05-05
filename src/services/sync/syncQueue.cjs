/**
 * syncQueue.js — Queue of pending operations with retry logic
 * 
 * Maintains a persistent queue in SQLite (pending_operations table).
 * Operations are retried up to 5 times with exponential backoff.
 */

class SyncQueue {
  constructor(localDB) {
    this.localDB = localDB;
    this.processing = false;
  }

  /**
   * Add an operation to the queue
   */
  enqueue(tabla, operacion, datos) {
    const id = this.localDB.insert('pending_operations', {
      tabla,
      operacion,
      datos: JSON.stringify(datos),
      intentos: 0,
      max_intentos: 5,
      estado: 'pending'
    });
    return id;
  }

  /**
   * Get all pending operations (ordered by creation time)
   */
  getPending() {
    return this.localDB.getAll('pending_operations', {
      where: "estado = 'pending' AND intentos < max_intentos",
      orderBy: 'created_at ASC'
    });
  }

  /**
   * Get count of pending operations
   */
  getPendingCount() {
    try {
      const row = this.localDB.db.prepare(
        "SELECT COUNT(*) as count FROM pending_operations WHERE estado = 'pending' AND intentos < max_intentos"
      ).get();
      return row?.count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Mark an operation as completed
   */
  markCompleted(id) {
    this.localDB.update('pending_operations', id, {
      estado: 'completed',
      sync_status: 'synced'
    });
  }

  /**
   * Increment retry count and update error message
   */
  markRetry(id, errorMessage) {
    const op = this.localDB.getById('pending_operations', id);
    if (!op) return;

    this.localDB.update('pending_operations', id, {
      intentos: (op.intentos || 0) + 1,
      ultimo_intento: new Date().toISOString(),
      error_message: errorMessage,
      estado: (op.intentos || 0) + 1 >= (op.max_intentos || 5) ? 'failed' : 'pending',
      sync_status: 'pending'
    });
  }

  /**
   * Process the queue — called when connectivity is restored.
   * Delegates to syncManager.pushToMySQL which reads sync_status='pending'
   * from each table and pushes them to the VPS.
   */
  async processQueue(syncManager, token = null) {
    if (this.processing) return;
    this.processing = true;

    try {
      // Drive the real sync through the table-level sync_status mechanism
      const results = await syncManager.pushToMySQL(this.localDB, token);

      // Mark queue entries as completed/retry based on push results
      const pending = this.getPending();
      for (const op of pending) {
        try {
          // If the table had no push errors, mark the queue entry done
          const tableResults = results.tables[op.tabla];
          if (!tableResults || tableResults.errors === 0) {
            this.markCompleted(op.id);
          } else {
            this.markRetry(op.id, `Push reported ${tableResults.errors} error(s) for table ${op.tabla}`);
          }
        } catch (error) {
          this.markRetry(op.id, error.message);
        }
      }

      return results;
    } catch (error) {
      console.error('SyncQueue.processQueue failed:', error.message);
      // Mark all pending as retry so they get another chance
      const pending = this.getPending();
      for (const op of pending) {
        this.markRetry(op.id, error.message);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Clean up old completed/failed operations (older than 7 days)
   */
  cleanup() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      this.localDB.db.prepare(
        "DELETE FROM pending_operations WHERE (estado = 'completed' OR estado = 'failed') AND created_at < ?"
      ).run(sevenDaysAgo);
    } catch (e) {
      console.error('Error cleaning up sync queue:', e);
    }
  }
}

module.exports = { SyncQueue };
