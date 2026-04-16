import { useEffect, useState } from "react";
import {
    Truck,
    Plus,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    ArrowRight,
    ArrowLeftRight,
    Store,
    Package,
    AlertTriangle,
    Eye,
    Trash2,
    X,
    Filter,
    ChevronRight,
    RefreshCw,
    Layers,
    Calendar,
    FileText
} from "lucide-react";
import { trasladosAPI, tiendasAPI, productosAPI, dashboardAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import Loading from "../Components/Common/Loading";

export default function ManageTraslados() {
    const { user } = useAuth();
    const isAdmin = user?.rol === 'admin';

    const [traslados, setTraslados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tiendas, setTiendas] = useState([]);

    // Filtros
    const [filtroTienda, setFiltroTienda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("");

    // Detalle
    const [detalleModal, setDetalleModal] = useState({ open: false, traslado: null, productos: [] });

    // Modal nuevo traslado
    const [showModal, setShowModal] = useState(false);
    const [productosCatalogo, setProductosCatalogo] = useState([]);
    const [busquedaProducto, setBusquedaProducto] = useState("");
    const [trasladoData, setTrasladoData] = useState({
        tienda_origen_id: isAdmin ? "" : user?.tienda_id,
        tienda_destino_id: "",
        notas: "",
        productos: []
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [trasladosData, tiendasData] = await Promise.all([
                trasladosAPI.getAll(isAdmin ? filtroTienda : user?.tienda_id, filtroTipo),
                dashboardAPI.getTiendas()
            ]);
            setTraslados(trasladosData);
            setTiendas(tiendasData);
        } catch (error) {
            toast.error("Error al cargar traslados");
        } finally {
            setLoading(false);
        }
    };

    const loadCatalogo = async () => {
        try {
            const data = await productosAPI.getAll();
            setProductosCatalogo(data);
        } catch (e) {
            toast.error("Error al cargar productos");
        }
    };

    useEffect(() => {
        loadData();
    }, [filtroTienda, filtroTipo]);

    useEffect(() => {
        if (showModal) loadCatalogo();
    }, [showModal]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!trasladoData.tienda_destino_id) return toast.error("Selecciona una tienda destino");
        if (trasladoData.productos.length === 0) return toast.error("Añade al menos un producto");
        if (trasladoData.tienda_origen_id === trasladoData.tienda_destino_id) return toast.error("Origen y destino no pueden ser iguales");

        // Bug #20: Validate quantities are positive
        const productosInvalidos = trasladoData.productos.filter(p => !p.cantidad || p.cantidad <= 0);
        if (productosInvalidos.length > 0) {
            return toast.error("Todos los productos deben tener una cantidad mayor a 0");
        }

        try {
            await trasladosAPI.create({
                ...trasladoData,
                usuario_id: user?.id
            });
            toast.success("Traslado iniciado");
            setShowModal(false);
            setTrasladoData({
                tienda_origen_id: isAdmin ? "" : user?.tienda_id,
                tienda_destino_id: "",
                notas: "",
                productos: []
            });
            loadData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleRecibir = async (id) => {
        if (!confirm("¿Confirmas que has recibido toda la mercancía de este traslado?")) return;
        try {
            await trasladosAPI.completar(id);
            toast.success("Mercancía recibida correctamente");
            loadData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleCancelar = async (id) => {
        if (!confirm("¿Cancelar este traslado?")) return;
        try {
            await trasladosAPI.cancelar(id);
            toast.success("Traslado cancelado");
            loadData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const verDetalle = async (t) => {
        try {
            const productos = await trasladosAPI.getDetails(t.id);
            setDetalleModal({ open: true, traslado: t, productos });
        } catch (e) {
            toast.error("Error al cargar detalles");
        }
    };

    const agregarProducto = (p) => {
        const existe = trasladoData.productos.find(item => item.producto_id === p.id);
        if (existe) return toast.error("Ya está en la lista");

        setTrasladoData({
            ...trasladoData,
            productos: [...trasladoData.productos, {
                producto_id: p.id,
                nombre: p.nombre,
                cantidad: 1
            }]
        });
        setBusquedaProducto("");
    };

    const removerProducto = (id) => {
        setTrasladoData({
            ...trasladoData,
            productos: trasladoData.productos.filter(p => p.producto_id !== id)
        });
    };

    const actualizarCantidad = (id, cant) => {
        setTrasladoData({
            ...trasladoData,
            productos: trasladoData.productos.map(p =>
                p.producto_id === id ? { ...p, cantidad: parseInt(cant) || 1 } : p
            )
        });
    };

    const getStatusBadge = (estado) => {
        switch (estado) {
            case 'PENDIENTE': return 'badge-standard bg-amber-100 dark:bg-amber-900/30 text-amber-600 border-amber-200 dark:border-amber-800/50';
            case 'COMPLETADO': return 'badge-standard bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 border-emerald-200 dark:border-emerald-800/50';
            case 'CANCELADO': return 'badge-standard bg-rose-100 dark:bg-rose-900/30 text-rose-600 border-rose-200 dark:border-rose-800/50';
            default: return 'badge-standard bg-slate-100 dark:bg-slate-900 text-slate-600 border-slate-200';
        }
    };

    if (loading && traslados.length === 0) return <Loading />;

    return (
        <div className="p-4 sm:p-8 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-4 uppercase">
                            <div className="p-4 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-500/20">
                                <Truck className="text-white" size={32} />
                            </div>
                            TRASLADOS <span className="text-indigo-600">INTER-SUCURSAL</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-black uppercase tracking-[0.2em] opacity-60">Control operativo de movimientos de stock interno</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary px-10 h-[60px] shadow-indigo-600/20 w-full md:w-auto"
                    >
                        <Plus size={22} />
                        INICIAR TRASLADO
                    </button>
                </div>

                {/* Filters Section */}
                <div className="card-standard p-6 mb-10 flex flex-col md:flex-row gap-6 shadow-2xl border-indigo-500/5">
                    {isAdmin && (
                        <div className="flex-1 relative group">
                            <Store className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                            <select
                                value={filtroTienda}
                                onChange={(e) => setFiltroTienda(e.target.value)}
                                className="select-standard pl-16 h-[60px] font-black"
                            >
                                <option value="">TIENDA: TODAS LAS SUCURSALES</option>
                                <option value="0">ALMACÉN CENTRAL</option>
                                {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex-1 relative group">
                        <ArrowLeftRight className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <select
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                            className="select-standard pl-16 h-[60px] font-black"
                        >
                            <option value="">FILTRO: TODOS LOS MOVIMIENTOS</option>
                            <option value="envios">SALIDAS (ENVÍOS)</option>
                            <option value="recepciones">ENTRADAS (RECEPCIONES)</option>
                        </select>
                    </div>
                </div>

                {/* Main Table */}
                <div className="card-standard p-0 overflow-hidden shadow-2xl relative transition-all duration-500">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-md border-b dark:border-slate-700/50">
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Referencia / Fecha</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Ruta Logística</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Volumen</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Estado</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {traslados.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-6 opacity-20">
                                                <Truck size={80} className="text-slate-400" />
                                                <p className="font-black uppercase tracking-[0.3em] text-xs">No se encontraron movimientos registrados</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    traslados.map((t) => (
                                        <tr key={t.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">#{t.id.toString().padStart(4, '0')}</span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5 opacity-60">
                                                        <Calendar size={10} /> {new Date(t.fecha_envio).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center justify-center gap-4">
                                                    <span className="badge-standard bg-slate-100 dark:bg-slate-900 text-slate-500 border-none font-black text-[9px] min-w-[120px] text-center">{t.origen_nombre || 'PRINCIPAL'}</span>
                                                    <div className="relative flex items-center">
                                                        <div className="w-8 h-[2px] bg-indigo-500/30"></div>
                                                        <ArrowRight size={14} className="text-indigo-400 animate-pulse" />
                                                        <div className="w-8 h-[2px] bg-indigo-500/30"></div>
                                                    </div>
                                                    <span className="badge-standard bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 border-none font-black text-[9px] min-w-[120px] text-center">{t.destino_nombre || 'PRINCIPAL'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center justify-center min-w-[3.5rem] px-4 py-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-2xl text-lg font-black text-slate-700 dark:text-slate-300 tracking-tighter shadow-sm">
                                                    {t.total_items}
                                                    <span className="text-[10px] font-black text-slate-400 ml-2 uppercase opacity-40">UDS</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={getStatusBadge(t.estado)}>{t.estado}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex justify-end gap-3 translate-x-4 group-hover:translate-x-0 transition-all opacity-0 group-hover:opacity-100 duration-300">
                                                    <button
                                                        onClick={() => verDetalle(t)}
                                                        className="btn-secondary p-3 aspect-square border-indigo-100 dark:border-indigo-900/30 text-indigo-600"
                                                        title="VER DETALLE"
                                                    >
                                                        <Eye size={20} />
                                                    </button>
                                                    {t.estado === 'PENDIENTE' && (
                                                        <>
                                                            {(t.tienda_destino_id === user?.tienda_id || isAdmin) && (
                                                                <button
                                                                    onClick={() => handleRecibir(t.id)}
                                                                    className="btn-secondary p-3 aspect-square border-emerald-100 dark:border-emerald-900/30 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                                                                    title="RECIBIR MERCANCÍA"
                                                                >
                                                                    <CheckCircle2 size={20} />
                                                                </button>
                                                            )}
                                                            {(t.tienda_origen_id === user?.tienda_id || isAdmin) && (
                                                                <button
                                                                    onClick={() => handleCancelar(t.id)}
                                                                    className="btn-secondary p-3 aspect-square border-rose-100 dark:border-rose-900/30 text-rose-600 hover:bg-rose-600 hover:text-white"
                                                                    title="CANCELAR TRASLADO"
                                                                >
                                                                    <Trash2 size={20} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create Modal */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-container max-w-4xl p-0 overflow-hidden flex flex-col h-[90vh]">
                            <div className="p-8 border-b dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                                    <div className="p-2 bg-indigo-600 rounded-xl">
                                        <Truck size={24} className="text-white" />
                                    </div>
                                    OPERACIÓN DE <span className="text-indigo-600">TRASLADO</span>
                                </h2>
                                <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-600 transition-all">
                                    <X size={28} />
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="flex-1 overflow-hidden flex flex-col">
                                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-indigo-50/30 dark:bg-indigo-900/10 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800/20 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                            <ArrowLeftRight size={120} className="text-indigo-600" />
                                        </div>
                                        <div className="space-y-4 relative z-10">
                                            <label className="label-standard px-1">ORIGEN (EGRESO STOCK)</label>
                                            <select
                                                value={trasladoData.tienda_origen_id}
                                                disabled={!isAdmin}
                                                onChange={(e) => setTrasladoData({ ...trasladoData, tienda_origen_id: e.target.value })}
                                                className="select-standard h-[56px] font-black"
                                            >
                                                <option value="">ALMACÉN CENTRAL</option>
                                                {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-4 relative z-10">
                                            <label className="label-standard px-1">DESTINO (INGRESO STOCK)</label>
                                            <select
                                                value={trasladoData.tienda_destino_id}
                                                onChange={(e) => setTrasladoData({ ...trasladoData, tienda_destino_id: e.target.value })}
                                                required
                                                className="select-standard h-[56px] font-black border-indigo-500/20"
                                            >
                                                <option value="">SELECCIONAR DESTINO...</option>
                                                <option value="0">ALMACÉN CENTRAL</option>
                                                {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                                            <Package size={14} /> CATALOGACIÓN DE PRODUCTOS
                                        </h3>
                                        <div className="relative group">
                                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                type="text"
                                                placeholder="BUSCAR PRODUCTO PARA AÑADIR A LA RUTA..."
                                                value={busquedaProducto}
                                                onChange={(e) => setBusquedaProducto(e.target.value)}
                                                className="input-standard pl-16 h-[60px] font-black uppercase"
                                            />
                                            {busquedaProducto && (
                                                <ul className="absolute z-50 bg-white dark:bg-slate-800 border dark:border-slate-700/80 rounded-2xl w-full mt-3 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] max-h-56 overflow-y-auto custom-scrollbar ring-1 ring-black/5">
                                                    {productosCatalogo.filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())).map(p => (
                                                        <li
                                                            key={p.id}
                                                            onClick={() => agregarProducto(p)}
                                                            className="p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer flex justify-between items-center border-b dark:border-slate-700/50 last:border-0 group/item transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover/item:bg-indigo-100 group-hover/item:text-indigo-600 transition-colors">
                                                                    <Package size={14} />
                                                                </div>
                                                                <span className="font-black text-slate-700 dark:text-slate-200 uppercase text-xs tracking-tight">{p.nombre}</span>
                                                            </div>
                                                            <span className="badge-standard bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 border-none px-4">AÑADIR</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {trasladoData.productos.map(p => (
                                                <div key={p.producto_id} className="bg-white dark:bg-slate-800/40 p-5 rounded-3xl border dark:border-slate-700 flex items-center gap-6 group hover:border-indigo-500/30 transition-all shadow-sm">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-tight truncate group-hover:text-indigo-600 transition-colors">{p.nombre}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-6 shrink-0">
                                                        <div className="w-24">
                                                            <input
                                                                type="number"
                                                                value={p.cantidad}
                                                                onChange={(e) => actualizarCantidad(p.producto_id, e.target.value)}
                                                                min="1"
                                                                className="input-standard h-12 text-center font-black text-indigo-600 text-base"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removerProducto(p.producto_id)}
                                                            className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                                                        >
                                                            <Trash2 size={22} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {trasladoData.productos.length === 0 && (
                                                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed dark:border-slate-700 opacity-20">
                                                    <Layers size={60} />
                                                    <p className="font-black uppercase tracking-widest text-xs">Cargamento vacío</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="label-standard px-1">NOTAS OPERATIVAS / INSTRUCCIONES</label>
                                        <textarea
                                            value={trasladoData.notas}
                                            onChange={(e) => setTrasladoData({ ...trasladoData, notas: e.target.value })}
                                            placeholder="Detalles sobre el envío, responsable o prioridad..."
                                            className="input-standard min-h-[120px] py-6 resize-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="p-10 border-t dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="btn-secondary flex-1 h-[60px] text-[10px]"
                                    >
                                        CANCELAR OPERACIÓN
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary flex-1 h-[60px] text-[10px] shadow-indigo-600/20"
                                    >
                                        CONFIRMAR Y GENERAR GUÍA
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Detail Modal */}
                {detalleModal.open && (
                    <div className="modal-overlay">
                        <div className="modal-container max-w-2xl p-0 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-500">
                            <div className="p-10 border-b dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start">
                                <div>
                                    <div className="badge-standard bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 border-none mb-3">MANIFESTO DE CARGA</div>
                                    <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1">
                                        TRASLADO #{detalleModal.traslado.id}
                                    </h2>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                                        <Calendar size={12} /> {new Date(detalleModal.traslado.fecha_envio).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setDetalleModal({ open: false, traslado: null, productos: [] })}
                                    className="p-3 bg-white dark:bg-slate-700 text-slate-400 hover:text-rose-600 rounded-2xl shadow-xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl border dark:border-slate-700 text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">ORIGEN</p>
                                        <p className="font-black text-slate-800 dark:text-white uppercase truncate">{detalleModal.traslado.origen_nombre || 'PRINCIPAL'}</p>
                                    </div>
                                    <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-3xl border border-indigo-100 dark:border-indigo-800/30 text-center">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase mb-2">DESTINO</p>
                                        <p className="font-black text-indigo-600 dark:text-indigo-400 uppercase truncate">{detalleModal.traslado.destino_nombre || 'PRINCIPAL'}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESGLOSE DE MERCANCÍA</h3>
                                    <div className="space-y-3">
                                        {detalleModal.productos.map(p => (
                                            <div key={p.id} className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-[2rem] shadow-sm">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-sm font-black text-slate-700 dark:text-white uppercase truncate tracking-tight">{p.nombre}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{p.sku || 'SIN SKU'}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="badge-standard bg-indigo-600 text-white border-none px-6 py-2 text-lg font-black tracking-tighter">
                                                        {p.cantidad}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {detalleModal.traslado.notas && (
                                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-800/30">
                                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <FileText size={14} /> COMENTARIOS DEL DESPACHO
                                        </p>
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                            "{detalleModal.traslado.notas}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-10 border-t dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50">
                                <button
                                    onClick={() => setDetalleModal({ open: false, traslado: null, productos: [] })}
                                    className="w-full btn-primary h-[60px]"
                                >
                                    FINALIZAR REVISIÓN
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
