// Build timestamp: 2026-03-05T12:40:00
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { authAPI } from "../services/api";
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import Icono from "../assets/ICONO.png";

const Login = () => {
  const navigate = useNavigate();
  const { login, loginOffline, storeConfig } = useAuth();
  const { isOnline } = useNetwork();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isOnline) {
        const data = await authAPI.login(username, password);
        await login(data.user, data.token, data.turnoActivo, password);
        toast.success(`Bienvenido, ${data.user.username}`);
      } else {
        const data = await loginOffline(username, password);
        toast.success(`Modo Offline: Bienvenido, ${data.user.username}`, {
          icon: '📡',
          duration: 4000
        });
      }
      navigate("/store");
    } catch (error) {
      const errorMsg = error.message || "Credenciales incorrectas";
      if (!isOnline && errorMsg.includes("Failed to fetch")) {
        toast.error("No hay conexión y no tienes una sesión guardada");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md px-4 z-10 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] shadow-2xl p-10">

          {/* Brand Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 border border-white/20 mb-4 p-2 shadow-inner overflow-hidden">
              <img
                src={Icono}
                alt="TENDO-POS Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              TENDO-POS
            </h1>
            <p className="text-slate-400 font-medium text-sm mt-1">Identifícate para entrar al sistema</p>
            
            {!isOnline && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-500 text-[10px] font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Modo Offline - Sesión Guardada
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              {/* Input Usuario */}
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                  required
                />
              </div>

              {/* Input Contraseña */}
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 p-px rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              <div className="bg-slate-900 group-hover:bg-transparent transition-colors rounded-2xl py-4 flex items-center justify-center gap-2">
                <span className="text-white font-bold tracking-wide uppercase text-sm">
                  {loading ? "Iniciando sesión..." : isOnline ? "Acceder al Sistema" : "Acceder Offline"}
                </span>
                {!loading && <ArrowRight className="text-white group-hover:translate-x-1 transition-transform" size={18} />}
              </div>
            </button>
          </form>

          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Seguridad de Acceso Activada</span>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <p className="mt-8 text-center text-slate-600 text-[10px] uppercase font-bold tracking-widest">
          &copy; 2026 TENDO-POS
        </p>
      </div>
    </div>
  );
};

export default Login;
