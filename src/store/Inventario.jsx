import { useEffect, useState, useRef, useMemo, memo } from "react";
import React from "react";
import { List } from 'react-window';

import { productosAPI, getImageUrl, tiendasAPI } from "../services/api";
import { Search, Package, RefreshCw, ShoppingCart, ChevronDown, ChevronRight, Store, LayoutGrid, BarChart3, AlertTriangle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { FileText, Table as TableIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Info, Settings2, Trash2, Edit3, CheckCircle2 } from "lucide-react";
import PinValidationModal from "./components/PinValidationModal";
import { toast } from "react-hot-toast";

import { useProductos } from "../hooks/queries/useProductos";
import { useTiendas } from "../hooks/queries/useTiendas";
import { useInventarioMutations } from "../hooks/queries/useInventarioMutations";
// import { ajustesAPI } from "../services/api"; // Replaced by mutation hook

// Componente de Fila Virtualizada (Memoized para rendimiento)
const InventoryRow = memo(({ index, style, data }) => {
  const { items, handlers, utils } = data;
  const p = items[index];
  const { currency, estadoStock } = utils;
  const estado = estadoStock(p.stockReal, p.stock_minimo);

  return (
    <div style={style} className="flex items-center border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
      {/* Col 1: ID/Name */}
      <div className="w-[30%] px-6 py-2 flex items-center gap-3 overflow-hidden">
        {p.variaciones?.length > 0 && (
          <button
            onClick={() => handlers.handleVerVariaciones(p)}
            className="p-1.5 shrink-0 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-500 rounded-lg transition-all"
            title="Ver Variaciones"
          >
            <LayoutGrid size={14} />
          </button>
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-800 dark:text-white uppercase tracking-tight text-sm truncate" title={p.nombre}>{p.nombre}</span>
          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-widest mt-0.5 truncate">{p.categoria}</span>
        </div>
      </div>

      {/* Col 2: Stock Level */}
      <div className="w-[15%] px-2 py-2 flex flex-col items-center justify-center">
        <span className={`text-sm font-bold tracking-tighter ${p.stockReal <= (p.stock_minimo || 5) ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>
          {p.stockReal}
        </span>
        <div className="w-12 h-1 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full transition-all ${p.stockReal <= (p.stock_minimo || 5) ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, (p.stockReal / (p.stock_minimo * 2 || 10)) * 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Col 3: Costo */}
      <div className="w-[10%] px-2 py-2 font-bold text-slate-400 text-xs text-center">
        {currency}{p.precio_compra.toFixed(2)}
      </div>

      {/* Col 4: Venta */}
      <div className="w-[10%] px-2 py-2 text-center">
        <span className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">{currency}{p.precio_venta.toFixed(2)}</span>
      </div>

      {/* Col 5: Oferta */}
      <div className="w-[10%] px-2 py-2 text-center">
        {p.precio_oferta ? (
          <div className="flex flex-col items-center">
            <span className="text-emerald-500 dark:text-emerald-400 font-bold text-xs">{currency}{p.precio_oferta.toFixed(2)}</span>
            <span className="text-[8px] font-bold text-emerald-500/50 uppercase tracking-tighter">Oferta</span>
          </div>
        ) : (
          <span className="text-slate-200 dark:text-slate-700 font-bold text-xs">---</span>
        )}
      </div>

      {/* Col 6: Estado */}
      <div className="w-[10%] px-2 py-2 text-center">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border opacity-80 ${estado.color} w-full truncate`}>
          {estado.text}
        </span>
      </div>

      {/* Col 7: Acciones */}
      <div className="w-[15%] px-6 py-2 flex justify-center">
        <button
          onClick={() => handlers.handleAjustar(p)}
          className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
          title="Ajustar Stock"
        >
          <Settings2 size={16} />
        </button>
      </div>
    </div>
  );
});

const Inventario = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currency = CURRENCY_SYMBOL;

  // State
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(user?.rol === 'admin' ? "" : user?.tienda_id);
  const [viewMode, setViewMode] = useState("table"); // "table" or "charts"
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const location = useLocation();
  const [busqueda, setBusqueda] = useState("");
  const [urlFilter, setUrlFilter] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('filter') || "";
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    if (filter) setUrlFilter(filter);
  }, [location.search]);

  // React Query Hooks
  const {
    data: productos = [],
    isLoading: isLoadingProductos,
    refetch: refetchProductos
  } = useProductos(tiendaSeleccionada, user);

  const { data: tiendasData = [] } = useTiendas(user);

  const { realizarAjuste } = useInventarioMutations();

  const [variacionesModal, setVariacionesModal] = useState({ open: false, producto: null });

  // Ajuste de Stock
  const [ajusteModal, setAjusteModal] = useState({ open: false, producto: null, variacion: null });
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("CORRECCION");
  const [notasAjuste, setNotasAjuste] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);

  // Success handler for adjustment
  const handleConfirmarAjuste = async (authorizedUser) => {
    try {
      if (!nuevaCantidad || isNaN(nuevaCantidad)) {
        toast.error("Ingresa una cantidad válida");
        return;
      }

      if (user?.rol === 'admin' && !tiendaSeleccionada) {
        toast.error("Selecciona una sucursal para realizar el ajuste");
        return;
      }

      const loadingToast = toast.loading("Registrando ajuste...");
      await realizarAjuste.mutateAsync({
        producto_id: ajusteModal.producto.id,
        variacion_id: ajusteModal.variacion?.id,
        tienda_id: user?.rol === 'admin' ? tiendaSeleccionada : user?.tienda_id,
        cantidad_nueva: parseInt(nuevaCantidad),
        motivo: motivoAjuste,
        notas: notasAjuste,
        usuario_id: authorizedUser?.id || user?.id
      });

      const authorName = authorizedUser?.nombre || authorizedUser?.username || user?.nombre || 'Usuario';
      toast.success(`Ajuste registrado por: ${authorName}`, { id: loadingToast });

      setAjusteModal({ open: false, producto: null, variacion: null });
      setNuevaCantidad("");
      setNotasAjuste("");
      setShowPinModal(false);
    } catch (error) {
      toast.error(error.message || "Error al ajustar inventario");
    }
  };

  const searchInputRef = useRef(null);



  // Shortcuts keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        refetchProductos();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refetchProductos]);


  const productosFiltrados = useMemo(() => {
    let base = productos.filter((p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    if (urlFilter === 'bajoStock') {
      base = base.filter(p => p.stockReal <= (p.stock_minimo || 5));
    } else if (urlFilter === 'agotado') {
      base = base.filter(p => p.stockReal <= 0);
    }

    return base;
  }, [productos, busqueda, urlFilter]);

  /* Removed toggleExpandir in favor of Modal */

  /* Stats Memoized - Use all products for totals, not filtered */
  const stats = useMemo(() => {
    const total = productos.reduce((acc, p) => acc + p.stockReal, 0);
    const inversion = productos.reduce((acc, p) => acc + (p.precio_compra * p.stockReal), 0);
    const bajoStock = productos.filter(p => p.stockReal <= (p.stock_minimo || 5)).length;
    const agotados = productos.filter(p => p.stockReal <= 0).length;
    const categorias = [...new Set(productos.map(p => p.categoria))].filter(Boolean);

    return { total, inversion, bajoStock, agotados, categorias };
  }, [productos]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    let base = productosFiltrados;
    if (categoriaFiltro) {
      base = base.filter(p => p.categoria === categoriaFiltro);
    }

    return base
      .sort((a, b) => b.stockReal - a.stockReal)
      .slice(0, 15) // Limit to top items for chart readability
      .map(p => ({
        name: p.nombre.length > 20 ? p.nombre.substring(0, 20) + '...' : p.nombre,
        stock: p.stockReal,
        min: p.stock_minimo || 5,
        fullName: p.nombre,
        categoria: p.categoria
      }));
  }, [productosFiltrados, categoriaFiltro]);

  const estadoStock = (cantidad, minimo = 5) => {
    if (cantidad <= 0) return { text: "AGOTADO", color: "badge-danger" };
    if (cantidad <= minimo) return { text: "CRÍTICO", color: "badge-warning" };
    return { text: "OK", color: "badge-success" };
  };

  const handleExportExcel = () => {
    const dataToExport = productosFiltrados.map(p => ({
      Producto: p.nombre,
      Categoría: p.categoria,
      Stock: p.stockReal,
      'Precio Compra': p.precio_compra,
      'Precio Venta': p.precio_venta,
      Estado: estadoStock(p.stockReal, p.stock_minimo).text
    }));
    exportToExcel(dataToExport, `Inventario_${tiendaSeleccionada || 'General'}`, 'Inventario');
  };

  const handleExportPDF = () => {
    const headers = ['Producto', 'Categoría', 'Stock', 'P. Compra', 'P. Venta', 'Estado'];
    const data = productosFiltrados.map(p => [
      p.nombre,
      p.categoria,
      p.stockReal.toString(),
      `${currency}${p.precio_compra.toFixed(2)}`,
      `${currency}${p.precio_venta.toFixed(2)}`,
      estadoStock(p.stockReal, p.stock_minimo).text
    ]);
    exportToPDF({
      title: `Reporte de Inventario - ${tiendaSeleccionada ? 'Sucursal' : 'Almacén Central'}`,
      headers,
      data,
      fileName: 'Reporte_Inventario'
    });
  };

  return (
    <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Package className="text-white" size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none">
              CONTROL DE <span className="text-indigo-600 dark:text-indigo-400">INVENTARIO</span>
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] opacity-80 flex items-center gap-2 mt-2">
            <span className="w-6 h-[1.5px] bg-indigo-500/30"></span>
            Gestión de existencias por sucursal
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* View Toggles */}
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700 shadow-sm mr-2">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title="Vista de Tabla"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode("charts")}
              className={`p-2 rounded-lg transition-all ${viewMode === 'charts' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title="Vista Gráfica (Dashboard)"
            >
              <BarChart3 size={18} />
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportExcel}
              className="h-[40px] px-5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
            >
              <TableIcon size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">EXCEL</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="h-[40px] px-5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group"
            >
              <FileText size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Store Selector */}
      {user?.rol === 'admin' && (
        <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-xs tracking-widest shrink-0">
            <Store size={20} /> FILTRAR POR TIENDA:
          </div>
          <div className="grid grid-cols-2 sm:flex flex-wrap gap-2 w-full">
            <button
              onClick={() => setTiendaSeleccionada("")}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border
                ${tiendaSeleccionada === ""
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-transparent hover:border-slate-200'}
              `}
            >
              ALMACÉN CENTRAL
            </button>
            {tiendasData.map(t => (
              <button
                key={t.id}
                onClick={() => setTiendaSeleccionada(t.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border
                  ${tiendaSeleccionada === t.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-transparent hover:border-slate-200'}
                `}
              >
                {t.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card-standard p-5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Total</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total}</div>
        </div>
        {user?.rol === 'admin' && (
          <div className="card-standard p-5 relative group">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              VALOR STOCK (COSTO)
              <div className="relative">
                <Info size={10} className="text-slate-300 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-[9px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center font-bold uppercase tracking-tighter">
                  Dinero total invertido basado en el precio de compra.
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-500">{currency}{stats.inversion.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
        )}
        <div
          className={`card-standard p-5 cursor-pointer hover:scale-[1.02] transition-all ${urlFilter === 'bajoStock' ? 'ring-2 ring-amber-500 shadow-amber-500/20' : ''}`}
          onClick={() => setUrlFilter(urlFilter === 'bajoStock' ? "" : 'bajoStock')}
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bajo Stock</div>
          <div className="text-2xl font-bold text-amber-500 flex items-center gap-2">{stats.bajoStock} <AlertTriangle size={18} /></div>
        </div>
        <div
          className={`card-standard p-5 cursor-pointer hover:scale-[1.02] transition-all ${urlFilter === 'agotado' ? 'ring-2 ring-rose-500 shadow-rose-500/20' : ''}`}
          onClick={() => setUrlFilter(urlFilter === 'agotado' ? "" : 'agotado')}
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Agotados</div>
          <div className="text-2xl font-bold text-rose-500">{stats.agotados}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mb-8">
        <div className="relative">
          <div className="flex justify-between items-center mb-2 px-1">
            <label className="label-standard">Filtrar por nombre</label>
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border dark:border-slate-700 opacity-50">F2</span>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-3.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              ref={searchInputRef}
              placeholder="Buscar en esta sucursal..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input-standard pl-10"
            />
          </div>
        </div>


      </div>

      {viewMode === 'table' ? (
        <div className="overflow-hidden rounded-2xl border dark:border-slate-700/50 shadow-xl bg-white dark:bg-slate-800 transition-all animate-in fade-in duration-300 flex flex-col h-[calc(100vh-280px)]">
          {/* Virtualized List Header - Matches Row Widths */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="w-[30%] px-6 py-4"> Producto</div>
            <div className="w-[15%] px-2 py-4 text-center">Stock</div>
            <div className="w-[10%] px-2 py-4 text-center">Costo</div>
            <div className="w-[10%] px-2 py-4 text-center">Venta</div>
            <div className="w-[10%] px-2 py-4 text-center">Oferta</div>
            <div className="w-[10%] px-2 py-4 text-center">Estado</div>
            <div className="w-[15%] px-6 py-4 text-center">Acciones</div>
          </div>

          <div className="flex-1">
            <List
              style={{ width: '100%', height: '100%' }}
              rowCount={productosFiltrados.length}
              rowHeight={70}
              rowComponent={InventoryRow}
              rowProps={{
                data: {
                  items: productosFiltrados,
                  handlers: {
                    handleAjustar: (p) => setAjusteModal({ open: true, producto: p, variacion: null }),
                    handleVerVariaciones: (p) => setVariacionesModal({ open: true, producto: p })
                  },
                  utils: { currency, estadoStock }
                }
              }}
            />
          </div>
        </div>
      ) : (
        <div className="card-standard min-h-[400px] animate-in fade-in zoom-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl text-indigo-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Análisis Visual de Existencias</h2>
                <p className="text-xs text-slate-400">Cantidades precisas filtradas por categoría</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border dark:border-slate-700">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">Categoría:</span>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="bg-white dark:bg-slate-800 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 dark:text-slate-200"
              >
                <option value="">TODAS LAS CATEGORÍAS</option>
                {stats.categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  fontSize={10}
                  fontWeight="bold"
                  stroke="#94A3B8"
                  height={60}
                />
                <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px', fontWeight: 'bold' }}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  formatter={(value, name, props) => [`${value} Unidades`, 'Stock Actual']}
                  labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                />
                <Bar dataKey="stock" radius={[6, 6, 0, 0]} barSize={35} animationDuration={1000}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.stock <= entry.min ? '#F43F5E' : '#6366F1'} />
                  ))}
                  <LabelList
                    dataKey="stock"
                    position="top"
                    fill="#94A3B8"
                    fontSize={11}
                    fontWeight="black"
                    formatter={(val) => val === 0 ? '' : val}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {productosFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/20 rounded-3xl mt-4 border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Package size={64} className="text-slate-200 dark:text-slate-800 mb-4" />
          <p className="text-slate-400 dark:text-slate-600 font-bold ">No se encontraron productos en esta consulta.</p>
        </div>
      )}
      {/* Modal de Ajuste de Stock */}
      {ajusteModal.open && (
        <div className="modal-overlay">
          <div className="modal-container">
            <h2 className="modal-header text-xl mb-2">
              Ajustar <span className="text-indigo-600">Stock</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-6 uppercase tracking-widest">
              {ajusteModal.producto?.nombre} {ajusteModal.variacion ? `(${ajusteModal.variacion.nombre})` : ''}
            </p>

            <div className="space-y-5">
              <div>
                <label className="label-standard">Nueva Cantidad</label>
                <input
                  type="number"
                  value={nuevaCantidad}
                  onChange={(e) => setNuevaCantidad(e.target.value)}
                  placeholder="Ej: 50"
                  className="input-standard text-lg"
                />
              </div>

              <div>
                <label className="label-standard">Motivo del Ajuste</label>
                <select
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                  className="select-standard"
                >
                  <option value="CORRECCION">CORRECCIÓN (ERROR DE CONTEO)</option>
                  <option value="MERMA">MERMA (DAÑADO/VENCIDO)</option>
                  <option value="PERDIDA">PÉRDIDA (ROBO/FALTANTE)</option>
                  <option value="OTRO">OTRO MOTIVO</option>
                </select>
              </div>

              <div>
                <label className="label-standard">Notas adicionales</label>
                <textarea
                  value={notasAjuste}
                  onChange={(e) => setNotasAjuste(e.target.value)}
                  placeholder="Opcional..."
                  className="textarea-standard h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setAjusteModal({ open: false, producto: null, variacion: null })}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (user?.rol === 'admin') {
                    // Bypas PIN for admins
                    handleConfirmarAjuste();
                  } else {
                    setShowPinModal(true);
                  }
                }}
                className="btn-primary flex-1"
              >
                {user?.rol === 'admin' ? 'Confirmar Ajuste' : 'Confirmar con PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Validation */}
      <PinValidationModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handleConfirmarAjuste}
        actionName="Ajustar Inventario"
      />
      {/* Modal de Variaciones */}
      {variacionesModal.open && variacionesModal.producto && (
        <div className="modal-overlay">
          <div className="modal-container max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight">Variaciones de <span className="text-indigo-600">{variacionesModal.producto.nombre}</span></h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Gestión de stock detallado</p>
              </div>
              <button
                onClick={() => setVariacionesModal({ open: false, producto: null })}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
              {variacionesModal.producto.variaciones?.map(v => {
                const estadoV = estadoStock(v.stock, variacionesModal.producto.stock_minimo);
                return (
                  <div key={v.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{v.atributo}</span>
                      <span className="font-bold text-slate-800 dark:text-white uppercase">{v.nombre}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Stock</span>
                        <span className="font-black text-lg">{v.stock}</span>
                      </div>

                      <div className="text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${estadoV.color}`}>
                          {estadoV.text}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setVariacionesModal({ open: false, producto: null }); // Cerrar este modal
                          setAjusteModal({ open: true, producto: variacionesModal.producto, variacion: v }); // Abrir ajuste
                        }}
                        className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="Ajustar Stock de esta variación"
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setVariacionesModal({ open: false, producto: null })}
                className="btn-primary"
              >
                Cerrar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Local Error Boundary for debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center">
          <h1 className="text-xl font-bold text-rose-500 mb-4">Algo salió mal en el Inventario</h1>
          <pre className="text-left bg-slate-100 p-4 rounded text-xs overflow-auto max-h-96">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.error && this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded">
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function InventarioWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Inventario />
    </ErrorBoundary>
  );
}
