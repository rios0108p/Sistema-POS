import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

/**
 * ElectronTitleBar — Custom title bar for frameless Electron window.
 * Only renders when running inside Electron (window.electronAPI?.isDesktop).
 * Provides drag region and minimize/maximize/close buttons.
 */
const ElectronTitleBar = () => {
  const isElectron = !!window.electronAPI?.isDesktop;
  const [isMaximized, setIsMaximized] = useState(true);

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
        <div className="w-3 h-3 rounded-full bg-indigo-500/80"></div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
          TENDO-POS
        </span>
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
