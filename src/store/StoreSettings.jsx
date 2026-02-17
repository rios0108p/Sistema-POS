import { useState, useEffect } from "react";
import { configuracionAPI, getImageUrl } from "../services/api";
import { toast } from "react-hot-toast";
import {
    Store, ImagePlus, CheckCircle, Settings, MapPin,
    Phone, CreditCard, DollarSign, Printer, ChevronRight,
    Info, ShieldCheck, RefreshCw
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function StoreSettings() {
    const { user, fetchStoreConfig } = useAuth();
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        nombre_tienda: "",
        logo: "",
        direccion: "",
        telefono: "",
        nit: "",
        moneda: "$",
        ancho_ticket: "58mm",
        mensaje_ticket: "",
        email: "",
        website: "",
        requerir_pin: true,
        card_primary_color: "#4f46e5",
        card_secondary_color: "#3730a3",
        card_text_color: "#ffffff",
        card_title: "Cliente Preferencial",
        show_logo_on_card: false,
        card_template: "vanguard",
        card_bg_image: null
    });
    const [logoFile, setLogoFile] = useState(null);
    const [cardBgFile, setCardBgFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewBgUrl, setPreviewBgUrl] = useState(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const data = await configuracionAPI.get();
            if (data) {
                setConfig({
                    ...config,
                    ...data,
                    requerir_pin: data.requerir_pin === 1 || data.requerir_pin === true || data.requerir_pin === 'true',
                    card_template: data.card_template || "vanguard"
                });
            }
        } catch (error) {
            console.error("Error al cargar configuración:", error);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleBgChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCardBgFile(file);
            setPreviewBgUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("nombre_tienda", config.nombre_tienda);
            formData.append("direccion", config.direccion || "");
            formData.append("telefono", config.telefono || "");
            formData.append("nit", config.nit || "");
            formData.append("moneda", config.moneda || "$");
            formData.append("ancho_ticket", config.ancho_ticket || "58mm");
            formData.append("mensaje_ticket", config.mensaje_ticket || "");
            formData.append("email", config.email || "");
            formData.append("website", config.website || "");
            formData.append("requerir_pin", config.requerir_pin);
            formData.append("card_primary_color", config.card_primary_color);
            formData.append("card_secondary_color", config.card_secondary_color);
            formData.append("card_text_color", config.card_text_color);
            formData.append("card_title", config.card_title);
            formData.append("show_logo_on_card", config.show_logo_on_card);
            formData.append("card_template", config.card_template);

            if (logoFile) formData.append("logo", logoFile);
            if (cardBgFile) formData.append("card_bg_image", cardBgFile);

            const updatedData = await configuracionAPI.update(formData);
            await fetchStoreConfig(); // Update global context

            if (updatedData) {
                setConfig({
                    ...config,
                    ...updatedData,
                    requerir_pin: updatedData.requerir_pin === 1 || updatedData.requerir_pin === true || updatedData.requerir_pin === 'true',
                    card_template: updatedData.card_template || "vanguard"
                });
            }

            setLogoFile(null);
            setCardBgFile(null);
            setPreviewUrl(null);
            setPreviewBgUrl(null);
            toast.success("Parámetros del sistema actualizados");
        } catch (error) {
            toast.error(error.message || "Error al sincronizar cambios");
        } finally {
            setLoading(false);
        }
    };

    const currentLogo = previewUrl || (config.logo ? `${getImageUrl(config.logo)}?t=${new Date().getTime()}` : "/images/compra.png");
    const currentBg = previewBgUrl || (config.card_bg_image ? getImageUrl(config.card_bg_image) : null);

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                            <Settings className="text-indigo-600 dark:text-indigo-400" size={32} />
                            CONFIGURACIÓN <span className="text-indigo-600 dark:text-indigo-400 text-sm">/ CORE SYSTEM</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 font-semibold">Personalización de identidad corporativa y parámetros operativos</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Identity & Sidebars */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="card-standard p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                            <label className="label-standard block mb-6 relative">Identidad Visual</label>

                            <div className="flex flex-col items-center gap-6 relative">
                                <div className="relative group/logo">
                                    <div className="w-44 h-44 rounded-3xl border-4 border-slate-50 dark:border-slate-700/50 overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg transition-transform duration-500 group-hover/logo:scale-[1.02]">
                                        <img
                                            src={currentLogo}
                                            alt="Logo Preview"
                                            className="w-full h-full object-contain p-4"
                                            onError={(e) => { e.target.src = "/images/compra.png"; }}
                                        />
                                    </div>
                                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-600/80 backdrop-blur-sm opacity-0 group-hover/logo:opacity-100 transition-all cursor-pointer rounded-3xl text-white">
                                        <ImagePlus size={32} className="mb-2" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Cambiar Logo</span>
                                        <input type="file" name="logo" accept="image/*" className="hidden" onChange={handleLogoChange} />
                                    </label>
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Logo del Negocio</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">PNG o JPG • Máx 2MB</p>
                                </div>
                            </div>
                        </div>

                        <div className="card-standard p-8">
                            <label className="label-standard block mb-6">Fondo de Tarjeta</label>
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 overflow-hidden bg-slate-50 dark:bg-slate-900/30 flex items-center justify-center group relative">
                                    {currentBg ? (
                                        <img src={currentBg} className="w-full h-full object-cover" alt="Card BG" />
                                    ) : (
                                        <ImagePlus className="text-slate-200 dark:text-slate-700" size={32} />
                                    )}
                                    <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[9px] font-bold uppercase tracking-widest">
                                        Subir Fondo
                                        <input type="file" name="card_bg_image" accept="image/*" className="hidden" onChange={handleBgChange} />
                                    </label>
                                </div>
                                <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-tight">Estilo Visual (Chedraui / SAMS)</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><ShieldCheck size={120} /></div>
                            <h4 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2 relative">
                                <ShieldCheck size={18} /> Seguridad Core
                            </h4>
                            <p className="text-xs font-medium leading-relaxed opacity-90 mb-6 relative">
                                Estas configuraciones afectan los documentos legales y tickets emitidos por el sistema en todas las sucursales.
                            </p>
                            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 relative">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                    <span>Versión del Sistema</span>
                                    <span>v4.1.0 Premium</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Detailed Forms */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="card-standard p-10">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-8 flex items-center gap-3">
                                <Info size={24} className="text-indigo-500" />
                                Información de Operaciones
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-2">
                                    <label className="label-standard px-1">Nombre Comercial</label>
                                    <div className="relative group">
                                        <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            className="input-standard pl-12 h-[52px] font-bold"
                                            value={config.nombre_tienda}
                                            onChange={e => setConfig({ ...config, nombre_tienda: e.target.value })}
                                            placeholder="Nombre de la empresa..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="label-standard px-1">Identificación Fiscal (NIT/DPI)</label>
                                    <div className="relative group">
                                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            className="input-standard pl-12 h-[52px] font-bold"
                                            value={config.nit}
                                            onChange={e => setConfig({ ...config, nit: e.target.value })}
                                            placeholder="Tax ID..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="label-standard px-1">Teléfono de Contacto</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            className="input-standard pl-12 h-[52px] font-bold"
                                            value={config.telefono}
                                            onChange={e => setConfig({ ...config, telefono: e.target.value })}
                                            placeholder="+502 ..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="label-standard px-1">Divisa Nacional</label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            className="input-standard pl-12 h-[52px] font-bold"
                                            value={config.moneda}
                                            onChange={e => setConfig({ ...config, moneda: e.target.value })}
                                            placeholder="E.j. Q o $"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <label className="label-standard px-1">Dirección Física</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <textarea
                                            rows="2"
                                            className="input-standard pl-12 py-4 h-24 font-bold resize-none"
                                            value={config.direccion}
                                            onChange={e => setConfig({ ...config, direccion: e.target.value })}
                                            placeholder="Dirección física completa..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-2">
                                    <label className="label-standard px-1">Correo Electrónico</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"><Info size={20} /></div>
                                        <input
                                            type="email"
                                            className="input-standard pl-12 h-[52px] font-bold"
                                            value={config.email || ""}
                                            onChange={e => setConfig({ ...config, email: e.target.value })}
                                            placeholder="contacto@empresa.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="label-standard px-1">Sitio Web</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"><Store size={20} /></div>
                                        <input
                                            type="text"
                                            className="input-standard pl-12 h-[52px] font-bold"
                                            value={config.website || ""}
                                            onChange={e => setConfig({ ...config, website: e.target.value })}
                                            placeholder="www.mitienda.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="label-standard px-1">Mensaje Pie de Ticket</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors"><Printer size={20} /></div>
                                    <textarea
                                        rows="2"
                                        className="input-standard pl-12 py-4 h-24 font-bold resize-none"
                                        value={config.mensaje_ticket || ""}
                                        onChange={e => setConfig({ ...config, mensaje_ticket: e.target.value })}
                                        placeholder="Gracias por su compra..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card-standard p-10">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-8 flex items-center gap-3">
                                <Printer size={24} className="text-indigo-500" />
                                Configuración de Ticket POS
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <div className="space-y-4">
                                    <label className="label-standard px-1 block">Ancho Impresión Térmica</label>
                                    <div className="flex gap-4">
                                        {['58mm', '80mm'].map(size => (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => setConfig({ ...config, ancho_ticket: size })}
                                                className={`flex-1 py-4 px-6 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all border-2 ${config.ancho_ticket === size
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-indigo-200'
                                                    }`}
                                            >
                                                {size} Standard
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card-standard p-10">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-8 flex items-center gap-3">
                                <CreditCard size={24} className="text-indigo-500" />
                                Estilo de Tarjeta de Cliente
                            </h2>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                                {/* Controls */}
                                <div className="lg:col-span-5 space-y-8">
                                    <div className="space-y-3">
                                        <label className="label-standard px-1 flex items-center gap-2">
                                            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                                            Textos e Identidad
                                        </label>
                                        <div className="group relative">
                                            <input
                                                type="text"
                                                className="input-standard pr-10 h-[52px] font-bold"
                                                value={config.card_title}
                                                onChange={e => setConfig({ ...config, card_title: e.target.value })}
                                                placeholder="Ej: Cliente Preferencial"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                                <CreditCard size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="label-standard px-1 flex items-center gap-2">
                                            <span className="w-1 h-4 bg-fuchsia-500 rounded-full"></span>
                                            Paleta de Colores
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-2 group">
                                                <div className="relative h-14 w-full rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700/50 shadow-sm transition-transform group-hover:scale-[1.02] active:scale-95">
                                                    <input
                                                        type="color"
                                                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                                        value={config.card_primary_color}
                                                        onChange={(e) => setConfig({ ...config, card_primary_color: e.target.value })}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-bold text-center block text-slate-400 uppercase tracking-wider">Fondo A</span>
                                            </div>
                                            <div className="space-y-2 group">
                                                <div className="relative h-14 w-full rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700/50 shadow-sm transition-transform group-hover:scale-[1.02] active:scale-95">
                                                    <input
                                                        type="color"
                                                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                                        value={config.card_secondary_color}
                                                        onChange={(e) => setConfig({ ...config, card_secondary_color: e.target.value })}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-bold text-center block text-slate-400 uppercase tracking-wider">Fondo B</span>
                                            </div>
                                            <div className="space-y-2 group">
                                                <div className="relative h-14 w-full rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700/50 shadow-sm transition-transform group-hover:scale-[1.02] active:scale-95">
                                                    <input
                                                        type="color"
                                                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                                        value={config.card_text_color}
                                                        onChange={(e) => setConfig({ ...config, card_text_color: e.target.value })}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-bold text-center block text-slate-400 uppercase tracking-wider">Texto</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="label-standard px-1 flex items-center gap-2">
                                            <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                                            Personalización Avanzada
                                        </label>

                                        <div className="relative group">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                id="bg-upload"
                                                className="hidden"
                                                onChange={handleBgChange}
                                            />
                                            <label
                                                htmlFor="bg-upload"
                                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group-hover:border-indigo-300"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-indigo-500">
                                                        <ImagePlus size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Imagen de Fondo</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Reemplaza el degradado</p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border dark:border-slate-600 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                    Elegir
                                                </span>
                                            </label>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setConfig({ ...config, show_logo_on_card: !config.show_logo_on_card })}
                                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700 rounded-2xl transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg transition-colors duration-300 ${config.show_logo_on_card ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                                                    <ShieldCheck size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Logo Corporativo</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Mostrar en tarjeta</p>
                                                </div>
                                            </div>
                                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${config.show_logo_on_card ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${config.show_logo_on_card ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="lg:col-span-7">
                                    <div className="sticky top-6">
                                        <div className="bg-slate-100/50 dark:bg-slate-900/50 rounded-[3rem] p-8 border border-white dark:border-slate-800 shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                                            <div className="flex flex-col items-center relative z-10">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-8 bg-white/80 dark:bg-slate-800/80 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border dark:border-slate-700">
                                                    Vista Previa en Vivo
                                                </p>

                                                <div
                                                    className="w-full relative overflow-hidden shadow-[0_30px_70px_-15px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-8 gap-4 text-center transition-all duration-500 hover:scale-[1.03] rounded-[2.5rem]"
                                                    style={{
                                                        backgroundColor: config.card_primary_color,
                                                        backgroundImage: currentBg
                                                            ? `url(${currentBg})`
                                                            : `linear-gradient(135deg, ${config.card_primary_color} 0%, ${config.card_secondary_color} 100%)`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        color: config.card_text_color,
                                                        minHeight: '440px',
                                                        aspectRatio: 'auto',
                                                        maxWidth: '320px',
                                                        fontFamily: 'system-ui, sans-serif'
                                                    }}
                                                >
                                                    {/* Overlay */}
                                                    {currentBg && <div className="absolute inset-0 bg-black/20 z-0" />}

                                                    {/* Decorative Elements */}
                                                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 z-0 pointer-events-none blur-xl" />
                                                    <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/10 z-0 pointer-events-none blur-xl" />

                                                    {/* Logo/Icon */}
                                                    {config.show_logo_on_card && (
                                                        <div className="absolute top-8 right-8 w-11 h-11 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center p-2 z-10 border border-white/30 shadow-2xl">
                                                            {currentLogo ? (
                                                                <img src={currentLogo} className="w-full h-full object-contain" alt="Logo" />
                                                            ) : (
                                                                <ShieldCheck className="text-white w-full h-full" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Header */}
                                                    <div className="relative z-10 w-full mt-6">
                                                        <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-3 drop-shadow-sm">
                                                            {config.card_title || 'Cliente Preferencial'}
                                                        </p>
                                                        <h3 className="text-3xl font-black uppercase tracking-tight leading-none w-full drop-shadow-lg">
                                                            PANFILO
                                                        </h3>
                                                    </div>

                                                    {/* Central Box */}
                                                    <div className="relative z-10 bg-white p-6 rounded-[2.5rem] w-full flex flex-col items-center gap-5 shadow-2xl">
                                                        <div className="w-32 h-32 bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-inner">
                                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700 via-slate-900 to-black"></div>
                                                            <div className="grid grid-cols-2 gap-2 relative z-10 p-2">
                                                                <div className="w-11 h-11 border-[3px] border-white rounded-md"></div>
                                                                <div className="w-11 h-11 bg-white/20 rounded-md"></div>
                                                                <div className="w-11 h-11 bg-white/20 rounded-md"></div>
                                                                <div className="w-11 h-11 border-[3px] border-white rounded-md"></div>
                                                            </div>
                                                        </div>
                                                        <div className="h-10 w-full bg-slate-50 rounded-xl flex items-end justify-center pb-1 overflow-hidden px-4 border border-slate-100 shadow-inner">
                                                            <div className="flex gap-[3px] h-full items-end w-full justify-center">
                                                                {[...Array(30)].map((_, i) => (
                                                                    <div key={i} className="bg-slate-800 w-[1.5px]" style={{ height: Math.random() > 0.4 ? '85%' : '55%' }}></div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="relative z-10 w-full mb-4">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">ID ÚNICO ASIGNADO</p>
                                                        <p className="text-base font-black font-mono tracking-[0.2em] opacity-100 drop-shadow-sm">CLI-8304</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full h-[64px] bg-indigo-600 hover:bg-indigo-700 border-none shadow-indigo-500/20 py-5 text-sm tracking-[0.2em]"
                        >
                            {loading ? (
                                <RefreshCw size={24} className="animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle size={22} />
                                    SINCRONIZAR PARÁMETROS
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
