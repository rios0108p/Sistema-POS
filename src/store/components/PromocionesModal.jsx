import { useState, useEffect } from 'react';
import { X, Tag, Package, Search, ChevronRight, ShoppingCart } from 'lucide-react';
import { promocionesAPI } from '../../services/api';

export default function PromocionesModal({ isOpen, onClose, onSelect, tiendaId }) {
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadPromos();
        }
    }, [isOpen, tiendaId]);

    const loadPromos = async () => {
        setLoading(true);
        try {
            const data = await promocionesAPI.getAll(tiendaId);
            setPromos(data);
        } catch (error) {
            console.error('Error al cargar promos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredPromos = promos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="modal-overlay flex items-center justify-center bg-slate-900/60 backdrop-blur-md z-[60] p-4">
            <div className="bg-white dark:bg-slate-950 w-full max-w-2xl h-[600px] rounded-[2rem] flex flex-col overflow-hidden shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-amber-500 px-8 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <Tag className="text-white" size={24} />
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-widest">Promociones Activas</h2>
                            <p className="text-[10px] font-bold text-amber-100 uppercase tracking-widest opacity-80">F11 - Selecciona un combo rápidamente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={18} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="BUSCAR PROMOCIÓN POR NOMBRE O DESCRIPCIÓN..."
                            className="input-standard pl-12 h-14 font-black uppercase tracking-tight"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40">
                            <Tag size={40} className="animate-pulse text-slate-400 mb-4" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Buscando ofertas...</span>
                        </div>
                    ) : filteredPromos.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                            <Package size={60} className="text-slate-400 mb-6" />
                            <span className="text-xs font-black uppercase tracking-widest">No hay promociones disponibles</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredPromos.map(promo => (
                                <button
                                    key={promo.id}
                                    onClick={() => onSelect(promo)}
                                    className="group text-left p-5 bg-white dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-amber-500 transition-all flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-amber-500/5"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors">{promo.nombre}</span>
                                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-black rounded-md uppercase">Combo</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-3 line-clamp-1">{promo.descripcion || 'Selecciona este paquete de productos'}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {promo.productos?.map((p, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border dark:border-slate-700/50">
                                                    <span className="text-[9px] font-black text-amber-500">x{p.cantidad}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate max-w-[100px]">{p.nombre}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="ml-6 flex flex-col items-end shrink-0">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Final</span>
                                        <span className="text-2xl font-black text-amber-600 tracking-tighter">${promo.precio_combo}</span>
                                        <div className="mt-2 w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                            <ShoppingCart size={16} strokeWidth={3} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Tips */}
                <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded text-[10px] font-black text-slate-500">ESC</kbd>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cerrar</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded text-[10px] font-black text-slate-500">ENTER</kbd>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Elegir</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
