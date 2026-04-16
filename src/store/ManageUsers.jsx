import { useState, useEffect } from "react";
import { UserPlus, Shield, UserPen, Trash2, Key, Users, Store, Clock, Plus, Check, Search } from "lucide-react";
import { usuariosAPI, tiendasAPI } from "../services/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

export default function ManageUsers() {
    const { user: currentUser, updateUser } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [tiendas, setTiendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const DEFAULT_PERMISSIONS = {
        ventas: true,
        inventario: false,
        clientes: false,
        compras: false,
        gastos: false,
        tiendas: false,
        usuarios: false,
        configuracion: false,
        dashboard: false,
        imprimir_corte: true,
        hacer_corte: true
    };

    const [formData, setFormData] = useState({
        nombre_usuario: "",
        password: "",
        rol: "vendedor",
        tienda_id: "",
        turno_trabajo: "COMPLETO",
        pin_seguridad: "",
        permisos: { ...DEFAULT_PERMISSIONS }
    });

    useEffect(() => {
        fetchUsuarios();
        fetchTiendas();
    }, []);

    const fetchTiendas = async () => {
        try {
            const data = await tiendasAPI.getAll();
            setTiendas(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading tiendas", error);
        }
    };

    const fetchUsuarios = async () => {
        try {
            const data = await usuariosAPI.getAll();
            setUsuarios(data);
        } catch (error) {
            toast.error("Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (usuario = null) => {
        if (usuario) {
            setEditingUser(usuario);
            const userPerms = typeof usuario.permisos === 'string' ? JSON.parse(usuario.permisos) : (usuario.permisos || {});

            setFormData({
                nombre_usuario: usuario.nombre_usuario,
                password: "",
                rol: usuario.rol,
                tienda_id: usuario.tienda_id || "",
                turno_trabajo: usuario.turno_trabajo || "COMPLETO",
                pin_seguridad: "", // No mostramos el PIN hasheado
                permisos: {
                    ...DEFAULT_PERMISSIONS,
                    ...userPerms // Las guardadas en DB mandan, aunque sean false
                }
            });
        } else {
            setEditingUser(null);
            setFormData({
                nombre_usuario: "",
                password: "",
                rol: "vendedor",
                tienda_id: "",
                turno_trabajo: "COMPLETO",
                pin_seguridad: "",
                permisos: { ...DEFAULT_PERMISSIONS }
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Bug #18: Prevent admin from demoting themselves
        if (editingUser?.id === currentUser.id && formData.rol !== currentUser.rol) {
            return toast.error("No puedes cambiar tu propio rol. Pide a otro administrador que lo haga.");
        }
        try {
            if (editingUser) {
                await usuariosAPI.update(editingUser.id, formData);
                // Si el admin está editandose a sí mismo, actualizamos su propio contexto global
                if (editingUser.id === currentUser.id) {
                    updateUser(formData);
                }
                toast.success("Usuario actualizado");
            } else {
                if (!formData.password) return toast.error("La contraseña es obligatoria");
                await usuariosAPI.create(formData);
                toast.success("Usuario creado");
            }
            setIsModalOpen(false);
            fetchUsuarios();
        } catch (error) {
            toast.error(error.message || "Error al guardar");
        }
    };

    const handleDelete = async (id) => {
        if (id === currentUser.id) return toast.error("No puedes eliminarte a ti mismo");
        if (!window.confirm("¿Seguro que quieres eliminar este trabajador?")) return;

        try {
            await usuariosAPI.delete(id);
            toast.success("Usuario eliminado");
            fetchUsuarios();
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                        <Users className="text-indigo-600 dark:text-indigo-400" size={28} />
                        GESTIÓN DE <span className="text-indigo-600 dark:text-indigo-400">TRABAJADORES</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Control de acceso y perfiles de usuario por sucursal</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar trabajador..."
                            className="input-standard pl-12 h-[44px] text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="btn-primary flex items-center gap-2 text-[10px]"
                    >
                        <UserPlus size={18} />
                        Añadir Trabajador
                    </button>
                </div>
            </div>

            <div className="card-standard overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="table-header">
                            <tr>
                                <th className="px-8 py-6">Nombre del Operador</th>
                                <th className="px-8 py-6">Privilegios</th>
                                <th className="px-8 py-6">Sucursal Principal</th>
                                <th className="px-8 py-6">Jornada</th>
                                <th className="px-8 py-6">Registro</th>
                                <th className="px-8 py-6 text-right">Controles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium text-slate-600 dark:text-slate-400">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-20">
                                        <div className="flex flex-col items-center gap-3 animate-pulse">
                                            <Users size={40} className="text-slate-200" />
                                            <span className="font-bold uppercase tracking-widest text-[10px] text-slate-300">Sincronizando equipo de trabajo...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : usuarios.filter(u =>
                                    u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    (u.tienda_nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
                                ).map((u) => (
                                <tr key={u.id} className="table-row">
                                    <td className="table-cell font-bold text-slate-800 dark:text-white uppercase tracking-tighter text-sm px-8 py-5">{u.nombre_usuario}</td>
                                    <td className="table-cell px-8 py-5">
                                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border shadow-sm ${u.rol === 'admin'
                                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30'
                                            }`}>
                                            {u.rol}
                                        </span>
                                    </td>
                                    <td className="table-cell px-8 py-5">
                                        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-tighter w-fit border dark:border-slate-700/50">
                                            <Store size={14} className="opacity-50" />
                                            {u.tienda_nombre || "ACCESO GLOBAL"}
                                        </div>
                                    </td>
                                    <td className="table-cell px-8 py-5">
                                        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-tighter w-fit border dark:border-slate-600 shadow-sm">
                                            <Clock size={14} className="opacity-50" />
                                            {u.turno_trabajo || 'COMPLETO'}
                                        </div>
                                    </td>
                                    <td className="table-cell px-8 py-5 text-slate-300 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="table-cell px-8 py-5 text-right flex justify-end gap-3">
                                        <button
                                            onClick={() => handleOpenModal(u)}
                                            className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-lg active:scale-90 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800/50"
                                        >
                                            <UserPen size={18} />
                                        </button>
                                        {u.nombre_usuario !== 'admin@sistema.com' && (
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-lg active:scale-90 border border-transparent hover:border-rose-100 dark:hover:border-rose-800/50"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="p-2">
                            <h2 className="modal-header mb-8">
                                {editingUser ? "Modificar Acceso" : "Nuevo Operador"}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="label-standard">Alias del Trabajador</label>
                                    <input
                                        type="text"
                                        required
                                        className="input-standard font-bold"
                                        value={formData.nombre_usuario}
                                        onChange={e => setFormData({ ...formData, nombre_usuario: e.target.value })}
                                        placeholder="ej: mario_pos"
                                    />
                                </div>
                                <div>
                                    <label className="label-standard">
                                        {editingUser ? "Cambiar Contraseña (OPCIONAL)" : "Código de Seguridad"}
                                    </label>
                                    <div className="relative group">
                                        <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                        <input
                                            type="password"
                                            className="input-standard pl-14 font-bold"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-standard">
                                        {editingUser ? "Cambiar PIN de seguridad (4 dígitos)" : "PIN de seguridad (4 dígitos)"}
                                    </label>
                                    <div className="relative group">
                                        <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                        <input
                                            type="password"
                                            maxLength={4}
                                            className="input-standard pl-14 font-bold"
                                            value={formData.pin_seguridad || ""}
                                            onChange={e => {
                                                const val = e.target.value === "" ? "" : e.target.value.replace(/\D/g, '');
                                                if (val.length <= 4) setFormData({ ...formData, pin_seguridad: val });
                                            }}
                                            placeholder="Ej: 1234"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="label-standard">Rol Operativo</label>
                                        <select
                                            className="select-standard font-bold uppercase text-xs tracking-widest cursor-pointer disabled:opacity-50"
                                            value={formData.rol}
                                            disabled={editingUser?.nombre_usuario === 'admin@sistema.com'}
                                            onChange={e => setFormData({ ...formData, rol: e.target.value })}
                                        >
                                            <option value="vendedor">Vendedor / POS</option>
                                            <option value="admin">Administrador / Full</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-standard">Sucursal</label>
                                        <select
                                            className="select-standard text-[10px]"
                                            value={formData.tienda_id}
                                            onChange={e => setFormData({ ...formData, tienda_id: e.target.value })}
                                        >
                                            <option value="">Global</option>
                                            {tiendas.map(t => (
                                                <option key={t.id} value={t.id}>{t.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-standard">Jornada</label>
                                        <select
                                            className="select-standard text-[10px]"
                                            value={formData.turno_trabajo}
                                            onChange={e => setFormData({ ...formData, turno_trabajo: e.target.value })}
                                        >
                                            <option value="COMPLETO">Completo</option>
                                            <option value="MAÑANA">Mañana</option>
                                            <option value="TARDE">Tarde</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 pt-4 border-t dark:border-slate-700/50">
                                        <label className="label-standard mb-4 flex items-center gap-2">
                                            <Shield size={14} className="text-indigo-500" />
                                            Permisos de Acceso Específicos
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {Object.keys(formData.permisos).map((perm) => (
                                                <div
                                                    key={perm}
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        permisos: { ...formData.permisos, [perm]: !formData.permisos[perm] }
                                                    })}
                                                    className={`
                                                        flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all active:scale-95 select-none
                                                        ${formData.permisos[perm]
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400'
                                                            : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900/50 dark:border-slate-800'}
                                                    `}
                                                >
                                                    <div className={`w-5 h-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-all ${formData.permisos[perm] ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                                        {formData.permisos[perm] && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest truncate">{perm}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-8 flex flex-col gap-3">
                                    <button
                                        type="submit"
                                        className="btn-primary py-5 text-[10px] tracking-[0.25em]"
                                    >
                                        {editingUser ? "Guardar Cambios" : "Sincronizar Operador"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-full py-3 text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em] hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Descartar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
