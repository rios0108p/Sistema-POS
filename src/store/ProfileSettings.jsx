import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { toast } from "react-hot-toast";
import {
    User as UserIcon, Shield as ShieldIcon, Lock as LockIcon,
    Clock as ClockIcon, History as HistoryIcon, Key as KeyIcon,
    RefreshCw as RefreshIcon, CheckCircle as CheckIcon,
    X, Eye, EyeOff
} from "lucide-react";
import { InstallPWAButton } from "../components/common/InstallPWAButton";

export default function ProfileSettings() {
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: user?.username || "",
        password: ""
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authAPI.updateProfile(user.id, formData);
            updateUser({ ...user, username: formData.username });
            toast.success("Credenciales de seguridad actualizadas");
            setFormData(prev => ({ ...prev, password: "" }));
        } catch (error) {
            toast.error(error.message || "Fallo en la sincronización de perfil");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
                            <ShieldIcon className="text-indigo-600 dark:text-indigo-400" size={32} />
                            PERFIL DE <span className="text-indigo-600 dark:text-indigo-400 text-sm">/ USUARIO</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 font-bold">Gestión de identidad y parámetros de acceso restringido</p>
                    </div>
                    <InstallPWAButton />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Identity Summary Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="card-standard p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>

                            <div className="flex flex-col items-center gap-6 relative">
                                <div className="w-28 h-28 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl relative border-4 border-white dark:border-slate-800">
                                    <UserIcon size={56} />
                                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 border-4 border-white dark:border-slate-800 rounded-full shadow-lg"></div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">{user?.nombre || user?.username}</h3>
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest mt-4 border border-indigo-100 dark:border-indigo-800/30 shadow-sm">
                                        <ShieldIcon size={12} /> {user?.rol || 'Operador'}
                                    </div>
                                </div>

                                <div className="w-full space-y-4 pt-6 mt-2 border-t dark:border-slate-700/50">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                        <span className="text-slate-400">Estado Core</span>
                                        <span className="text-emerald-500 flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            Activo
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                        <span className="text-slate-400">Sucursal</span>
                                        <span className="text-slate-600 dark:text-slate-300 font-black">{user?.tienda_nombre || 'Sede Central'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card-standard p-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <HistoryIcon size={14} className="text-indigo-500" /> HISTORIAL DE ACCESO
                            </h4>
                            <div className="space-y-5">
                                <div className="flex items-center gap-4 group cursor-default">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 flex items-center justify-center border dark:border-slate-700/50 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-500 transition-all">
                                        <ClockIcon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-tight">Sesión Actual</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Hace 2 horas • IP: Protegida</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Settings Form */}
                    <div className="lg:col-span-8">
                        <div className="card-standard p-10 h-full flex flex-col">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter mb-10 flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                    <LockIcon size={24} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                Seguridad y Credenciales
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-8 flex-1">
                                <div className="space-y-2">
                                    <label className="label-standard px-1">Identificador de Acceso (Usuario)</label>
                                    <div className="relative group">
                                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            className="input-standard pl-12 h-[56px] font-bold"
                                            value={formData.username}
                                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                                            placeholder="Nombre de usuario comercial..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="label-standard px-1">Actualizar Clave Secreta</label>
                                    <div className="relative group">
                                        <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Nueva frase de paso..."
                                            className="input-standard pl-12 pr-12 h-[56px] font-bold"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 px-2 mt-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dejar vacío para conservar la contraseña actual</p>
                                    </div>
                                </div>

                                <div className="pt-10 mt-auto">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn-primary w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-none shadow-xl shadow-indigo-500/20 text-[11px] font-black tracking-widest"
                                    >
                                        {loading ? (
                                            <RefreshIcon size={22} className="animate-spin" />
                                        ) : (
                                            <>
                                                <CheckIcon size={22} />
                                                SINCRONIZAR CREDENCIALES
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="mt-8 p-6 bg-blue-50/50 dark:bg-indigo-900/10 border border-blue-100 dark:border-indigo-800/30 rounded-3xl flex flex-col sm:flex-row gap-5 items-center">
                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0 shadow-sm border dark:border-slate-700/50">
                        <ShieldIcon size={28} />
                    </div>
                    <div>
                        <h5 className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-widest mb-1 shadow-sm">Protocolo de Protección de Datos v4</h5>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                            Al modificar tu identificador comercial de acceso, el sistema aplicará un <b>cierrer de sesión forzado</b> por motivos de integridad. Deberás reautenticarte con las nuevas credenciales vinculadas a tu perfil.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
