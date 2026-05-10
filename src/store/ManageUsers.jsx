import { useState, useEffect } from "react";
import {
    UserPlus, Shield, UserPen, Trash2, Key, Users, Store,
    Clock, Check, Search, X, User
} from "lucide-react";
import { usuariosAPI, tiendasAPI } from "../services/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const PERM_LABELS = {
    ventas: 'Ventas / POS',
    inventario: 'Inventario',
    clientes: 'Clientes',
    compras: 'Compras',
    gastos: 'Gastos',
    tiendas: 'Sucursales',
    usuarios: 'Usuarios',
    configuracion: 'Configuración',
    dashboard: 'Dashboard',
    imprimir_corte: 'Imprimir Corte',
    hacer_corte: 'Hacer Corte'
};

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

export default function ManageUsers() {
    const { user: currentUser, updateUser } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [tiendas, setTiendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

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
                pin_seguridad: "",
                permisos: { ...DEFAULT_PERMISSIONS, ...userPerms }
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
        if (editingUser?.id === currentUser.id && formData.rol !== currentUser.rol) {
            return toast.error("No puedes cambiar tu propio rol. Pide a otro administrador que lo haga.");
        }
        try {
            if (editingUser) {
                await usuariosAPI.update(editingUser.id, formData);
                if (editingUser.id === currentUser.id) updateUser(formData);
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

    const filtered = usuarios.filter(u =>
        u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.tienda_nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">

            {/* ── Header ── */}
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
                    <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2 text-[10px]">
                        <UserPlus size={18} />
                        Añadir Trabajador
                    </button>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="card-standard overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="table-header">
                            <tr>
                                <th className="px-6 py-5">Operador</th>
                                <th className="px-6 py-5">Rol</th>
                                <th className="px-6 py-5">Sucursal</th>
                                <th className="px-6 py-5 hidden md:table-cell">Jornada</th>
                                <th className="px-6 py-5 hidden lg:table-cell">Registro</th>
                                <th className="px-6 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium text-slate-600 dark:text-slate-400">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-20">
                                        <div className="flex flex-col items-center gap-3 animate-pulse">
                                            <Users size={40} className="text-slate-200" />
                                            <span className="font-bold uppercase tracking-widest text-[10px] text-slate-300">Sincronizando equipo...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-20">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <User size={36} className="text-slate-200" />
                                            <span className="font-bold uppercase tracking-widest text-[10px]">Sin resultados</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map((u) => (
                                <tr key={u.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-all group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs uppercase flex-shrink-0">
                                                {u.nombre_usuario.charAt(0)}
                                            </div>
                                            <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm">{u.nombre_usuario}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${u.rol === 'admin'
                                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30'
                                        }`}>
                                            {u.rol === 'admin' ? 'Admin' : 'Vendedor'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold uppercase w-fit border dark:border-slate-700/50">
                                            <Store size={12} className="opacity-50" />
                                            {u.tienda_nombre || "GLOBAL"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 rounded-xl text-[10px] font-bold uppercase w-fit border dark:border-slate-600">
                                            <Clock size={12} className="opacity-50" />
                                            {u.turno_trabajo || 'COMPLETO'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden lg:table-cell text-slate-300 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(u)}
                                                className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all active:scale-90"
                                            >
                                                <UserPen size={16} />
                                            </button>
                                            {u.nombre_usuario !== 'admin@sistema.com' && (
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-90"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modal ── */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] flex flex-col">

                        {/* Gradient Header */}
                        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-7 overflow-hidden flex-shrink-0">
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
                            </div>
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                                        <Users className="text-white" size={22} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                                            {editingUser ? 'Modificar Acceso' : 'Nuevo Operador'}
                                        </h2>
                                        <p className="text-indigo-200/80 text-[10px] font-black uppercase tracking-widest mt-1">
                                            {editingUser ? `Editando: ${editingUser.nombre_usuario}` : 'Registrar nuevo integrante del equipo'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all active:scale-90">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-7 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
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
                                        {editingUser ? "Nueva Contraseña (opcional)" : "Contraseña *"}
                                    </label>
                                    <div className="relative group">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                        <input
                                            type="password"
                                            className="input-standard pl-12 font-bold"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-standard">PIN Seguridad (4 dígitos)</label>
                                    <div className="relative group">
                                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                        <input
                                            type="password"
                                            maxLength={4}
                                            className="input-standard pl-12 font-bold tracking-widest"
                                            value={formData.pin_seguridad || ""}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 4) setFormData({ ...formData, pin_seguridad: val });
                                            }}
                                            placeholder="••••"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-standard">Rol Operativo</label>
                                    <select
                                        className="select-standard font-bold uppercase text-xs tracking-widest cursor-pointer disabled:opacity-50"
                                        value={formData.rol}
                                        disabled={editingUser?.nombre_usuario === 'admin@sistema.com'}
                                        onChange={e => setFormData({ ...formData, rol: e.target.value })}
                                    >
                                        <option value="vendedor">Vendedor / POS</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label-standard">Jornada</label>
                                    <select
                                        className="select-standard text-xs"
                                        value={formData.turno_trabajo}
                                        onChange={e => setFormData({ ...formData, turno_trabajo: e.target.value })}
                                    >
                                        <option value="COMPLETO">Completo</option>
                                        <option value="MAÑANA">Mañana</option>
                                        <option value="TARDE">Tarde</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="label-standard">Sucursal Asignada</label>
                                    <select
                                        className="select-standard text-xs"
                                        value={formData.tienda_id}
                                        onChange={e => setFormData({ ...formData, tienda_id: e.target.value })}
                                    >
                                        <option value="">Acceso Global (todas)</option>
                                        {tiendas.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Permissions */}
                            <div className="pt-4 border-t dark:border-slate-700/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                                        <Shield size={14} className="text-indigo-500" />
                                    </div>
                                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                        Permisos de Acceso Específicos
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    {Object.keys(formData.permisos || {}).map((perm) => {
                                        const active = formData.permisos[perm];
                                        return (
                                            <div
                                                key={perm}
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    permisos: { ...formData.permisos, [perm]: !active }
                                                })}
                                                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-95 select-none ${
                                                    active
                                                        ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700'
                                                        : 'bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${active ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                                    {active && <Check size={11} className="text-white" strokeWidth={3} />}
                                                </div>
                                                <span className={`text-[10px] font-black leading-tight ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {PERM_LABELS[perm] || perm}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {editingUser ? "Guardar Cambios" : "Crear Operador"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
