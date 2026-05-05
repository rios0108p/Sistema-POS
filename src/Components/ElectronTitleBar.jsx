import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy, Cloud, CloudOff, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

/**
 * ElectronTitleBar — Custom title bar for frameless Electron window.
 * Only renders when running inside Electron (window.electronAPI?.isDesktop).
 * Provides drag region and minimize/maximize/close buttons.
 */
const ElectronTitleBar = () => {
  const isElectron = !!window.electronAPI?.isDesktop;
  const [isMaximized, setIsMaximized] = useState(true);
  const { isOnline, isSyncing, pendingOps, syncDb } = useNetwork();

  useEffect(() => {
    if (!isElectron) return;

    // Check initial state
    window.electronAPI.windowIsMaximized?.().then(setIsMaximized);

    // Listen for maximize/unmaximize events
    window.electronAPI.onWindowMaximizedChanged?.((maximized) => {
      setIsMaximized(maximized);
    });
  }, [isElectron]);

  // Don't render in browser
  if (!isElectron) return null;

  return (
    <div
      className="electron-titlebar flex items-center justify-between h-8 bg-slate-950 select-none shrink-0 z-[9999]"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: App name */}
      <div className="flex items-center gap-2 pl-3">
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
        <span className="text-[10px] font-black text-slate-100 uppercase tracking-[0.2em]">
          TENDO-POS
        </span>
      </div>

      {/* Middle: Connectivity & Sync Status */}
      <div className="flex items-center gap-4 text-[10px] font-bold" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className={`flex items-center gap-1.5 ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <div 
          onClick={() => isOnline && !isSyncing && syncDb()}
          className={`flex items-center gap-1.5 cursor-pointer transition-all ${
            isSyncing ? 'text-indigo-400' : pendingOps > 0 ? 'text-amber-400' : 'text-slate-500 hover:text-indigo-300'
          }`}
          title={isSyncing ? 'Sincronizando...' : `${pendingOps} operaciones pendientes. Click para sincronizar.`}
        >
          {isSyncing ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : pendingOps > 0 ? (
            <CloudOff size={12} />
          ) : (
            <RefreshCw size={12} />
          )}
          <span>
            {isSyncing ? 'SYNCING...' : pendingOps > 0 ? `${pendingOps} PENDING` : 'SYNCED'}
          </span>
        </div>

        {/* New Manual Pull/Download Button */}
        {isOnline && !isSyncing && (
          <button
            onClick={() => syncDb()}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            title="Descargar todos los productos y datos de la nube"
          >
            <Cloud size={12} />
            <span>DOWNLOAD DB</span>
          </button>
        )}
      </div>

      {/* Right: Window controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {/* Minimize */}
        <button
          onClick={() => window.electronAPI.windowMinimize()}
          className="w-12 h-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          title="Minimizar"
        >
          <Minus size={14} strokeWidth={2} />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={() => window.electronAPI.windowMaximize()}
          className="w-12 h-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={2} />
          ) : (
            <Square size={12} strokeWidth={2} />
          )}
        </button>

        {/* Close */}
        <button
          onClick={() => window.electronAPI.windowClose()}
          className="w-12 h-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-600 transition-colors"
          title="Cerrar"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default ElectronTitleBar;
