import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Loading from "../Components/Common/Loading";
import { pedidosAPI, tiendasAPI, productosAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Clock, Package, Truck, CheckCircle, Search,
  User, Printer, X, RefreshCw, FileText,
  Calendar, ShoppingBag, Plus, Trash2, Store,
  Filter, ArrowRight, Layers
} from "lucide-react";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { toast } from "react-hot-toast";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";

const StoreOrders = () => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalCreacionAbierto, setModalCreacionAbierto] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [tiendas, setTiendas] = useState([]);
  const [procesandoIds, setProcesandoIds] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeWeekFilter, setActiveWeekFilter] = useState('this_week');

  const applyWeekFilter = (period) => {
    setActiveWeekFilter(period);
  };

  const getWeekDateRange = (period) => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (period === 'this_week') {
      const day = today.getDay();
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { start: fmt(mon), end: fmt(today) };
    } else if (period === 'last_week') {
      const day = today.getDay();
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 13 : day + 6));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: fmt(mon), end: fmt(sun) };
    } else if (period === 'this_month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(first), end: fmt(today) };
    }
    return null;
  };

  // Estado para nueva solicitud
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    tienda_id: "",
    notas: "",
    productos: [],
    fecha_programada: ""
  });
  const [mostrarProgramados, setMostrarProgramados] = useState(false);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [alertasBajoStock, setAlertasBajoStock] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");

  const currency = CURRENCY_SYMBOL;

  const obtenerDatosBase = async () => {
    try {
      const isAdmin = user?.rol?.toLowerCase() === 'admin';
      if (isAdmin) {
        const [tiendasData, productosData, alertasData] = await Promise.all([
          tiendasAPI.getAll(),
          productosAPI.getAll(),
          tiendasAPI.getAlertasBajoStock()
        ]);
        setTiendas(tiendasData);
        setProductosDisponibles(productosData);
        setAlertasBajoStock(alertasData);
      } else {
        // Vendedores también necesitan la lista de productos para crear solicitudes
        const productosData = await productosAPI.getAll();
        setProductosDisponibles(productosData);
      }
    } catch (error) {
      console.error("Error al obtener datos base:", error);
    }
  };

  const obtenerPedidos = async () => {
    setCargando(true);
    try {
      const isAdmin = user?.rol?.toLowerCase() === 'admin';
      const tiendaIdFiltro = !isAdmin ? user?.tienda_id : "";
      const data = await pedidosAPI.getAll(tiendaIdFiltro, mostrarProgramados);
      setPedidos(data || []);
    } catch (error) {
      console.error("Error al obtener pedidos:", error.message);
      toast.error("Error al sincronizar solicitudes");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerPedidos();
    obtenerDatosBase();
  }, []);

  // Efecto para detectar parámetros de URL y abrir modal de creación
  useEffect(() => {
    const newOrder = searchParams.get('newOrder');
    const productId = searchParams.get('productId');
    const tiendaId = searchParams.get('tiendaId');
    const cantidad = searchParams.get('cantidad');

    if (newOrder === 'true' && productId && productosDisponibles.length > 0) {
      const prod = productosDisponibles.find(p => p.id == productId);
      if (prod) {
        setModalCreacionAbierto(true);
        setNuevaSolicitud(prev => {
          // Evitar duplicados si el efecto se dispara varias veces
          const existe = prev.productos.find(p => p.producto_id == productId);
          if (existe) return prev;

          return {
            ...prev,
            tienda_id: tiendaId || prev.tienda_id,
            productos: [{
              producto_id: prod.id,
              nombre: prod.nombre,
              cantidad: parseInt(cantidad) || 1,
              precio_unitario: Number(prod.precio_compra) || 0
            }]
          };
        });
        // Limpiar parámetros para no re-abrir al recargar
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, productosDisponibles]);

  // Auto-refresh every 30 seconds, only when online
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) obtenerPedidos();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCrearSolicitud = async () => {
    const tiendaId = nuevaSolicitud.tienda_id || (user?.rol !== 'admin' ? user?.tienda_id : "");
    if (!tiendaId || nuevaSolicitud.productos.length === 0) {
      return toast.error("Debe seleccionar una tienda y al menos un producto");
    }
    if (!nuevaSolicitud.tienda_id && user?.rol !== 'admin') {
      setNuevaSolicitud(prev => ({ ...prev, tienda_id: tiendaId }));
    }

    if (nuevaSolicitud.productos.some(p => (p.cantidad || 0) <= 0)) {
      return toast.error("Todos los productos deben tener una cantidad mayor a 0");
    }

    const subtotal = nuevaSolicitud.productos.reduce((acc, p) => acc + (p.cantidad * p.precio_unitario), 0);

    try {
      await pedidosAPI.create({
        ...nuevaSolicitud,
        tienda_id: tiendaId,
        usuario_solicitante_id: user.id,
        subtotal,
        total: subtotal,
        envio: 0
      });
      toast.success("Solicitud enviada correctamente");
      setModalCreacionAbierto(false);
      setNuevaSolicitud({ tienda_id: "", notas: "", productos: [], fecha_programada: "" });
      obtenerPedidos();
    } catch (error) {
      toast.error("Error al crear solicitud");
    }
  };

  const agregarProductoASolicitud = (prod) => {
    const precioUnitario = Number(prod.precio_compra) || 0;

    setNuevaSolicitud(prev => {
      const existe = prev.productos.find(p => p.producto_id === prod.id);
      if (existe) {
        return {
          ...prev,
          productos: prev.productos.map(p =>
            p.producto_id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p
          )
        };
      }
      return {
        ...prev,
        productos: [...prev.productos, {
          producto_id: prod.id,
          nombre: prod.nombre,
          cantidad: 1,
          precio_unitario: precioUnitario
        }]
      };
    });
  };

  const agregarAlertaASolicitud = (alerta) => {
    setNuevaSolicitud(prev => {
      if (prev.tienda_id && prev.tienda_id != alerta.tienda_id) {
        toast.error(`Esta alerta corresponde a ${alerta.tienda_nombre}. Seleccione la tienda correcta o cree una solicitud nueva.`);
        return prev;
      }

      const precioUnitario = Number(alerta.precio_compra) || 0;
      const existe = prev.productos.find(p => p.producto_id === alerta.producto_id);

      const nuevosProductos = existe
        ? prev.productos.map(p => p.producto_id === alerta.producto_id ? { ...p, cantidad: p.cantidad + 1 } : p)
        : [...prev.productos, {
          producto_id: alerta.producto_id,
          nombre: alerta.producto_nombre,
          cantidad: 1,
          precio_unitario: precioUnitario
        }];

      return {
        ...prev,
        tienda_id: alerta.tienda_id,
        productos: nuevosProductos
      };
    });

    setAlertasBajoStock(prev => prev.filter(a => !(a.producto_id === alerta.producto_id && a.tienda_id === alerta.tienda_id)));
  };

  const actualizarEstadoPedido = async (pedidoId, nuevoEstado) => {
    if (procesandoIds.includes(pedidoId)) return;

    const pedidoActual = pedidos.find(p => p.id === pedidoId);
    const estadoActual = pedidoActual?.estado?.toString().trim().toUpperCase();
    if (estadoActual === 'COMPRADO' || estadoActual === 'CANCELADO') {
      toast.error('Este pedido ya ha sido finalizado');
      return;
    }

    try {
      if (nuevoEstado === 'EN PROCESO') return;
      setProcesandoIds(prev => [...prev, pedidoId]);

      await pedidosAPI.updateEstado(pedidoId, { estado: nuevoEstado, usuario_id: user?.id });

      setPedidos(prevPedidos =>
        prevPedidos.map(p =>
          p.id === pedidoId ? { ...p, estado: nuevoEstado.toUpperCase() } : p
        )
      );

      toast.success(nuevoEstado === 'COMPRADO' ? "Solicitud completada e inventario actualizado" : "Estado actualizado");
      obtenerPedidos();
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      toast.error(error.response?.data?.error || "Error al asignar estado");
      await obtenerPedidos();
    } finally {
      setProcesandoIds(prev => prev.filter(id => id !== pedidoId));
    }
  };

  const eliminarPedido = async (pedidoId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta solicitud permanentemente?")) return;
    try {
      await pedidosAPI.delete(pedidoId);
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
      toast.success("Solicitud eliminada correctamente");
    } catch (error) {
      console.error("Error al eliminar:", error);
      toast.error("Solo se pueden eliminar solicitudes CANCELADAS");
    }
  };

  const exportarPDF = () => {
    const headers = ["ID", "TIENDA/CLIENTE", "SOLICITANTE", "ESTADO", "FECHA", "TOTAL"];
    const data = pedidosFiltrados.map(p => [
      `#${p.id.toString().padStart(5, '0')}`,
      p.tienda_id ? (p.tienda_nombre || `SUCURSAL #${p.tienda_id}`) : p.nombre_cliente,
      p.usuario_nombre || 'SISTEMA',
      p.estado,
      new Date(p.created_at).toLocaleDateString(),
      `${currency}${p.total}`
    ]);
    exportToPDF({ title: 'Gestión de Suministros (Pedidos)', headers, data, fileName: 'Reporte_Suministros' });
  };

  const exportarExcel = () => {
    const dataToExport = pedidosFiltrados.map(p => ({
      'ID': `#${p.id.toString().padStart(5, '0')}`,
      'Tienda/Cliente': p.tienda_id ? (p.tienda_nombre || `SUCURSAL #${p.tienda_id}`) : p.nombre_cliente,
      'Solicitante': p.usuario_nombre || 'SISTEMA',
      'Estado': p.estado,
      'Fecha': new Date(p.created_at).toLocaleDateString(),
      'Total': p.total
    }));
    exportToExcel(dataToExport, 'Reporte_Suministros', 'Pedidos');
  };

  const quitarProductoDeSolicitud = (productoId) => {
    setNuevaSolicitud({
      ...nuevaSolicitud,
      productos: nuevaSolicitud.productos.filter(p => p.producto_id !== productoId)
    });
  };

  const weekRange = getWeekDateRange(activeWeekFilter);

  const pedidosFiltrados = pedidos.filter(p => {
    const cumpleEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    const cumpleTienda = filtroTienda === "todas" || p.tienda_id === parseInt(filtroTienda);
    const cumpleBusqueda = p.id.toString().includes(busqueda) ||
      (p.tienda_nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.usuario_nombre || "").toLowerCase().includes(busqueda.toLowerCase());
    let cumpleSemana = true;
    if (weekRange) {
      // Extract date safely without timezone conversion issues
      const rawDate = p.created_at ? p.created_at.toString() : '';
      const fecha = rawDate.split('T')[0].split(' ')[0];
      cumpleSemana = fecha >= weekRange.start && fecha <= weekRange.end;
    }
    return cumpleEstado && cumpleTienda && cumpleBusqueda && cumpleSemana;
  });

  const getStatusBadgeClass = (estado) => {
    const e = estado?.toLowerCase();
    switch (e) {
      case 'pendiente': return 'badge-standard bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-indigo-100 dark:border-indigo-800/50';
      case 'en proceso': return 'badge-standard bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 border-indigo-200 dark:border-indigo-800/50';
      case 'comprado': return 'badge-standard bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 border-emerald-200 dark:border-emerald-800/50';
      case 'cancelado': return 'badge-standard bg-rose-100 dark:bg-rose-900/30 text-rose-600 border-rose-200 dark:border-rose-800/50';
      default: return 'badge-standard bg-slate-100 dark:bg-slate-900 text-slate-600 border-slate-200';
    }
  };

  if (cargando) return <Loading />;

  return (
    <div className="p-4 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
      <div>
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-xl shadow-indigo-600/20 group hover:rotate-3 transition-transform duration-500">
                <Truck className="text-white" size={28} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase leading-none">
                  LOGÍSTICA DE <span className="text-indigo-600 dark:text-indigo-400">SUMINISTRO</span>
                </h1>
                <p className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-[0.3em] opacity-80 flex items-center gap-2">
                  <span className="w-6 h-[1.5px] bg-indigo-500/30"></span>
                  Gestión de Requerimientos
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 w-full xl:w-auto">
            <button
              onClick={() => {
                if (user?.rol !== 'admin') {
                  setNuevaSolicitud(prev => ({ ...prev, tienda_id: user?.tienda_id || "" }));
                }
                setModalCreacionAbierto(true);
              }}
              className="btn-primary flex-1 xl:flex-none px-6 h-[44px] rounded-2xl shadow-lg shadow-indigo-600/20 text-[10px] tracking-widest"
            >
              <Plus size={20} strokeWidth={3} />
              {user?.rol === 'admin' ? 'NUEVA SOLICITUD' : 'SOLICITAR PEDIDO'}
            </button>
            <button
              onClick={obtenerPedidos}
              className="btn-secondary flex-1 xl:flex-none px-4 h-[44px] rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 shadow-sm transition-all"
            >
              <RefreshCw size={18} className={`${cargando ? "animate-spin" : ""} text-indigo-500`} />
              <span className="font-black text-[9px] tracking-widest">SINCRONIZAR</span>
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="card-standard p-2 mb-4 flex flex-col lg:flex-row items-center gap-2 shadow-sm border-indigo-500/5 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl">
          {user?.rol?.toLowerCase() === 'admin' ? (
            <div className="flex-1 w-full relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-all duration-300" size={18} />
              <input
                type="text"
                placeholder="SUCURSAL..."
                className="input-standard pl-12 h-[44px] rounded-xl border-transparent bg-slate-50/50 dark:bg-slate-900/50 font-black uppercase tracking-widest text-[10px] focus:ring-0 focus:outline-none"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex-1 px-4 py-3 flex items-center gap-3 text-slate-400">
              <Package size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Mis Solicitudes - {user?.tienda_nombre || 'Sucursal Local'}</span>
            </div>
          )}

          <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto px-1">
            {user?.rol?.toLowerCase() === 'admin' && (
              <div className="relative flex-1 lg:w-56">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  className="select-standard pl-10 h-[44px] rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-transparent font-black text-[10px] appearance-none focus:ring-0 focus:outline-none"
                  value={filtroTienda}
                  onChange={(e) => setFiltroTienda(e.target.value)}
                >
                  <option value="todas">SUCURSAL: TODAS</option>
                  {tiendas.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative flex-1 lg:w-48">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                className="select-standard pl-10 h-[44px] rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-transparent font-black text-[10px] focus:ring-0 focus:outline-none"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">ESTADO: TODOS</option>
                <option value="PENDIENTE">PENDIENTES</option>
                <option value="COMPRADO">COMPRADOS</option>
                <option value="CANCELADO">CANCELADOS</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const nuevoEstado = !mostrarProgramados;
                  setMostrarProgramados(nuevoEstado);
                  // Trigger reload immediately
                  setTimeout(() => obtenerPedidos(), 0);
                }}
                className={`h-[44px] px-5 rounded-xl flex items-center gap-2 border transition-all group ${mostrarProgramados
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50'
                  }`}
                title="VER PROGRAMADOS (FUTURO)"
              >
                <Calendar size={16} className={mostrarProgramados ? "" : "group-hover:scale-110 transition-transform"} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {mostrarProgramados ? 'VER HOY' : 'VER FUTUROS'}
                </span>
              </button>

              <button
                onClick={exportarExcel}
                className="h-[44px] px-5 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
                title="EXPORTAR EXCEL"
              >
                <Layers size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">EXCEL</span>
              </button>
              <button
                onClick={exportarPDF}
                className="h-[44px] px-5 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-rose-500 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group"
                title="EXPORTAR PDF"
              >
                <FileText size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Week Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'all', label: 'Todo' },
            { key: 'this_week', label: 'Esta Semana' },
            { key: 'last_week', label: 'Semana Pasada' },
            { key: 'this_month', label: 'Este Mes' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => applyWeekFilter(f.key)}
              className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border ${
                activeWeekFilter === f.key
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-500'
              }`}
            >
              {f.label}
              {f.key !== 'all' && activeWeekFilter === f.key && (
                <span className="ml-1.5 bg-white/20 px-1.5 rounded-md">{pedidosFiltrados.length}</span>
              )}
            </button>
          ))}
          <span className="ml-auto flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {pedidosFiltrados.length} resultado{pedidosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pedidosFiltrados.length === 0 ? (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-1000">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-indigo-500/10 blur-[80px] rounded-full scale-150 animate-pulse"></div>
                <div className="relative w-32 h-32 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-[3rem] flex items-center justify-center shadow-2xl border border-white dark:border-white/5 rotate-6 hover:rotate-0 transition-transform duration-700">
                  <Package size={56} className="text-indigo-300 dark:text-indigo-500/40" strokeWidth={1} />
                </div>
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.4em] mb-3">Sin Solicitudes</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest max-w-[300px] leading-relaxed">No se encontraron requerimientos que coincidan con los filtros aplicados</p>
            </div>
          ) : (
            pedidosFiltrados.map((p) => {
              const esSolicitudVendedor = p.usuario_rol && p.usuario_rol !== 'admin';
              const fechaObj = p.created_at ? new Date(p.created_at.toString().replace(' ', 'T')) : null;
              const fechaStr = fechaObj && !isNaN(fechaObj) ? fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
              const horaStr = fechaObj && !isNaN(fechaObj) ? fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';

              return (
              <div key={p.id} className={`group relative bg-white dark:bg-slate-800 rounded-3xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden ${
                esSolicitudVendedor
                  ? 'border-amber-200 dark:border-amber-800/40 hover:border-amber-400/60'
                  : 'border-slate-200 dark:border-slate-700/50 hover:border-indigo-400/30'
              }`}>
                {/* Color strip top */}
                <div className={`h-1.5 w-full ${esSolicitudVendedor ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}></div>

                {/* Header of Card */}
                <div className="px-5 py-3.5 border-b dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${esSolicitudVendedor ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500'}`}>
                      {esSolicitudVendedor ? <Store size={17} /> : <Truck size={17} />}
                    </div>
                    <div>
                      <span className={`text-[7px] font-black uppercase tracking-widest ${esSolicitudVendedor ? 'text-amber-500' : 'text-indigo-500/60'}`}>
                        {esSolicitudVendedor ? 'SOLICITUD SUCURSAL' : 'ORDEN'}
                      </span>
                      <div className="text-sm font-black text-slate-800 dark:text-white tracking-tight leading-none">
                        #{p.id.toString().padStart(5, '0')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`${getStatusBadgeClass(p.estado)} !py-1 !px-2.5 !text-[8px]`}>{p.estado}</span>
                    {user?.rol === 'admin' && p.estado === 'CANCELADO' && (
                      <button onClick={(e) => { e.stopPropagation(); eliminarPedido(p.id); }} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                        <Trash2 size={15} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Body of Card */}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  {/* Store name */}
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sucursal Destino</p>
                    <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm truncate leading-tight">
                      {p.tienda_id ? (p.tienda_nombre || `SUCURSAL #${p.tienda_id}`) : (p.nombre_cliente || 'CENTRAL')}
                    </h3>
                  </div>

                  {/* Requester info — prominent for admin */}
                  <div className={`rounded-xl p-2.5 flex items-center gap-2.5 ${esSolicitudVendedor ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${esSolicitudVendedor ? 'bg-amber-400 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {(p.usuario_nombre || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] font-black uppercase truncate leading-none ${esSolicitudVendedor ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>
                        {p.usuario_nombre || 'SISTEMA'}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {esSolicitudVendedor ? 'Vendedor' : (p.usuario_nombre ? 'Admin' : 'Sistema')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-black text-slate-600 dark:text-slate-300">{fechaStr}</p>
                      <p className="text-[8px] font-bold text-slate-400">{horaStr}</p>
                    </div>
                  </div>

                  {/* Products list preview */}
                  {p.detalles && p.detalles.length > 0 && (
                    <div className="space-y-1">
                      {p.detalles.slice(0, 2).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-[9px]">
                          <span className="font-bold text-slate-600 dark:text-slate-400 truncate max-w-[60%] uppercase">{d.producto_nombre}</span>
                          <span className="font-black text-slate-500 dark:text-slate-400 shrink-0">×{d.cantidad}</span>
                        </div>
                      ))}
                      {p.detalles.length > 2 && (
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">+{p.detalles.length - 2} más...</p>
                      )}
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">PRODS</span>
                      <div className="flex items-center justify-center gap-1">
                        <Package size={9} className="text-indigo-400" />
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">{p.detalles?.length || 0}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">TOTAL</span>
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-[9px] font-black text-emerald-500/60">{currency}</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{parseFloat(p.total).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {p.notas && (
                    <div className="bg-indigo-50/40 dark:bg-indigo-900/10 px-3 py-2 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20">
                      <p className="text-[9px] font-bold text-indigo-700/80 dark:text-indigo-400/80 italic line-clamp-1">"{p.notas}"</p>
                    </div>
                  )}

                  {p.fecha_programada && (
                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl border border-amber-100 dark:border-amber-800/50">
                      <Clock size={10} className="text-amber-500 shrink-0" />
                      <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                        Programado: {new Date(p.fecha_programada + 'T00:00:00').toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer / Actions */}
                <div className="px-4 pb-4 pt-0">
                  {p.estado?.toString().trim().toUpperCase() === 'PENDIENTE' ? (
                    <div className="flex gap-2">
                      {user?.rol === 'admin' ? (
                        <button
                          onClick={() => { if (window.confirm("¿Confirmar que esta mercancía ha sido comprada y recibida?")) actualizarEstadoPedido(p.id, 'COMPRADO'); }}
                          disabled={procesandoIds.includes(p.id)}
                          className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-700 h-[38px] rounded-xl text-[8px] tracking-[.15em]"
                        >
                          {procesandoIds.includes(p.id) ? <RefreshCw className="animate-spin" size={13} /> : <CheckCircle size={13} />}
                          {procesandoIds.includes(p.id) ? 'ESPERA...' : 'CONFIRMAR'}
                        </button>
                      ) : (
                        <div className="flex-1 h-[38px] flex items-center justify-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 font-black text-[8px] uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          <Clock size={13} /> EN ESPERA
                        </div>
                      )}
                      <button
                        onClick={() => { setPedidoSeleccionado(p); setModalAbierto(true); }}
                        className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center border transition-all ${esSolicitudVendedor ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 border-amber-100 dark:border-amber-800/30 hover:bg-amber-100' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100'}`}
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <div className={`flex-1 h-[38px] flex items-center justify-center gap-2 rounded-xl border font-black text-[8px] uppercase tracking-widest ${p.estado?.toUpperCase() === 'COMPRADO' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 text-rose-600'}`}>
                        {p.estado?.toUpperCase() === 'COMPRADO' ? <CheckCircle size={13} /> : <X size={13} />}
                        {p.estado?.toUpperCase() === 'COMPRADO' ? 'COMPLETADO' : 'CANCELADO'}
                      </div>
                      <button
                        onClick={() => { setPedidoSeleccionado(p); setModalAbierto(true); }}
                        className="w-[38px] h-[38px] rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:text-indigo-600 hover:border-indigo-400 transition-all"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Details Modal */}
      {modalAbierto && pedidoSeleccionado && (
        <div className="modal-overlay backdrop-blur-md">
          <div className="modal-container max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh] border-none shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[8px] font-black uppercase tracking-widest">Detalle de Suministro</span>
                  <span className={`${getStatusBadgeClass(pedidoSeleccionado.estado)} !py-1 !px-2 !text-[8px]`}>{pedidoSeleccionado.estado}</span>
                </div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">
                  ORDEN <span className="text-indigo-600">#{pedidoSeleccionado.id}</span>
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1.5 opacity-60">
                  <Calendar size={10} className="text-indigo-400" />
                  {new Date(pedidoSeleccionado.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 rounded-xl shadow-sm transition-all flex items-center justify-center active:scale-90 border dark:border-slate-700">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
              {/* Requester + Store info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Store size={11} /> Sucursal Destino</p>
                  <p className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">
                    {pedidoSeleccionado.tienda_id ? (pedidoSeleccionado.tienda_nombre || `SUCURSAL #${pedidoSeleccionado.tienda_id}`) : (pedidoSeleccionado.nombre_cliente || 'CENTRAL')}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={10} className="text-indigo-400" />
                    {pedidoSeleccionado.created_at
                      ? new Date(pedidoSeleccionado.created_at.toString().replace(' ', 'T')).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
                      : '—'
                    }
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-3 ${pedidoSeleccionado.usuario_rol && pedidoSeleccionado.usuario_rol !== 'admin' ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-100 dark:border-amber-800/30' : 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100/50 dark:border-indigo-900/20'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><User size={11} /> Solicitante</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base ${pedidoSeleccionado.usuario_rol && pedidoSeleccionado.usuario_rol !== 'admin' ? 'bg-amber-400 text-white' : 'bg-indigo-500 text-white'}`}>
                      {(pedidoSeleccionado.usuario_nombre || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 dark:text-white uppercase text-sm">{pedidoSeleccionado.usuario_nombre || 'SISTEMA'}</p>
                      <span className={`inline-block text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest mt-0.5 ${pedidoSeleccionado.usuario_rol && pedidoSeleccionado.usuario_rol !== 'admin' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                        {pedidoSeleccionado.usuario_rol && pedidoSeleccionado.usuario_rol !== 'admin' ? 'Vendedor / Sucursal' : 'Administrador'}
                      </span>
                    </div>
                  </div>
                  {pedidoSeleccionado.notas && (
                    <p className="text-[10px] italic text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
                      "{pedidoSeleccionado.notas}"
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Layers size={12} /> DESGLOSE</h3>
                <div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700/50 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-900 dark:bg-black text-white uppercase text-[8px] font-black tracking-widest">
                        <th className="px-5 py-3">Producto</th>
                        <th className="px-5 py-3 text-center">Cant.</th>
                        <th className="px-5 py-3 text-right">Unitario</th>
                        <th className="px-5 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {pedidoSeleccionado.detalles?.map((prod, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="px-5 py-3 text-[10px] uppercase font-bold text-slate-800 dark:text-white">{prod.producto_nombre}</td>
                          <td className="px-5 py-3 text-center"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded-md font-black text-[10px]">{prod.cantidad}</span></td>
                          <td className="px-5 py-3 text-right font-bold text-[10px] text-slate-400">{currency} {parseFloat(prod.precio_unitario || 0).toFixed(2)}</td>
                          <td className="px-5 py-3 text-right font-black text-[11px] text-slate-800 dark:text-white">{currency} {parseFloat(prod.subtotal || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" className="px-5 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">INVERSIÓN TOTAL</td>
                        <td className="px-5 py-4 text-right bg-indigo-50/30 dark:bg-indigo-900/10 text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                          {currency} {parseFloat(pedidoSeleccionado.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 sticky bottom-0 z-20">
              <button onClick={() => window.print()} className="px-5 h-10 rounded-xl border border-slate-200 dark:border-slate-700 font-black text-[9px] uppercase hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-2">
                <Printer size={16} /> COMPROBANTE
              </button>
              <button onClick={() => setModalAbierto(false)} className="btn-primary px-8 h-10 rounded-xl text-[9px]">CERRAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {modalCreacionAbierto && (
        <div className="modal-overlay backdrop-blur-md">
          <div className="modal-container max-w-5xl p-0 overflow-hidden flex flex-col h-[85vh] border-none shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20"><Plus size={20} className="text-white" strokeWidth={3} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">NUEVO <span className="text-indigo-600">REQUERIMIENTO</span></h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">Suministro</p>
                </div>
              </div>
              <button onClick={() => setModalCreacionAbierto(false)} className="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 rounded-xl shadow-sm transition-all flex items-center justify-center active:scale-90"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              <div className="w-full lg:w-80 p-6 border-r dark:border-slate-700/50 space-y-6 overflow-y-auto custom-scrollbar bg-gradient-to-br from-slate-50/50 to-indigo-50/20 dark:from-slate-900/50 dark:to-indigo-950/20">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Store size={12} /> DESTINO</label>
                  {user?.rol === 'admin' ? (
                    <select className="input-standard h-12 rounded-2xl text-[11px] font-bold border-2 border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-slate-800 shadow-lg shadow-indigo-500/5 focus:border-indigo-400 transition-all"
                      value={nuevaSolicitud.tienda_id} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, tienda_id: e.target.value })}>
                      <option value="">SELECCIONAR SUCURSAL...</option>
                      {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                    </select>
                  ) : (
                    <div className="h-12 px-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-2 text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase">
                      <Store size={14} className="text-indigo-500" />
                      {user?.tienda_nombre || 'MI SUCURSAL'}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><FileText size={12} /> NOTAS</label>
                  <textarea placeholder="Observaciones adicionales..." className="input-standard h-36 rounded-2xl text-[11px] font-bold p-4 border-2 border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-slate-800 shadow-lg shadow-indigo-500/5 resize-none focus:border-indigo-400 transition-all"
                    value={nuevaSolicitud.notas} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, notas: e.target.value })} />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={12} /> FECHA PROGRAMADA (OPCIONAL)</label>
                  <input
                    type="date"
                    className="input-standard h-12 rounded-2xl text-[11px] font-bold border-2 border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-slate-800 shadow-lg shadow-indigo-500/5 focus:border-indigo-400 transition-all px-4"
                    value={nuevaSolicitud.fecha_programada}
                    onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, fecha_programada: e.target.value })}
                  />
                  <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight px-1">Si dejas vacío, se mostrará inmediatamente.</p>
                </div>
                <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-2xl shadow-indigo-600/30 flex flex-col items-center border-4 border-white/10">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Total Estimado</span>
                  <div className="flex items-baseline gap-1.5"><span className="text-sm font-black opacity-70">{currency}</span><span className="text-4xl font-black tracking-tighter">
                    {nuevaSolicitud.productos.reduce((sum, p) => sum + (p.cantidad * (Number(p.precio_unitario) || 0)), 0).toLocaleString()}
                  </span></div>
                  <button onClick={handleCrearSolicitud} disabled={procesandoIds.length > 0 || nuevaSolicitud.productos.length === 0 || !nuevaSolicitud.tienda_id}
                    className="mt-5 w-full h-12 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                    {procesandoIds.length > 0 ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />} ENVIAR SOLICITUD
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col overflow-hidden bg-white dark:bg-slate-900/40">
                <div className="mb-5 relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
                  <input type="text" placeholder="Buscar productos por nombre..." className="input-standard h-14 pl-14 pr-5 rounded-2xl text-[11px] font-bold border-2 border-indigo-100 dark:border-indigo-900/30 bg-slate-50 dark:bg-slate-800 focus:border-indigo-400 shadow-lg shadow-indigo-500/5 transition-all"
                    value={busquedaProducto} onChange={(e) => setBusquedaProducto(e.target.value)} />
                  {busquedaProducto && (
                    <ul className="absolute z-50 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 rounded-2xl w-full mt-2 shadow-2xl max-h-72 overflow-y-auto custom-scrollbar">
                      {productosDisponibles.filter(p => p.nombre?.toLowerCase().includes(busquedaProducto.toLowerCase())).map(p => (
                        <li key={p.id} onClick={() => { agregarProductoASolicitud(p); setBusquedaProducto(""); }} className="p-4 flex justify-between items-center hover:bg-indigo-50 dark:hover:bg-indigo-900/40 cursor-pointer transition-colors border-b last:border-0 dark:border-slate-700/50">
                          <div><p className="font-bold text-[11px] uppercase text-slate-800 dark:text-white">{p.nombre}</p><p className="text-[9px] text-slate-400 mt-0.5">STOCK DISPONIBLE: {p.cantidad}</p></div>
                          <span className="font-black text-indigo-600 dark:text-indigo-400 text-[11px]">{currency}{Number(p.precio_compra || 0).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar border-2 border-indigo-100 dark:border-slate-700/50 rounded-3xl shadow-xl shadow-indigo-500/5">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-gradient-to-r from-slate-900 to-indigo-900 text-white uppercase text-[9px] font-black tracking-[0.15em] z-10 shadow-lg">
                      <tr><th className="px-6 py-4">Producto</th><th className="px-6 py-4 text-center">Cant.</th><th className="px-6 py-4 text-right">Acción</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {nuevaSolicitud.productos.length === 0 ? (
                        <tr><td colSpan="3" className="px-5 py-16 text-center text-slate-400"><ShoppingBag className="mx-auto mb-4 opacity-20" size={48} /><p className="text-[11px] font-black uppercase tracking-widest">Sin productos agregados</p><p className="text-[9px] text-slate-400 mt-1">Busca y selecciona productos arriba</p></td></tr>
                      ) : (
                        nuevaSolicitud.productos.map((prod) => (
                          <tr key={prod.producto_id} className="hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="px-6 py-4 text-[11px] uppercase font-bold text-slate-800 dark:text-white">{prod.nombre}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 w-28 mx-auto border dark:border-slate-700">
                                <button onClick={() => { const cant = Math.max(1, prod.cantidad - 1); setNuevaSolicitud(prev => ({ ...prev, productos: prev.productos.map(item => item.producto_id === prod.producto_id ? { ...item, cantidad: cant } : item) })); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-bold transition-all active:scale-90">-</button>
                                <input type="number" className="w-12 bg-transparent text-center font-black text-[11px] outline-none text-slate-800 dark:text-white"
                                  value={prod.cantidad === 0 ? "" : prod.cantidad}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : (parseInt(e.target.value) || 0);
                                    setNuevaSolicitud(prev => ({
                                      ...prev,
                                      productos: prev.productos.map(item => item.producto_id === prod.producto_id ? { ...item, cantidad: Math.max(0, val) } : item)
                                    }));
                                  }} />
                                <button onClick={() => { setNuevaSolicitud(prev => ({ ...prev, productos: prev.productos.map(item => item.producto_id === prod.producto_id ? { ...item, cantidad: item.cantidad + 1 } : item) })); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-bold transition-all active:scale-90">+</button>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => quitarProductoDeSolicitud(prod.producto_id)} className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-90"><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ErrorBoundary for debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error in StoreOrders", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center">
          <h1 className="text-xl font-bold text-rose-500 mb-4">Error en Solicitudes</h1>
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

export default function StoreOrdersWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <StoreOrders />
    </ErrorBoundary>
  );
}
