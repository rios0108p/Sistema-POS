const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Dynamically handle dev mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Icon path (works both in dev and production)
const iconPath = path.join(__dirname, '../build/icon.ico');

// ===== LOCAL DATABASE (Better-SQLite3) =====
let localDB = null;
let syncManager = null;
let conflictResolver = null;
let mainWindow = null;
let dbInitError = null;

function initLocalDB() {
  try {
    console.log('📦 Starting local database initialization...');
    
    // Use .cjs extensions to avoid ESM issues in Electron/Node
    const localDBPath = path.resolve(__dirname, '..', 'src/services/db/localDB.cjs');
    const migrationsPath = path.resolve(__dirname, '..', 'src/services/db/migrations.cjs');
    
    // Check if files exist before requiring
    if (!fs.existsSync(localDBPath)) {
      const errorMsg = `localDB.cjs source NOT FOUND at: ${localDBPath}`;
      console.error('❌', errorMsg);
      dbInitError = errorMsg;
      return false;
    }

    const { localDB: db } = require(localDBPath);
    const { runMigrations } = require(migrationsPath);
    
    const userDataPath = app.getPath('userData');
    console.log('📂 User data path:', userDataPath);
    
    db.init(userDataPath);
    runMigrations(db.db);
    localDB = db;
    dbInitError = null;
    console.log('✅ Local SQLite database ready');

    // Load sync modules
    try {
      const syncManagerPath = path.resolve(__dirname, '..', 'src/services/sync/syncManager.cjs');
      const conflictResolverPath = path.resolve(__dirname, '..', 'src/services/sync/conflictResolver.cjs');
      
      console.log('📦 Loading syncManager from:', syncManagerPath);
      syncManager = require(syncManagerPath);
      console.log('✅ syncManager loaded successfully');
      
      console.log('📦 Loading conflictResolver from:', conflictResolverPath);
      conflictResolver = require(conflictResolverPath);
      console.log('✅ conflictResolver loaded successfully');

    } catch (err) {
      console.error('❌ Failed to load sync modules:', err);
      console.error('Error details:', err.message);
      if (err.stack) console.error('Stack trace:', err.stack);
    }

    return true;
  } catch (error) {
    console.error('❌ CRITICAL ERROR initializing local DB:');
    console.error(error);
    dbInitError = error.message;
    return false;
  }
}

