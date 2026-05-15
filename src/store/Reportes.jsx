import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  FileText, Download, TrendingUp, TrendingDown, ShoppingCart,
  DollarSign, BarChart2, PieChart as PieIcon, Trophy,
  Calendar, RefreshCw, FileSpreadsheet, Ticket, Package, Wallet,
  ArrowDownCircle, ArrowUpCircle, Layers
} from "lucide-react";
import { dashboardAPI, ventasAPI } from "../services/api";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { CURRENCY_SYMBOL } from "../utils/currency";
import Loading from "../Components/Common/Loading";

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

const RANGE_LABELS = { day: 'Hoy', week: 'Esta Semana', month: 'Este Mes', year: 'Este Año' };

function KpiCard({ title, value, icon: Icon, color, trend, prefix = '' }) {
  const isPositive = parseFloat(trend) >= 0;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-white">{prefix}{value}</div>
      {trend !== undefined && trend !== null && (
        <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? '+' : ''}{parseFloat(trend).toFixed(1)}% vs período anterior
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 text-xs">
      <p className="font-black text-slate-500 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? `${CURRENCY_SYMBOL}${p.value.toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Reportes() {
  const currency = CURRENCY_SYMBOL;

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("month");
  const [selectedTienda, setSelectedTienda] = useState("");
  const [selectedTurno, setSelectedTurno] = useState("");
  const [stores, setStores] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(false);

  const [data, setData] = useState({
    ingresos: 0, gastos: 0, gastos_operativos: 0, compras: 0,
    utilidad: 0, ganancia_bruta: 0, costo: 0, totalVentas: 0, ticketPromedio: 0,
    tendencias: { ingresos: 0, ganancia: 0, ventas: 0, gastos: 0, compras: 0 },
    tendenciaVentas: [], ventasPorCategoria: [], topProductos: [],
    ingresosVsGastos: [], mejorProducto: null, mejorCategoria: null
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const stats = await dashboardAPI.getStats(timeRange, selectedTienda, selectedTurno);
      if (!stats) return;
      setData({
        ingresos:          stats.financiero?.ingresos || 0,
        gastos:            stats.financiero?.gastos || 0,
        gastos_operativos: stats.financiero?.gastos_operativos ?? stats.financiero?.gastos ?? 0,
        compras:           stats.financiero?.compras || 0,
        utilidad:          stats.financiero?.ganancia_neta || 0,
        ganancia_bruta:    stats.financiero?.ganancia_bruta || 0,
        costo:             stats.financiero?.costo || 0,
        totalVentas:       stats.totalVentas?.cantidad || 0,
        ticketPromedio:    stats.totalVentas?.cantidad > 0
          ? (stats.financiero?.ingresos || 0) / stats.totalVentas.cantidad : 0,
        tendencias:        stats.tendencias || { ingresos: 0, ganancia: 0, ventas: 0, gastos: 0, compras: 0 },
        tendenciaVentas:   stats.tendenciaVentas || [],
        ventasPorCategoria: stats.ventasPorCategoria || [],
        topProductos:      stats.topProductos || [],
        ingresosVsGastos:  stats.ingresosVsGastos || [],
        mejorProducto:     stats.mejorProducto || null,
        mejorCategoria:    stats.mejorCategoria || null,
      });
    } catch (e) {
      console.error("Error reportes:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVentas = async () => {
    setLoadingVentas(true);
    try {
      const params = {};
      if (selectedTienda) params.tienda_id = selectedTienda;
      if (selectedTurno)  params.turno_id  = selectedTurno;
      const result = await ventasAPI.getAll(Object.keys(params).length ? params : null);
      setVentas(Array.isArray(result) ? result.slice(0, 100) : []);
    } catch (e) {
      setVentas([]);
    } finally {
      setLoadingVentas(false);
    }
  };

  const loadFilters = async () => {
    try {
      const s = await dashboardAPI.getTiendas();
      setStores(Array.isArray(s) ? s : []);
      const t = await dashboardAPI.getTurnosByTienda(selectedTienda);
      setTurnos(Array.isArray(t) ? t : []);
    } catch (_) {}
  };

  useEffect(() => { fetchData(); fetchVentas(); }, [timeRange, selectedTienda, selectedTurno]);
  useEffect(() => { loadFilters(); }, [selectedTienda]);

  const handleExcelVentas = () => {
    if (!ventas.length) return;
    const rows = ventas.map(v => ({
      'Ticket':        v.ticket_numero || '-',
      'Fecha':         v.fecha ? new Date(v.fecha).toLocaleString('es-MX') : '-',
      'Cliente':       v.cliente_nombre || 'Público General',
      'Método Pago':   v.metodo_pago || '-',
      'Total':         `${currency}${parseFloat(v.total || 0).toFixed(2)}`,
      'Estado':        v.estado || '-',
    }));
    exportToExcel(rows, `Reporte_Ventas_${timeRange}`, 'Ventas');
  };

  const handlePDFVentas = () => {
    if (!ventas.length) return;
    const tiendaNombre = stores.find(s => String(s.id) === String(selectedTienda))?.nombre || 'Todas las tiendas';
    exportToPDF({
      title: `Reporte de Ventas — ${RANGE_LABELS[timeRange]} — ${tiendaNombre}`,
      headers: ['Ticket', 'Fecha', 'Cliente', 'Método', 'Total', 'Estado'],
      data: ventas.map(v => [
        v.ticket_numero || '-',
        v.fecha ? new Date(v.fecha).toLocaleDateString('es-MX') : '-',
        v.cliente_nombre || 'Público General',
        v.metodo_pago || '-',
        `${currency}${parseFloat(v.total || 0).toFixed(2)}`,
        v.estado || '-',
      ]),
      fileName: `Reporte_Ventas_${timeRange}`,
      orientation: 'landscape'
    });
  };

  const handleExcelResumen = () => {
    const rows = [
      { Concepto: 'Ingresos Brutos',      Valor: data.ingresos.toFixed(2) },
      { Concepto: 'Costo de Ventas',      Valor: data.costo.toFixed(2) },
      { Concepto: 'Ganancia Bruta',       Valor: data.ganancia_bruta.toFixed(2) },
      { Concepto: 'Compras Inventario',   Valor: data.compras.toFixed(2) },
      { Concepto: 'Gastos Operativos',    Valor: data.gastos_operativos.toFixed(2) },
      { Concepto: 'Egresos Totales',      Valor: data.gastos.toFixed(2) },
      { Concepto: 'Utilidad Neta',        Valor: data.utilidad.toFixed(2) },
      { Concepto: 'Ventas Realizadas',    Valor: data.totalVentas },
      { Concepto: 'Ticket Promedio',      Valor: data.ticketPromedio.toFixed(2) },
      ...data.topProductos.map((p, i) => ({ Concepto: `Top ${i+1}: ${p.nombre}`, Valor: `${p.cantidad_vendida} uds / ${currency}${parseFloat(p.total_generado || 0).toFixed(2)}` }))
    ];
    exportToExcel(rows, `Resumen_${timeRange}`, 'Resumen');
  };

  if (loading) return <Loading />;

  const tiendaNombre = stores.find(s => String(s.id) === String(selectedTienda))?.nombre || 'Global';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg shadow-orange-500/20">
            <FileText size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Reportes</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Análisis y estadísticas — {tiendaNombre}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExcelResumen}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={() => { fetchData(); fetchVentas(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 items-center">
        {/* Period */}
        <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 gap-1">
          {Object.entries(RANGE_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setTimeRange(key)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                timeRange === key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tienda */}
        {stores.length > 0 && (
          <select value={selectedTienda} onChange={e => { setSelectedTienda(e.target.value); setSelectedTurno(""); }}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todas las tiendas</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}

        {/* Turno */}
        {turnos.length > 0 && (
          <select value={selectedTurno} onChange={e => setSelectedTurno(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los turnos</option>
            {turnos.map(t => (
              <option key={t.id} value={t.id}>
                Turno #{t.id} — {t.estado} {t.fecha_apertura ? `(${new Date(t.fecha_apertura).toLocaleDateString('es-MX')})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard title="Ingresos"       value={`${currency}${data.ingresos.toFixed(2)}`}            icon={DollarSign}    color="bg-emerald-500"  trend={data.tendencias.ingresos} />
        <KpiCard title="Egresos Total"  value={`${currency}${data.gastos.toFixed(2)}`}              icon={TrendingDown}  color="bg-rose-500"     trend={data.tendencias.gastos} />
        <KpiCard title="Compras Inv."   value={`${currency}${data.compras.toFixed(2)}`}             icon={Package}       color="bg-amber-500"    trend={data.tendencias.compras} />
        <KpiCard title="Gastos Op."     value={`${currency}${data.gastos_operativos.toFixed(2)}`}   icon={Wallet}        color="bg-orange-500"   trend={null} />
        <KpiCard title="Utilidad Neta"  value={`${currency}${data.utilidad.toFixed(2)}`}            icon={TrendingUp}    color="bg-indigo-500"   trend={data.tendencias.ganancia} />
        <KpiCard title="Ventas"         value={data.totalVentas}                                     icon={ShoppingCart}  color="bg-blue-500"     trend={data.tendencias.ventas} />
        <KpiCard title="Ticket Prom."   value={`${currency}${data.ticketPromedio.toFixed(2)}`}      icon={Ticket}        color="bg-purple-500"   trend={null} />
      </div>

      {/* Desglose Financiero P&L */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Layers size={16} className="text-indigo-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Resumen P&L — Estado de Resultados</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-700">
          {[
            { label: 'Ingresos Brutos',    value: data.ingresos,          color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10', icon: ArrowUpCircle },
            { label: 'Costo de Ventas',    value: data.costo,             color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/10',   icon: ArrowDownCircle },
            { label: 'Ganancia Bruta',     value: data.ganancia_bruta,    color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/10',     icon: BarChart2 },
            { label: 'Compras Inventario', value: data.compras,           color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/10',   icon: Package },
            { label: 'Gastos Operativos',  value: data.gastos_operativos, color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-900/10',     icon: Wallet },
            { label: 'Utilidad Neta',      value: data.utilidad,          color: data.utilidad >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400', bg: data.utilidad >= 0 ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'bg-rose-50 dark:bg-rose-900/10', icon: TrendingUp },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className="p-4 flex flex-col gap-2">
              <div className={`self-start p-1.5 rounded-lg ${bg}`}>
                <Icon size={13} className={color} />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              <p className={`text-sm font-black ${color}`}>{currency}{parseFloat(value || 0).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Tendencia Ventas — wide */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-indigo-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Tendencia de Ventas</h3>
          </div>
          {data.tendenciaVentas.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.tendenciaVentas} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} name="Ingresos" />
                <Line type="monotone" dataKey="cantidad" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="Ventas" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-300 dark:text-slate-600">
              <div className="text-center"><BarChart2 size={40} className="mx-auto mb-2 opacity-30" /><p className="text-xs font-bold">Sin datos</p></div>
            </div>
          )}
        </div>

        {/* Ventas por Categoría */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon size={16} className="text-purple-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Por Categoría</h3>
          </div>
          {data.ventasPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.ventasPorCategoria} dataKey="total" nameKey="categoria" cx="50%" cy="50%"
                  outerRadius={80} label={({ categoria, percent }) => `${categoria?.slice(0,8)} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={9}>
                  {data.ventasPorCategoria.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${currency}${parseFloat(v).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-300 dark:text-slate-600">
              <div className="text-center"><PieIcon size={40} className="mx-auto mb-2 opacity-30" /><p className="text-xs font-bold">Sin datos</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ingresos vs Gastos */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-emerald-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Ingresos vs Gastos</h3>
          </div>
          {data.ingresosVsGastos.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.ingresosVsGastos} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" radius={[4,4,0,0]} />
                <Bar dataKey="gastos"   fill="#f43f5e" name="Gastos"   radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-300 dark:text-slate-600">
              <div className="text-center"><BarChart2 size={40} className="mx-auto mb-2 opacity-30" /><p className="text-xs font-bold">Sin datos</p></div>
            </div>
          )}
        </div>

        {/* Top Productos */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Top Productos</h3>
          </div>
          {data.topProductos.length > 0 ? (
            <div className="space-y-2">
              {data.topProductos.slice(0, 7).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center text-white flex-shrink-0 ${
                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-slate-400">{p.cantidad_vendida} uds</p>
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    {currency}{parseFloat(p.total_generado || 0).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
              <div className="text-center"><Trophy size={32} className="mx-auto mb-2 opacity-30" /><p className="text-xs font-bold">Sin datos</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Ventas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-indigo-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Ventas Recientes ({ventas.length})
            </h3>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExcelVentas} disabled={!ventas.length}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-40">
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button onClick={handlePDFVentas} disabled={!ventas.length}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all disabled:opacity-40">
              <Download size={12} /> PDF
            </button>
          </div>
        </div>

        {loadingVentas ? (
          <div className="p-10 text-center text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
            <p className="text-xs font-bold uppercase tracking-widest">Cargando ventas...</p>
          </div>
        ) : ventas.length === 0 ? (
          <div className="p-10 text-center text-slate-300 dark:text-slate-600">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest">No hay ventas en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  {['Ticket', 'Fecha', 'Cajero', 'Cliente', 'Productos', 'Método', 'Total', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {ventas.map((v, i) => (
                  <tr key={v.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-black text-indigo-600 dark:text-indigo-400">#{v.ticket_numero || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {v.fecha ? new Date(v.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{v.cajero_nombre || v.usuario_nombre || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{v.cliente_nombre || 'Público General'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{v.resumen_productos || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                        {v.metodo_pago || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-800 dark:text-white whitespace-nowrap">
                      {currency}{parseFloat(v.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        v.estado === 'COMPLETADA' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        v.estado === 'CANCELADA'  ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                        'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>{v.estado || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
