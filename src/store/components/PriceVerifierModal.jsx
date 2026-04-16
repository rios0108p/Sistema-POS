import { useState, useRef, useEffect } from "react";
import { Search, X, Package, Tag, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { productosAPI } from "../../services/api";
import { CURRENCY_SYMBOL } from "../../utils/currency";

const PriceVerifierModal = ({ isOpen, onClose, tiendaId }) => {
    const [busqueda, setBusqueda] = useState("");
    const [producto, setProducto] = useState(null);
    const [resultados, setResultados] = useState([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const currency = CURRENCY_SYMBOL;

    useEffect(() => {
        if (isOpen) {
            setBusqueda("");
            setProducto(null);
            setResultados([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!busqueda) return;

        setLoading(true);
        try {
            const data = await productosAPI.buscar(busqueda, tiendaId);
            if (data && data.length > 0) {
                if (data.length === 1) {
                    setProducto(data[0]);
                    setResultados([]);
                } else {
                    setResultados(data);
                    setProducto(null);
                }
                setBusqueda("");
            } else {
                setProducto(null);
                setResultados([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay backdrop-blur-sm z-[60]">
            <div className="modal-container max-w-lg p-0 overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-700/50 bg-indigo-600">
                    <div className="flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Search size={20} strokeWidth={3} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Verificador de Precios</h2>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Escanea o busca un producto</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50">
                    <form onSubmit={handleSearch} className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="ESCANEA CÓDIGO DE BARRAS..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full h-14 pl-12 pr-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                        />
                    </form>
                </div>

                {/* Result Area */}
                <div className="p-8 min-h-[300px] flex flex-col items-center justify-center">
                    {loading ? (
                        <div className="animate-spin text-indigo-500">
                            <Package size={48} strokeWidth={1} />
                        </div>
                    ) : resultados.length > 0 ? (
                        <div className="w-full space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar animate-in fade-in slide-in-from-bottom-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Múltiples coincidencias encontradas:</p>
                            {resultados.map(p => (
                                <div 
                                    key={p.id} 
                                    onClick={() => { setProducto(p); setResultados([]); }}
                                    className="p-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-all group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{p.nombre}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.categoria || 'Sin Categoría'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{currency}{Number(p.precio_venta).toFixed(2)}</span>
                                        <p className="text-[8px] font-black text-slate-300 uppercase leading-none mt-1">Stock: {p.cantidad}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center opacity-30 select-none">
                            <Search size={80} strokeWidth={1} className="mx-auto mb-4" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">Esperando escaneo o nombre...</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50 flex justify-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Info size={12} className="text-indigo-500" />
                        Presione <span className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border dark:border-slate-700 text-slate-600 dark:text-white">Esc</span> para salir
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PriceVerifierModal;
