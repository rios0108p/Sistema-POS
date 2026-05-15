import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { productosAPI, comprasAPI, proveedoresAPI, tiendasAPI } from "../services/api";
import { toast } from "react-hot-toast";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { FileText, Table as TableIcon, ShoppingBag, Plus, Search, RefreshCw, Calendar, Store, User, ChevronDown, Package, ArrowRight, DollarSign, TrendingUp, Filter } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useOfflineOperation from "../hooks/useOfflineOperation";

const RegistrarCompras = () => {
  const { user, turnoActivo } = useAuth();
  const navigate = useNavigate();
  const currency = CURRENCY_SYMBOL;
  const [searchParams] = useSearchParams();
  const [productos, setProductos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [busquedaNombre, setBusquedaNombre] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [variacionSeleccionada, setVariacionSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(false);

  const { execute: executePurchase } = useOfflineOperation('compras');

  // Fecha local correcta (no UTC) para Cancún GMT-5/GMT-6
  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [form, setForm] = useState({
    cantidad: "",
    precio_compra: "",
    fecha: getLocalDate(),
    proveedor_id: "",
    tienda_id: "",
  });
  const [listaTiendas, setListaTiendas] = useState([]);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const prodId = searchParams.get('productId');
    const tId = searchParams.get('tiendaId');

    if (prodId && productos.length > 0) {
      const prod = productos.find(p => p.id == prodId);
      if (prod) {
        handleSeleccionarProducto(prod);
      }
    }

    if (tId) {
      setForm(prev => ({ ...prev, tienda_id: tId }));
    }
  }, [searchParams, productos]);

  const cargarProductos = async (tiendaId) => {
    try {
      let data;
      if (tiendaId && tiendaId !== '0' && tiendaId !== '') {
        data = await tiendasAPI.getProductos(tiendaId);
      } else {
        data = await productosAPI.getAll();
      }
      setProductos(data || []);
    } catch (error) {
      console.error("Error al cargar productos", error);
    }
  };

  const [filterRange, setFilterRange] = useState('today');
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  const cargarCompras = async () => {
    try {
      const params = {
        tienda_id: user?.rol === 'admin' ? null : user?.tienda_id,
        range: filterRange,
        fecha_inicio: customDateStart,
        fecha_fin: customDateEnd
      };
      const data = await comprasAPI.getAll(params);
      setCompras(data || []);
    } catch (error) {
      console.error("Error al cargar compras", error);
    }
  };

  const cargarProveedores = async () => {
    try {
      const data = await proveedoresAPI.getAll();
      setProveedores(data || []);
    } catch (error) {
      console.error("Error al cargar proveedores", error);
    }
  };

  const cargarTiendas = async () => {
    if (user?.rol !== 'admin') return;
    try {
      const data = await tiendasAPI.getAll();
      setListaTiendas(data || []);
    } catch (error) {
      console.error("Error al cargar tiendas", error);
    }
  };

  // Carga inicial: productos de la tienda del usuario o todos si es admin sin tienda
  useEffect(() => {
    const initialTiendaId = user?.rol === 'admin' ? null : user?.tienda_id;
    cargarProductos(initialTiendaId);
    cargarProveedores();
    cargarTiendas();
  }, []);

  // Admin: re-cargar productos cuando cambia la tienda destino
  useEffect(() => {
    if (user?.rol === 'admin') {
      cargarProductos(form.tienda_id || null);
    }
  }, [form.tienda_id]);

  // Teclado: F2 y F9
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setMostrarLista(true);
        searchInputRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        registrarCompra();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form, productoSeleccionado]);

  useEffect(() => {
    cargarCompras();
  }, [filterRange, customDateStart, customDateEnd]);

  const handleExportExcel = () => {
    const dataToExport = compras.map(c => ({
      Fecha: new Date(c.fecha).toLocaleDateString(),
      Hora: new Date(c.fecha).toLocaleTimeString(),
      Producto: c.producto_nombre,
      Cantidad: c.cantidad,
      'Precio Unitario': c.precio_unitario,
      Total: c.total,
      Proveedor: c.proveedor_nombre || 'N/A',
      Comprador: c.usuario_nombre || 'N/A'
    }));
    exportToExcel(dataToExport, 'Reporte_Compras', 'Compras');
  };

  const handleExportPDF = () => {
    const headers = ['Fecha', 'Hora', 'Producto', 'Cant.', 'Total', 'Proveedor', 'Comprador'];
    const data = compras.map(c => [
      new Date(c.fecha).toLocaleDateString(),
      new Date(c.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      c.producto_nombre,
      c.cantidad.toString(),
      `${currency}${Number(c.total).toFixed(2)}`,
      c.proveedor_nombre || '-',
      c.usuario_nombre || '-'
    ]);
    exportToPDF({ title: 'Historial de Compras', headers, data, fileName: 'Reporte_Compras' });
  };

  const handleSeleccionarProducto = (p) => {
    setProductoSeleccionado(p);
    setBusquedaNombre(p.nombre);
    setMostrarLista(false);
    setVariacionSeleccionada(null);
    setForm(prev => ({ ...prev, precio_compra: p.precio_compra || "" }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const registrarCompra = async () => {
    const targetTiendaId = user?.rol === 'admin' ? form.tienda_id : user?.tienda_id;

    if (!productoSeleccionado || !form.cantidad || !form.precio_compra) {
      return toast.error("Completa todos los campos requeridos");
    }

    if (user?.rol === 'admin' && !targetTiendaId) {
      return toast.error("Selecciona una tienda de destino");
    }

    setCargando(true);
    try {
      const data = {
        tienda_id: targetTiendaId ? parseInt(targetTiendaId) : null,
        turno_id: turnoActivo?.id ? parseInt(turnoActivo.id) : null,
        usuario_id: user?.id ? parseInt(user.id) : null,
        proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
        productos: [{
          producto_id: parseInt(productoSeleccionado.id),
          variacion_id: variacionSeleccionada?.id ? parseInt(variacionSeleccionada.id) : null,
          cantidad: parseInt(form.cantidad) || 0,
          precio_unitario: parseFloat(form.precio_compra) || 0
        }]
      };

      await comprasAPI.create(data);
      toast.success("Compra registrada correctamente");

      setProductoSeleccionado(null);
      setVariacionSeleccionada(null);
      setBusquedaNombre("");
      setForm({
        cantidad: "",
        precio_compra: "",
        fecha: new Date().toISOString().split('T')[0],
        proveedor_id: form.proveedor_id,
        tienda_id: user?.rol === 'admin' ? form.tienda_id : "",
      });

      await Promise.all([cargarCompras(), cargarProductos()]);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error al registrar la compra");
    } finally {
      setCargando(false);
    }
  };

  const productosFiltrados = productos
    .filter(p =>
      p.nombre.toLowerCase().includes(busquedaNombre.toLowerCase()) ||
      (p.codigo_barras && p.codigo_barras.includes(busquedaNombre))
    )
    .sort((a, b) => {
      const aHasStock = a.cantidad > 0;
      const bHasStock = b.cantidad > 0;
      if (aHasStock && !bHasStock) return -1;
      if (!aHasStock && bHasStock) return 1;
      return a.nombre.localeCompare(b.nombre);
    })
    .slice(0, 10);

  const safeCompras = Array.isArray(compras) ? compras : [];
  const totalUnidades = safeCompras.reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);
  const granTotalDinero = safeCompras.reduce((acc, c) => acc + (Number(c.total) || 0), 0);

  return (
    <div className="p-4 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
      <div>
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20">
                <ShoppingBag className="text-white" size={28} />
              </div>
              REGISTRO DE <span className="text-indigo-600">COMPRAS</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest opacity-60">Control de entradas y abastecimiento de inventario</p>
          </div>
        </div>

        {/* Purchase Registration Form */}
        <div className={`card-standard p-6 mb-4 shadow-xl relative transition-all duration-500 hover:shadow-indigo-500/10 !overflow-visible ${mostrarLista && busquedaNombre ? 'z-[1001]' : 'z-10'}`}>
          <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-x-6 gap-y-4 items-end relative z-50">
            {/* Product Selector */}
            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="label-standard">SELECCIONAR PRODUCTO *</label>
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border dark:border-slate-800 text-[10px] font-black text-slate-400">
                  F2
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                  ref={searchInputRef}
                  value={busquedaNombre}
                  onChange={(e) => { setBusquedaNombre(e.target.value); setMostrarLista(true); }}
                  className="input-standard pl-12 h-[56px] font-black uppercase tracking-tight focus:ring-0 focus:outline-none"
                  placeholder="LOCALIZAR O ESCANEAR..."
                />
                {mostrarLista && busquedaNombre && (
                  <ul className="absolute z-[1002] bg-white dark:bg-slate-800 border-0 rounded-[2rem] w-full mt-2 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.4)] max-h-[260px] overflow-y-auto ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-300 custom-scrollbar overflow-x-hidden border border-slate-100 dark:border-slate-700/50">
                    {productosFiltrados.length > 0 ? (
                      <div className="p-1.5 space-y-0.5">
                        {productosFiltrados.map(p => (
                          <li
                            key={p.id}
                            onClick={() => handleSeleccionarProducto(p)}
                            className="p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-indigo-900/10 group cursor-pointer flex justify-between items-center transition-all duration-200 border border-transparent hover:border-slate-100 dark:hover:border-indigo-500/20"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                                <Package size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase text-xs tracking-tight leading-tight">{p.nombre}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.codigo_barras || 'SIN CÓDIGO'}</span>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${p.cantidad > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>EXIST: {p.cantidad}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200">{currency}{Number(p.precio_venta || 0).toFixed(2)}</span>
                              {p.variaciones?.length > 0 && (
                                <span className="text-[7px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-1.5 py-0.5 rounded-full mt-1 border border-indigo-100">VARIACIONES</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </div>
                    ) : (
                      <div className="p-10 text-center">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-3 opacity-40">
                          <Search size={22} className="text-slate-400" />
                        </div>
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest opacity-50">Sin coincidencias</p>
                      </div>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Variations */}
            {productoSeleccionado && productoSeleccionado.variaciones?.length > 0 && (
              <div className="md:col-span-1 lg:col-span-3 space-y-2">
                <label className="label-standard px-1">ESPECIFICACIÓN / TALLA</label>
                <select
                  value={variacionSeleccionada?.id || ""}
                  onChange={(e) => {
                    const vari = productoSeleccionado.variaciones.find(v => v.id == e.target.value);
                    setVariacionSeleccionada(vari);
                  }}
                  className="select-standard h-[56px] font-bold focus:ring-0 focus:outline-none"
                >
                  <option value="">Seleccionar Variante...</option>
                  {productoSeleccionado.variaciones.map(v => (
                    <option key={v.id} value={v.id}>{v.nombre} ({v.atributo}) - Stock: {v.stock}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity */}
            <div className="md:col-span-1 lg:col-span-2 space-y-2">
              <label className="label-standard px-1">CANTIDAD</label>
              <input
                type="number"
                name="cantidad"
                value={form.cantidad}
                onChange={handleChange}
                className="input-standard h-[56px] text-center font-black text-indigo-600 focus:ring-0 focus:outline-none"
                placeholder="0"
              />
            </div>

            {/* Purchase Price */}
            <div className="md:col-span-1 lg:col-span-3 space-y-2">
              <label className="label-standard px-1">PRECIO COSTO</label>
              <div className="relative group">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  type="number"
                  name="precio_compra"
                  value={form.precio_compra}
                  onChange={handleChange}
                  className="input-standard pl-10 h-[56px] text-center font-black text-emerald-600 dark:text-emerald-400 border-emerald-500/20 focus:ring-0 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Supplier */}
            <div className="md:col-span-1 lg:col-span-4 space-y-2">
              <label className="label-standard px-1">PROVEEDOR</label>
              <select
                name="proveedor_id"
                value={form.proveedor_id}
                onChange={handleChange}
                className="select-standard h-[56px] font-bold focus:ring-0 focus:outline-none"
              >
                <option value="">SELECCIONAR PROVEEDOR...</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Target Store (Admin only) */}
            {user?.rol === 'admin' && (
              <div className="md:col-span-1 lg:col-span-4 space-y-2">
                <label className="label-standard px-1">TIENDA DESTINO</label>
                <select
                  name="tienda_id"
                  value={form.tienda_id}
                  onChange={handleChange}
                  className="select-standard h-[56px] font-bold border-indigo-200 dark:border-indigo-900/50 focus:ring-0 focus:outline-none"
                >
                  <option value="">SELECCIONAR TIENDA...</option>
                  <option value="0">ALMACÉN CENTRAL (GLOBAL)</option>
                  {listaTiendas.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="md:col-span-2 lg:col-span-4 flex gap-3 h-[56px]">
              <button
                onClick={registrarCompra}
                disabled={cargando}
                className="flex-[2] btn-primary bg-indigo-600 hover:bg-indigo-700 border-none shadow-indigo-600/20 px-4 group relative rounded-2xl"
              >
                {cargando ? <RefreshCw className="animate-spin" size={18} /> : (
                  <>
                    <div className="absolute top-1 right-2 bg-white/10 px-1.5 py-0.5 rounded text-[8px] font-black opacity-40 group-hover:opacity-100 transition-opacity uppercase">F9</div>
                    <Plus size={18} /> REGISTRAR ENTRADA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col xl:flex-row justify-between items-end gap-4 mb-4">
          <div className="w-full xl:w-auto">
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3 mb-2">
              <TrendingUp size={24} className="text-indigo-500" /> HISTORIAL DE REABASTECIMIENTO
            </h2>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                <Calendar size={14} className="text-indigo-500" />
                <select
                  value={filterRange}
                  onChange={e => setFilterRange(e.target.value)}
                  className="appearance-none bg-transparent text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 cursor-pointer pr-4 focus:outline-none"
                  style={{ border: 'none', outline: 'none' }}
                >
                  <option value="today">Hoy</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mes</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {filterRange === 'custom' && (
                <div className="flex gap-2 pr-2 border-l dark:border-slate-700 ml-2 pl-4">
                  <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-slate-600" />
                  <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-slate-600" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full xl:w-auto">
          <button
            onClick={handleExportExcel}
            className="h-[44px] px-5 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
          >
            <TableIcon size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">EXCEL</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="h-[44px] px-5 rounded-xl flex items-center gap-2 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group"
          >
            <FileText size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">PDF</span>
          </button>
        </div>
      </div>

      {/* Table View */}
      <div className="card-standard p-0 overflow-hidden shadow-2xl relative transition-all duration-500">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-md border-b dark:border-slate-700/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Producto / Descriptor</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Unidades</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Inversión Bruta</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Cronología</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {safeCompras.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-6 opacity-20">
                      <ShoppingBag size={80} className="text-slate-400" />
                      <p className="font-black uppercase tracking-[0.3em] text-xs">No hay registros de compra para este período</p>
                    </div>
                  </td>
                </tr>
              ) : (
                safeCompras.map((c) => (
                  <tr key={c.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tighter group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{c.producto_nombre}</span>
                        <div className="flex items-center gap-2.5 mt-2">
                          <span className="text-[9px] font-black text-indigo-500/80 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800/20">{c.proveedor_nombre || "GENÉRICO"}</span>
                          <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                            <User size={10} className="text-slate-300" /> {c.usuario_nombre || "OPERADOR"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center justify-center min-w-[3.5rem] px-4 py-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-2xl text-lg font-black text-slate-700 dark:text-slate-300 tracking-tighter shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                        {c.cantidad}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-black text-slate-900 dark:text-white tracking-tighter">
                          {currency}{Number(c.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase flex items-center gap-1">
                          <DollarSign size={8} /> {Number(c.precio_unitario).toFixed(2)} NETO
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-all transform group-hover:-translate-x-2">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{new Date(c.fecha).toLocaleDateString()}</span>
                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter mt-1">{new Date(c.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {safeCompras.length > 0 && (
              <tfoot className="bg-indigo-50 dark:bg-indigo-900/20 relative">
                <tr>
                  <td className="px-8 py-8 border-none">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                      <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">BALANCE CONSOLIDADO</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center border-none">
                    <div className="flex flex-col">
                      <span className="text-3xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400 leading-none">{totalUnidades.toLocaleString()}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest">UNIDADES REFILADAS</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right border-none" colSpan="2">
                    <div className="flex flex-col items-end">
                      <span className="text-4xl font-black tracking-widest text-emerald-600 dark:text-emerald-500 leading-none">
                        {currency}{granTotalDinero.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest">TOTAL INVERTIDO EN PERÍODO</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default RegistrarCompras;
