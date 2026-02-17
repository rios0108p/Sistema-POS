import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Package, AlertTriangle, TrendingUp, Check, X, Trash2 } from "lucide-react";
import { dashboardAPI } from "../services/api";

const NotificationDropdown = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);

    const [dismissedIds, setDismissedIds] = useState(() => {
        const saved = localStorage.getItem("dismissed_notifications");
        return saved ? JSON.parse(saved) : [];
    });

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Load notifications when opened
    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen]);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const stats = await dashboardAPI.getStats("month");
            const notifs = [];

            // 1. Critical Stock (Priority)
            if (stats.bajoStock > 0) {
                notifs.push({
                    id: `out-of-stock-${stats.bajoStock}`, // Use count in ID to reappear if count changes
                    type: "error",
                    icon: Package,
                    title: "CRÍTICO: STOCK AGOTADO",
                    message: `${stats.bajoStock} productos requieren atención inmediata`,
                    action: () => navigate("/store/inventarios"),
                    time: "Ahora"
                });
            }

            // 2. Pending Orders (New)
            if (stats.pedidosPendientes > 0) {
                notifs.push({
                    id: `pending-orders-${stats.pedidosPendientes}`,
                    type: "info",
                    icon: Package,
                    title: "SOLICITUDES PENDIENTES",
                    message: `${stats.pedidosPendientes} órdenes esperan procesamiento`,
                    action: () => navigate("/store/orders"),
                    time: "En espera"
                });
            }

            // 3. Low Stock Warnings
            if (stats.productosStock) {
                const lowStock = stats.productosStock.filter(p => p.cantidad <= (p.stock_minimo || 5));
                lowStock.slice(0, 3).forEach(p => {
                    notifs.push({
                        id: `stock-${p.id}-${p.cantidad}`,
                        type: "warning",
                        icon: AlertTriangle,
                        title: "ALERTA DE INVENTARIO",
                        message: `${p.nombre} está por agotarse (${p.cantidad} uds)`,
                        action: () => navigate(`/store/compras?productId=${p.id}`),
                        time: "Revisar"
                    });
                });
            }

            // 4. Recent Sales
            if (stats.actividadReciente) {
                stats.actividadReciente.slice(0, 2).forEach(activity => {
                    if (activity.tipo === 'venta') {
                        notifs.push({
                            id: `sale-${activity.id || activity.fecha}`,
                            type: "success",
                            icon: TrendingUp,
                            title: "NUEVA TRANSACCIÓN",
                            message: `${activity.descripcion} - $${parseFloat(activity.monto).toFixed(2)}`,
                            action: () => navigate("/store/ventas"),
                            time: formatTimeAgo(activity.fecha)
                        });
                    }
                });
            }

            // Filter out dismissed notifications
            const filtered = notifs.filter(n => !dismissedIds.includes(n.id));
            setNotifications(filtered);
        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (date) => {
        if (!date) return "Reciente";
        const diff = Date.now() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Ahora";
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    const dismissNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        const newDismissed = [...dismissedIds, id];
        setDismissedIds(newDismissed);
        localStorage.setItem("dismissed_notifications", JSON.stringify(newDismissed));
    };

    const clearAll = () => {
        const allIds = notifications.map(n => n.id);
        const newDismissed = [...new Set([...dismissedIds, ...allIds])];
        setDismissedIds(newDismissed);
        localStorage.setItem("dismissed_notifications", JSON.stringify(newDismissed));
        setNotifications([]);
    };

    const unreadCount = notifications.length;

    const getTypeStyles = (type) => {
        switch (type) {
            case "success":
                return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
            case "warning":
                return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20";
            case "error":
                return "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20";
            case "info":
                return "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20";
            default:
                return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Bell button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative"
                aria-label="Notificaciones"
            >
                <Bell size={20} className="text-slate-500 dark:text-slate-400" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-4 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 ring-4 ring-slate-200/50 dark:ring-black/20 animate-in fade-in zoom-in duration-200 slide-in-from-top-2">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-sm">Centro de Alertas</h3>
                        {notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest flex items-center gap-1.5"
                            >
                                <Trash2 size={12} />
                                Limpiar
                            </button>
                        )}
                    </div>

                    {/* Notifications list */}
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-10 text-center">
                                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sincronizando...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                                    <Bell size={28} />
                                </div>
                                <p className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Sin Novedades</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-1 max-w-[150px] mx-auto leading-relaxed">Todo el sistema opera con normalidad tras la última revisión.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const Icon = notif.icon;
                                return (
                                    <div
                                        key={notif.id}
                                        className="relative group flex items-start gap-4 p-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                    >
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${getTypeStyles(notif.type)}`}>
                                            <Icon size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{notif.title}</p>
                                                <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded">{notif.time}</span>
                                            </div>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{notif.message}</p>
                                            {notif.action && (
                                                <button
                                                    onClick={() => { notif.action(); setIsOpen(false); }}
                                                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-wider mt-3 flex items-center gap-1 group/btn"
                                                >
                                                    Gestionar Inmediatamente <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                                            className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                            <button
                                onClick={() => { navigate("/store"); setIsOpen(false); }}
                                className="w-full py-3 bg-white dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-indigo-200 transition-all shadow-sm"
                            >
                                Panel de Control
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
