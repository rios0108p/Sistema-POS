import React, { useEffect, useState } from "react";
import { turnosAPI, dashboardAPI } from "../services/api";
import { toast } from "react-hot-toast";
import {
    Clock, DollarSign, TrendingUp, TrendingDown, Banknote,
    Calendar, User, ChevronDown, ChevronUp, RefreshCw,
    Store, ShoppingBasket as ShoppingBasketIcon, ArrowRightLeft,
    CheckCircle2, AlertTriangle, FileText, Tag, Layers, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import Loading from "../Components/Common/Loading";

const CorteCaja = () => {
    const { user } = useAuth();
    const isAdmin = user?.rol?.toLowerCase() === 'admin';
    const [turnos, setTurnos] = useState([]);
    const [turnoDetalle, setTurnoDetalle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedTurno, setExpandedTurno] = useState(null);
    const [timeRange, setTimeRange] = useState("day");
    const [selectedTienda, setSelectedTienda] = useState("");
    const [stores, setStores] = useState([]);

    useEffect(() => {
        loadTurnos();
    }, [timeRange, selectedTienda]);

    useEffect(() => {
        if (isAdmin) {
            dashboardAPI.getTiendas().then(data => setStores(data || [])).catch(() => { });
        }
    }, [isAdmin]);

    const loadTurnos = async () => {
        try {
            setLoading(true);
            const data = await turnosAPI.getAll(timeRange, selectedTienda);
            setTurnos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading turnos:", error);
            toast.error("Error al cargar los turnos");
        } finally {
            setLoading(false);
        }
    };

    const loadTurnoDetalle = async (turnoId) => {
        try {
            const data = await turnosAPI.getById(turnoId);
            setTurnoDetalle(data);
        } catch (error) {
            console.error("Error loading turno detail:", error);
            toast.error("Error al cargar detalles");
        }
    };

    const toggleExpand = (turnoId) => {
        if (expandedTurno === turnoId) {
            setExpandedTurno(null);
            setTurnoDetalle(null);
        } else {
            setExpandedTurno(turnoId);
            loadTurnoDetalle(turnoId);
        }
    };

    const formatCurrency = (value) => {
        return `${CURRENCY_SYMBOL}${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-MX', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    const turnosCerrados = turnos.filter(t => t.estado === 'CERRADO');
    const totalVentas = turnosCerrados.reduce((sum, t) => sum + Number(t.total_monto || 0), 0);
    const totalDiferencias = turnosCerrados.reduce((sum, t) => sum + Number(t.diferencia || 0), 0);

    if (loading && turnos.length === 0) return <Loading />;

    return (
        <div className="p-4 sm:p-8 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-8 mb-12">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                            <div className="p-4 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-500/20">
                                <Clock className="text-white" size={32} />
                            </div>
                            AUDITORÍA DE <span className="text-indigo-600">TURNOS</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-black uppercase tracking-[0.2em] opacity-60">Control transaccional y validación de cortes de caja operativos</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full xl:w-auto">
                        {isAdmin && (
                            <div className="relative group min-w-[240px]">
                                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                <select
                                    value={selectedTienda}
                                    onChange={(e) => setSelectedTienda(e.target.value)}
                                    className="select-standard pl-12 h-[56px] font-black text-[10px]"
                                >
                                    <option value="">RED DE TIENDAS (GLOBAL)</option>
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl p-1.5 shadow-xl border dark:border-slate-700/50 flex items-center h-[56px]">
                            {[{ key: "day", label: "HOY" }, { key: "week", label: "SEM" }, { key: "month", label: "MES" }, { key: "year", label: "AÑO" }].map((r) => (
                                <button
                                    key={r.key}
                                    onClick={() => setTimeRange(r.key)}
                                    className={`px-6 h-full rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${timeRange === r.key
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={loadTurnos}
                            className="w-14 h-14 bg-white dark:bg-slate-800 border dark:border-slate-700/50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:shadow-xl transition-all active:scale-90 group"
                        >
                            <RefreshCw size={22} className={`group-hover:rotate-180 transition-transform duration-700 ${loading ? "animate-spin text-indigo-500" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Indicators Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <div className="card-standard p-6 border-indigo-500/5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/30">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <ArrowRightLeft size={12} className="text-indigo-500" /> SESIONES
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{turnos.length}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Global</span>
                        </div>
                    </div>

                    <div className="card-standard p-6 border-emerald-500/5 bg-gradient-to-br from-white to-emerald-50/10 dark:from-slate-800 dark:to-emerald-900/5">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <CheckCircle2 size={12} /> ACTIVOS
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-emerald-500 tracking-tighter">{turnos.filter(t => t.estado === 'ABIERTO').length}</span>
                            <span className="text-[10px] font-black text-emerald-200 dark:text-emerald-800 uppercase tracking-widest">En Turno</span>
                        </div>
                    </div>

                    <div className="card-standard p-6 border-indigo-500/10 bg-gradient-to-br from-white to-indigo-50/20 dark:from-slate-800 dark:to-indigo-900/10">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <TrendingUp size={12} /> INGESTA NETA
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                {formatCurrency(totalVentas)}
                            </span>
                            <span className="text-[10px] font-black text-indigo-200 dark:text-indigo-800 uppercase tracking-widest">{timeRange}</span>
                        </div>
                    </div>

                    <div className={`card-standard p-6 transition-all ${totalDiferencias >= 0 ? "border-emerald-500/10 bg-emerald-50/5" : "border-rose-500/10 bg-rose-50/5"}`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${totalDiferencias >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {totalDiferencias >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} AUDITORÍA
                        </p>
                        <div className={`flex items-baseline gap-2 ${totalDiferencias >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            <span className="text-4xl font-black tracking-tighter">{formatCurrency(totalDiferencias)}</span>
                            <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">{totalDiferencias >= 0 ? 'SOBRANTE' : 'FALTANTE'}</span>
                        </div>
                    </div>
                </div>

                {/* Main Audit Table */}
                <div className="card-standard p-0 overflow-hidden shadow-2xl relative transition-all duration-500">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-md border-b dark:border-slate-700/50">
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Referencia / Operador</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Ventana Operativa</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Fondo Fijo</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Ingresos Ventas</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Estado de Arca</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Ficha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {turnos.length > 0 ? turnos.map(t => (
                                    <React.Fragment key={t.id}>
                                        <tr className={`group transition-all ${expandedTurno === t.id ? "bg-indigo-50/30 dark:bg-indigo-900/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-700/20"}`}>
                                            <td className="px-8 py-6 border-none">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 border dark:border-slate-600 flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                        #{t.id}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{t.usuario_nombre || 'OPERADOR POS'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={t.estado === 'ABIERTO' ? 'badge-standard bg-emerald-500 text-white border-none py-0.5 px-2' : 'badge-standard py-0.5 px-2'}>
                                                                {t.estado}
                                                            </span>
                                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{t.tienda_nombre || 'PRINCIPAL'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 border-none">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-[11px] font-black text-slate-600 dark:text-slate-300">
                                                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                        {formatDate(t.fecha_apertura)}
                                                    </div>
                                                    {t.fecha_cierre ? (
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                            <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                                            {formatDate(t.fecha_cierre)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest pl-4">En curso...</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 border-none">
                                                <p className="text-base font-black text-slate-700 dark:text-slate-300 tracking-tighter">{formatCurrency(t.monto_inicial)}</p>
                                            </td>
                                            <td className="px-8 py-6 border-none">
                                                <div className="flex flex-col">
                                                    <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                                        +{formatCurrency(Number(t.ventas_efectivo || 0) + Number(t.ventas_tarjeta || 0) + Number(t.ventas_transferencia || 0))}
                                                    </p>
                                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 opacity-60">{t.num_ventas} OPERACIONES</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 border-none">
                                                {t.estado === 'CERRADO' ? (
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`text-base font-black tracking-tighter ${Number(t.diferencia) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {Number(t.diferencia) > 0 ? '+' : ''}{formatCurrency(t.diferencia)}
                                                        </span>
                                                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div className={`h-full ${Number(t.diferencia) >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: '100%' }}></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="badge-standard bg-slate-50 dark:bg-slate-900 border-none text-slate-300 animate-pulse">SIN CIERRE</div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-center border-none">
                                                <button
                                                    onClick={() => toggleExpand(t.id)}
                                                    className={`btn-secondary w-12 h-12 p-0 flex items-center justify-center transition-all ${expandedTurno === t.id ? "bg-indigo-600 border-indigo-600 text-white" : ""}`}
                                                >
                                                    {expandedTurno === t.id ? <ChevronUp size={20} /> : <FileText size={20} />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedTurno === t.id && (
                                            <tr>
                                                <td colSpan="6" className="px-0 bg-slate-50/50 dark:bg-slate-900/40 border-b dark:border-slate-700/50">
                                                    <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                                        {/* Financial Details Container */}
                                                        <div className="lg:col-span-5 space-y-8">
                                                            <div className="card-standard p-8 shadow-xl bg-white dark:bg-slate-800 border-indigo-500/5">
                                                                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] mb-8 flex items-center gap-3">
                                                                    <Banknote size={14} className="text-indigo-500" /> ARCA FINANCIERA
                                                                </h3>
                                                                <div className="space-y-6">
                                                                    <div className="flex justify-between items-center group">
                                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Ventas Efectivo</span>
                                                                        <span className="font-black text-emerald-500 text-lg tracking-tighter">+{formatCurrency(t.ventas_efectivo)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center group">
                                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Ventas Tarjeta</span>
                                                                        <span className="font-black text-blue-500 text-lg tracking-tighter">+{formatCurrency(t.ventas_tarjeta)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center group">
                                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Ventas Transferencia</span>
                                                                        <span className="font-black text-purple-500 text-lg tracking-tighter">+{formatCurrency(t.ventas_transferencia)}</span>
                                                                    </div>
                                                                    <div className="pt-6 border-t border-dashed dark:border-slate-700">
                                                                        <div className="flex justify-between items-center group">
                                                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Base de Inicio</span>
                                                                            <span className="font-black text-slate-700 dark:text-slate-300 text-lg tracking-tighter">{formatCurrency(t.monto_inicial)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="pt-8">
                                                                        <div className="flex items-center justify-between p-6 bg-slate-900 rounded-[2rem] shadow-2xl relative overflow-hidden group/total">
                                                                            <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 transition-transform group-hover/total:scale-110">
                                                                                <DollarSign size={80} className="text-white" />
                                                                            </div>
                                                                            <div className="relative z-10">
                                                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-1">TOTAL EN ARCA</span>
                                                                                <span className="text-3xl font-black text-white tracking-tighter leading-none">
                                                                                    {formatCurrency(t.monto_final || (Number(t.monto_inicial) + Number(t.ventas_efectivo)))}
                                                                                </span>
                                                                            </div>
                                                                            <div className="relative z-10 p-3 bg-white/10 rounded-2xl text-white">
                                                                                <Layers size={24} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Wholesale Metrics */}
                                                            {turnoDetalle?.totales_mayoreo_por_metodo?.length > 0 && (
                                                                <div className="card-standard p-8 border-amber-500/20 bg-amber-500/[0.03]">
                                                                    <h3 className="text-[10px] font-black uppercase text-amber-600 tracking-[0.25em] mb-8 flex items-center gap-3">
                                                                        <Tag size={14} className="text-amber-500" /> MÉTRICAS MAYOREO
                                                                    </h3>
                                                                    <div className="space-y-4">
                                                                        {turnoDetalle.totales_mayoreo_por_metodo.map(tm => (
                                                                            <div key={tm.metodo} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-amber-500/10 hover:border-amber-500/30 transition-all">
                                                                                <span className="text-[11px] font-black text-amber-600/60 uppercase tracking-widest">{tm.metodo}</span>
                                                                                <span className="font-black text-amber-600 text-base tracking-tighter">{formatCurrency(tm.total)}</span>
                                                                            </div>
                                                                        ))}
                                                                        <div className="pt-6">
                                                                            <div className="flex items-center justify-between p-6 bg-amber-500 rounded-[2rem] shadow-xl shadow-amber-500/20 text-white">
                                                                                <div>
                                                                                    <span className="text-[10px] font-black uppercase opacity-70 tracking-widest block mb-1">VOLUMEN MAYOREO</span>
                                                                                    <span className="text-3xl font-black tracking-tighter leading-none">
                                                                                        {formatCurrency(turnoDetalle.totales_mayoreo_por_metodo.reduce((acc, curr) => acc + Number(curr.total), 0))}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="p-3 bg-white/20 rounded-2xl">
                                                                                    <TrendingUp size={24} />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Sales Timeline */}
                                                        <div className="lg:col-span-7 flex flex-col h-full">
                                                            <div className="card-standard p-8 shadow-xl bg-white dark:bg-slate-800 flex-1 flex flex-col">
                                                                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] mb-8 flex items-center gap-3">
                                                                    <ShoppingBasketIcon size={14} className="text-indigo-500" /> BITÁCORA DE TRANSACCIONES
                                                                </h3>
                                                                <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar max-h-[600px]">
                                                                    {turnoDetalle?.ventas?.length > 0 ? turnoDetalle.ventas.map((venta, idx) => (
                                                                        <div key={venta.id} className="flex justify-between items-center p-5 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-500/30 transition-all group shadow-sm">
                                                                            <div className="flex items-center gap-6">
                                                                                <div className="flex flex-col items-center justify-center w-14 h-14 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-2xl shadow-sm">
                                                                                    <span className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">POS</span>
                                                                                    <span className="text-sm font-black text-slate-800 dark:text-white">#{venta.id}</span>
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors truncate max-w-[200px] xl:max-w-xs">{venta.resumen_productos || 'TRANSACCIÓN GENERAL'}</p>
                                                                                    <div className="flex items-center gap-3 mt-2">
                                                                                        <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                                            <Clock size={10} /> {new Date(venta.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                        </span>
                                                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${venta.metodo_pago === 'EFECTIVO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                                                            {venta.metodo_pago}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right ml-4">
                                                                                <p className="text-xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">{formatCurrency(venta.total)}</p>
                                                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Consolidado</p>
                                                                            </div>
                                                                        </div>
                                                                    )) : (
                                                                        <div className="flex flex-col items-center justify-center py-32 opacity-20">
                                                                            <Layers size={60} className="mb-4" />
                                                                            <p className="font-black uppercase tracking-[0.3em] text-xs">Vaciado de bitácora</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )) : (
                                    <tr>
                                        <td colSpan="6" className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-6 opacity-20">
                                                <AlertTriangle size={80} className="text-slate-400" />
                                                <p className="font-black uppercase tracking-[0.3em] text-xs">Sin registros correlativos en el periodo</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CorteCaja;
