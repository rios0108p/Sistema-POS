import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LogOut, Settings, X, Clock, Ban, ChevronRight, Tag,
  LayoutDashboard, CreditCard, ReceiptText, Banknote, Users2,
  Archive, Package, Truck, Store, DollarSign, UserCircle2,
  Building2, Settings2, Lock, Download, UserPlus, PlusCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { configuracionAPI, getImageUrl, dashboardAPI } from "../services/api";
import PendingTicketsModal from "./components/PendingTicketsModal";

const StoreSidebar = ({ storeInfo, onClose, isCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, turnoActivo, hasPermission } = useAuth();
  const { isDark } = useTheme();
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [showPendingTickets, setShowPendingTickets] = useState(false);
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);

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
    const suspended = localStorage.getItem('ventas_suspendidas');
    let count = 0;
    try {
      count = suspended ? JSON.parse(suspended).length : 0;
    } catch (e) { count = 0; }

    if (count > 0) {
      setPendingTicketsCount(count);
      setShowPendingTickets(true);
      return;
    }

    executeLogout();
  };

  const executeLogout = () => {
    logout();
    navigate("/");
  };

  const handleClearSuspended = () => {
    localStorage.removeItem('ventas_suspendidas');
  };

  const handleCorteYSalir = () => {
    navigate("/store/ventas?openCorte=true");
    if (onClose) onClose();
  };

  const sidebarGroups = [
    {
      title: " Operación",
      links: [
        { name: "RESUMEN", href: "/store", icon: LayoutDashboard, permission: "dashboard" },
        { name: "COBRAR", href: "/store/ventas", icon: CreditCard, permission: "ventas" },
        { name: "VENTAS", href: "/store/history", icon: ReceiptText, permission: "ventas" },
        { name: "CAJA", href: "/store/corte-caja", icon: Banknote, permission: "ventas" },
        { name: "PEDIDOS", href: "/store/orders", icon: Truck, permission: "ventas" },
        { name: "CLIENTES", href: "/store/manage-customers", icon: Users2, permission: "clientes" },
      ]
    },
    {
      title: " Inventario",
      links: [
        { name: "EXISTENCIAS", href: "/store/inventarios", icon: Archive, permission: "ventas" },
        { name: "ALTA", href: "/store/add-product", icon: PlusCircle, permission: "inventario" },
        { name: "PRODUCTOS", href: "/store/manage-product", icon: Package, permission: "inventario" },
        { name: "COMPRAS", href: "/store/compras", icon: CreditCard, permission: "ventas" }, // Re-using card for financial entry or ShoppingCart
        { name: "PROVEEDORES", href: "/store/manage-suppliers", icon: Store, permission: "inventario" },
        { name: "GASTOS", href: "/store/gastos", icon: DollarSign, permission: "gastos" },
      ]
    },
    {
      title: " Administración",
      links: [
        { name: "USUARIOS", href: "/store/users", icon: UserCircle2, permission: "usuarios" },
        { name: "TIENDAS", href: "/store/tiendas", icon: Building2, permission: "tiendas" },
        { name: "PROMOCIONES", href: "/store/promociones", icon: Tag, permission: "configuracion" },
        { name: "MI PERFIL", href: "/store/profile", icon: UserCircle2, permission: "dashboard" },
        { name: "AJUSTES", href: "/store/settings", icon: Settings2, permission: "configuracion" },
      ]
    }
  ];

  // Flatten the sidebarGroups into a single array of links for filtering
  const allSidebarLinks = sidebarGroups.flatMap(group => group.links);
  const filteredLinks = allSidebarLinks.filter(link => hasPermission(link.permission));

  return (
    <div className={`flex h-full flex-col gap-8 w-full bg-white dark:bg-slate-900 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.05)] lg:shadow-none transition-all duration-500 overflow-hidden relative ${isCollapsed ? 'items-center' : ''}`}>
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent"></div>
      <div className={`pt-10 px-6 flex items-center justify-between ${isCollapsed ? 'px-2' : ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
          {!isCollapsed && <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] truncate">SISTEMA TENDO</p>}
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Navigation with Groups */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'} custom-scrollbar`}>
        {sidebarGroups.map((group, groupIdx) => {
          const visibleLinks = group.links.filter(link => hasPermission(link.permission));
          if (visibleLinks.length === 0) return null;

          return (
            <div key={groupIdx} className="mb-8 last:mb-10">
              {!isCollapsed && (
                <p className="px-5 mb-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] opacity-70">
                  {group.title}
                </p>
              )}
              <div className="space-y-1.5">
                {visibleLinks.map((link, index) => {
                  const isActive = location.pathname === link.href;
                  const Icon = link.icon;

                  return (
                    <Link
                      key={index}
                      to={link.href}
                      onClick={onClose}
                      title={isCollapsed ? link.name : ''}
                      className={`group relative flex items-center rounded-2xl transition-all duration-500 ${isCollapsed ? 'justify-center p-3.5' : 'gap-4 px-5 py-3.5'} ${isActive
                        ? "bg-indigo-600 dark:bg-indigo-50 text-white dark:text-indigo-600 shadow-xl shadow-indigo-600/20"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-white"
                        }`}
                    >
                      <div className={`transition-all duration-500 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                        <Icon size={18} strokeWidth={isActive ? 3 : 2.5} />
                      </div>

                      {!isCollapsed && (
                        <span className={`text-[11px] font-black uppercase tracking-widest transition-all ${isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}>
                          {link.name}
                        </span>
                      )}

                      {link.name === "PEDIDOS" && pedidosPendientes > 0 && (
                        <span className={`${isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} w-5 h-5 flex items-center justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500 text-[10px] font-black text-white group-hover:scale-110 transition-transform`}>
                          {pedidosPendientes}
                        </span>
                      )}

                      {!isCollapsed && <ChevronRight size={14} className={`ml-auto transition-all ${isActive ? "opacity-40 translate-x-0" : "opacity-0 -translate-x-4 group-hover:opacity-20 group-hover:translate-x-0"}`} />}

                      {isActive && !isCollapsed && (
                        <div className="absolute left-0 w-1.5 h-6 bg-white dark:bg-indigo-600 rounded-r-full"></div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Premium Footer */}
      <div className={`p-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md ${isCollapsed ? 'p-2' : ''}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            {turnoActivo ? (
              <button
                onClick={handleCorteYSalir}
                title={isCollapsed ? (hasPermission('hacer_corte') ? 'CERRAR CAJA' : 'ENTREGAR TURNO') : ''}
                className={`w-full h-[52px] flex items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group ${isCollapsed ? '' : 'gap-3'}`}
              >
                <Lock size={18} className="group-hover:rotate-12 transition-transform" />
                {!isCollapsed && (hasPermission('hacer_corte') ? 'CERRAR CAJA' : 'ENTREGAR TURNO')}
              </button>
            ) : null}

            <button
              onClick={handleLogout}
              title={isCollapsed ? (turnoActivo ? 'CAMBIAR USUARIO' : 'SALIR') : ''}
              className={`w-full h-[52px] flex items-center justify-center rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 group shadow-sm ${isCollapsed ? '' : 'gap-3'} ${turnoActivo
                ? 'bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:shadow-md'
                : 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700'
                }`}
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              {!isCollapsed && (turnoActivo ? 'CAMBIAR USUARIO' : 'SALIR')}
            </button>
          </div>
        </div>
      </div>

      <PendingTicketsModal
        isOpen={showPendingTickets}
        onClose={() => setShowPendingTickets(false)}
        count={pendingTicketsCount}
        onConfirmConservar={() => {
          setShowPendingTickets(false);
          executeLogout();
        }}
        onConfirmBorrar={() => {
          handleClearSuspended();
          setShowPendingTickets(false);
          executeLogout();
        }}
      />
    </div>
  );
};

export default StoreSidebar;