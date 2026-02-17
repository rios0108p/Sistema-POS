import { useState, useEffect } from "react";
import { promocionesAPI, productosAPI, tiendasAPI } from "../services/api";
import { toast } from "react-hot-toast";
import { Plus, Trash2, Store, Tag, Package, X, ChevronRight, Info } from "lucide-react";

const ManagePromociones = () => {
    const [promociones, setPromociones] = useState([]);
    const [productos, setProductos] = useState([]);
    const [tiendas, setTiendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: "",
        precio_combo: "",
        tienda_id: "",
        productos: [] // Array of { producto_id, cantidad }
    });

    const [selectedProduct, setSelectedProduct] = useState("");
    const [selectedQty, setSelectedQty] = useState(1);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [promosData, prodsData, tiendasData] = await Promise.all([
                promocionesAPI.getAll(),
                productosAPI.getAll(),
                tiendasAPI.getAll()
            ]);
            setPromociones(promosData);
            setProductos(prodsData);
            setTiendas(tiendasData);
        } catch (error) {
            toast.error("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    const handleAddProductToPromo = () => {
        if (!selectedProduct) return;
        const prod = productos.find(p => p.id == selectedProduct);
        if (!prod) return;

        setFormData(prev => ({
            ...prev,
            productos: [...prev.productos, {
                producto_id: prod.id,
                nombre: prod.nombre,
                cantidad: parseInt(selectedQty)
            }]
        }));
        setSelectedProduct("");
        setSelectedQty(1);
    };

    const removeProductFromPromo = (index) => {
        setFormData(prev => ({
            ...prev,
            productos: prev.productos.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.productos.length === 0) {
            return toast.error("Agrega al menos un producto al combo");
        }

        try {
            await promocionesAPI.create(formData);
            toast.success("Promoción creada correctamente");
            setIsModalOpen(false);
            setFormData({ nombre: "", descripcion: "", precio_combo: "", tienda_id: "", productos: [] });
            loadData();
        } catch (error) {
            toast.error("Error al crear promoción");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar esta promoción?")) return;
        try {
            await promocionesAPI.delete(id);
            toast.success("Promoción eliminada");
            loadData();
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                        <Tag className="text-indigo-600 dark:text-indigo-400" size={28} />
                        GESTIÓN DE <span className="text-indigo-600 dark:text-indigo-400">PROMOCIONES</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Configura combos y ofertas por sucursal</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary gap-2 bg-amber-500 hover:bg-amber-600 border-none shadow-amber-500/20"
                >
                    <Plus size={18} /> Nueva Promoción
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-20 animate-pulse text-slate-300 uppercase font-bold tracking-[0.3em] text-xs">Cargando ofertas...</div>
            ) : promociones.length === 0 ? (
                <div className="card-standard border-dashed p-20 text-center">
                    <Tag size={60} className="mx-auto text-slate-100 dark:text-slate-700 mb-6" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay promociones activas</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary mt-8 mx-auto bg-amber-500 hover:bg-amber-600 border-none shadow-amber-500/20"
                    >
                        Crear Primera Oferta
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promociones.map(promo => (
                        <div key={promo.id} className="group relative overflow-hidden card-standard p-0 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500">
                            <div className="p-8 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-amber-50 dark:bg-amber-900/40 p-3 rounded-2xl text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 shadow-sm">
                                        <Package size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Precio Combo</p>
                                        <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">${promo.precio_combo}</span>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-none mb-2">{promo.nombre}</h3>
                                <p className="text-xs text-slate-400 font-bold mb-6 line-clamp-2 min-h-[2rem]">{promo.descripcion || 'Sin descripción'}</p>

                                <div className="space-y-3 mb-8 flex-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b dark:border-slate-700/50 pb-2">Contenido de la Oferta</p>
                                    <div className="space-y-2">
                                        {promo.productos?.map((p, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                                <span className="truncate pr-4 uppercase tracking-tighter">{p.nombre}</span>
                                                <span className="badge-standard py-0.5 px-2 bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">x{p.cantidad}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t dark:border-slate-700/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                                        <Store size={12} />
                                        {tiendas.find(t => t.id == promo.tienda_id)?.nombre || "Todas las Tiendas"}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(promo.id)}
                                        className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Nueva Promoción */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container w-full max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
                        <div className="modal-header p-8 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter leading-none">Vincular Nueva Promo</h2>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1.5">Define productos y precio final del combo</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-all"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label-standard">Nombre de la Promoción *</label>
                                    <input
                                        required
                                        className="input-standard font-bold"
                                        placeholder="Ej: PACK FIN DE SEMANA"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label-standard">Precio Final del Combo ($) *</label>
                                    <div className="relative">
                                        <input
                                            type="number" step="0.01" required
                                            className="input-standard pl-10 h-[52px] font-black text-amber-600 text-xl"
                                            placeholder="0.00"
                                            value={formData.precio_combo}
                                            onChange={e => setFormData({ ...formData, precio_combo: e.target.value })}
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-lg">$</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label-standard">Alcance de la Oferta</label>
                                    <select
                                        className="select-standard font-bold"
                                        value={formData.tienda_id}
                                        onChange={e => setFormData({ ...formData, tienda_id: e.target.value })}
                                    >
                                        <option value="">Todas las tiendas</option>
                                        {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="label-standard">Descripción Breve</label>
                                    <input
                                        className="input-standard h-[52px] font-medium"
                                        placeholder="Nota interna o detalle para el ticket"
                                        value={formData.descripcion}
                                        onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Selector de Productos para el Bundle */}
                            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed dark:border-slate-700/50 flex flex-col gap-6">
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <Plus size={14} className="text-amber-500" /> ARMAR BUNDLE DE PRODUCTOS
                                    </h3>
                                    <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-12 md:col-span-7">
                                            <select
                                                className="select-standard h-[48px] font-bold"
                                                value={selectedProduct}
                                                onChange={e => setSelectedProduct(e.target.value)}
                                            >
                                                <option value="">Seleccionar Producto...</option>
                                                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (${p.precio_venta})</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-8 md:col-span-3">
                                            <input
                                                type="number" className="input-standard h-[48px] text-center font-bold"
                                                value={selectedQty}
                                                onChange={e => setSelectedQty(e.target.value)}
                                                min="1"
                                                placeholder="Cant."
                                            />
                                        </div>
                                        <button
                                            type="button" onClick={handleAddProductToPromo}
                                            className="col-span-4 md:col-span-2 bg-slate-800 dark:bg-amber-500 text-white flex items-center justify-center rounded-xl shadow-lg active:scale-95 h-[48px] hover:bg-slate-900 dark:hover:bg-amber-600 transition-all"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {formData.productos.length === 0 ? (
                                        <div className="text-center py-6 opacity-40 text-[10px] font-bold uppercase tracking-widest italic">Vincula al menos 2 ítems para este combo</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {formData.productos.map((p, idx) => (
                                                <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl flex justify-between items-center shadow-sm border dark:border-slate-700/50 group/item">
                                                    <div className="flex-1 truncate">
                                                        <span className="text-[10px] font-bold text-amber-500 mr-2">x{p.cantidad}</span>
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase leading-none tracking-tighter">{p.nombre}</span>
                                                    </div>
                                                    <button type="button" onClick={() => removeProductFromPromo(idx)} className="text-slate-300 hover:text-rose-500 transition-all ml-2"><X size={14} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div className="p-10 border-t dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-3">
                            <button
                                onClick={handleSubmit}
                                className="btn-primary w-full bg-amber-500 hover:bg-amber-600 border-none shadow-amber-500/20 py-5"
                            >
                                ACTIVAR PROMOCIÓN
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="btn-secondary w-full justify-center"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePromociones;
