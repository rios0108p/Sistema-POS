const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== IDENTITY =====
  isDesktop: true,
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome,
  electronVersion: process.versions.electron,

  // ===== WINDOW CONTROLS (frameless) =====
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximizedChanged: (callback) => {
    // Fix #28: Remove previous listener to prevent duplicates / memory leak
    ipcRenderer.removeAllListeners('window-maximized-changed');
    ipcRenderer.on('window-maximized-changed', (event, isMaximized) => callback(isMaximized));
  },

  // Fix #1: DB init status notification
  onDbInitError: (callback) => {
    ipcRenderer.removeAllListeners('db:init-error');
    ipcRenderer.on('db:init-error', (event, errorMsg) => callback(errorMsg));
  },
  getDbInitStatus: () => ipcRenderer.invoke('db:initStatus'),

  // ===== PRINTING =====
  nativePrint: (data) => ipcRenderer.invoke('native-print', data),
  printSilent: (html, printerName) => ipcRenderer.invoke('print-silent', { html, printerName }),
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // ===== LOCAL DB & SYNC =====
  localDB: {
    isAvailable: () => ipcRenderer.invoke('db:available'),
    insert: (table, data) => ipcRenderer.invoke('db:insert', { table, data }),
    update: (table, id, data) => ipcRenderer.invoke('db:update', { table, id, data }),
    softDelete: (table, id) => ipcRenderer.invoke('db:delete', { table, id }),
    getById: (table, id) => ipcRenderer.invoke('db:getById', { table, id }),
    getAll: (table, options) => ipcRenderer.invoke('db:getAll', { table, options }),
    searchProducts: (query) => ipcRenderer.invoke('db:search', { query }),
    countPendingOps: () => ipcRenderer.invoke('db:countPending'),
    getPendingSummary: () => ipcRenderer.invoke('db:getPendingSummary'),
    markSynced: (table, id, mysqlId) => ipcRenderer.invoke('db:markSynced', { table, id, mysqlId }),
    getPendingSync: (table) => ipcRenderer.invoke('db:getPendingSync', { table }),
    upsert: (table, data) => ipcRenderer.invoke('db:upsert', { table, data }),
    getSyncMeta: (key) => ipcRenderer.invoke('db:getSyncMeta', { key }),
    setSyncMeta: (key, value) => ipcRenderer.invoke('db:setSyncMeta', { key, value }),
  },
  sync: {
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    full: () => ipcRenderer.invoke('sync:full'),
  }
});
