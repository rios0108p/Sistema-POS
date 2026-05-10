import React, { useEffect, useState, useRef } from "react";
import {
    Clock,
    Calendar as CalendarIcon,
    Search,
    TrendingUp,
    TrendingDown,
    User,
    Store,
    Table,
    FileText,
    Printer,
    CreditCard,
    RefreshCw,
    Activity,
    History
} from "lucide-react";
import { movimientosAPI, dashboardAPI, configuracionAPI, tiendasAPI } from "../services/api";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { printTicket } from "../utils/printUtils";

export default function MovementHistory() {
    const { user } = useAuth();
    const isAdmin = user?.rol?.toLowerCase() === 'admin';
    const currency = CURRENCY_SYMBOL;

    const getLocalDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [loading, setLoading] = useState(true);
    const [movimientos, setMovimientos] = useState([]);
    const [stores, setStores] = useState([]);
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [tiendaId, setTiendaId] = useState(user?.tienda_id || "");
    const [searchTerm, setSearchTerm] = useState("");
    const [storeConfig, setStoreConfig] = useState(null);
    const searchTermRef = useRef(null);

    const fetchMovimientos = async () => {
        setLoading(true);
        try {
            const data = await movimientosAPI.getAll(selectedDate, selectedDate, tiendaId, "", !isAdmin ? user?.id : "");
            setMovimientos(data || []);
        } catch (error) {
            console.error("Error al cargar movimientos:", error);
            toast.error("Error al cargar historial");
        } finally {
            setLoading(false);
        }
    };

    const loadStores = async () => {
        if (!isAdmin) return;
        try {
            const data = await dashboardAPI.getTiendas();
            setStores(data || []);
        } catch (e) { }
    };

    useEffect(() => {
        fetchMovimientos();
    }, [selectedDate, tiendaId]);

    useEffect(() => {
        loadStores();
        configuracionAPI.get().then(setStoreConfig).catch(() => { });

        const handleKeyDown = (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                searchTermRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filteredMovimientos = movimientos.filter(m =>
        m.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.tienda_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.ticket_numero?.toString().includes(searchTerm)
    );

    const groupMovimientosByDate = (movs) => {
        const groups = {};
        movs.forEach(m => {
            const dateStr = new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(m);
        });
        return groups;
    };

    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            time: date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })
        };
    };

    const handleReprint = async (m) => {
        if (!m.id || m.tipo !== 'venta') {
            toast.error("Solo se pueden reimprimir ventas");
            return;
        }

        // Fetch the store config to ensure we get the custom ticket_header and ticket_footer
        let sucursalData = null;
        const targetTiendaId = m.tienda_id || user?.tienda_id;
        if (targetTiendaId) {
            try {
                sucursalData = await tiendasAPI.getById(targetTiendaId);
            } catch (e) {
                console.warn("No se pudo cargar la configuración de la sucursal para el ticket");
            }
        }

        printTicket({
            tienda: storeConfig,
            sucursal: sucursalData,
            venta: {
                id: m.referencia_id || m.id,
                subtotal: m.monto,
                descuento: 0,
                total: m.monto,
                metodo_pago: m.metodo_pago
            },
            productos: [
                { nombre: m.descripcion, cantidad: 1, precio: m.monto }
            ],
            pagos: [
                { metodo: m.metodo_pago, monto: m.monto }
            ]
        });
    };

    return (
        <div className="p-4 sm:p-8 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-4 uppercase">
                            <History className="text-indigo-600" size={32} />
                            HISTORIAL DE <span className="text-indigo-600">MOVIMIENTOS</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-black uppercase tracking-[0.2em] opacity-60">Cronología táctica y supervisión de transacciones diarias</p>
                    </div>

                    <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full xl:w-auto">
                        <button
                            onClick={() => exportToExcel(filteredMovimientos, `Historial_${selectedDate}`)}
                            className="h-[44px] px-5 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
                        >
                            <Table size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">EXCEL</span>
                        </button>
                        <button
                            onClick={() => exportToPDF(filteredMovimientos, `Historial_${selectedDate}`)}
                            className="h-[44px] px-5 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group"
                        >
                            <FileText size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">PDF</span>
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="card-standard p-4 mb-4 shadow-lg border-indigo-500/5 relative overflow-hidden transition-all duration-500">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 pointer-events-none"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-x-6 gap-y-4 items-end relative z-10">
                        <div className="md:col-span-3 space-y-3">
                            <label className="label-standard px-1">CONSULTAR FECHA</label>
                            <div className="relative group">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="input-standard pl-12 h-[60px] font-black"
                                />
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="md:col-span-3 space-y-3">
                                <label className="label-standard px-1">FILTRAR POR SUCURSAL</label>
                                <div className="relative group">
                                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    <select
                                        value={tiendaId}
                                        onChange={(e) => setTiendaId(e.target.value)}
                                        className="select-standard pl-12 h-[60px] font-black"
                                    >
                                        <option value="">TODAS LAS SUCURSALES</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className={`${isAdmin ? 'md:col-span-6' : 'md:col-span-9'} space-y-3`}>
                            <div className="flex justify-between items-center px-1">
                                <label className="label-standard">BÚSQUEDA INTELIGENTE</label>
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border dark:border-slate-800 text-[10px] font-black text-slate-400">
                                    F2
                                </div>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    ref={searchTermRef}
                                    type="text"
                                    placeholder="FOLIO, DESCRIPCIÓN, USUARIO O SUCURSAL..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-standard pl-16 h-[60px] font-black uppercase tracking-tight"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audit Table */}
                <div className="card-standard p-0 overflow-hidden shadow-xl relative">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[640px]">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b dark:border-slate-700/50 text-[9px] font-black uppercase text-slate-400 tracking-[0.15em]">
                                    <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Ticket / Hora</th>
                                    <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">Operación</th>
                                    <th className="px-4 sm:px-6 py-4">Descripción</th>
                                    <th className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell whitespace-nowrap">Estatus</th>
                                    <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">Importe</th>
                                    <th className="px-4 sm:px-6 py-4 text-center hidden md:table-cell whitespace-nowrap">Responsable</th>
                                    <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">Acc.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <RefreshCw size={36} className="text-indigo-500 animate-spin opacity-50" />
                                                <p className="font-black uppercase tracking-widest text-[10px] text-slate-400">Cargando historial...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredMovimientos.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <Activity size={48} className="text-slate-400" />
                                                <p className="font-black uppercase tracking-widest text-[10px]">Sin registros para los filtros aplicados</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    Object.entries(groupMovimientosByDate(filteredMovimientos)).map(([dateKey, groupMovs]) => (
                                        <React.Fragment key={dateKey}>
                                            <tr className="bg-indigo-50/40 dark:bg-indigo-900/10">
                                                <td colSpan="7" className="px-4 sm:px-6 py-2.5 text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest border-y border-indigo-100/50 dark:border-indigo-900/30">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarIcon size={12} />
                                                        {dateKey} — {groupMovs.length} mov.
                                                    </div>
                                                </td>
                                            </tr>
                                            {groupMovs.map((m, idx) => {
                                                const { time } = formatDateTime(m.fecha);
                                                const isCancelled = m.estado === 'CANCELADA';
                                                return (
                                                    <tr key={`${m.tipo}-${m.id}-${idx}`} className={`group transition-all hover:bg-slate-50/80 dark:hover:bg-slate-700/20 ${isCancelled ? 'opacity-40 grayscale' : ''}`}>
                                                        {/* Ticket / Hora */}
                                                        <td className="px-4 sm:px-6 py-4">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight leading-none">
                                                                    {m.ticket_numero ? `#${m.ticket_numero}` : `F-${m.id.toString().padStart(4, '0')}`}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                                                    <Clock size={9} /> {time}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {/* Operación */}
                                                        <td className="px-4 sm:px-6 py-4 text-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border ${
                                                                m.tipo === 'venta'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/30'
                                                                    : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800/30'
                                                            }`}>
                                                                {m.tipo === 'venta' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                                {m.tipo}
                                                            </span>
                                                        </td>
                                                        {/* Descripción */}
                                                        <td className="px-4 sm:px-6 py-4 max-w-[180px] sm:max-w-[260px]">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight truncate max-w-[160px] sm:max-w-[220px] group-hover:text-indigo-600 transition-colors ${isCancelled ? 'line-through' : ''}`}>
                                                                        {m.descripcion}
                                                                    </span>
                                                                    {m.es_mayoreo === 1 && <span className="text-[7px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">MAY</span>}
                                                                </div>
                                                                {m.cliente_nombre && (
                                                                    <span className={`text-[9px] font-black uppercase ${m.es_mayoreo === 1 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                                        {m.cliente_nombre}
                                                                    </span>
                                                                )}
                                                                <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                                                                    <span className="flex items-center gap-1"><Store size={8} /> {m.tienda_nombre || 'PRINCIPAL'}</span>
                                                                    <span>·</span>
                                                                    <span className="flex items-center gap-1"><CreditCard size={8} /> {m.metodo_pago || 'GENERAL'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {/* Estatus - oculto en móvil */}
                                                        <td className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${
                                                                isCancelled
                                                                    ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800/30'
                                                                    : 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:border-slate-700'
                                                            }`}>
                                                                {isCancelled ? 'ANULADA' : 'EFECTIVA'}
                                                            </span>
                                                        </td>
                                                        {/* Importe */}
                                                        <td className="px-4 sm:px-6 py-4 text-right">
                                                            <span className={`text-base sm:text-lg font-black tracking-tighter ${m.tipo === 'venta' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {m.tipo === 'venta' ? '+' : '-'}{currency}{Number(m.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </td>
                                                        {/* Responsable - oculto en tablet pequeña */}
                                                        <td className="px-4 sm:px-6 py-4 text-center hidden md:table-cell">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                                                                    <User size={13} />
                                                                </div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide max-w-[80px] truncate">{m.usuario || 'SISTEMA'}</span>
                                                            </div>
                                                        </td>
                                                        {/* Acciones */}
                                                        <td className="px-4 sm:px-6 py-4 text-center">
                                                            {m.tipo === 'venta' && (
                                                                <button
                                                                    onClick={() => handleReprint(m)}
                                                                    className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-300 hover:text-indigo-600 transition-all active:scale-90"
                                                                    title="Reimprimir"
                                                                >
                                                                    <Printer size={16} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
