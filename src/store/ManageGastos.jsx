import { useEffect, useState } from "react";
import {
    Receipt,
    Plus,
    Search,
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
    X
} from "lucide-react";
import { gastosAPI, dashboardAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { toast } from "react-hot-toast";
import Loading from "../Components/Common/Loading";

const CATEGORIAS = [
    { id: 'RENTA', label: 'RENTA / ALQUILER', icon: Home, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
    { id: 'LUZ', label: 'SERVICIOS (LUZ/AGUA)', icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    { id: 'SUELDO', label: 'SUELDOS / PLANILLA', icon: Briefcase, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'PUBLICIDAD', label: 'MARKETING / PUBLICIDAD', icon: DollarSign, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' },
    { id: 'MANTENIMIENTO', label: 'MANTENIMIENTO', icon: Wrench, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
    { id: 'TRANSPORTE', label: 'TRANSPORTE / ENVÍOS', icon: Truck, color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/20' },
    { id: 'OTRO', label: 'OTROS GASTOS', icon: MoreHorizontal, color: 'text-slate-400 bg-slate-50 dark:bg-slate-900/20' }
];

export default function ManageGastos() {
    const { user } = useAuth();
    const currency = CURRENCY_SYMBOL;

    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tiendas, setTiendas] = useState([]);

    // Filtros
    const [tiendaId, setTiendaId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Modal nuevo gasto
    const [showModal, setShowModal] = useState(false);
    const [nuevoGasto, setNuevoGasto] = useState({
        monto: "",
        categoria: "OTRO",
        descripcion: "",
        fecha: new Date().toISOString().split('T')[0],
        tienda_id: user?.tienda_id || ""
    });

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

    useEffect(() => {
        loadData();
    }, [tiendaId, startDate, endDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nuevoGasto.monto || !nuevoGasto.categoria) {
            return toast.error("Completa los campos obligatorios");
        }

        try {
            await gastosAPI.create({
                ...nuevoGasto,
                usuario_id: user?.id
            });
            toast.success("Gasto registrado");
            setShowModal(false);
            setNuevoGasto({
                monto: "",
                categoria: "OTRO",
                descripcion: "",
                fecha: new Date().toISOString().split('T')[0],
                tienda_id: user?.tienda_id || ""
            });
            loadData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar este registro de gasto?")) return;
        try {
            await gastosAPI.delete(id);
            toast.success("Gasto eliminado");
            loadData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const getCatInfo = (catId) => CATEGORIAS.find(c => c.id === catId) || CATEGORIAS[6];

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-3 bg-rose-600 rounded-2xl shadow-lg shadow-rose-500/20">
                            <Receipt className="text-white" size={24} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                            Gastos <span className="text-rose-600 dark:text-rose-400">Operativos</span>
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">Control de egresos y rentabilidad</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary gap-2 bg-rose-600 hover:bg-rose-700 border-none shadow-rose-500/20"
                    >
                        <Plus size={18} /> Registrar Gasto
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card-standard p-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Gasto Total Periodo</p>
                    <div className="text-3xl font-black text-rose-600 tracking-tighter">{currency}{gastos.reduce((acc, g) => acc + parseFloat(g.monto), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="card-standard p-6 overflow-hidden relative group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-2xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800/20 transition-all"></div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Registros</p>
                    <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{gastos.length}</div>
                </div>
                <div className="card-standard p-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Categoría Mayor</p>
                    <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight truncate">
                        {gastos.length > 0 ? (
                            Object.entries(gastos.reduce((acc, g) => {
                                acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.monto);
                                return acc;
                            }, {})).sort((a, b) => b[1] - a[1])[0][0]
                        ) : '---'}
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="card-standard p-3">
                    <label className="label-standard px-2">Sucursal</label>
                    <div className="flex items-center gap-2 px-2">
                        <Store size={14} className="text-indigo-500" />
                        <select
                            value={tiendaId}
                            onChange={(e) => setTiendaId(e.target.value)}
                            className="appearance-none w-full bg-transparent font-bold text-xs cursor-pointer dark:text-white pr-4 focus:outline-none"
                            style={{ border: 'none', outline: 'none' }}
                        >
                            <option value="">Todas las Sedes</option>
                            {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                    </div>
                </div>
                <div className="card-standard p-3">
                    <label className="label-standard px-2">Desde</label>
                    <div className="flex items-center gap-2 px-2">
                        <CalendarIcon size={14} className="text-rose-500" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-transparent border-none outline-none font-bold text-xs dark:text-white"
                        />
                    </div>
                </div>
                <div className="card-standard p-3">
                    <label className="label-standard px-2">Hasta</label>
                    <div className="flex items-center gap-2 px-2">
                        <CalendarIcon size={14} className="text-rose-500" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-transparent border-none outline-none font-bold text-xs dark:text-white"
                        />
                    </div>
                </div>
                <button
                    onClick={() => { setTiendaId(""); setStartDate(""); setEndDate(""); }}
                    className="btn-secondary h-full justify-center text-[10px] tracking-widest uppercase gap-2"
                >
                    <Filter size={14} /> Limpiar Filtros
                </button>
            </div>

            {/* Tabla de Gastos */}
            <div className="card-standard p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b dark:border-slate-700/50 text-slate-400 dark:text-slate-500 uppercase text-[9px] font-bold tracking-[0.2em]">
                                <th className="px-8 py-6">Fecha / Categoría</th>
                                <th className="px-8 py-6">Descripción</th>
                                <th className="px-8 py-6">Registrado por</th>
                                <th className="px-8 py-6 text-right">Monto</th>
                                <th className="px-8 py-6 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20"><Loading /></td>
                                </tr>
                            ) : gastos.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No hay gastos registrados</td>
                                </tr>
                            ) : (
                                gastos.map((g) => {
                                    const cat = getCatInfo(g.categoria);
                                    const Icon = cat.icon;
                                    return (
                                        <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-all group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2.5 rounded-xl ${cat.color} transition-transform group-hover:scale-110 duration-500 shadow-sm`}>
                                                        <Icon size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tight">{cat.label}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{new Date(g.fecha).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 max-w-xs truncate">{g.descripcion || '---'}</p>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="badge-standard bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                                                    {g.usuario_nombre || 'SISTEMA'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <p className="text-lg font-black text-rose-600 tracking-tighter">{currency}{parseFloat(g.monto).toFixed(2)}</p>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <button
                                                    onClick={() => handleDelete(g.id)}
                                                    className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-90"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Nuevo Gasto */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container w-full max-w-lg p-0 overflow-hidden">
                        <div className="modal-header p-8 flex items-center justify-between border-b dark:border-slate-700/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-rose-600 rounded-2xl shadow-xl shadow-rose-500/20">
                                    <Receipt className="text-white" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter leading-none">Registrar Gasto</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Sincroniza egresos operativos</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 transition-all"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-6 bg-white dark:bg-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label-standard">Monto del Egreso *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" size={20} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={nuevoGasto.monto}
                                            onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
                                            required
                                            placeholder="0.00"
                                            className="input-standard pl-12 py-5 text-2xl font-black text-rose-600"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-standard">Fecha de Factura</label>
                                    <input
                                        type="date"
                                        value={nuevoGasto.fecha}
                                        onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })}
                                        required
                                        className="input-standard font-bold uppercase"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label-standard">Categoría Operativa</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {CATEGORIAS.map(cat => {
                                        const Icon = cat.icon;
                                        const isSelected = nuevoGasto.categoria === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setNuevoGasto({ ...nuevoGasto, categoria: cat.id })}
                                                className={`flex flex-col items-center justify-center gap-2 p-2 rounded-xl border-2 transition-all active:scale-95 ${isSelected ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-50 dark:border-slate-700/50 bg-transparent opacity-60'}`}
                                            >
                                                <Icon size={18} className={isSelected ? 'text-rose-600' : 'text-slate-400'} />
                                                <span className={`text-[7px] font-bold uppercase text-center leading-none ${isSelected ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'}`}>{cat.id.split(' ')[0]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="label-standard">Detalles / Nota Interna</label>
                                <textarea
                                    value={nuevoGasto.descripcion}
                                    onChange={(e) => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })}
                                    placeholder="Ej: Pago de renta del local 5, mes de Enero..."
                                    className="input-standard h-28 resize-none py-4 font-medium"
                                />
                            </div>

                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="btn-primary w-full bg-rose-600 hover:bg-rose-700 border-none shadow-xl shadow-rose-500/20 py-5"
                                >
                                    Confirmar Egreso
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn-secondary w-full justify-center"
                                >
                                    Retroceder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
