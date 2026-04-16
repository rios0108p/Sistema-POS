import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import {
  CircleDollarSignIcon,
  ShoppingBasketIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  TagsIcon,
  PackageIcon,
  CalendarIcon,
  Check,
  PlusCircle,
  ShoppingCart,
  LayoutGrid,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Crown,
  Clock,
  Zap,
  Download,
  Table,
  Store,
  Ticket
} from "lucide-react";
import Loading from "../Components/Common/Loading";
import { dashboardAPI, getImageUrl } from "../services/api";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import { exportDashboardData } from "../utils/exportUtils";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol?.toLowerCase() === 'admin';
  const currency = CURRENCY_SYMBOL;

  // Redirigir si no es admin
  useEffect(() => {
    if (user && !isAdmin) {
      navigate("/store/ventas");
    }
  }, [user, isAdmin]);

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("day"); // DEFAULT HOY
  const [selectedTienda, setSelectedTienda] = useState(""); // empty = Global
  const [selectedTurno, setSelectedTurno] = useState("");
  const [stores, setStores] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const [dashboardData, setDashboardData] = useState({
    totalProducts: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalCost: 0,
    totalOrders: 0,
    averagePrice: 0,
    recentProducts: [],
    outOfStock: 0,
    lowStockProducts: [],
    ventasPorCategoria: [],
    tendenciaVentas: [],
    topProductos: [],
    ingresosVsGastos: [],
    actividadReciente: [],
    mejorProducto: null,
    mejorCategoria: null,
    mejorTienda: null,
    tendencias: { ingresos: 0, ganancia: 0, ventas: 0 }
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const stats = await dashboardAPI.getStats(timeRange, selectedTienda, selectedTurno);
      setDashboardData({
        totalProducts: stats.totalProductos || 0,
        totalRevenue: stats.financiero?.ingresos || 0,
        totalProfit: stats.financiero?.ganancia_neta || 0,
        totalGrossProfit: stats.financiero?.ganancia_bruta || 0,
        totalExpenses: stats.financiero?.gastos || 0,
        totalCost: stats.financiero?.costo || 0,
        totalOrders: stats.totalVentas?.cantidad || 0,
        averagePrice: stats.totalVentas?.cantidad > 0
          ? stats.financiero?.ingresos / stats.totalVentas.cantidad
          : 0,
        recentProducts: stats.productosStock?.slice(0, 5) || [],
        outOfStock: stats.bajoStock || 0,
        lowStockProducts: stats.productosStock?.filter(p => (Number(p.cantidad) <= (p.stock_minimo || 5))) || [],
        ventasPorCategoria: stats.ventasPorCategoria || [],
        tendenciaVentas: stats.tendenciaVentas || [],
        topProductos: stats.topProductos || [],
        ingresosVsGastos: stats.ingresosVsGastos || [],
        actividadReciente: stats.actividadReciente || [],
        mejorProducto: stats.mejorProducto || null,
        mejorCategoria: stats.mejorCategoria || null,
        mejorTienda: stats.mejorTienda || null,
        tendencias: stats.tendencias || { ingresos: 0, ganancia: 0, ventas: 0 }
      });
    } catch (error) {
      console.error("Error dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilterData = async () => {
    if (!isAdmin) return;
    try {
      const storesData = await dashboardAPI.getTiendas();
      setStores(Array.isArray(storesData) ? storesData : []);

      const turnosData = await dashboardAPI.getTurnosByTienda(selectedTienda);
      setTurnos(Array.isArray(turnosData) ? turnosData : []);
    } catch (e) {
      console.log("Error loading filters");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange, selectedTienda, selectedTurno]);

  useEffect(() => {
    loadFilterData();
  }, [selectedTienda]);

  const formatTimeAgo = (fecha) => {
    const now = new Date();
    const date = new Date(fecha);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora mismo";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString("es-GT");
  };

  if (loading) return <Loading />;
  if (!isAdmin) return null; // Prevenir render si no es admin tras redirección

  const quickActions = [
    { label: "Nueva Venta", icon: ShoppingCart, path: "/store/ventas", color: "from-emerald-500 to-teal-600" },
    { label: "Añadir Producto", icon: PlusCircle, path: "/store/add-product", color: "from-blue-500 to-indigo-600" },
    { label: "Inventario", icon: LayoutGrid, path: "/store/inventarios", color: "from-purple-500 to-pink-600" },
    { label: "Ver Reportes", icon: FileText, path: "/store/ventas", color: "from-orange-500 to-red-600" },
  ];

  const cards = [
    { title: "Total Productos", value: dashboardData.totalProducts, icon: ShoppingBasketIcon, visible: true, trend: null, color: "text-slate-600" },
    { title: "Ingresos Totales", value: `${currency}${dashboardData.totalRevenue.toFixed(2)}`, icon: CircleDollarSignIcon, visible: true, trend: dashboardData.tendencias.ingresos, color: "text-emerald-600" },
    { title: "Gastos Operativos", value: `${currency}${dashboardData.totalExpenses.toFixed(2)}`, icon: TrendingDownIcon, visible: true, trend: dashboardData.tendencias.gastos, color: "text-rose-500" },
    { title: "Utilidad Neta", value: `${currency}${dashboardData.totalProfit.toFixed(2)}`, icon: TrendingUpIcon, visible: true, trend: dashboardData.tendencias.ganancia, color: "text-indigo-600" },
    { title: "Ganancia Bruta", value: `${currency}${dashboardData.totalGrossProfit.toFixed(2)}`, icon: TagsIcon, visible: true, trend: null, color: "text-blue-600" },
    { title: "Ventas Realizadas", value: dashboardData.totalOrders, icon: ShoppingCart, visible: true, trend: dashboardData.tendencias.ventas, color: "text-orange-500" },
    { title: "Bajo Stock", value: dashboardData.outOfStock, icon: PackageIcon, visible: true, trend: null, color: dashboardData.outOfStock > 0 ? "text-red-600" : "text-emerald-600", path: "/store/inventarios?filter=bajoStock" },
  ];

  return (
    <div className="p-3 sm:p-6 mb-28 text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-colors duration-300">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Zap className="text-white" size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none">
              {user?.tienda_nombre || 'Sede Central'} <span className="text-indigo-600 dark:text-indigo-400">/ Dashboard</span>
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] opacity-80 flex items-center gap-2 mt-2">
            <span className="w-6 h-[1.5px] bg-indigo-500/30"></span>
            Operador: <span className="text-slate-600 dark:text-slate-300 ml-1">{user?.username || 'Admin'}</span>
            <span className="mx-2 opacity-30">|</span>
            Rol: <span className="text-indigo-500 ml-1">{user?.rol}</span>
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          {/* Tienda Selector */}
          <div className="relative group min-w-[200px]">
            <div className="absolute left-3 top-2.5 text-slate-400"><Store size={16} /></div>
            <select
              value={selectedTienda}
              onChange={(e) => { setSelectedTienda(e.target.value); setSelectedTurno(""); }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all h-[42px]"
            >
              <option value="">Global (Todas las tiendas)</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {/* Turno Selector */}
          <div className="relative group min-w-[180px]">
            <div className="absolute left-3 top-2.5 text-slate-400"><Ticket size={16} /></div>
            <select
              value={selectedTurno}
              onChange={(e) => setSelectedTurno(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all h-[42px]"
            >
              <option value="">Todos los Turnos</option>
              {turnos.map(t => {
                const date = new Date(t.fecha_apertura);
                const shiftLabel = t.shift_name ? t.shift_name.charAt(0).toUpperCase() + t.shift_name.slice(1).toLowerCase() : "Turno";
                return (
                  <option key={t.id} value={t.id}>
                    {shiftLabel} ({date.toLocaleDateString("es-MX", { day: '2-digit', month: '2-digit' })})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Time Picker */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border dark:border-slate-700 flex items-center h-[42px] min-w-fit">
            {[{ key: "day", label: "Hoy" }, { key: "week", label: "Sem" }, { key: "month", label: "Mes" }, { key: "year", label: "Año" }].map((r) => (
              <button
                key={r.key}
                disabled={!!selectedTurno}
                onClick={() => setTimeRange(r.key)}
                className={`px-4 sm:px-6 h-full rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center ${selectedTurno ? 'opacity-30 cursor-not-allowed' : ''} ${timeRange === r.key && !selectedTurno
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md transform scale-[1.05]"
                  : "text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2.5 min-w-fit">
            <button
              onClick={() => {
                const storeName = selectedTienda ? stores.find(s => s.id == selectedTienda)?.nombre : 'Global';
                exportDashboardData(dashboardData, 'excel', storeName, timeRange);
              }}
              className="h-[40px] px-5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
              title="Exportar a Excel"
            >
              <Table size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Excel</span>
            </button>
            <button
              onClick={() => {
                const storeName = selectedTienda ? stores.find(s => s.id == selectedTienda)?.nombre : 'Global';
                exportDashboardData(dashboardData, 'pdf', storeName, timeRange);
              }}
              className="h-[40px] px-5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group"
              title="Exportar a PDF"
            >
              <FileText size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mb-8">
        <label className="label-standard mb-3 flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          Acciones Rápidas
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => navigate(action.path)}
              className={`bg-gradient-to-r ${action.color} text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] flex items-center gap-3 text-left`}
            >
              <action.icon size={24} />
              <span className="font-bold text-sm sm:text-base leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`card-standard p-5 ${c.path ? 'cursor-pointer hover:scale-[1.02] transition-all hover:shadow-indigo-500/10' : ''}`}
            onClick={() => c.path && navigate(c.path)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{c.title}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                {c.trend !== null && (
                  <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${c.trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {c.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span>{Math.abs(c.trend)}%</span>
                  </div>
                )}
              </div>
              <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-700">
                <c.icon className="text-slate-400 dark:text-slate-300" size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DESTACADOS */}
      {(dashboardData.mejorProducto || dashboardData.mejorCategoria) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {dashboardData.mejorProducto && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
              <div className="absolute -right-4 -top-4 opacity-10 rotate-12"><Trophy size={100} /></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <Trophy size={20} />
                <span className="text-sm font-bold uppercase tracking-wider opacity-90">Producto Estrella</span>
              </div>
              <div className="flex items-center gap-5 relative z-10">
                {dashboardData.mejorProducto.imagenes?.length > 0 ? (
                  <img src={getImageUrl(dashboardData.mejorProducto.imagenes[0])} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-md" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center"><PackageIcon size={32} /></div>
                )}
                <div>
                  <p className="text-xl font-bold leading-tight">{dashboardData.mejorProducto.nombre}</p>
                  <p className="text-sm font-medium opacity-80 mt-1">{dashboardData.mejorProducto.unidades} unidades vendidas</p>
                  <p className="text-2xl font-bold mt-1 leading-none">{currency}{parseFloat(dashboardData.mejorProducto.total).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          {dashboardData.mejorTienda && (
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
              <div className="absolute -right-4 -top-4 opacity-10 rotate-12"><Store size={100} /></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <Store size={20} />
                <span className="text-sm font-bold uppercase tracking-wider opacity-90">Mejor Tienda</span>
              </div>
              <div className="relative z-10">
                <p className="text-2xl font-bold leading-tight text-white mb-1 uppercase tracking-tighter">{dashboardData.mejorTienda.nombre}</p>
                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-sm font-medium opacity-80">{dashboardData.mejorTienda.ventas} ventas completadas</p>
                    <p className="text-2xl font-bold">{currency}{parseFloat(dashboardData.mejorTienda.total).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter">Ranking #1</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card-standard p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Tendencia de Ingresos</h2>
            <TrendingUpIcon size={20} className="text-slate-200" />
          </div>
          <div className="h-[280px] w-full">
            {dashboardData.tendenciaVentas?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.tendenciaVentas}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickFormatter={(val) => `${currency}${val}`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <TrendingUpIcon size={40} className="opacity-10" />
                <p className="text-sm font-bold opacity-30">Distribución de ingresos no disponible</p>
              </div>
            )}
          </div>
        </div>

        <div className="card-standard p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Ingresos vs Gastos</h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold uppercase text-slate-400">Ingresos</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[10px] font-bold uppercase text-slate-400">Gastos</span></div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            {dashboardData.ingresosVsGastos?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.ingresosVsGastos}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickFormatter={(val) => `${currency}${val}`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={4} dot={false} />
                  <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <TrendingUpIcon size={40} className="opacity-10" />
                <p className="text-sm font-bold opacity-30">Comparativa no disponible</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVIDAD Y ALERTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card-standard p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tighter"><Clock size={20} className="text-slate-300" /> Historial Reciente</h2>
            <button onClick={() => navigate('/store/history')} className="text-[10px] font-bold uppercase text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">Ver Todo</button>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {dashboardData.actividadReciente?.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${item.tipo === 'venta' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>
                  {item.tipo === 'venta' ? <TrendingUpIcon size={22} /> : <TrendingDownIcon size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate uppercase tracking-tighter">{item.descripcion}</p>
                    <span className={`text-sm font-bold ${item.tipo === 'venta' ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {item.tipo === 'venta' ? '+' : '-'}{currency}{parseFloat(item.monto).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge-${item.tipo === 'venta' ? 'success' : 'warning'}`}>{item.tipo}</span>
                    <span className="text-[11px] font-bold text-slate-400">{formatTimeAgo(item.fecha)} • {item.usuario || 'Sistema'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-standard p-8">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-tighter">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div> Reabastecimiento Crítico
          </h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {dashboardData.lowStockProducts?.length > 0 ? (
              dashboardData.lowStockProducts.map((p) => (
                <div key={`${p.id}-${p.tienda_id}`} className="p-4 flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-red-200 dark:hover:border-red-900 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => navigate(`/store/add-product?id=${p.id}`)}>
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border">
                      {p.images?.length > 0 ? <img src={getImageUrl(p.images[0])} alt="" className="w-full h-full object-cover" /> : <PackageIcon size={20} className="text-slate-300" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight uppercase tracking-tighter">{p.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{p.categoria}</p>
                        {p.tienda_nombre && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-tighter">{p.tienda_nombre}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${Number(p.cantidad) <= 0 ? 'text-red-600' : 'text-amber-500'}`}>{p.cantidad}</p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase leading-none">Min: {p.stock_minimo || 5}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const cantPedir = Math.max(1, (p.stock_minimo || 5) * 2 - Number(p.cantidad || 0));
                        navigate(`/store/orders?newOrder=true&productId=${p.id}&tiendaId=${p.tienda_id || ''}&cantidad=${cantPedir}`);
                      }}
                      className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                      title="Generar Pedido"
                    >
                      <ShoppingCart size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                <div className="p-4 rounded-full bg-emerald-50 text-emerald-500"><Check size={32} /></div>
                <p className="text-sm font-bold uppercase">Inventario Óptimo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center text-[10px] font-bold uppercase text-slate-400 bg-white dark:bg-slate-800 py-2 px-6 rounded-full border border-slate-100 dark:border-slate-700 w-fit ml-auto shadow-sm">
        <CalendarIcon size={12} className="mr-2" />
        Sincronizado: {new Date().toLocaleDateString("es-GT")}
      </div>
    </div>
  );
}
