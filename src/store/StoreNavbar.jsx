import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { dashboardAPI, configuracionAPI, getImageUrl } from "../services/api";
import { Menu, X, Moon, Sun, Bell, Settings, User, Search, Store } from "lucide-react";
import { toast } from "react-hot-toast";
import GlobalSearch from "../Components/GlobalSearch";
import NotificationDropdown from "../Components/NotificationDropdown";

const StoreNavbar = ({ onMenuToggle, sidebarOpen }) => {
  const { user, storeConfig } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [lastPedidosCount, setLastPedidosCount] = useState(0);

  // Poll for new requests every 60 seconds
  useEffect(() => {
    const checkNewRequests = async () => {
      try {
        const stats = await dashboardAPI.getStats("month");
        if (stats.pedidosPendientes > lastPedidosCount) {
          toast.success(`¡Nueva solicitud recibida! (#${stats.pedidosPendientes} pendientes)`, {
            duration: 6000,
            icon: '🚚',
            style: {
              borderRadius: '20px',
              background: '#4f46e5',
              color: '#fff',
              fontWeight: '900',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 20px 40px -10px rgba(79, 70, 229, 0.4)'
            }
          });

          try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.play().catch(() => { });
          } catch (e) { }
        }
        setLastPedidosCount(stats.pedidosPendientes);
      } catch (error) {
        console.error("Error checking for new requests:", error);
      }
    };

    checkNewRequests();
    const interval = setInterval(checkNewRequests, 60000);
    return () => clearInterval(interval);
  }, [lastPedidosCount]);

  return (
    <div className="flex items-center justify-between px-4 sm:px-10 h-[84px] transition-all bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl sticky top-0 z-40 shadow-sm">
      {/* Left side: Menu button + Logo */}
      <div className="flex items-center gap-6">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 border dark:border-slate-700 transition-all active:scale-90"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link to="/store" className="flex items-center gap-4 group/logo active:scale-95 transition-all">
          <div className="w-12 h-12 rounded-[1.25rem] bg-white dark:bg-slate-800 p-2 border dark:border-slate-700 shadow-xl shadow-indigo-500/5 overflow-hidden group-hover/logo:border-indigo-500/50 group-hover/logo:shadow-indigo-500/10 transition-all duration-500 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
            <img
              src={storeConfig.logoUrl || "/images/compra.png"}
              alt=""
              className="w-full h-full object-contain relative z-10"
              onError={(e) => { e.target.src = "/images/compra.png"; }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg leading-none block group-hover/logo:text-indigo-600 transition-colors">{storeConfig.nombre_tienda}</span>
            <div className="flex items-center gap-1.5 mt-1 opacity-60">
              <Store size={10} className="text-indigo-500" />
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{user?.tienda_nombre || 'Sede Central'}</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 flex justify-center max-w-xl px-10">
        <GlobalSearch />
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 border dark:border-slate-700 transition-all hover:shadow-lg active:scale-90"
            aria-label={isDark ? "Modo Claro" : "Modo Oscuro"}
          >
            {isDark ? (
              <Sun size={20} className="text-amber-400" />
            ) : (
              <Moon size={20} />
            )}
          </button>

          <NotificationDropdown />
        </div>

        <div className="h-10 w-px bg-slate-100 dark:bg-slate-700 mx-2 hidden lg:block"></div>

        {/* User Profile */}
        <div className="flex items-center gap-4 pl-2 group cursor-pointer p-1 rounded-2xl transition-all">
          <div className="flex flex-col items-end hidden lg:flex">
            <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1.5">
              {user?.username || 'USUARIO'}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-[9px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest leading-none">{user?.rol}</p>
            </div>
          </div>

          <div className="relative group/avatar">
            <div className="absolute inset-0 bg-indigo-600 rounded-2xl blur-lg opacity-20 group-hover/avatar:opacity-40 transition-opacity"></div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 dark:bg-indigo-50 flex items-center justify-center text-white dark:text-indigo-600 shadow-xl shadow-indigo-600/20 border-2 border-white dark:border-slate-800 relative z-10 transition-transform group-hover/avatar:scale-105">
              <User size={20} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreNavbar;
