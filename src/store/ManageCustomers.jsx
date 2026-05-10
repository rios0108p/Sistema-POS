import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Users,
    Search,
    Plus,
    Edit,
    Edit3,
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
    DollarSign,
    Banknote
} from "lucide-react";
import { clientesAPI, productosAPI, getImageUrl } from "../services/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import useOfflineOperation from "../hooks/useOfflineOperation";
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

    const { execute: executeClient } = useOfflineOperation('clients');
    const { execute: executeSpecialPrice } = useOfflineOperation('client_special_prices');
    const { execute: executeAbono } = useOfflineOperation('client_abonos');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState(null);
    const [formData, setFormData] = useState({
        nombre: "",
        email: "",
        telefono: "",
        direccion: "",
        nit_dpi: "",
        codigo_barras: "",
        credito_habilitado: false,
        limite_credito: 0
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
    const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
    const [abonoData, setAbonoData] = useState({
        monto: "",
        metodo_pago: "EFECTIVO",
        nota: ""
    });
    const [isSavingAbono, setIsSavingAbono] = useState(false);

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
                codigo_barras: cliente.codigo_barras || "",
                credito_habilitado: !!cliente.credito_habilitado,
                limite_credito: cliente.limite_credito || 0
            });
        } else {
            setEditingCliente(null);
            setFormData({
                nombre: "",
                email: "",
                telefono: "",
                direccion: "",
                nit_dpi: "",
                codigo_barras: "",
                credito_habilitado: false,
                limite_credito: 0
            });
        }
        setIsModalOpen(true);
    };

    const generateRandomID = () => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const newID = `CLI-${randomNum}`;
        setFormData(prev => ({ ...prev, codigo_barras: newID }));
        toast.success(`ID de Membresía: ${newID}`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCliente) {
                await executeClient('update', formData, editingCliente.id);
                toast.success("Cliente actualizado");
            } else {
                await executeClient('insert', formData);
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
            await executeClient('delete', {}, id);
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

            // Combinar ventas y abonos en un solo historial cronológico
            const ventasNormalizadas = (data.ventas || []).map(v => ({
                ...v,
                tipo_evento: 'VENTA',
                monto_operado: v.total,
                metodo_display: v.metodo_detalle || v.metodo_pago
            }));

            const abonosNormalizados = (data.abonos || []).map(a => ({
                ...a,
                tipo_evento: 'ABONO',
                total: a.monto,
                monto_operado: a.monto,
                resumen_productos: `ABONO RECIBIDO: ${a.nota || 'Sin nota'}`,
                metodo_display: a.metodo_pago,
                tienda_nombre: 'CAJA (ADMIN)'
            }));

            const historialCombinado = [...ventasNormalizadas, ...abonosNormalizados].sort((a, b) =>
                new Date(b.fecha) - new Date(a.fecha)
            );

            setClientHistory(historialCombinado);
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
            // Load products only once - use a flag to avoid duplicate API calls
            // even if the catalog returns an empty array
            if (productos.length === 0) {
                const prods = await productosAPI.getAll();
                if (prods && prods.length > 0) setProductos(prods);
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
        const prod = productos.find(p => p.id == newSpecial.producto_id);
        if (prod && parseFloat(newSpecial.precio_especial) >= parseFloat(prod.precio_venta)) {
            return toast.error(`El precio especial debe ser menor al precio regular ($${prod.precio_venta})`);
        }
        try {
            const result = await executeSpecialPrice('insert', {
                cliente_id: selectedClient.id,
                ...newSpecial
            });
            // En modo web, executeSpecialPrice no llama la API — hay que llamarla directamente
            if (result?.mode === 'api') {
                await clientesAPI.savePrecioEspecial(selectedClient.id, newSpecial);
            }
            toast.success("Precio asignado");
            setNewSpecial({ producto_id: "", precio_especial: "", min_cantidad: 1 });
            const specials = await clientesAPI.getPreciosEspeciales(selectedClient.id);
            setPreciosEspeciales(specials);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar precio especial");
        }
    };

    const handleDeleteSpecialPrice = async (productoId) => {
        try {
            const result = await executeSpecialPrice('delete', { producto_id: productoId, cliente_id: selectedClient.id }, `${selectedClient.id}_${productoId}`);
            if (result?.mode === 'api') {
                await clientesAPI.deletePrecioEspecial(selectedClient.id, productoId);
            }
            setPreciosEspeciales(preciosEspeciales.filter(p => p.producto_id !== productoId));
            toast.success("Precio eliminado");
        } catch (error) {
            toast.error("Error eliminando precio");
        }
    };

    const handleOpenAbono = (cliente) => {
        setSelectedClient(cliente);
        setAbonoData({
            monto: "",
            metodo_pago: "EFECTIVO",
            nota: ""
        });
        setIsAbonoModalOpen(true);
    };

    const handleRegistrarAbono = async (e) => {
        e.preventDefault();
        if (!abonoData.monto || abonoData.monto <= 0) return toast.error("Ingresa un monto válido");

        setIsSavingAbono(true);
        try {
            const result = await executeAbono('insert', {
                cliente_id: selectedClient.id,
                ...abonoData,
                usuario_id: user?.id
            });
            // En modo web, executeAbono no llama la API — hay que llamarla directamente
            if (result?.mode === 'api') {
                await clientesAPI.registrarAbono(selectedClient.id, {
                    ...abonoData,
                    usuario_id: user?.id
                });
            }
            toast.success("Abono registrado correctamente");
            setIsAbonoModalOpen(false);
            fetchClientes();
        } catch (error) {
            toast.error(error.message || "Error al registrar abono");
        } finally {
            setIsSavingAbono(false);
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
                        placeholder="Búsqueda inteligente por nombre, email o identificación (RFC/CURP)..."
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
                        <div key={cliente.id} className="group relative overflow-hidden bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-indigo-500/8 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300">
                            {/* Top color strip */}
                            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-[1.5rem]"></div>

                            <div className="p-6">
                                {/* Header row */}
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-500/20">
                                            {cliente.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight leading-none">{cliente.nombre}</h3>
                                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mt-0.5">Cliente Preferencial</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => handleOpenModal(cliente)} className="w-8 h-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all flex items-center justify-center">
                                            <Edit size={15} />
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => handleDelete(cliente.id)} className="w-8 h-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all flex items-center justify-center">
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4">
                                    {cliente.telefono && (
                                        <div className="flex items-center gap-2"><Phone size={12} className="text-slate-300 shrink-0" /><a href={`tel:${cliente.telefono}`} className="hover:text-indigo-600 font-mono">{cliente.telefono}</a></div>
                                    )}
                                    {cliente.direccion && (
                                        <div className="flex items-start gap-2"><MapPin size={12} className="text-slate-300 shrink-0 mt-0.5" /><span className="line-clamp-1 opacity-70">{cliente.direccion}</span></div>
                                    )}
                                </div>

                                {/* Credit bar */}
                                {cliente.credito_habilitado ? (() => {
                                    const deuda = Number(cliente.saldo_deudor || 0);
                                    const limite = Number(cliente.limite_credito || 0);
                                    const disponible = limite - deuda;
                                    const pctUsado = limite > 0 ? Math.min((deuda / limite) * 100, 100) : 0;
                                    return (
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-4">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Crédito</span>
                                                <span className={`text-[9px] font-black ${deuda > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Deuda: ${deuda.toFixed(2)}</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${pctUsado > 80 ? 'bg-rose-500' : pctUsado > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pctUsado}%` }}></div>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[8px] text-slate-400 font-bold">Disponible: ${disponible.toFixed(2)}</span>
                                                <span className="text-[8px] text-slate-400 font-bold">Límite: ${limite.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin crédito habilitado</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-2">
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => handleOpenSpecialPrices(cliente)} className="h-9 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-all rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                                                <DollarSign size={12} /> Precios
                                            </button>
                                            <button onClick={() => handleOpenAbono(cliente)} className="h-9 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-all rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                                                <Banknote size={12} /> Abono
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => handleViewHistory(cliente)} className={`h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${isAdmin ? '' : 'col-span-1'}`}>
                                        <Clock size={12} /> Historial
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => { setSelectedClient(cliente); setIsIdCardOpen(true); }} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                            <CreditCard size={12} /> Tarjeta
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Tarjeta Digital */}
            {isIdCardOpen && selectedClient && (
                <div className="modal-overlay">
                    <div className="w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl bg-white dark:bg-slate-900 flex flex-col">
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-600 px-8 pt-7 pb-10 overflow-hidden shrink-0">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white"></div>
                                <div className="absolute -bottom-6 -left-6 w-40 h-40 rounded-full bg-white"></div>
                            </div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                        <CreditCard size={26} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">Tarjeta Digital</p>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">{selectedClient.nombre}</h2>
                                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1 font-mono">{selectedClient.codigo_barras || selectedClient.nit_dpi || 'Sin ID'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsIdCardOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"><X size={18} /></button>
                            </div>
                        </div>

                        <div className="p-6 -mt-4 flex flex-col items-center gap-5 bg-slate-50/50 dark:bg-slate-900/50">
                            {/* Card preview container */}
                            <div className="w-full flex items-center justify-center">
                                <div
                                    id="customer-id-card"
                                    style={{
                                        backgroundColor: storeConfig.card_primary_color || '#4f46e5',
                                        backgroundImage: storeConfig.card_bg_image
                                            ? `url(${getImageUrl(storeConfig.card_bg_image)})`
                                            : `linear-gradient(135deg, ${storeConfig.card_primary_color || '#4f46e5'} 0%, ${storeConfig.card_secondary_color || '#3730a3'} 100%)`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        padding: '1.75rem',
                                        borderRadius: '1.5rem',
                                        color: storeConfig.card_text_color || 'white',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1.25rem',
                                        width: '100%',
                                        maxWidth: '300px',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                                        minHeight: '420px',
                                        fontFamily: 'system-ui, sans-serif'
                                    }}
                                >
                                    {storeConfig.card_bg_image && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 1 }}></div>}
                                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '140px', height: '140px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '50%', zIndex: 2 }}></div>
                                    <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '110px', height: '110px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '50%', zIndex: 2 }}></div>

                                    {/* Header Section */}
                                    <div style={{ textAlign: 'center', zIndex: 10, width: '100%' }}>
                                        <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '100px', padding: '4px 14px', marginBottom: '0.75rem' }}>
                                            <p style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 1 }}>
                                                {storeConfig.card_title || 'Cliente Preferencial'}
                                            </p>
                                        </div>
                                        <h3 style={{ fontSize: '1.6rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.25)', wordBreak: 'break-word' }}>
                                            {selectedClient.nombre}
                                        </h3>
                                    </div>

                                    {/* White Box for Codes */}
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1.25rem 1rem',
                                        borderRadius: '1.25rem',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        zIndex: 10,
                                        boxShadow: '0 12px 30px -5px rgba(0,0,0,0.25)'
                                    }}>
                                        <QRCodeCanvas value={selectedClient.codigo_barras || selectedClient.nit_dpi || selectedClient.id.toString()} size={110} level="M" />
                                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                            <Barcode
                                                value={selectedClient.codigo_barras || selectedClient.nit_dpi || selectedClient.id.toString()}
                                                width={1.4}
                                                height={36}
                                                fontSize={11}
                                                background="transparent"
                                                margin={0}
                                                displayValue={true}
                                            />
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ textAlign: 'center', zIndex: 10, width: '100%' }}>
                                        <p style={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.7, marginBottom: '0.25rem' }}>ID Único de Membresía</p>
                                        <p style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '0.12em', fontFamily: 'monospace', opacity: 0.95 }}>
                                            {selectedClient.codigo_barras || selectedClient.nit_dpi || `CLI-${selectedClient.id}`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="grid grid-cols-2 gap-3 w-full">
                                <button
                                    onClick={() => downloadIdCard(selectedClient.nombre)}
                                    className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                >
                                    <FileText size={15} className="text-slate-400" />
                                    Descargar
                                </button>
                                <button
                                    onClick={() => handleShareWhatsApp(selectedClient)}
                                    className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Phone size={15} />
                                    WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Precios Especiales */}
            {isSpecialPriceOpen && (() => {
                const prodSeleccionado = productos.find(p => p.id == newSpecial.producto_id);
                const precioRegular = prodSeleccionado ? parseFloat(prodSeleccionado.precio_venta) : 0;
                const precioEspecialNum = parseFloat(newSpecial.precio_especial) || 0;
                const ahorro = precioRegular > 0 && precioEspecialNum > 0 ? ((precioRegular - precioEspecialNum) / precioRegular * 100).toFixed(0) : 0;
                return (
                <div className="modal-overlay">
                    <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] overflow-hidden shadow-2xl bg-white dark:bg-slate-900">

                        {/* Header degradado */}
                        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 px-8 pt-8 pb-10 overflow-hidden">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white"></div>
                                <div className="absolute -bottom-6 -left-6 w-40 h-40 rounded-full bg-white"></div>
                            </div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                        <DollarSign size={26} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">Precios Especiales</p>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">{selectedClient?.nombre}</h2>
                                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">{preciosEspeciales.length} precio{preciosEspeciales.length !== 1 ? 's' : ''} configurado{preciosEspeciales.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsSpecialPriceOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Cuerpo */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 -mt-4">

                            {/* Formulario */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Asignar Nuevo Precio</p>
                                </div>
                                <div className="p-5 space-y-4">
                                    {/* Selector de producto */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Producto</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            value={newSpecial.producto_id}
                                            onChange={e => setNewSpecial({ ...newSpecial, producto_id: e.target.value })}
                                        >
                                            <option value="">Seleccionar producto...</option>
                                            {productos.map(p => (
                                                <option key={p.id} value={p.id}>{p.nombre} — ${p.precio_venta}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Preview precio regular */}
                                    {prodSeleccionado && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio regular:</span>
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">${precioRegular.toFixed(2)}</span>
                                            {ahorro > 0 && (
                                                <span className="ml-auto text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg uppercase tracking-widest">
                                                    -{ahorro}% descuento
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Cant. Mínima (Mayoreo)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="1"
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                value={newSpecial.min_cantidad || ""}
                                                onChange={e => setNewSpecial({ ...newSpecial, min_cantidad: e.target.value === "" ? null : Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Precio Especial ($)</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                value={newSpecial.precio_especial || ""}
                                                onChange={e => setNewSpecial({ ...newSpecial, precio_especial: e.target.value === "" ? null : e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAddSpecialPrice}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                        Guardar Precio Especial
                                    </button>
                                </div>
                            </div>

                            {/* Lista configurados */}
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] px-1">Precios Configurados</p>
                                {loadingSpecial ? (
                                    <div className="text-center py-10 opacity-40 text-[10px] font-black uppercase tracking-widest animate-pulse">Cargando...</div>
                                ) : preciosEspeciales.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                        <DollarSign size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin precios especiales aún</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {preciosEspeciales.map(ps => {
                                            const pct = ps.precio_regular > 0
                                                ? ((ps.precio_regular - ps.precio_especial) / ps.precio_regular * 100).toFixed(0)
                                                : 0;
                                            return (
                                                <div key={ps.producto_id} className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                                    {/* Badge descuento */}
                                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center shrink-0">
                                                        <span className="text-[9px] font-black text-emerald-600 leading-none">-{pct}%</span>
                                                        <span className="text-[8px] text-emerald-500 font-bold leading-none mt-0.5">OFF</span>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-tight truncate">{ps.producto_nombre}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] text-slate-400 font-bold line-through">${Number(ps.precio_regular).toFixed(2)}</span>
                                                            <span className="text-[9px] font-black text-emerald-600">${Number(ps.precio_especial).toFixed(2)}</span>
                                                            {ps.min_cantidad > 1 && (
                                                                <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md uppercase tracking-widest">
                                                                    Mín {ps.min_cantidad} pzas
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={() => setNewSpecial({ producto_id: ps.producto_id, min_cantidad: ps.min_cantidad, precio_especial: ps.precio_especial })}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSpecialPrice(ps.producto_id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                            <button
                                onClick={() => setIsSpecialPriceOpen(false)}
                                className="px-8 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Modal Crear/Editar Cliente */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="w-full max-w-lg max-h-[95vh] flex flex-col rounded-[2rem] overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
                        {/* Gradient Header */}
                        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 px-8 pt-7 pb-10 overflow-hidden shrink-0">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white"></div>
                                <div className="absolute -bottom-6 -left-6 w-40 h-40 rounded-full bg-white"></div>
                            </div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                        <UserCheck size={26} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">
                                            {editingCliente ? 'Actualizar Perfil' : 'Nuevo Registro'}
                                        </p>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                                            {editingCliente ? editingCliente.nombre : 'Vincular Cliente'}
                                        </h2>
                                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">Identificación y contacto</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 -mt-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Datos Personales */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                        <Users size={13} className="text-indigo-400" />
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Datos Personales</p>
                                    </div>
                                    <div className="p-5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nombre Completo *</label>
                                        <input
                                            type="text" required
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            value={formData.nombre}
                                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                            placeholder="Nombre completo del cliente"
                                        />
                                    </div>
                                </div>

                                {/* Membresía */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CreditCard size={13} className="text-indigo-500" />
                                            <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.25em]">Identificación de Membresía</p>
                                        </div>
                                        <button
                                            type="button" onClick={generateRandomID}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
                                        >
                                            <Plus size={11} strokeWidth={3} /> Autogenerar
                                        </button>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Código / Barras</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                                value={formData.codigo_barras}
                                                onChange={e => setFormData({ ...formData, codigo_barras: e.target.value })}
                                                placeholder="CLI-1234"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">RFC / CURP</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                value={formData.nit_dpi}
                                                onChange={e => setFormData({ ...formData, nit_dpi: e.target.value })}
                                                placeholder="Opcional"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Contacto */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                        <Phone size={13} className="text-slate-400" />
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Información de Contacto</p>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Teléfono</label>
                                                <div className="relative">
                                                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        className="w-full pl-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pr-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                        value={formData.telefono}
                                                        onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                                        placeholder="Contacto directo"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Email</label>
                                                <div className="relative">
                                                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                                    <input
                                                        type="email"
                                                        className="w-full pl-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pr-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                        value={formData.email}
                                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                        placeholder="correo@ejemplo.com"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Dirección / Localidad</label>
                                            <div className="relative">
                                                <MapPin size={14} className="absolute left-3.5 top-3.5 text-slate-300 pointer-events-none" />
                                                <textarea
                                                    rows="2"
                                                    className="w-full pl-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pr-4 py-3 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                                                    value={formData.direccion}
                                                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                                    placeholder="Dirección física"
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Configuración de Crédito */}
                                {isAdmin && (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                        <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Banknote size={13} className="text-emerald-500" />
                                                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.25em]">Configuración de Crédito</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox" className="sr-only peer"
                                                    checked={formData.credito_habilitado}
                                                    onChange={e => setFormData({ ...formData, credito_habilitado: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                            </label>
                                        </div>
                                        {formData.credito_habilitado && (
                                            <div className="p-5 animate-in slide-in-from-top-2 duration-300">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Límite de Crédito ($)</label>
                                                <div className="relative">
                                                    <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="number" step="0.01"
                                                        className="w-full pl-10 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                                        value={formData.limite_credito}
                                                        onChange={e => setFormData({ ...formData, limite_credito: e.target.value })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-col gap-3 pt-1 pb-2">
                                    <button
                                        type="submit"
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {editingCliente
                                            ? <><Edit size={15} /> Guardar Cambios</>
                                            : <><Plus size={15} strokeWidth={3} /> Registrar Cliente</>
                                        }
                                    </button>
                                    <button
                                        type="button" onClick={() => setIsModalOpen(false)}
                                        className="w-full h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        Cancelar
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
                    <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black px-8 pt-7 pb-10 overflow-hidden">
                            <div className="absolute inset-0 opacity-10"><div className="absolute top-2 right-6 w-32 h-32 rounded-full bg-indigo-400"></div><div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-violet-400"></div></div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Clock size={22} className="text-white" /></div>
                                    <div>
                                        <p className="text-white/50 text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">Auditoría de Actividad</p>
                                        <h2 className="text-lg font-black text-white uppercase tracking-tight">{selectedClient?.nombre}</h2>
                                        <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-0.5">{clientHistory.length} movimiento{clientHistory.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsHistoryOpen(false)} className="relative w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"><X size={16} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar -mt-3">
                            {loadingHistory ? (
                                <div className="p-20 text-center animate-pulse flex flex-col items-center gap-4">
                                    <Clock className="text-slate-200 dark:text-slate-700" size={48} />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-600">Cargando movimientos...</p>
                                </div>
                            ) : clientHistory.length === 0 ? (
                                <div className="p-20 text-center flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center"><FileText size={28} className="text-slate-300 dark:text-slate-600" /></div>
                                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Sin actividad registrada</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase text-[9px] font-black tracking-widest sticky top-0 border-b border-slate-100 dark:border-slate-700 z-10">
                                        <tr>
                                            <th className="px-6 py-4">Fecha / Tienda</th>
                                            <th className="px-6 py-4">Movimiento</th>
                                            <th className="px-6 py-4 text-center">Método</th>
                                            <th className="px-6 py-4 text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {clientHistory.map((evento, index) => {
                                            const fecha = evento.fecha ? new Date(evento.fecha.replace(' ', 'T')) : null;
                                            const fechaStr = fecha && !isNaN(fecha) ? fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
                                            const horaStr = fecha && !isNaN(fecha) ? fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
                                            const esAbono = evento.tipo_evento === 'ABONO';
                                            return (
                                                <tr key={index} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${evento.estado === 'CANCELADA' ? 'opacity-40' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{fechaStr}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{horaStr}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{evento.tienda_nombre || 'Central'}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-block text-[8px] font-black px-2 py-0.5 rounded-lg mb-1 uppercase tracking-widest ${esAbono ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                                            {esAbono ? 'Abono' : 'Compra'}
                                                        </span>
                                                        <p className={`text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[180px] ${evento.estado === 'CANCELADA' ? 'line-through' : ''}`}>{evento.resumen_productos}</p>
                                                        <p className="text-[9px] text-slate-400 font-mono">#{evento.id}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{evento.metodo_display}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`text-sm font-black tracking-tighter ${esAbono ? 'text-emerald-600 dark:text-emerald-400' : evento.estado === 'CANCELADA' ? 'text-slate-400 line-through' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                            {esAbono ? '-' : '+'}{storeConfig?.moneda || '$'}{Number(evento.monto_operado).toFixed(2)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                            <div className="flex gap-2">
                                <button onClick={() => { const data = clientHistory.map(v => ({ Fecha: v.fecha ? new Date(v.fecha.replace(' ','T')).toLocaleDateString('es-MX') : '—', Tipo: v.tipo_evento, Detalle: v.resumen_productos, Método: v.metodo_display, Monto: v.monto_operado })); exportToExcel(data, `Historial_${selectedClient?.nombre}`, 'Historial'); }} className="h-9 px-4 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 transition-all">
                                    <Table size={13} /><span className="text-[9px] font-black uppercase tracking-widest">Excel</span>
                                </button>
                                <button onClick={() => { const headers = ['Fecha','Tipo','Detalle','Método','Monto']; const data = clientHistory.map(v => [v.fecha ? new Date(v.fecha.replace(' ','T')).toLocaleDateString('es-MX') : '—', v.tipo_evento, v.resumen_productos, v.metodo_display, `${storeConfig?.moneda||'$'}${Number(v.monto_operado).toFixed(2)}`]); exportToPDF({ title: `Auditoría: ${selectedClient?.nombre}`, headers, data, fileName: `Historial_${selectedClient?.nombre}` }); }} className="h-9 px-4 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-rose-500 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 transition-all">
                                    <FileText size={13} /><span className="text-[9px] font-black uppercase tracking-widest">PDF</span>
                                </button>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="h-9 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Registrar Abono */}
            {isAbonoModalOpen && selectedClient && (() => {
                const deuda = Number(selectedClient.saldo_deudor || 0);
                const limite = Number(selectedClient.limite_credito || 0);
                const abono = parseFloat(abonoData.monto) || 0;
                const restante = Math.max(0, deuda - abono);
                const pct = deuda > 0 ? Math.min((abono / deuda) * 100, 100) : 0;
                return (
                <div className="modal-overlay">
                    <div className="w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl bg-white dark:bg-slate-900 flex flex-col">
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-rose-600 to-rose-700 px-8 pt-7 pb-10 overflow-hidden">
                            <div className="absolute inset-0 opacity-10"><div className="absolute top-2 right-6 w-32 h-32 rounded-full bg-white"></div><div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white"></div></div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center"><Banknote size={22} className="text-white" /></div>
                                    <div>
                                        <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">Registrar Abono</p>
                                        <h2 className="text-lg font-black text-white uppercase tracking-tight leading-none">{selectedClient.nombre}</h2>
                                    </div>
                                </div>
                                <button onClick={() => setIsAbonoModalOpen(false)} className="relative w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"><X size={16} /></button>
                            </div>
                        </div>

                        <div className="p-6 -mt-4 space-y-5 overflow-y-auto">
                            {/* Balance card */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
                                <div className="flex items-end justify-between mb-3">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Deuda actual</p>
                                        <p className="text-2xl font-black text-rose-600 tracking-tighter">${deuda.toFixed(2)}</p>
                                    </div>
                                    {abono > 0 && (
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Quedaría</p>
                                            <p className={`text-lg font-black tracking-tighter ${restante === 0 ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200'}`}>${restante.toFixed(2)}</p>
                                        </div>
                                    )}
                                </div>
                                {/* Progress bar */}
                                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                                </div>
                                {abono > 0 && <p className="text-[9px] font-bold text-emerald-600 mt-1.5 text-right">{pct.toFixed(0)}% liquidado</p>}
                            </div>

                            <form onSubmit={handleRegistrarAbono} className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Monto del Abono ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                                        <input
                                            type="number" step="0.01" max={deuda} required autoFocus
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-4 py-3 text-lg font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                                            value={abonoData.monto}
                                            onChange={e => setAbonoData({ ...abonoData, monto: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {['EFECTIVO','TARJETA','TRANSFERENCIA','OTRO'].map(m => (
                                        <button key={m} type="button"
                                            onClick={() => setAbonoData({ ...abonoData, metodo_pago: m })}
                                            className={`h-11 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${abonoData.metodo_pago === m ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                        >{m}</button>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nota / Referencia</label>
                                    <textarea rows="2"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                                        value={abonoData.nota}
                                        onChange={e => setAbonoData({ ...abonoData, nota: e.target.value })}
                                        placeholder="Referencia de pago o nota..."
                                    />
                                </div>

                                <div className="pt-1 flex flex-col gap-2">
                                    <button type="submit" disabled={isSavingAbono}
                                        className="w-full h-12 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-500/20 active:scale-95">
                                        {isSavingAbono ? 'Procesando...' : 'Confirmar Abono'}
                                    </button>
                                    <button type="button" onClick={() => setIsAbonoModalOpen(false)}
                                        className="w-full h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div >
    );
}
