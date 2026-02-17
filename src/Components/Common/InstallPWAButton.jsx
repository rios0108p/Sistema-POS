import React from 'react';
import { Download, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const InstallPWAButton = () => {
    const { isInstallable, install } = usePWAInstall();

    // DEBUG: Show always, but styled differently if not ready
    if (!isInstallable) {
        return (
            <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl cursor-not-allowed opacity-70 border dark:border-slate-700"
                title="App ya instalada o navegador no compatible"
            >
                <Download size={18} />
                <span className="font-bold text-xs uppercase tracking-widest hidden sm:inline">App Instalada / No disponible</span>
            </button>
        );
    }

    return (
        <button
            onClick={install}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all animate-in fade-in"
        >
            <Download size={18} />
            <span className="font-bold text-xs uppercase tracking-widest">Descargar App</span>
        </button>
    );
};
