import { useEffect, useState } from "react";
import {
    Receipt,
    Plus,
    Trash2,
    Calendar as CalendarIcon,
    Store,
    Filter,
    DollarSign,
    Briefcase,
    Zap,
    Home,
    Wrench,
    Truck,
    MoreHorizontal,
    X,
    Edit3,
    TrendingDown,
    Hash,
    Award
} from "lucide-react";
import { gastosAPI, dashboardAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import useOfflineOperation from "../hooks/useOfflineOperation";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { toast } from "react-hot-toast";
import Loading from "../Components/Common/Loading";
import PinValidationModal from "./components/PinValidationModal";

const CATEGORIAS = [
    { id: 'RENTA', label: 'RENTA / ALQUILER', icon: Home, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20', accent: '#6366f1' },
    { id: 'LUZ', label: 'SERVICIOS (LUZ/AGUA)', icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', accent: '#f59e0b' },
    { id: 'SUELDO', label: 'SUELDOS / PLANILLA', icon: Briefcase, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', accent: '#10b981' },
    { id: 'PUBLICIDAD', label: 'MARKETING / PUBLICIDAD', icon: DollarSign, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20', accent: '#f43f5e' },
    { id: 'MANTENIMIENTO', label: 'MANTENIMIENTO', icon: Wrench, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', accent: '#3b82f6' },
    { id: 'TRANSPORTE', label: 'TRANSPORTE / ENVÍOS', icon: Truck, color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/20', accent: '#64748b' },
    { id: 'OTRO', label: 'OTROS GASTOS', icon: MoreHorizontal, color: 'text-slate-400 bg-slate-50 dark:bg-slate-900/20', accent: '#94a3b8' }
];

export default function ManageGastos() {
    const { user } = useAuth();
    const currency = CURRENCY_SYMBOL;

    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tiendas, setTiendas] = useState([]);

    const { execute } = useOfflineOperation('expenses');

    const [tiendaId, setTiendaId] = useState(user?.rol === 'admin' ? "" : (user?.tienda_id || ""));
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activeFilter, setActiveFilter] = useState('this_week');

    const applyWeekFilter = (period) => {
        setActiveFilter(period);
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (period === 'all') {
            setStartDate(''); setEndDate('');
        } else if (period === 'this_week') {
            const day = today.getDay();
            const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
            setStartDate(fmt(mon)); setEndDate(fmt(today));
        } else if (period === 'last_week') {
            const day = today.getDay();
            const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 13 : day + 6));
            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
            setStartDate(fmt(mon)); setEndDate(fmt(sun));
        } else if (period === 'this_month') {
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(fmt(first)); setEndDate(fmt(today));
        }
    };

    const getLocalDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [editingGasto, setEditingGasto] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [nuevoGasto, setNuevoGasto] = useState({
        monto: "",
        categoria: "OTRO",
        descripcion: "",
        fecha: getLocalDate(),
        tienda_id: user?.tienda_id || ""
    });

    const [showPinModal, setShowPinModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [gastosData, tiendasData] = await Promise.all([
                gastosAPI.getAll(tiendaId, startDate, endDate),
                dashboardAPI.getTiendas()
            ]);
            setGastos(gastosData);
            setTiendas(tiendasData);
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    // Aplicar filtro "Esta Semana" al montar
    useEffect(() => {
        applyWeekFilter('this_week');
    }, []);

    useEffect(() => {
        loadData();
    }, [tiendaId, startDate, endDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nuevoGasto.monto || !nuevoGasto.categoria) {
            return toast.error("Completa los campos obligatorios");
        }

        try {
            const payload = { ...nuevoGasto, usuario_id: user?.id };

            if (editingGasto) {
                const result = await execute('update', payload, editingGasto.id);
                if (result?.mode === 'api') {
                    await gastosAPI.update(editingGasto.id, payload);
                }
                toast.success("Gasto actualizado");
            } else {
                const result = await execute('insert', payload);
                if (result?.mode === 'api') {
                    await gastosAPI.create(payload);
                }
                toast.success("Gasto registrado");
            }

            setShowModal(false);
            setEditingGasto(null);
            setNuevoGasto({
                monto: "",
                categoria: "OTRO",
                descripcion: "",
                fecha: getLocalDate(),
                tienda_id: user?.tienda_id || ""
            });
            loadData();
        } catch (error) {
            toast.error(error.message || "Error al guardar");
        }
    };

    const handleDelete = async (id) => {
        if (user?.rol !== 'admin') {
            setPendingAction({ type: 'DELETE', payload: id });
            setShowPinModal(true);
            return;
        }
        executeDelete(id);
    };

    const executeDelete = async (id) => {
        if (!confirm("¿Eliminar este registro de gasto?")) return;
        setDeletingId(id);
        try {
            const result = await execute('delete', {}, id);
            if (result?.mode === 'api') {
                await gastosAPI.delete(id);
            }
            toast.success("Gasto eliminado");
            loadData();
        } catch (error) {
            toast.error(error.message || "Error al eliminar");
        } finally {
            setDeletingId(null);
        }
    };

    const handleEditClick = (g) => {
        if (user?.rol !== 'admin') {
            setPendingAction({ type: 'EDIT', payload: g });
            setShowPinModal(true);
            return;
        }
        executeEdit(g);
    };

    const executeEdit = (g) => {
        setEditingGasto(g);
        setNuevoGasto({
            monto: g.monto,
            categoria: g.categoria,
            descripcion: g.descripcion || "",
            fecha: new Date(g.fecha).toISOString().split('T')[0],
            tienda_id: g.tienda_id || ""
        });
        setShowModal(true);
    };

    const handlePinSuccess = () => {
        if (pendingAction?.type === 'DELETE') {
            executeDelete(pendingAction.payload);
        } else if (pendingAction?.type === 'EDIT') {
            executeEdit(pendingAction.payload);
        }
        setPendingAction(null);
    };

    const getCatInfo = (catId) => CATEGORIAS.find(c => c.id === catId) || CATEGORIAS[6];

    const totalGasto = gastos.reduce((acc, g) => acc + parseFloat(g.monto || 0), 0);
    const topCat = gastos.length > 0
        ? Object.entries(gastos.reduce((acc, g) => {
            acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.monto || 0);
            return acc;
          }, {})).sort((a, b) => b[1] - a[1])[0]
        : null;
    const topCatInfo = topCat ? getCatInfo(topCat[0]) : null;

    const hasActiveFilters = tiendaId || startDate || endDate;

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">

            {/* ── Hero Header ── */}
            <div className="relative overflow-hidden rounded-3xl mb-8 bg-gradient-to-br from-rose-600 via-rose-500 to-pink-600 p-8 shadow-2xl shadow-rose-500/30">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-black/10 rounded-full blur-2xl"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-white/5 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                                <Receipt className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-none">
                                    Gastos <span className="text-rose-200">Operativos</span>
                                </h1>
                                <p className="text-rose-200/80 text-xs font-bold uppercase tracking-widest mt-1">Control de egresos y rentabilidad</p>
                            </div>
                        </div>

                        {/* Stats inline */}
                        <div className="flex flex-wrap gap-4 mt-4">
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                                <TrendingDown size={16} className="text-rose-200" />
                                <div>
                                    <p className="text-[9px] font-black text-rose-200/70 uppercase tracking-widest leading-none">Total Período</p>
                                    <p className="text-xl font-black text-white leading-tight">{currency}{totalGasto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                                <Hash size={16} className="text-rose-200" />
                                <div>
                                    <p className="text-[9px] font-black text-rose-200/70 uppercase tracking-widest leading-none">Registros</p>
                                    <p className="text-xl font-black text-white leading-tight">{gastos.length}</p>
                                </div>
                            </div>
                            {topCatInfo && (
                                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                                    <Award size={16} className="text-rose-200" />
                                    <div>
                                        <p className="text-[9px] font-black text-rose-200/70 uppercase tracking-widest leading-none">Mayor Gasto</p>
                                        <p className="text-sm font-black text-white leading-tight uppercase">{topCat[0]}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => { setEditingGasto(null); setNuevoGasto({ monto: "", categoria: "OTRO", descripcion: "", fecha: getLocalDate(), tienda_id: user?.tienda_id || "" }); setShowModal(true); }}
                        className="flex items-center gap-2 px-6 py-4 bg-white text-rose-600 font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-95 transition-all duration-200 whitespace-nowrap"
                    >
                        <Plus size={18} /> Registrar Gasto
                    </button>
                </div>
            </div>

            {/* ── Week Quick Filters ── */}
            <div className="flex flex-wrap gap-2 mb-4">
                {[
                    { key: 'all', label: 'Todo' },
                    { key: 'this_week', label: 'Esta Semana' },
                    { key: 'last_week', label: 'Semana Pasada' },
                    { key: 'this_month', label: 'Este Mes' },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => applyWeekFilter(f.key)}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border ${
                            activeFilter === f.key
                                ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/25'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-500'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* ── Filtros ── */}
            <div className="card-standard p-4 mb-6">
                <div className="flex flex-wrap items-end gap-3">
                    {user?.rol === 'admin' && (
                        <div className="flex-1 min-w-[160px]">
                            <label className="label-standard px-1">Sucursal</label>
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                <Store size={14} className="text-indigo-500 flex-shrink-0" />
                                <select
                                    value={tiendaId}
                                    onChange={(e) => setTiendaId(e.target.value)}
                                    className="appearance-none w-full bg-transparent font-bold text-xs cursor-pointer dark:text-white focus:outline-none"
                                >
                                    <option value="">Todas las Sedes</option>
                                    {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 min-w-[140px]">
                        <label className="label-standard px-1">Desde</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <CalendarIcon size={14} className="text-rose-500 flex-shrink-0" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-bold text-xs dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="label-standard px-1">Hasta</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <CalendarIcon size={14} className="text-rose-500 flex-shrink-0" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-bold text-xs dark:text-white"
                            />
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={() => { setTiendaId(user?.rol === 'admin' ? "" : (user?.tienda_id || "")); setStartDate(""); setEndDate(""); setActiveFilter('all'); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95"
                        >
                            <Filter size={13} /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabla de Gastos ── */}
            <div className="card-standard p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 text-slate-400 dark:text-slate-500 uppercase text-[9px] font-black tracking-[0.2em]">
                                <th className="px-6 py-5">Categoría / Fecha</th>
                                <th className="px-6 py-5">Descripción</th>
                                <th className="px-6 py-5">Registrado por</th>
                                <th className="px-6 py-5 text-right">Monto</th>
                                <th className="px-6 py-5 text-center w-28">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20"><Loading /></td>
                                </tr>
                            ) : gastos.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl">
                                                <Receipt size={32} className="text-rose-300" />
                                            </div>
                                            <p className="font-black uppercase text-[10px] tracking-widest">Sin gastos en este período</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                gastos.map((g) => {
                                    const cat = getCatInfo(g.categoria);
                                    const Icon = cat.icon;
                                    const isDeleting = deletingId === g.id;
                                    return (
                                        <tr key={g.id} className={`hover:bg-rose-50/30 dark:hover:bg-rose-500/5 transition-all group ${isDeleting ? 'opacity-50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2.5 rounded-xl ${cat.color} transition-transform group-hover:scale-110 duration-300 flex-shrink-0`}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{cat.id}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(g.fecha.replace(' ', 'T')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                                    {g.descripcion || <span className="text-slate-300 italic text-xs">Sin descripción</span>}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/30">
                                                    {g.usuario_nombre || 'SISTEMA'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="text-base font-black text-rose-600 tracking-tighter">
                                                    {currency}{parseFloat(g.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleEditClick(g)}
                                                        disabled={isDeleting}
                                                        className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all active:scale-90"
                                                        title="Editar"
                                                    >
                                                        <Edit3 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(g.id)}
                                                        disabled={isDeleting}
                                                        className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-90"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {gastos.length > 0 && !loading && (
                            <tfoot>
                                <tr className="bg-rose-50/50 dark:bg-rose-900/10 border-t border-rose-100 dark:border-rose-900/30">
                                    <td colSpan="3" className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {gastos.length} registro{gastos.length !== 1 ? 's' : ''}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-lg font-black text-rose-600 tracking-tighter">
                                            {currency}{totalGasto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* ── Modal Nuevo / Editar Gasto ── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-slate-800">

                        {/* Gradient Header */}
                        <div className="relative bg-gradient-to-br from-rose-600 via-rose-500 to-pink-600 p-7 overflow-hidden">
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
                            </div>
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                                        <Receipt className="text-white" size={22} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                                            {editingGasto ? 'Editar Gasto' : 'Registrar Gasto'}
                                        </h2>
                                        <p className="text-rose-200/80 text-[10px] font-black uppercase tracking-widest mt-1">
                                            {editingGasto ? 'Modifica el egreso operativo' : 'Nuevo egreso operativo'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowModal(false); setEditingGasto(null); }}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all active:scale-90"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSubmit} className="p-7 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-standard">Monto *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-500" size={18} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={nuevoGasto.monto || ""}
                                            onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
                                            required
                                            placeholder="0.00"
                                            className="input-standard pl-10 py-4 text-xl font-black text-rose-600"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-standard">Fecha</label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            value={nuevoGasto.fecha}
                                            onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })}
                                            required
                                            className="input-standard pl-10 font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="label-standard mb-2">Categoría Operativa</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {CATEGORIAS.map(cat => {
                                        const Icon = cat.icon;
                                        const isSelected = nuevoGasto.categoria === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setNuevoGasto({ ...nuevoGasto, categoria: cat.id })}
                                                className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 transition-all active:scale-95 ${
                                                    isSelected
                                                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 shadow-sm'
                                                        : 'border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                <Icon size={16} className={isSelected ? 'text-rose-600' : 'text-slate-400'} />
                                                <span className={`text-[7px] font-black uppercase text-center leading-none ${isSelected ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'}`}>
                                                    {cat.id.split('/')[0].trim()}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="label-standard">Descripción / Nota</label>
                                <textarea
                                    value={nuevoGasto.descripcion}
                                    onChange={(e) => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })}
                                    placeholder="Ej: Pago de renta del local 5, mes de Enero..."
                                    rows={3}
                                    className="input-standard resize-none py-3 font-medium"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingGasto(null); }}
                                    className="flex-1 py-4 px-6 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {editingGasto ? 'Guardar Cambios' : 'Confirmar Egreso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <PinValidationModal
                isOpen={showPinModal}
                onClose={() => { setShowPinModal(false); setPendingAction(null); }}
                onSuccess={handlePinSuccess}
                title="Autorización Módulo Gastos"
                actionType={pendingAction?.type === 'EDIT' ? "M_GASTO_MODIFICAR" : "M_GASTO_ELIMINAR"}
            />
        </div>
    );
}
