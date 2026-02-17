import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Users,
    Search,
    Plus,
    Edit,
    Trash2,
    FileText,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    ChevronRight,
    UserCheck,
    Clock,
    X,
    Table,
    DollarSign
} from "lucide-react";
import { clientesAPI, productosAPI, getImageUrl } from "../services/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { QRCodeCanvas } from "qrcode.react";
import Barcode from "react-barcode";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";

export default function ManageCustomers() {
    const { user, storeConfig } = useAuth();
    const isAdmin = user?.rol === 'admin';
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState(null);
    const [formData, setFormData] = useState({
        nombre: "",
        email: "",
        telefono: "",
        direccion: "",
        nit_dpi: "",
        codigo_barras: ""
    });

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [clientHistory, setClientHistory] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Special Prices State
    const [isSpecialPriceOpen, setIsSpecialPriceOpen] = useState(false);
    const [productos, setProductos] = useState([]);
    const [preciosEspeciales, setPreciosEspeciales] = useState([]);
    const [loadingSpecial, setLoadingSpecial] = useState(false);
    const [newSpecial, setNewSpecial] = useState({ producto_id: "", precio_especial: "", min_cantidad: 1 });

    const [isIdCardOpen, setIsIdCardOpen] = useState(false);

    useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = async () => {
        try {
            const data = await clientesAPI.getAll();
            setClientes(data || []);
        } catch (error) {
            toast.error("Error al cargar clientes");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (cliente = null) => {
        if (cliente) {
            setEditingCliente(cliente);
            setFormData({
                nombre: cliente.nombre,
                email: cliente.email || "",
                telefono: cliente.telefono || "",
                direccion: cliente.direccion || "",
                nit_dpi: cliente.nit_dpi || "",
                codigo_barras: cliente.codigo_barras || ""
            });
        } else {
            setEditingCliente(null);
            setFormData({
                nombre: "",
                email: "",
                telefono: "",
                direccion: "",
                nit_dpi: "",
                codigo_barras: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCliente) {
                await clientesAPI.update(editingCliente.id, formData);
                toast.success("Cliente actualizado");
            } else {
                await clientesAPI.create(formData);
                toast.success("Cliente registrado con éxito");
            }
            setIsModalOpen(false);
            fetchClientes();
        } catch (error) {
            toast.error(error.message || "Error al procesar la solicitud");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar este registro de cliente?")) return;
        try {
            await clientesAPI.delete(id);
            toast.success("Cliente eliminado del registro");
            fetchClientes();
        } catch (error) {
            toast.error("Error operativo al eliminar");
        }
    };

    const handleViewHistory = async (cliente) => {
        setSelectedClient(cliente);
        setIsHistoryOpen(true);
        setLoadingHistory(true);
        try {
            const data = await clientesAPI.getHistory(cliente.id);
            setClientHistory(data.ventas || []);
        } catch (error) {
            console.error(error);
            toast.error("No se pudo sincronizar el historial");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleOpenSpecialPrices = async (cliente) => {
        setSelectedClient(cliente);
        setIsSpecialPriceOpen(true);
        setLoadingSpecial(true);
        try {
            // Load products if not loaded
            if (productos.length === 0) {
                const prods = await productosAPI.getAll();
                setProductos(prods);
            }
            // Load current special prices
            const specials = await clientesAPI.getPreciosEspeciales(cliente.id);
            setPreciosEspeciales(specials);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando configuración de precios");
        } finally {
            setLoadingSpecial(false);
        }
    };

    const handleAddSpecialPrice = async () => {
        if (!newSpecial.producto_id || !newSpecial.precio_especial) return toast.error("Completa los datos");
        try {
            await clientesAPI.savePrecioEspecial(selectedClient.id, newSpecial);
            toast.success("Precio asignado");
            setNewSpecial({ producto_id: "", precio_especial: "", min_cantidad: 1 });
            // Refresh list
            const specials = await clientesAPI.getPreciosEspeciales(selectedClient.id);
            setPreciosEspeciales(specials);
        } catch (error) {
            toast.error("Error operando precios especiales");
        }
    };

    const handleDeleteSpecialPrice = async (productoId) => {
        try {
            await clientesAPI.deletePrecioEspecial(selectedClient.id, productoId);
            setPreciosEspeciales(preciosEspeciales.filter(p => p.producto_id !== productoId));
            toast.success("Precio eliminado");
        } catch (error) {
            toast.error("Error eliminando precio");
        }
    };

    const filteredClientes = clientes.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.nit_dpi && c.nit_dpi.includes(searchTerm)) ||
        (c.codigo_barras && c.codigo_barras.includes(searchTerm))
    );

    const handleShareWhatsApp = (cliente) => {
        const text = `¡Hola ${cliente.nombre}! Aquí tienes tu código de cliente preferencial: ${cliente.codigo_barras}. Preséntalo en tienda para obtener tus beneficios.`;
        window.open(`https://wa.me/${cliente.telefono?.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
    };

    const downloadIdCard = async (clienteName) => {
        const element = document.getElementById('customer-id-card');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: null,
                scale: 3, // Mayor calidad
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('customer-id-card');
                    if (el) {
                        // Hacemos la tarjeta rectangular para descargar y removemos el overflow
                        el.style.borderRadius = '0';
                        el.style.boxShadow = 'none';
                        el.style.transform = 'none';
                        el.style.overflow = 'visible'; // Permite que el contenido no se corte
                        el.style.paddingBottom = '3rem'; // Espacio extra de seguridad

                        // Aseguramos que el fondo cubra todo
                        el.style.backgroundClip = 'border-box';
                        el.style.width = '350px'; // Ancho fijo para consistencia
                        el.style.height = 'auto'; // Altura automática según contenido
                        el.style.minHeight = '480px';
                    }
                }
            });
            const dataUrl = canvas.toDataURL("image/png");
            saveAs(dataUrl, `Tarjeta_Cliente_${clienteName.replace(/\s+/g, '_')}.png`);
        } catch (err) {
            console.error("Error generating image:", err);
            toast.error("Error al generar imagen");
        }
    };

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-4 uppercase relative z-10">
                        <Users className="text-indigo-600 dark:text-indigo-400" size={32} />
                        CARTERA DE <span className="text-indigo-600 dark:text-indigo-400">CLIENTES</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest opacity-60">Gestión de relaciones comerciales e historial de consumo</p>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full md:w-auto">
                    <button onClick={() => {
                        const data = filteredClientes.map(c => ({ Nombre: c.nombre, ID: c.nit_dpi, Email: c.email, Telefono: c.telefono }));
                        exportToExcel(data, 'Clientes', 'Clientes');
                    }} className="h-[44px] px-6 rounded-2xl flex items-center gap-3 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group">
                        <Table size={16} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">EXCEL</span>
                    </button>
                    <button onClick={() => {
                        const headers = ['Nombre', 'ID', 'Email', 'Teléfono'];
                        const data = filteredClientes.map(c => [c.nombre, c.nit_dpi || '-', c.email || '-', c.telefono || '-']);
                        exportToPDF({ title: 'Reporte de Clientes', headers, data, fileName: 'Clientes' });
                    }} className="h-[44px] px-6 rounded-2xl flex items-center gap-3 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group">
                        <FileText size={16} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">PDF</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="btn-primary gap-2"
                        >
                            <Plus size={18} />
                            Nuevo Cliente
                        </button>
                    )}
                </div>
            </div>

            {/* Buscador de Alto Nivel */}
            <div className="bg-white/50 dark:bg-slate-800/50 p-6 rounded-[2rem] border dark:border-slate-700/50 backdrop-blur-md mb-8 shadow-xl">
                <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={24} />
                    <input
                        type="text"
                        placeholder="Búsqueda inteligente por nombre, email o identificación (NIT/DPI)..."
                        className="w-full pl-16 pr-8 py-5 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-slate-800 dark:text-white font-bold placeholder:text-slate-300 placeholder:font-normal"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid de Clientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center animate-pulse">
                        <Users className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={50} />
                        <p className="text-slate-300 dark:text-slate-700 font-bold uppercase tracking-[0.2em] text-xs">Cargando base de datos...</p>
                    </div>
                ) : filteredClientes.length === 0 ? (
                    <div className="col-span-full text-center py-20 card-standard border-dashed">
                        <UserCheck className="mx-auto text-slate-100 dark:text-slate-700 mb-4 opacity-10" size={80} />
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No se encontraron clientes que coincidan</p>
                    </div>
                ) : (
                    filteredClientes.map((cliente) => (
                        <div key={cliente.id} className="group relative overflow-hidden card-standard p-8 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>

                            <div className="flex justify-between items-start mb-6 relative">
                                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center font-bold text-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                    {cliente.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                    <button
                                        onClick={() => handleOpenModal(cliente)}
                                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-md active:scale-90"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cliente.id)}
                                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-md active:scale-90"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-bold text-slate-800 dark:text-white text-xl mb-1 uppercase tracking-tighter leading-none">{cliente.nombre}</h3>
                            <p className="text-[10px] font-bold text-indigo-500/50 dark:text-indigo-400/50 uppercase tracking-[0.15em] mb-6">Cliente Preferencial</p>

                            <div className="space-y-3.5 text-xs text-slate-500 dark:text-slate-400 font-bold ml-1">
                                {cliente.nit_dpi && (
                                    <div className="flex items-center gap-3">
                                        <CreditCard size={14} className="text-slate-300" />
                                        <span className="tracking-tighter">ID: <span className="text-slate-800 dark:text-slate-200">{cliente.nit_dpi}</span></span>
                                    </div>
                                )}
                                {cliente.email && (
                                    <div className="flex items-center gap-3">
                                        <Mail size={14} className="text-slate-300" />
                                        <a href={`mailto:${cliente.email}`} className="hover:text-indigo-600 font-medium truncate">{cliente.email}</a>
                                    </div>
                                )}
                                {cliente.telefono && (
                                    <div className="flex items-center gap-3">
                                        <Phone size={14} className="text-slate-300" />
                                        <a href={`tel:${cliente.telefono}`} className="hover:text-indigo-600 font-mono">{cliente.telefono}</a>
                                    </div>
                                )}
                                {cliente.direccion && (
                                    <div className="flex items-start gap-3">
                                        <MapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-300" />
                                        <span className="line-clamp-2 leading-relaxed opacity-60 font-medium">{cliente.direccion}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t dark:border-slate-700/50 flex flex-wrap gap-2 justify-end">
                                {isAdmin && (
                                    <button
                                        onClick={() => handleOpenSpecialPrices(cliente)}
                                        className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-all rounded-xl tracking-widest flex items-center gap-2 shadow-sm"
                                    >
                                        <DollarSign size={14} /> PRECIOS ESPECIALES
                                    </button>
                                )}
                                <button
                                    onClick={() => handleViewHistory(cliente)}
                                    className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 text-[9px] font-bold uppercase text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all rounded-xl tracking-widest flex items-center gap-2 shadow-sm group/btn"
                                >
                                    AUDITAR ACTIVIDAD
                                    <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                                {isAdmin || user?.rol === 'vendedor' ? (
                                    <button
                                        onClick={() => { setSelectedClient(cliente); setIsIdCardOpen(true); }}
                                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-indigo-500 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95"
                                    >
                                        <CreditCard size={14} /> TARJETA DIGITAL
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Tarjeta Digital */}
            {isIdCardOpen && selectedClient && (
                <div className="modal-overlay">
                    <div className="modal-container w-full max-w-md p-0 overflow-hidden flex flex-col">
                        <div className="modal-header px-10 py-8 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter">Tarjeta de Cliente</h2>
                            <button onClick={() => setIsIdCardOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>

                        <div className="p-10 flex flex-col items-center gap-8 bg-slate-50/50 dark:bg-slate-900/50">
                            {/* Tarjeta para Captura */}
                            <div
                                id="customer-id-card"
                                style={{
                                    backgroundColor: storeConfig.card_primary_color || '#4f46e5',
                                    backgroundImage: storeConfig.card_bg_image
                                        ? `url(${getImageUrl(storeConfig.card_bg_image)})`
                                        : `linear-gradient(135deg, ${storeConfig.card_primary_color || '#4f46e5'} 0%, ${storeConfig.card_secondary_color || '#3730a3'} 100%)`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    padding: '2rem',
                                    borderRadius: '1.5rem',
                                    color: storeConfig.card_text_color || 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1.5rem',
                                    width: '100%',
                                    maxWidth: '320px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
                                    minHeight: '440px',
                                    aspectRatio: 'auto',
                                    fontFamily: 'system-ui, sans-serif'
                                }}
                            >
                                {/* Overlay para fondo imagen */}
                                {storeConfig.card_bg_image && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 1 }}></div>}

                                {/* Decorative Circles */}
                                <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '150px', height: '150px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', zIndex: 2 }}></div>
                                <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '120px', height: '120px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', zIndex: 2 }}></div>

                                {/* Header Section */}
                                <div style={{ textAlign: 'center', zIndex: 10, marginTop: '1rem' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.9, marginBottom: '0.5rem' }}>
                                        {storeConfig.card_title || 'Cliente Preferencial'}
                                    </p>
                                    <h3 style={{ fontSize: '2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.025em', lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                                        {selectedClient.nombre}
                                    </h3>
                                </div>

                                {/* White Box for Codes */}
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '1.5rem',
                                    borderRadius: '1.25rem',
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    zIndex: 10,
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
                                }}>
                                    <QRCodeCanvas value={selectedClient.nit_dpi || selectedClient.id.toString()} size={120} />
                                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                                        <Barcode
                                            value={selectedClient.codigo_barras || (selectedClient.nit_dpi?.length > 4 ? selectedClient.nit_dpi : "0000000")}
                                            width={1.5}
                                            height={40}
                                            fontSize={12}
                                            background="transparent"
                                            margin={0}
                                            displayValue={true}
                                        />
                                    </div>
                                </div>

                                {/* Footer Info */}
                                <div style={{ textAlign: 'center', zIndex: 10, marginBottom: '1rem' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>ID ÚNICO</p>
                                    <p style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
                                        {selectedClient.codigo_barras || selectedClient.nit_dpi || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full">
                                <button
                                    onClick={() => downloadIdCard(selectedClient.nombre)}
                                    className="btn-secondary py-4 w-full justify-center"
                                >
                                    Descargar Imagen
                                </button>
                                <button
                                    onClick={() => handleShareWhatsApp(selectedClient)}
                                    className="btn-primary py-4 w-full justify-center bg-emerald-500 hover:bg-emerald-600 border-none shadow-lg shadow-emerald-500/20"
                                >
                                    Enviar WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Precios Especiales */}
            {isSpecialPriceOpen && (
                <div className="modal-overlay">
                    <div className="modal-container w-full max-w-2xl max-h-[85vh] flex flex-col p-0">
                        <div className="modal-header px-10 py-8 bg-amber-50/50 dark:bg-amber-900/10 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter">Precios Especiales</h2>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Cliente: {selectedClient?.nombre}</p>
                            </div>
                            <button onClick={() => setIsSpecialPriceOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* Formulario Añadir */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border dark:border-slate-700/50">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Asignar Nuevo Precio</h3>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-5">
                                        <label className="label-standard ml-1">Producto</label>
                                        <select
                                            className="select-standard"
                                            value={newSpecial.producto_id}
                                            onChange={e => setNewSpecial({ ...newSpecial, producto_id: e.target.value })}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {productos.map(p => (
                                                <option key={p.id} value={p.id}>{p.nombre} (${p.precio_venta})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="label-standard ml-1">Min. (Mayoreo)</label>
                                        <input
                                            type="number"
                                            placeholder="1"
                                            className="input-standard"
                                            value={newSpecial.min_cantidad}
                                            onChange={e => setNewSpecial({ ...newSpecial, min_cantidad: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="md:col-span-4 flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="label-standard ml-1">Precio Especial</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="input-standard"
                                                value={newSpecial.precio_especial}
                                                onChange={e => setNewSpecial({ ...newSpecial, precio_especial: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            onClick={handleAddSpecialPrice}
                                            className="bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-xl transition-all shadow-md active:scale-95 h-[46px]"
                                            title="Agregar Regla"
                                        >
                                            <Plus size={20} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Lista Actual */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Precios Configurados</h3>
                                {loadingSpecial ? (
                                    <div className="text-center py-10 opacity-50 text-[10px] font-bold uppercase tracking-widest">Cargando...</div>
                                ) : preciosEspeciales.length === 0 ? (
                                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay precios específicos para este cliente</div>
                                ) : (
                                    <div className="space-y-2">
                                        {preciosEspeciales.map(ps => (
                                            <div key={ps.producto_id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm group">
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{ps.producto_nombre}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Regular: ${ps.precio_regular}</span>
                                                        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md uppercase tracking-widest">Aplica Cada {ps.min_cantidad} pza(s)</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <span className="text-lg font-bold text-amber-600 tracking-tighter">${ps.precio_especial}</span>
                                                    <button
                                                        onClick={() => handleDeleteSpecialPrice(ps.producto_id)}
                                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-8 border-t dark:border-slate-700/50 flex justify-center bg-slate-50/50 dark:bg-slate-900/50">
                            <button onClick={() => setIsSpecialPriceOpen(false)} className="btn-primary w-auto px-10">Listo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear/Editar Cliente */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container w-full max-w-lg overflow-hidden border border-white/20">
                        <div className="px-10 py-10">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 uppercase tracking-tighter leading-none">
                                {editingCliente ? "Actualizar Perfil" : "Vincular Nuevo Cliente"}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-10">Identificación oficial y contacto</p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="label-standard ml-1">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        className="input-standard"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        placeholder="Nombre Legal"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="label-standard ml-1">NIT / DPI</label>
                                        <input
                                            type="text"
                                            className="input-standard"
                                            value={formData.nit_dpi}
                                            onChange={e => setFormData({ ...formData, nit_dpi: e.target.value })}
                                            placeholder="Identificación"
                                        />
                                    </div>
                                    <div>
                                        <label className="label-standard ml-1">Teléfono</label>
                                        <input
                                            type="text"
                                            className="input-standard"
                                            value={formData.telefono}
                                            onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                            placeholder="Contacto"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label-standard ml-1">Email</label>
                                    <input
                                        type="email"
                                        className="input-standard"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>

                                <div>
                                    <label className="label-standard ml-1">Dirección / Localidad</label>
                                    <textarea
                                        rows="2"
                                        className="input-standard"
                                        value={formData.direccion}
                                        onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                        placeholder="Dirección física"
                                    ></textarea>
                                </div>

                                <div className="pt-6 flex flex-col gap-3">
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                    >
                                        {editingCliente ? "Guardar Cambios" : "Sincronizar Cliente"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="btn-secondary w-full justify-center"
                                    >
                                        Retroceder
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Historial */}
            {isHistoryOpen && (
                <div className="modal-overlay">
                    <div className="modal-container w-full max-w-2xl max-h-[85vh] flex flex-col p-0">
                        <div className="modal-header px-10 py-10 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-end border-b dark:border-slate-700/50">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2">Auditoría de Actividad</h2>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{selectedClient?.nombre}</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-slate-300 hover:text-slate-600 p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all">
                                <X size={28} />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                            {loadingHistory ? (
                                <div className="p-20 text-center animate-pulse flex flex-col items-center gap-4">
                                    <Clock className="text-slate-100 dark:text-slate-800" size={60} />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300 dark:text-slate-700">Auditando transacciones...</p>
                                </div>
                            ) : clientHistory.length === 0 ? (
                                <div className="p-20 text-center flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-600">
                                        <FileText size={40} />
                                    </div>
                                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Sin actividad transaccional registrada.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase text-[9px] font-bold tracking-widest sticky top-0 border-b dark:border-slate-700/50 z-10">
                                        <tr>
                                            <th className="px-8 py-5">Cronología / Sucursal</th>
                                            <th className="px-8 py-5">Detalle / ID</th>
                                            <th className="px-8 py-5 text-right">Método</th>
                                            <th className="px-8 py-5 text-right">Monto Operado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {clientHistory.map((venta) => (
                                            <tr key={venta.id} className={`hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors group ${venta.estado === 'CANCELADA' ? 'opacity-50 grayscale' : ''}`}>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">{new Date(venta.fecha).toLocaleDateString()}</span>
                                                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-300 uppercase">{venta.tienda_nombre || 'Sede Central'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <p className={`text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter truncate max-w-[200px] ${venta.estado === 'CANCELADA' ? 'line-through' : ''}`}>
                                                        {venta.resumen_productos}
                                                    </p>
                                                    <span className="text-[8px] font-bold text-slate-400">ID VENTA: #{venta.id}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{venta.metodo_pago}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className={`text-base font-bold tracking-tighter ${venta.estado === 'CANCELADA' ? 'text-slate-400 line-through' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                        {storeConfig?.moneda || '$'} {Number(venta.total).toFixed(1)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-10 border-t dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex gap-3">
                                <button onClick={() => {
                                    const data = clientHistory.map(v => ({ Fecha: new Date(v.fecha).toLocaleDateString(), Sucursal: v.tienda_nombre || 'Sede Central', Productos: v.resumen_productos, Total: v.total, Estado: v.estado }));
                                    exportToExcel(data, `Historial_${selectedClient?.nombre}`, 'Historial');
                                }} className="h-[40px] px-5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group">
                                    <Table size={14} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">EXCEL</span>
                                </button>
                                <button onClick={() => {
                                    const headers = ['Fecha', 'Sucursal', 'Productos', 'Total', 'Estado'];
                                    const data = clientHistory.map(v => [new Date(v.fecha).toLocaleDateString(), v.tienda_nombre || 'Sede Central', v.resumen_productos, `${storeConfig?.moneda || '$'} ${Number(v.total).toFixed(1)}`, v.estado]);
                                    exportToPDF({ title: `Auditoría: ${selectedClient?.nombre}`, headers, data, fileName: `Historial_${selectedClient?.nombre}` });
                                }} className="h-[40px] px-5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group">
                                    <FileText size={14} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">PDF</span>
                                </button>
                            </div>
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="btn-primary w-auto px-10"
                            >
                                Cerrar Auditoría
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