// ===== REGISTER ALL IPC HANDLERS (outside createWindow to prevent duplicates) =====
function registerIPCHandlers() {
  // ===== WINDOW CONTROLS (for frameless window) =====
  ipcMain.on('window-minimize', () => mainWindow?.minimize());

  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });

  ipcMain.on('window-close', () => mainWindow?.close());

  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

  // ===== DB INIT STATUS (Fix #1: notify renderer about DB status) =====
  ipcMain.handle('db:initStatus', () => ({
    initialized: !!localDB?.isInitialized,
    error: dbInitError
  }));

  // ===== LOCAL DB IPC HANDLERS =====
  ipcMain.handle('db:available', () => !!localDB?.isInitialized);

  ipcMain.handle('db:insert', (event, { table, data }) => {
    if (!localDB) throw new Error('DB not initialized');
    return localDB.insert(table, data);
  });

  ipcMain.handle('db:update', (event, { table, id, data }) => {
    if (!localDB) throw new Error('DB not initialized');
    localDB.update(table, id, data);
    return { success: true };
  });

  ipcMain.handle('db:delete', (event, { table, id }) => {
    if (!localDB) throw new Error('DB not initialized');
    localDB.softDelete(table, id);
    return { success: true };
  });

  ipcMain.handle('db:getById', (event, { table, id }) => {
    if (!localDB) throw new Error('DB not initialized');
    return localDB.getById(table, id);
  });

  ipcMain.handle('db:getAll', (event, { table, options }) => {
    if (!localDB) throw new Error('DB not initialized');
    return localDB.getAll(table, options);
  });

  ipcMain.handle('db:search', (event, { query }) => {
    if (!localDB) throw new Error('DB not initialized');
    return localDB.searchProducts(query);
  });

  ipcMain.handle('db:countPending', () => {
    if (!localDB) return 0;
    return localDB.countPendingOps();
  });

  ipcMain.handle('db:getPendingSummary', () => {
    if (!localDB) return [];

    const tables = [
      'products', 'product_variants', 'categories', 'customers',
      'suppliers', 'sales', 'inventory_movements',
      'expenses', 'cash_registers', 'cash_register_movements',
      'pedidos', 'pedido_detalles', 'compras'
    ];

    const summary = [];
    for (const table of tables) {
      try {
        const row = localDB.db.prepare(
          `SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 'pending'`
        ).get();
        if (row.count > 0) {
          summary.push({ table, count: row.count });
        }
      } catch (e) {
        // Table might not exist
      }
    }
    return summary;
  });

  ipcMain.handle('db:markSynced', (event, { table, id, mysqlId }) => {
    if (!localDB) throw new Error('DB not initialized');
    localDB.markSynced(table, id, mysqlId);
    return { success: true };
  });

  ipcMain.handle('db:getPendingSync', (event, { table }) => {
    if (!localDB) return [];
    return localDB.getPendingSync(table);
  });

  ipcMain.handle('db:upsert', (event, { table, data }) => {
    if (!localDB) throw new Error('DB not initialized');
    return localDB.upsert(table, data);
  });

  // Parameterized user lookup — never use string-interpolated WHERE for this
  ipcMain.handle('db:getUserByUsername', (_event, { username }) => {
    if (!localDB) return null;
    return localDB.getUserByUsername(username);
  });

  ipcMain.handle('db:getUserByPin', (_event, { pin }) => {
    if (!localDB) return null;
    return localDB.getUserByPin(pin);
  });

  ipcMain.handle('db:decrementStock', (event, { productId, qty }) => {
    if (!localDB) return { success: false };
    localDB.decrementStock(productId, qty);
    return { success: true };
  });

  ipcMain.handle('db:getSyncMeta', (event, { key }) => {
    if (!localDB) return null;
    return localDB.getSyncMeta(key);
  });

  ipcMain.handle('db:setSyncMeta', (event, { key, value }) => {
    if (!localDB) throw new Error('DB not initialized');
    localDB.setSyncMeta(key, value);
    return { success: true };
  });

  // ===== SYNC IPC HANDLERS =====
  ipcMain.handle('sync:push', async (event, token) => {
    if (!localDB || !syncManager) throw new Error('Sync not initialized');
    return await syncManager.pushToMySQL(localDB, token);
  });

  ipcMain.handle('sync:pull', async (event, token) => {
    if (!localDB || !syncManager || !conflictResolver) throw new Error('Sync not initialized');
    return await syncManager.pullFromMySQL(localDB, conflictResolver, token);
  });

  ipcMain.handle('sync:full', async (event, token) => {
    if (!localDB || !syncManager || !conflictResolver) throw new Error('Sync not initialized');
    return await syncManager.fullSync(localDB, conflictResolver, token, (progressInfo) => {
        event.sender.send('sync:progress', progressInfo);
    });
  });

  // ===== PRINTER HANDLERS =====
  ipcMain.handle('get-printers', async () => {
    if (!mainWindow) return [];
    return await mainWindow.webContents.getPrintersAsync();
  });

  ipcMain.handle('print-silent', async (event, { html, printerName }) => {
    console.log(`Solicitud de impresión silenciosa para: ${printerName || 'Impresora predeterminada'}`);

    // 302px = 80mm a 96 DPI — el viewport debe coincidir con el ancho del papel
    let printWindow = new BrowserWindow({
      show: false,
      width: 302,
      height: 1200,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Medir la altura real del contenido con fallback seguro
      let heightMicrons = 200000; // 200mm por defecto
      try {
        await new Promise(r => setTimeout(r, 400));
        const scrollHeight = await printWindow.webContents.executeJavaScript(
          'document.documentElement.scrollHeight'
        );
        // 1px @ 96dpi = 264.58 micrones
        heightMicrons = Math.max(Math.ceil(scrollHeight * 264.58), 50000);
        console.log(`Altura medida: ${scrollHeight}px → ${heightMicrons} micrones`);
      } catch (jsErr) {
        console.warn('No se midió altura, usando 200mm por defecto:', jsErr.message);
      }

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Print timeout after 15s'));
        }, 15000);

        printWindow.webContents.print({
          silent: true,
          deviceName: printerName || '',
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: heightMicrons }
        }, (success, errorType) => {
          clearTimeout(timeout);
          if (success) { console.log('Impresión exitosa'); resolve(); }
          else { console.error('Error de impresión:', errorType); reject(new Error(errorType)); }
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Fallo en impresión nativa:', error);
      return { success: false, error: error.message };
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
        printWindow = null;
      }
    }
  });

  ipcMain.handle('native-print', async () => ({ success: true }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'TENDO-POS Professional',
  });

  // Centrar y maximizar suavemente
  mainWindow.maximize();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Forward console messages directly to the terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    switch (level) {
      case 0: console.log(`[Renderer LOG]: ${message}`); break;
      case 1: console.warn(`[Renderer WARN]: ${message}`); break;
      case 2: console.error(`[Renderer ERR]: ${message} (line ${line} in ${sourceId})`); break;
      case 3: console.error(`[Renderer FATAL]: ${message}`); break;
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setIcon(iconPath);

    // Fix #1: Notify renderer about DB status after window is ready
    if (dbInitError) {
      mainWindow.webContents.send('db:init-error', dbInitError);
    }
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register IPC handlers ONCE (Fix #14: prevent duplicate handler errors)
  registerIPCHandlers();

  // Initialize local database before creating window
  initLocalDB();
  createWindow();

  app.on('activate', function () {
    // Fix #14: Only create window, don't re-register handlers
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Cleanup on exit
app.on('before-quit', () => {
  if (localDB) {
    console.log('📦 Closing local database...');
    localDB.close();
  }
});
