import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { X, RefreshCw, UploadCloud, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

const SyncManagerPanel = ({ isOpen, onClose }) => {
  const { isOnline, pendingOps, syncDb, isSyncing, syncProgress } = useNetwork();
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const fetchSummary = async () => {
    if (window.electronAPI?.isDesktop && window.electronAPI.localDB?.getPendingSummary) {
      try {
        setLoading(true);
        const data = await window.electronAPI.localDB.getPendingSummary();
        setSummary(data);
      } catch (err) {
        console.error("Error fetching sync summary:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
    }
  }, [isOpen, pendingOps]); // Refresh when pendingOps changes

  const handleForceSync = async () => {
    if (cooldown) return;
    await syncDb();
    await fetchSummary();
    setCooldown(true);
    setTimeout(() => setCooldown(false), 5000);
  };

  const traduccionesTablas = {
    'sales': 'Ventas',
    'sale_items': 'Detalles de Venta',
    'products': 'Productos',
    'customers': 'Clientes',
    'expenses': 'Gastos',
    'cash_registers': 'Turnos',
    'cash_register_movements': 'Movimientos de Caja',
    'suppliers': 'Proveedores',
    'compras': 'Compras',
    'inventory_movements': 'Movimientos Inventario',
    'product_variants': 'Variaciones'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center relative">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${pendingOps > 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
               <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white leading-none uppercase tracking-tight">Centro de Sync</h2>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isOnline ? 'CONEXIÓN ESTABLE' : 'MODO OFFLINE'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">TOTAL PENDIENTE</p>
              <div className="text-4xl font-black text-slate-800 dark:text-white leading-none">
                {pendingOps} <span className="text-xl text-slate-400">ops</span>
              </div>
            </div>
            {pendingOps > 0 && isOnline && (
              <div className="animate-pulse flex items-center gap-1.5 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md">
                <AlertCircle size={12} /> Esperando red...
              </div>
            )}
            {pendingOps === 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                <CheckCircle2 size={12} /> Al día
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
            {loading ? (
               <div className="py-8 text-center text-slate-400">
                 <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                 <p className="text-xs uppercase font-bold tracking-widest">Calculando...</p>
               </div>
            ) : summary.length > 0 ? (
              summary.map(item => (
                <div key={item.table} className="flex justify-between items-center p-3 sm:p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 dark:bg-slate-800/50 dark:hover:bg-indigo-900/20 border border-slate-100 dark:border-slate-800 transition-colors">
                  <span className="font-bold text-sm tracking-tight text-slate-700 dark:text-slate-300 uppercase">
                    {traduccionesTablas[item.table] || item.table}
                  </span>
                  <span className="text-xs font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
               <div className="py-8 text-center opacity-40">
                 <Database className="mx-auto mb-3" size={32} />
                 <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nada pendiente</p>
               </div>
            )}
          </div>

          {isSyncing && syncProgress && (
            <div className="mt-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                        {syncProgress.step === 'push_start' && 'Subiendo datos (' + pendingOps + ')'}
                        {syncProgress.step === 'pull_start' && 'Descarga iniciada...'}
                        {syncProgress.step === 'pulling_table' && `Descargando: ${traduccionesTablas[syncProgress.table] || syncProgress.table}`}
                        {syncProgress.step === 'done' && 'Sincronización finalizada'}
                    </span>
                    {syncProgress.current && syncProgress.total && (
                         <span className="text-xs font-bold text-indigo-500">{syncProgress.current}/{syncProgress.total}</span>
                    )}
                </div>
                {syncProgress.current && syncProgress.total && (
                    <div className="w-full bg-indigo-100 dark:bg-indigo-950 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                        />
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button 
             onClick={onClose}
             className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cerrar
          </button>
          
          <button
            onClick={handleForceSync}
            disabled={!isOnline || pendingOps === 0 || isSyncing || cooldown}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
              (!isOnline || pendingOps === 0 || cooldown) ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 shadow-none cursor-not-allowed' :
              isSyncing ? 'bg-indigo-400 text-white shadow-indigo-500/20 cursor-wait' :
              'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/30'
            }`}
          >
            {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <UploadCloud size={16} />}
            {isSyncing ? 'SINCRONIZANDO...' : cooldown ? 'ESPERA 5s...' : 'FORZAR SYNC'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SyncManagerPanel;
