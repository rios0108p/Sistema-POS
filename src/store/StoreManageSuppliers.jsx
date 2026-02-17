import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Loading from "../Components/Common/Loading";
import { proveedoresAPI } from "../services/api";
import { Pencil, Trash2, Save, X, RefreshCw, UserCheck, PlusCircle, Building2, Phone, Mail, MapPin, Contact, Search, Plus } from "lucide-react";

const StoreManageSuppliers = () => {
    const [cargando, setCargando] = useState(true);
    const [proveedores, setProveedores] = useState([]);
    const [editandoId, setEditandoId] = useState(null);
    const [mostrandoFormulario, setMostrandoFormulario] = useState(false);

    const [formulario, setFormulario] = useState({
        nombre: "",
        contacto: "",
        telefono: "",
        email: "",
        direccion: ""
    });

    const obtenerProveedores = async () => {
        setCargando(true);
        try {
            const data = await proveedoresAPI.getAll();
            setProveedores(data || []);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar proveedores");
        } finally {
            setCargando(false);
        }
    };

    const handleGuardar = async (e) => {
        if (e) e.preventDefault();

        if (!formulario.nombre) {
            toast.error("El nombre es obligatorio");
            return;
        }

        try {
            if (editandoId) {
                await proveedoresAPI.update(editandoId, formulario);
                toast.success("Proveedor actualizado con éxito");
            } else {
                await proveedoresAPI.create(formulario);
                toast.success("Nuevo proveedor vinculado al sistema");
            }

            setEditandoId(null);
            setMostrandoFormulario(false);
            setFormulario({ nombre: "", contacto: "", telefono: "", email: "", direccion: "" });
            obtenerProveedores();
        } catch (error) {
            console.error(error);
            toast.error("Error al sincronizar datos");
        }
    };

    const iniciarEdicion = (p) => {
        setEditandoId(p.id);
        setFormulario({
            nombre: p.nombre,
            contacto: p.contacto || "",
            telefono: p.telefono || "",
            email: p.email || "",
            direccion: p.direccion || ""
        });
        setMostrandoFormulario(true);
    };

    const eliminarProveedor = async (id) => {
        if (!window.confirm("¿Seguro que desea desvincular este proveedor?")) return;
        try {
            await proveedoresAPI.delete(id);
            toast.success("Proveedor desvinculado");
            obtenerProveedores();
        } catch (error) {
            toast.error(error.message || "Error al eliminar registro");
        }
    };

    useEffect(() => {
        obtenerProveedores();
    }, []);

    if (cargando && !mostrandoFormulario) return <Loading />;

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-4 uppercase relative z-10">
                            <Building2 className="text-indigo-600" size={32} />
                            GESTIÓN DE <span className="text-indigo-600">PROVEEDORES</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest">Control de alianzas logísticas y abastecimiento externo</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={obtenerProveedores}
                            className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700/50 rounded-2xl hover:shadow-xl transition-all text-slate-400 hover:text-indigo-500 active:scale-95 shadow-lg group"
                        >
                            <RefreshCw size={22} className={cargando ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                        </button>
                        <button
                            onClick={() => {
                                setMostrandoFormulario(!mostrandoFormulario);
                                setEditandoId(null);
                                setFormulario({ nombre: "", contacto: "", telefono: "", email: "", direccion: "" });
                            }}
                            className={`btn-primary flex-1 md:flex-none px-8 gap-3 ${mostrandoFormulario ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                        >
                            {mostrandoFormulario ? <X size={20} /> : <Plus size={20} />}
                            {mostrandoFormulario ? "CANCELAR" : "NUEVO PROVEEDOR"}
                        </button>
                    </div>
                </div>

                {/* Formulario */}
                {mostrandoFormulario && (
                    <div className="card-standard p-10 mb-10 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 dark:bg-slate-900/40 rounded-full -mr-32 -mt-32 pointer-events-none"></div>

                        <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter mb-10 flex items-center gap-3 relative z-10">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                <PlusCircle size={24} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            {editandoId ? "Modificar Ficha de Proveedor" : "Vincular Proveedor al Sistema"}
                        </h2>

                        <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
                            <div className="space-y-2">
                                <label className="label-standard px-1">Razón Social / Nombre Comercial *</label>
                                <div className="relative group">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input
                                        value={formulario.nombre}
                                        onChange={e => setFormulario({ ...formulario, nombre: e.target.value })}
                                        className="input-standard pl-12 h-[56px] font-black"
                                        placeholder="Ej: Distribuidora Central S.A."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="label-standard px-1">Persona de Enlace / Contacto</label>
                                <div className="relative group">
                                    <Contact className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input
                                        value={formulario.contacto}
                                        onChange={e => setFormulario({ ...formulario, contacto: e.target.value })}
                                        className="input-standard pl-12 h-[56px] font-bold"
                                        placeholder="Nombre del ejecutivo..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="label-standard px-1">Teléfono Directo</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input
                                        value={formulario.telefono}
                                        onChange={e => setFormulario({ ...formulario, telefono: e.target.value })}
                                        className="input-standard pl-12 h-[56px] font-black font-mono"
                                        placeholder="+502 0000 0000"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="label-standard px-1">Email de Operaciones</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        value={formulario.email}
                                        onChange={e => setFormulario({ ...formulario, email: e.target.value })}
                                        className="input-standard pl-12 h-[56px] font-bold"
                                        placeholder="ventas@proveedor.com"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="label-standard px-1">Ubicación / Dirección Fiscal</label>
                                <div className="relative group">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    <input
                                        value={formulario.direccion}
                                        onChange={e => setFormulario({ ...formulario, direccion: e.target.value })}
                                        className="input-standard pl-12 h-[56px] font-bold"
                                        placeholder="Ciudad, Zona, Dirección completa..."
                                    />
                                </div>
                            </div>

                            <div className="lg:col-span-3 flex justify-end pt-6">
                                <button
                                    type="submit"
                                    className="btn-primary px-12 h-[60px] bg-indigo-600 border-none shadow-indigo-500/20"
                                >
                                    <Save size={20} /> {editandoId ? "SINCROZINAR CAMBIOS" : "CONFIRMAR VINCULACIÓN"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tabla */}
                <div className="card-standard p-0 overflow-hidden shadow-2xl relative transition-all duration-500">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-md text-slate-400 uppercase text-[10px] font-black tracking-[0.2em] border-b dark:border-slate-700/50">
                                    <th className="px-8 py-6">Entidad Logística</th>
                                    <th className="px-8 py-6">Representante</th>
                                    <th className="px-8 py-6">Canales Directos</th>
                                    <th className="px-8 py-6 text-right">Controles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {proveedores.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-6 opacity-20">
                                                <Building2 size={80} className="text-slate-400" />
                                                <p className="font-black uppercase tracking-[0.3em] text-xs">No hay proveedores en el registro maestro</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    proveedores.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-600 border dark:border-slate-700/50 group-hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/10 transition-all">
                                                        <Building2 size={28} />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 dark:text-white leading-none uppercase tracking-tighter text-base mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.nombre}</p>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                            <MapPin size={12} className="text-indigo-500/50" /> {p.direccion || "COBERTURA GLOBAL"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700/50 rounded-2xl shadow-sm">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{p.contacto || "SIN ASIGNAR"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2.5 text-xs font-black text-slate-700 dark:text-slate-300 tracking-tight">
                                                        <div className="p-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-md text-emerald-500"><Phone size={12} /></div>
                                                        {p.telefono || "---"}
                                                    </div>
                                                    <div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        <div className="p-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-indigo-400"><Mail size={12} /></div>
                                                        {p.email || "S/N"}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => iniciarEdicion(p)}
                                                        className="p-3.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-md active:scale-90 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800/50"
                                                        title="Editar Expediente"
                                                    >
                                                        <Pencil size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => eliminarProveedor(p.id)}
                                                        className="p-3.5 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-md active:scale-90 border border-transparent hover:border-rose-100 dark:hover:border-rose-800/50"
                                                        title="Baja del Sistema"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoreManageSuppliers;
