import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

const NetworkContext = createContext();

// VPS Health endpoint — used for real connectivity check (not just router detection)
const VPS_HEALTH_URL = 'https://tendopos.cloud/api/health';
const CHECK_INTERVAL = 30000; // 30 seconds

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [pendingOps, setPendingOps] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const previousOnline = useRef(true);
  const intervalRef = useRef(null);
  // Ref so runCheck always reads the current pendingOps without stale closure
  const pendingOpsRef = useRef(0);

  // Real connectivity check — pings our actual VPS, not just the router
  const checkRealConnectivity = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds instead of 3

      const response = await fetch(VPS_HEALTH_URL, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Main connectivity monitoring loop
  useEffect(() => {
    const runCheck = async () => {
      const online = await checkRealConnectivity();
      setIsOnline(online);

      // Detect transition from offline → online
      if (online && !previousOnline.current) {
        toast.success(
          `Conexión restaurada — Sincronizando${pendingOpsRef.current > 0 ? ` ${pendingOpsRef.current} operaciones pendientes` : ''}...`,
          {
            duration: 5000,
            icon: '🔄',
            style: {
              borderRadius: '20px',
              background: '#065f46',
              color: '#fff',
              fontWeight: '700',
              fontSize: '12px'
            }
          }
        );

        // Trigger sync (will be connected to syncManager when available)
        window.dispatchEvent(new CustomEvent('network:reconnected'));
        syncDb(); // Automatically trigger sync on reconnection
      }

      // Detect transition from online → offline
      if (!online && previousOnline.current) {
        toast('Modo Offline activado — Las operaciones se guardan localmente', {
          duration: 4000,
          icon: '📡',
          style: {
            borderRadius: '20px',
            background: '#7c2d12',
            color: '#fff',
            fontWeight: '700',
            fontSize: '12px'
          }
        });
      }

      previousOnline.current = online;
    };

    // Initial check
    runCheck();

    // Periodic checks every 30 seconds
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL);

    // Also listen for browser online/offline events as quick triggers
    const handleOnline = () => runCheck();
    const handleOffline = () => {
      setIsOnline(false);
      previousOnline.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkRealConnectivity]);

  // Handle sync progress events from IPC
  useEffect(() => {
      let unsubscribe;
      if (window.electronAPI?.sync?.onProgress) {
          unsubscribe = window.electronAPI.sync.onProgress((info) => {
              setSyncProgress(info);
          });
      }
      return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // Keep ref in sync so runCheck can read current value without stale closure
  useEffect(() => { pendingOpsRef.current = pendingOps; }, [pendingOps]);

  // Update pending ops count from localStorage/SQLite
  const updatePendingOps = useCallback((count) => {
    setPendingOps(count);
  }, []);

  const updateLastSync = useCallback((date) => {
    setLastSync(date);
  }, []);

  const updateSyncStatus = useCallback((syncing) => {
    setIsSyncing(syncing);
  }, []);

  const syncDb = useCallback(async () => {
    if (window.electronAPI?.sync?.full) {
      updateSyncStatus(true);
      try {
        const token = localStorage.getItem('token');
        await window.electronAPI.sync.full(token);
        updateLastSync(new Date().toISOString());
      } catch (error) {
        console.error("Manual sync failed:", error);
      } finally {
        updateSyncStatus(false);
      }
    }
  }, [updateSyncStatus, updateLastSync]);

  return (
    <NetworkContext.Provider value={{
      isOnline,
      lastSync,
      pendingOps,
      isSyncing,
      syncProgress,
      updatePendingOps,
      updateLastSync,
      updateSyncStatus,
      checkRealConnectivity,
      syncDb
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext;
