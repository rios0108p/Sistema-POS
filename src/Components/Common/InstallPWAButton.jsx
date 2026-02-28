import React from 'react';
import { Download, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAuth } from '../../context/AuthContext';

export const InstallPWAButton = () => {
    const { isInstallable, install } = usePWAInstall();
    const { user } = useAuth();

    if (user?.rol !== 'admin') {
        return null;
    }

    if (!isInstallable) {
        return (
            <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl cursor-not-allowed border dark:border-slate-700"
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all"
        >
            <Download size={18} />
            <span className="font-bold text-xs uppercase tracking-widest">Descargar App</span>
        </button>
    );
};
