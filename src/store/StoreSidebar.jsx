import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LogOut, Settings, X, Clock, Ban, ChevronRight, Tag,
  HomeIcon, LayoutListIcon, SquarePenIcon, SquarePlusIcon,
  ShoppingCartIcon, BadgeDollarSignIcon, PackageSearchIcon,
  TruckIcon, Users, Compass, Activity, Package
} from "lucide-react";
import { useState, useEffect } from "react";
import { configuracionAPI, getImageUrl, dashboardAPI } from "../services/api";
import { InstallPWAButton } from "../components/common/InstallPWAButton";

const StoreSidebar = ({ storeInfo, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, turnoActivo } = useAuth();
  const { isDark } = useTheme();
  const [pedidosPendientes, setPedidosPendientes] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const stats = await dashboardAPI.getStats("month");
        setPedidosPendientes(stats.pedidosPendientes || 0);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleCorteYSalir = () => {
    navigate("/store/ventas?openCorte=true");
    if (onClose) onClose();
  };

  const sidebarLinks = [
    { name: "DASHBOARD", href: "/store", icon: HomeIcon, roles: ["admin"] },
    { name: "PUNTO DE VENTA", href: "/store/ventas", icon: BadgeDollarSignIcon, roles: ["admin", "vendedor"] },
    { name: "HISTORIAL TRANSACC.", href: "/store/history", icon: Activity, roles: ["admin"] },
    { name: "AUDITORÍA TURNOS", href: "/store/corte-caja", icon: Clock, roles: ["admin"] },
    { name: "SOLICITUDES", href: "/store/orders", icon: TruckIcon, roles: ["admin", "vendedor"] },
    { name: "GESTIÓN CLIENTES", href: "/store/manage-customers", icon: Users, roles: ["admin", "vendedor"] },
    { name: "COMPRAS STOCK", href: "/store/compras", icon: ShoppingCartIcon, roles: ["admin", "vendedor"] },
    { name: "GASTOS OPERATIVOS", href: "/store/gastos", icon: LayoutListIcon, roles: ["admin"] },
    { name: "INVENTARIO TIENDA", href: "/store/inventarios", icon: PackageSearchIcon, roles: ["vendedor"] },
    { name: "PROVEEDORES", href: "/store/manage-suppliers", icon: TruckIcon, roles: ["admin"] },
    { name: "ALTA PRODUCTO", href: "/store/add-product", icon: SquarePlusIcon, roles: ["admin"] },
    { name: "CATÁLOGO MAESTRO", href: "/store/manage-product", icon: Package, roles: ["admin"] },
    { name: "SEGURIDAD USUARIOS", href: "/store/users", icon: Users, roles: ["admin"] },
    { name: "RED SUCURSALES", href: "/store/tiendas", icon: Compass, roles: ["admin"] },
    { name: "PROMOCIONES", href: "/store/promociones", icon: Tag, roles: ["admin"] },
    { name: "PERFIL USUARIO", href: "/store/profile", icon: SquarePenIcon, roles: ["admin", "vendedor"] },
    { name: "CONFIGURACIÓN", href: "/store/settings", icon: Settings, roles: ["admin"] },
  ];

  const filteredLinks = sidebarLinks.filter(link => link.roles.includes(user?.rol));

  return (
    <div className="flex h-full flex-col gap-8 border-t border-r dark:border-slate-800/50 w-[280px] bg-white dark:bg-slate-900 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.03)] lg:shadow-none transition-all duration-500 overflow-hidden relative">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent"></div>

      <div className="pt-10 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">NAVEGACIÓN POS</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 border dark:border-slate-700 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <div className="space-y-1.5 pb-10">
          {filteredLinks.map((link, index) => {
            const isActive = location.pathname === link.href;
            const Icon = link.icon;

            return (
              <Link
                key={index}
                to={link.href}
                onClick={onClose}
                className={`group relative flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-500 ${isActive
                  ? "bg-indigo-600 dark:bg-indigo-50 text-white dark:text-indigo-600 shadow-xl shadow-indigo-600/20"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-white"
                  }`}
              >
                <div className={`transition-all duration-500 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                  <Icon size={18} strokeWidth={isActive ? 3 : 2.5} />
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest transition-all ${isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}>
                  {link.name}
                </span>

                {link.name === "SOLICITUDES" && pedidosPendientes > 0 && (
                  <span className="ml-auto w-5 h-5 flex items-center justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500 text-[10px] font-black text-white ring-4 ring-white dark:ring-slate-900 group-hover:scale-110 transition-transform">
                    {pedidosPendientes}
                  </span>
                )}

                <ChevronRight size={14} className={`ml-auto transition-all ${isActive ? "opacity-40 translate-x-0" : "opacity-0 -translate-x-4 group-hover:opacity-20 group-hover:translate-x-0"}`} />

                {isActive && (
                  <div className="absolute left-0 w-1.5 h-6 bg-white dark:bg-indigo-600 rounded-r-full"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Premium Footer */}
      <div className="p-6 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md">
        <div className="flex flex-col gap-4">

          {/* PWA Mode indicator */}
          <div className="hidden standalone:flex justify-center mb-2">
            <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/30 tracking-widest">
              Versión Escritorio
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {turnoActivo ? (
              <button
                onClick={handleCorteYSalir}
                className="w-full h-[52px] flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group"
              >
                <Ban size={18} className="group-hover:rotate-12 transition-transform" />
                CORTE Y CIERRE
              </button>
            ) : null}

            <button
              onClick={handleLogout}
              className={`w-full h-[52px] flex items-center justify-center gap-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 group ${turnoActivo
                ? 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-500/20'
                : 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700'
                }`}
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              {turnoActivo ? 'SOLO SALIR' : 'CERRAR SESIÓN'}
            </button>
            {user?.rol === 'admin' && <InstallPWAButton />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreSidebar;