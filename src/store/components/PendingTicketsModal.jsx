import React from 'react';
import { AlertCircle, Trash2, Save, X } from 'lucide-react';

const PendingTicketsModal = ({ isOpen, onClose, onConfirmBorrar, onConfirmConservar, count }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-900/40 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/20 relative overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

        <div className="p-8 relative z-10">
          {/* Header Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] flex items-center justify-center text-amber-500 shadow-inner group">
              <AlertCircle size={40} strokeWidth={2.5} className="animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">
              Tickets Pendientes
            </h3>
            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] bg-amber-50 dark:bg-amber-900/30 py-1 px-4 rounded-full w-fit mx-auto border border-amber-100 dark:border-amber-800/30">
              {count} VENTA{count > 1 ? 'S' : ''} EN ESPERA DETECTADA{count > 1 ? 'S' : ''}
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed pt-2">
              Debes decidir qué hacer con los tickets que dejaste "en espera" antes de finalizar tu jornada o salir del sistema.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={onConfirmConservar}
              className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-indigo-600/20 group outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Save size={18} className="group-hover:translate-y-[-2px] transition-transform" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-black uppercase tracking-widest">Conservar Tickets</span>
                <span className="text-[8px] font-bold text-white/60 uppercase mt-0.5">Seguirán vivos en el siguiente turno</span>
              </div>
            </button>

            <button
              onClick={onConfirmBorrar}
              className="w-full py-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/30 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group outline-none"
            >
              <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-black uppercase tracking-widest">Borrar Tickets</span>
                <span className="text-[8px] font-bold text-slate-400 group-hover:text-rose-400 uppercase mt-0.5">Se eliminarán permanentemente</span>
              </div>
            </button>

            <button
              onClick={onClose}
              className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-slate-800 dark:hover:text-white uppercase tracking-[0.3em] transition-colors mt-2"
            >
              Regresar a Ventas
            </button>
          </div>
        </div>

        {/* Close Button Top Right */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default PendingTicketsModal;
