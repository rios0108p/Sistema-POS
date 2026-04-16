import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNetwork } from "../context/NetworkContext";
import { dashboardAPI, configuracionAPI, getImageUrl } from "../services/api";
import { Menu, X, Moon, Sun, Bell, Settings, User, Search, Store, Printer, Settings2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import GlobalSearch from "../Components/GlobalSearch";
import NotificationDropdown from "../Components/NotificationDropdown";
import SyncManagerPanel from "../Components/SyncManagerPanel";
import Icono from "../assets/ICONO.png";

const StoreNavbar = ({ onMenuToggle, sidebarOpen, isCollapsed }) => {
  const { user, storeConfig } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isOnline, pendingOps, isSyncing } = useNetwork();
  const [lastPedidosCount, setLastPedidosCount] = useState(0);
  const [isPrinterLinked, setIsPrinterLinked] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  useEffect(() => {
    const vid = localStorage.getItem('pos_printer_vendor_id');
    setIsPrinterLinked(!!vid);
  }, []);

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

  const setupDirectPrinter = async () => {
    if (!navigator.usb) {
      toast.error("Tu navegador no soporta impresión directa (WebUSB). Usa Chrome o Edge.");
      return;
    }

    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      if (device) {
        localStorage.setItem('pos_printer_vendor_id', device.vendorId);
        localStorage.setItem('pos_printer_product_id', device.productId);
        localStorage.setItem('pos_printer_name', device.productName || 'Impresora Térmica');
        setIsPrinterLinked(true);
        toast.success(`USB vinculada: ${device.productName || 'Genérica'}`);
      }
    } catch (error) {
      console.error("USB Pairing Error:", error);
      if (error.name === 'SecurityError') {
        toast.error("Windows bloqueó el dispositivo. Intenta re-vincular o usa puerto Serial.");
      } else {
        toast.error("No se vinculó ninguna impresora");
      }
    }
  };

  const setupSerialPrinter = async () => {
    if (!navigator.serial) {
      toast.error("Navegador no soporta Serial (COM).");
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      if (port) {
        toast.success("Puerto Serial (COM) listo. Intenta imprimir.");
        setIsPrinterLinked(true);
      }
    } catch (e) {
      toast.error("No se vinculó puerto serial.");
    }
  };

  const forgetPrinter = () => {
    localStorage.removeItem('pos_printer_vendor_id');
    localStorage.removeItem('pos_printer_product_id');
    localStorage.removeItem('pos_serial_enabled');
    setIsPrinterLinked(false);
    toast.success("Impresora olvidada. Vincúlala de nuevo.");
  };

  const handleTestPrint = async () => {
    try {
      const { tryDirectUSBPrint } = await import("../utils/printUtils");
      const success = await tryDirectUSBPrint({
        tienda: storeConfig,
        venta: {
          id: 'TEST',
          ticket_numero: '0000',
          cajero: user?.username,
          total: 0
        },
        productos: [{ nombre: 'PRUEBA AHORRO PAPEL', cantidad: 1, precio: 0 }]
      });
      if (success) toast.success("Ticket de prueba enviado. Verifica el corte.");
    } catch (e) {
      toast.error("Error al iniciar prueba de impresión");
    }
  };

  return (
    <div className="flex items-center justify-between px-4 sm:px-10 h-[84px] transition-all bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl sticky top-0 z-40 shadow-sm border-b border-slate-100/50 dark:border-slate-800/50">
      {/* Left side: Menu button + Logo */}
      <div className="flex items-center gap-6">
        <button
          onClick={onMenuToggle}
          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
          aria-label="Toggle menu"
        >
          {sidebarOpen || (window.innerWidth >= 1024 && !isCollapsed) ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link to="/store" className="flex items-center gap-4 group/logo active:scale-95 transition-all">
          <div className="w-12 h-12 rounded-[1.25rem] bg-white dark:bg-slate-800 p-2 shadow-xl shadow-indigo-500/5 overflow-hidden group-hover/logo:shadow-indigo-500/10 transition-all duration-500 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
            <img
              src={Icono}
              alt="TENDO-POS Logo"
              className="w-full h-full object-contain relative z-10"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg leading-none block group-hover/logo:text-indigo-600 transition-colors">TENDO-POS</span>
            <div className="flex items-center gap-1.5 mt-1 opacity-60">
              <Store size={10} className="text-indigo-500" />
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{user?.tienda_nombre || 'Sede Central'}</span>
            </div>
          </div>
        </Link>

        {/* Connection Status Indicator */}
        <button 
          onClick={() => window.electronAPI?.isDesktop && setShowSyncPanel(true)}
          className={`flex items-center gap-2 ml-4 ${window.electronAPI?.isDesktop ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all' : 'cursor-default'}`} 
          title={
          !isOnline ? 'Sin conexión — Modo offline activo' :
          pendingOps > 0 ? `Online — Sincronizando ${pendingOps} operaciones` :
          'Online — Sincronizado'
        }>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            !isOnline
              ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_15px_-5px_rgba(239,68,68,0.5)]'
              : pendingOps > 0
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]'
          }`}>
            {!isOnline ? (
              <><WifiOff size={12} /> Offline</>
            ) : pendingOps > 0 ? (
              <><RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> {pendingOps}</>
            ) : (
              <><Wifi size={12} /> Online</>
            )}
          </div>
        </button>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 flex justify-center max-w-xl px-10">
        <GlobalSearch />
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2 sm:gap-6">
        {!window.electronAPI?.isDesktop && user?.rol?.toLowerCase() === 'admin' && (
          <a
            href="/TendoPOS-Portable.zip"
            download="TendoPOS-Portable.zip"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
          >
            <Printer size={14} className="rotate-180" />
            Descargar App
          </a>
        )}
        <div className="flex items-center gap-2">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all hover:shadow-lg active:scale-90"
            aria-label={isDark ? "Modo Claro" : "Modo Oscuro"}
          >
            {isDark ? (
              <Sun size={20} className="text-amber-400" />
            ) : (
              <Moon size={20} />
            )}
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-all">
            <button
              onClick={setupDirectPrinter}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:shadow-md active:scale-90 relative ${isPrinterLinked
                ? 'text-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20'
                : 'text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700'
                }`}
              title="VINCULAR USB (Recomendado - Usa Zadig si da error)"
            >
              <Printer size={18} />
              {isPrinterLinked && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white dark:border-slate-800"></div>
              )}
            </button>

            <button
              onClick={setupSerialPrinter}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90"
              title="VINCULAR SERIAL (COM) - Usa esto si el USB está bloqueado"
            >
              <Search size={16} />
            </button>

            {isPrinterLinked && (
              <>
                <button
                  onClick={handleTestPrint}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90"
                  title="Ticket de Prueba Directo"
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={forgetPrinter}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90"
                  title="OLVIDAR / RESET - Úsalo si falla la conexión"
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
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

      <SyncManagerPanel isOpen={showSyncPanel} onClose={() => setShowSyncPanel(false)} />
    </div>
  );
};

export default StoreNavbar;
