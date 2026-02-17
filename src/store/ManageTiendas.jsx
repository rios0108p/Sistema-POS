import { useEffect, useState } from "react";
import { tiendasAPI, productosAPI } from "../services/api";
import { toast } from "react-hot-toast";
import {
    Store, Plus, Edit2, Trash2, X, Save, Users, Package,
    DollarSign, MapPin, Phone, RefreshCw, ChevronDown, ChevronUp, Layers
} from "lucide-react";

const ManageTiendas = () => {
    const [tiendas, setTiendas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showProductosModal, setShowProductosModal] = useState(false);
    const [editingTienda, setEditingTienda] = useState(null);
    const [selectedTienda, setSelectedTienda] = useState(null);
    const [tiendaProductos, setTiendaProductos] = useState([]);
    const [expandedTienda, setExpandedTienda] = useState(null);

    const [formData, setFormData] = useState({
        nombre: '',
        tipo: 'GENERAL',
        direccion: '',
        telefono: '',
        monto_base: 500,
        precio_dolar: 20.00,
        datos_bancarios: ''
    });

    const tipoOptions = ['GENERAL', 'MODELO', 'TECATE', 'MIXTA'];

    useEffect(() => {
        loadTiendas();
        loadProductos();
    }, []);

    const loadTiendas = async () => {
        try {
            setLoading(true);
            const data = await tiendasAPI.getAll();
            setTiendas(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading tiendas:", error);
            toast.error("Error al cargar tiendas");
        } finally {
            setLoading(false);
        }
    };

    const loadProductos = async () => {
        try {
            const data = await productosAPI.getAll();
            setProductos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading productos:", error);
        }
    };

    const loadTiendaProductos = async (tiendaId) => {
        try {
            const data = await tiendasAPI.getProductos(tiendaId);
            setTiendaProductos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading tienda productos:", error);
            toast.error("Error al cargar productos de tienda");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTienda) {
                await tiendasAPI.update(editingTienda.id, formData);
                toast.success("Tienda actualizada");
            } else {
                await tiendasAPI.create(formData);
                toast.success("Tienda creada");
            }
            setShowModal(false);
            resetForm();
            loadTiendas();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleEdit = (tienda) => {
        setEditingTienda(tienda);
        setFormData({
            nombre: tienda.nombre,
            tipo: tienda.tipo || 'GENERAL',
            direccion: tienda.direccion || '',
            telefono: tienda.telefono || '',
            monto_base: tienda.monto_base || 500,
            precio_dolar: tienda.precio_dolar || 20.00,
            datos_bancarios: tienda.datos_bancarios || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar esta tienda?")) return;
        try {
            await tiendasAPI.delete(id);
            toast.success("Tienda eliminada");
            loadTiendas();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const resetForm = () => {
        setEditingTienda(null);
        setFormData({
            nombre: '',
            tipo: 'GENERAL',
            direccion: '',
            telefono: '',
            monto_base: 500,
            precio_dolar: 20.00,
            datos_bancarios: ''
        });
    };

    const openProductosModal = async (tienda) => {
        setSelectedTienda(tienda);
        await loadTiendaProductos(tienda.id);
        setShowProductosModal(true);
    };

    const handleAsignarProducto = async (productoId) => {
        try {
            await tiendasAPI.asignarProducto(selectedTienda.id, productoId, 10, 5);
            toast.success("Producto asignado");
            loadTiendaProductos(selectedTienda.id);
            loadTiendas();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleQuitarProducto = async (productoId) => {
        try {
            await tiendasAPI.eliminarProducto(selectedTienda.id, productoId);
            toast.success("Producto removido");
            loadTiendaProductos(selectedTienda.id);
            loadTiendas();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const tiendaProductoIds = tiendaProductos.map(p => p.producto_id);
    const productosDisponibles = productos.filter(p => !tiendaProductoIds.includes(p.id));

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                        <Store className="text-indigo-600 dark:text-indigo-400" size={28} />
                        CONTROL DE <span className="text-indigo-600 dark:text-indigo-400">SUCURSALES</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium ">
                        Visualización y gestión centralizada de la red comercial
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="btn-primary"
                >
                    <Plus size={18} />
                    Nueva Sucursal
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card-standard flex items-center gap-6">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50">
                        <Store className="text-indigo-600 dark:text-indigo-400" size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Puntos</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tighter">{tiendas.length}</p>
                    </div>
                </div>

                <div className="card-standard flex items-center gap-6">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50">
                        <Users className="text-emerald-600 dark:text-emerald-400" size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Personal Activo</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tighter">
                            {tiendas.reduce((sum, t) => sum + (t.total_empleados || 0), 0)}
                        </p>
                    </div>
                </div>

                <div className="card-standard flex items-center gap-6">
                    <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center border border-amber-100 dark:border-amber-800/50">
                        <Package className="text-amber-600 dark:text-amber-400" size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ítems Vinculados</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tighter">
                            {tiendas.reduce((sum, t) => sum + (t.total_productos || 0), 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tiendas Grid */}
            {loading ? (
                <div className="text-center py-24">
                    <RefreshCw className="animate-spin mx-auto text-indigo-500 mb-4" size={40} />
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Sincronizando red de tiendas...</p>
                </div>
            ) : tiendas.length === 0 ? (
                <div className="card-standard border-dashed p-20 text-center">
                    <Store className="mx-auto text-slate-100 dark:text-slate-700 mb-6" size={80} />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay sucursales registradas en el sistema</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary mt-8 mx-auto"
                    >
                        Inicializar Primera Tienda
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tiendas.map(tienda => (
                        <div
                            key={tienda.id}
                            className="group relative overflow-hidden card-standard p-0 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500"
                        >
                            <div className="p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-xl text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2">{tienda.nombre}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`badge-standard
                                                ${tienda.tipo === 'MODELO' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : ''}
                                                ${tienda.tipo === 'TECATE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' : ''}
                                                ${tienda.tipo === 'MIXTA' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : ''}
                                                ${tienda.tipo === 'GENERAL' ? 'bg-slate-100 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400' : ''}
                                            `}>
                                                {tienda.tipo || 'GENERAL'}
                                            </span>
                                            <span className="badge-standard bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">Activa</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button onClick={() => handleEdit(tienda)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">
                                            <Edit2 size={16} className="text-slate-500" />
                                        </button>
                                        <button onClick={() => handleDelete(tienda.id)} className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                                            <Trash2 size={16} className="text-rose-500" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6 ml-1">
                                    {tienda.direccion && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
                                            <MapPin size={12} strokeWidth={3} className="text-indigo-500" /> {tienda.direccion}
                                        </p>
                                    )}
                                    {tienda.telefono && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
                                            <Phone size={12} strokeWidth={3} className="text-indigo-500" /> {tienda.telefono}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-3 text-center mb-8">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-700/50">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Caja</p>
                                        <p className="font-bold text-indigo-600 dark:text-indigo-400 tracking-tighter text-sm ">${Number(tienda.monto_base || 0).toFixed(0)}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-700/50">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Equipo</p>
                                        <p className="font-bold text-emerald-600 dark:text-emerald-400 tracking-tighter text-sm ">{tienda.total_empleados || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-700/50">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock</p>
                                        <p className="font-bold text-amber-600 dark:text-amber-400 tracking-tighter text-sm ">{tienda.total_productos || 0}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => openProductosModal(tienda)}
                                    className="btn-secondary w-full py-4 uppercase text-[10px] tracking-widest gap-2"
                                >
                                    <Package size={14} strokeWidth={3} /> VINCULAR PRODUCTOS
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Tienda */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container max-w-md w-full p-0 overflow-hidden">
                        <div className="modal-header p-8 flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter leading-none ">
                                {editingTienda ? 'Actualizar Sede' : 'Nueva Sucursal'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-6">
                            <div>
                                <label className="label-standard">Nombre Comercial *</label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    className="input-standard font-bold"
                                    placeholder="Ej: Sucursal Norte"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-standard">Tipo de Tienda</label>
                                    <select
                                        value={formData.tipo}
                                        onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                        className="select-standard font-bold"
                                    >
                                        {tipoOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label-standard">Apertura Caja</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.monto_base}
                                        onChange={e => setFormData({ ...formData, monto_base: parseFloat(e.target.value) || 0 })}
                                        className="input-standard font-bold text-indigo-600 dark:text-indigo-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-standard">Tipo de Cambio USD</label>
                                    <div className="relative">
                                        <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.precio_dolar}
                                            onChange={e => setFormData({ ...formData, precio_dolar: parseFloat(e.target.value) || 0 })}
                                            className="input-standard pl-10 font-bold text-amber-600 dark:text-amber-400"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="label-standard">Depósitos (Banco)</label>
                                    <textarea
                                        value={formData.datos_bancarios}
                                        onChange={e => setFormData({ ...formData, datos_bancarios: e.target.value })}
                                        className="input-standard text-[10px] font-bold"
                                        placeholder="Cuenta, CLABE, Banco..."
                                        rows="2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label-standard">Dirección Exacta</label>
                                <input
                                    type="text"
                                    value={formData.direccion}
                                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                    className="input-standard font-bold"
                                    placeholder="Av. Principal #123..."
                                />
                            </div>

                            <div>
                                <label className="label-standard">Línea de Contacto</label>
                                <input
                                    type="text"
                                    value={formData.telefono}
                                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                    className="input-standard font-bold font-mono"
                                    placeholder="+502 0000 0000"
                                />
                            </div>

                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    type="submit"
                                    className="btn-primary w-full shadow-2xl"
                                >
                                    <Save size={18} />
                                    {editingTienda ? 'Confirmar Cambios' : 'Inicializar Sede'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn-secondary w-full justify-center"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Productos */}
            {showProductosModal && selectedTienda && (
                <div className="modal-overlay">
                    <div className="modal-container max-w-5xl w-full max-h-[85vh] p-0 overflow-hidden flex flex-col">
                        <div className="modal-header p-8 flex items-center justify-between border-b dark:border-slate-700/50">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter leading-none flex items-center gap-3">
                                    <Package className="text-indigo-500" size={28} />
                                    Catálogo: {selectedTienda.nombre}
                                </h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Personaliza el inventario específico para este punto de venta</p>
                            </div>
                            <button onClick={() => setShowProductosModal(false)} className="text-slate-400 hover:text-rose-500 transition-all">
                                <X size={32} />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Productos asignados */}
                            <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30 rounded-[2rem] p-6 border dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-6 flex items-center gap-3 px-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Inventario Local ({tiendaProductos.length})
                                </h4>
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                                    {tiendaProductos.length === 0 ? (
                                        <div className="text-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center">
                                            <Layers className="text-slate-200 dark:text-slate-700 mb-4 opacity-30" size={40} />
                                            <p className="text-slate-300 dark:text-slate-600 font-bold uppercase text-[10px] tracking-widest px-4">Sin productos activos</p>
                                        </div>
                                    ) : (
                                        tiendaProductos.map(p => (
                                            <div key={p.producto_id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700/50 shadow-sm group hover:scale-[1.02] transition-all duration-300">
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-700 dark:text-white uppercase tracking-tighter leading-tight text-sm">{p.nombre}</p>
                                                    <div className="flex gap-2 mt-2">
                                                        <span className="badge-standard bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                                                            STOCK: {p.cantidad}
                                                        </span>
                                                        <span className="badge-standard bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                                                            MIN: {p.stock_minimo}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleQuitarProducto(p.producto_id)}
                                                    className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-90"
                                                    title="Eliminar de tienda"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Catálogo Global */}
                            <div className="flex flex-col h-full bg-indigo-50/20 dark:bg-indigo-900/10 rounded-[2rem] p-6 border border-indigo-100/30 dark:border-indigo-800/30">
                                <h4 className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-6 flex items-center gap-3 px-2">
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                                    Catálogo Global
                                </h4>
                                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                    {productosDisponibles.length === 0 ? (
                                        <div className="text-center py-20 bg-white/30 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-indigo-100/30 dark:border-indigo-800/30">
                                            <p className="text-indigo-300 dark:text-indigo-700 font-bold uppercase text-[10px] tracking-widest px-4">Toda la colección vinculada</p>
                                        </div>
                                    ) : (
                                        productosDisponibles.map(p => (
                                            <div key={p.id} className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] border dark:border-slate-700/50 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-transparent hover:border-b-indigo-500/50">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-800 dark:text-white uppercase tracking-tighter leading-tight text-base mb-1">{p.nombre}</p>
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-900 rounded-md text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                                            <Layers size={10} /> Consolidado: {p.cantidad}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 mt-2 pt-4 border-t dark:border-slate-700/50">
                                                    <div className="flex-1 text-center">
                                                        <label className="label-standard mb-1.5 block">Traslado</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={p.cantidad}
                                                            id={`qty-${p.id}`}
                                                            defaultValue="0"
                                                            className="input-standard py-2 text-center text-indigo-600 dark:text-indigo-400 font-bold"
                                                        />
                                                    </div>
                                                    <div className="flex-1 text-center">
                                                        <label className="label-standard mb-1.5 block">Mínimo</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            id={`min-${p.id}`}
                                                            defaultValue="5"
                                                            className="input-standard py-2 text-center font-bold"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const qty = parseInt(document.getElementById(`qty-${p.id}`).value) || 0;
                                                            const min = parseInt(document.getElementById(`min-${p.id}`).value) || 5;

                                                            if (qty > 0 && qty > p.cantidad) {
                                                                toast.error("No hay suficiente stock global");
                                                                return;
                                                            }

                                                            tiendasAPI.asignarProducto(selectedTienda.id, p.id, qty, min)
                                                                .then(res => {
                                                                    toast.success(res.message || "Operación exitosa");
                                                                    loadTiendaProductos(selectedTienda.id);
                                                                    loadProductos();
                                                                    loadTiendas();
                                                                })
                                                                .catch(err => toast.error(err.message));
                                                        }}
                                                        className="btn-primary w-12 h-12 p-0 mt-4 shadow-xl active:scale-90"
                                                        title="Vincular a Tienda"
                                                    >
                                                        <Plus size={20} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 border-t dark:border-slate-700/50 flex justify-center bg-slate-50 dark:bg-slate-900/50">
                            <button onClick={() => setShowProductosModal(false)} className="btn-primary w-auto px-10">
                                Cerrar Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageTiendas;
