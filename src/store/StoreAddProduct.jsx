import { useState, useEffect } from "react";
import { categoriasAPI, productosAPI, proveedoresAPI } from "../services/api";
import { Trash2, Pencil, Check, X, PlusCircle, Package, AlertCircle, Tag, Plus, Save, ChevronRight, RefreshCw, DollarSign } from "lucide-react";
import { useNotify } from "../hooks/useNotify";
import { CURRENCY_SYMBOL } from "../utils/currency";

const StoreAddProduct = () => {
  const notify = useNotify();
  const currency = CURRENCY_SYMBOL;

  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [infoProducto, setInfoProducto] = useState({
    nombre: "", descripcion: "", precio_compra: "", precio_original: "",
    precio_oferta: "", categoria: "", cantidad: "", stock_minimo: 5, marca: "", color: "", proveedor_id: "", codigo_barras: "",
    caracteristicas: ["", "", ""],
    barcodes_agrupados: [],
    oferta: false, destacado: false, es_nuevo: true,
    variaciones: [],
  });
  const [tempBarcode, setTempBarcode] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [cargando, setCargando] = useState(false);

  // ========================= Cargar Categorías =========================
  const cargarDatos = async () => {
    try {
      const [cats, provs, prods] = await Promise.all([
        categoriasAPI.getAll(),
        proveedoresAPI.getAll(),
        productosAPI.getAll()
      ]);
      setCategorias(cats || []);
      setProveedores(provs || []);
      setProductos(prods || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const cargarCategorias = async () => {
    try {
      const cats = await categoriasAPI.getAll();
      setCategorias(cats || []);
    } catch (error) {
      console.error(error);
    }
  };

  // ========================= Manejadores =========================
  const manejarCambio = (e) => setInfoProducto({ ...infoProducto, [e.target.name]: e.target.value });
  const manejarBooleano = (campo, value) => setInfoProducto({ ...infoProducto, [campo]: value });

  // ========================= Categorías =========================
  const agregarCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return notify.error("Escribe una categoría");
    try {
      await categoriasAPI.create(nuevaCategoria);
      notify.success("Categoría agregada");
      setNuevaCategoria("");
      cargarCategorias();
    } catch (error) {
      notify.error(error.message || "Error al agregar categoría");
    }
  };

  const eliminarCategoria = async (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await categoriasAPI.delete(id);
      notify.success("Categoría eliminada");
      cargarCategorias();
    } catch (error) {
      notify.error(error.message || "Error al eliminar categoría");
    }
  };

  const guardarEdicion = async (id) => {
    try {
      await categoriasAPI.update(id, nombreEditado);
      notify.success("Categoría actualizada");
      setCategoriaEditando(null);
      setNombreEditado("");
      cargarCategorias();
    } catch (error) {
      notify.error(error.message || "Error al actualizar categoría");
    }
  };

  // ========================= Enviar Producto =========================
  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!infoProducto.categoria) return notify.error("Selecciona una categoría");

    setCargando(true);
    try {
      const productoData = { ...infoProducto, precio_venta: Number(infoProducto.precio_original) };
      await productosAPI.create(productoData, []); // Sin imágenes

      notify.success("Producto agregado al catálogo");
      setInfoProducto({
        nombre: "", descripcion: "", precio_compra: "", precio_original: "",
        precio_oferta: "", categoria: "", cantidad: "", stock_minimo: 5,
        marca: "", color: "", proveedor_id: "", codigo_barras: "",
        caracteristicas: ["", "", ""],
        barcodes_agrupados: [],
        oferta: false, destacado: false, es_nuevo: true,
        variaciones: [],
      });
      setTempBarcode("");
      cargarDatos();
    } catch (error) {
      notify.error(error.message || "Error al procesar registro");
    }
    setCargando(false);
  };

  return (
    <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
              <Package className="text-indigo-600" size={32} />
              GESTIÓN DE <span className="text-indigo-600">CATÁLOGO</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest">Control maestro de inventario y categorías</p>
          </div>
        </div>

        {/* CATEGORÍAS SECTION */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Tag className="text-slate-400" size={20} />
            <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Taxonomía / Categorías</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <div className="card-standard p-6 border-dashed border-2">
                <label className="label-standard mb-3 px-1 text-indigo-500">Registrar Nueva</label>
                <div className="flex gap-2">
                  <input
                    value={nuevaCategoria}
                    onChange={e => setNuevaCategoria(e.target.value)}
                    placeholder="Ej. Lácteos, Bebidas..."
                    className="input-standard h-[50px] font-bold"
                  />
                  <button
                    onClick={agregarCategoria}
                    className="btn-primary flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 w-14 h-[50px] justify-center"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-3 font-bold uppercase tracking-widest px-1">Organiza tus productos para mejores reportes</p>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="card-standard p-0 overflow-hidden shadow-md">
                <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em] border-b dark:border-slate-700/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4">Nombre de Categoría</th>
                        <th className="px-6 py-4 text-right">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {categorias.length === 0 ? (
                        <tr>
                          <td colSpan="2" className="py-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Sin categorías definidas</td>
                        </tr>
                      ) : (
                        categorias.map(cat => (
                          <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all group">
                            <td className="px-6 py-4">
                              {categoriaEditando === cat.id ? (
                                <input
                                  autoFocus
                                  value={nombreEditado}
                                  onChange={e => setNombreEditado(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-indigo-500 rounded-lg px-3 py-1 text-xs font-bold outline-none"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-40"></div>
                                  <span className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-tight">{cat.nombre}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {categoriaEditando === cat.id ? (
                                  <>
                                    <button onClick={() => guardarEdicion(cat.id)} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"><Check size={18} /></button>
                                    <button onClick={() => setCategoriaEditando(null)} className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"><X size={18} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { setCategoriaEditando(cat.id); setNombreEditado(cat.nombre); }} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Pencil size={16} /></button>
                                    <button onClick={() => eliminarCategoria(cat.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                  </>
                                )}
                              </div>
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

        {/* FORMULARIO PRODUCTO */}
        <div className="flex items-center gap-3 mb-6">
          <PlusCircle className="text-slate-400" size={20} />
          <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Alta de Producto <span className="text-indigo-500 text-xs ml-2">/ Master Data</span></h2>
        </div>

        <div className="card-standard p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 dark:bg-slate-900/40 rounded-full -mr-32 -mt-32 pointer-events-none"></div>

          <form
            onSubmit={manejarEnvio}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                if (e.target.name !== 'tempBarcode' && e.target.placeholder !== "Escanea aquí todos los códigos...") {
                  e.preventDefault();
                }
              }
            }}
            className="space-y-8 relative z-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Bloque Identificación */}
              <div className="md:col-span-2 space-y-6">
                <div>
                  <label className="label-standard mb-3 px-1">Descriptor Comercial *</label>
                  <input
                    name="nombre"
                    value={infoProducto.nombre}
                    onChange={manejarCambio}
                    placeholder="Ej: Sabritas Original 45g"
                    className="input-standard h-[56px] font-black text-lg"
                    required
                  />
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border dark:border-slate-700/50">
                  <label className="label-standard mb-3 px-1 flex items-center gap-2">
                    <div className="w-1.5 h-3 bg-indigo-500 rounded-full"></div>
                    ASIGNACIÓN DE CÓDIGOS EAN/UPC
                  </label>
                  <input
                    name="tempBarcode"
                    value={tempBarcode}
                    onChange={e => setTempBarcode(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = tempBarcode.trim();
                        if (!val) return;
                        if (val === infoProducto.codigo_barras || infoProducto.barcodes_agrupados.includes(val)) {
                          return notify.error("Código duplicado en la sesión");
                        }
                        if (!infoProducto.codigo_barras) {
                          setInfoProducto(prev => ({ ...prev, codigo_barras: val }));
                        } else {
                          setInfoProducto(prev => ({ ...prev, barcodes_agrupados: [...prev.barcodes_agrupados, val] }));
                        }
                        setTempBarcode("");
                      }
                    }}
                    placeholder="Escanea o escribe para agrupar..."
                    className="input-standard h-[50px] font-mono tracking-widest text-sm bg-white dark:bg-slate-800"
                  />

                  <div className="flex flex-wrap gap-2 mt-4">
                    {infoProducto.codigo_barras && (
                      <div className="badge-standard bg-indigo-600 text-white flex items-center gap-3 pr-2 py-1.5 shadow-lg border-none">
                        <span className="text-[7px] font-black opacity-40 tracking-widest">MASTER:</span>
                        <span className="font-mono">{infoProducto.codigo_barras}</span>
                        <button type="button" onClick={() => {
                          if (infoProducto.barcodes_agrupados.length > 0) {
                            const newBase = infoProducto.barcodes_agrupados[0];
                            setInfoProducto(prev => ({
                              ...prev,
                              codigo_barras: newBase,
                              barcodes_agrupados: prev.barcodes_agrupados.slice(1)
                            }));
                          } else {
                            setInfoProducto(prev => ({ ...prev, codigo_barras: "" }));
                          }
                        }} className="hover:text-rose-400 p-1"><X size={14} /></button>
                      </div>
                    )}
                    {infoProducto.barcodes_agrupados.map((b, idx) => (
                      <div key={idx} className="badge-standard bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-3 pr-2 py-1.5 border dark:border-slate-700/80 shadow-sm">
                        <span className="font-mono">{b}</span>
                        <button type="button" onClick={() => setInfoProducto(prev => ({ ...prev, barcodes_agrupados: prev.barcodes_agrupados.filter((_, i) => i !== idx) }))} className="hover:text-rose-500 p-1 text-slate-300"><X size={14} /></button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-3">
                    <AlertCircle size={14} className="text-amber-500 mt-0.5" />
                    <p className="text-[9px] font-bold text-amber-700 dark:text-amber-500/80 uppercase tracking-widest leading-normal">
                      Si agrupas códigos, se manejarán como el mismo ítem con <b>stock compartido</b>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloque Clasificación y Stock */}
              <div className="md:col-span-2 space-y-6">
                <div>
                  <label className="label-standard mb-3 px-1 text-indigo-500">Categoría del Sistema *</label>
                  <select
                    value={infoProducto.categoria}
                    onChange={e => setInfoProducto({ ...infoProducto, categoria: e.target.value })}
                    className="select-standard h-[56px] font-black text-slate-700 dark:text-slate-200"
                    required
                  >
                    <option value="">Seleccionar Categoría...</option>
                    {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="label-standard mb-3 px-1">Existencia Inicial *</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="cantidad"
                        value={infoProducto.cantidad}
                        onChange={manejarCambio}
                        placeholder="0"
                        className="input-standard h-[56px] font-black text-center text-xl"
                        required
                      />
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-200" size={18} />
                    </div>
                  </div>
                  <div>
                    <label className="label-standard mb-3 px-1">Stock de Alerta</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="stock_minimo"
                        value={infoProducto.stock_minimo}
                        onChange={manejarCambio}
                        placeholder="5"
                        className="input-standard h-[56px] font-black text-center text-xl border-rose-100 dark:border-rose-900/30 focus:border-rose-500"
                      />
                      <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-200 dark:text-rose-900/50" size={18} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque Precios */}
              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t dark:border-slate-700/50">
                <div>
                  <label className="label-standard mb-3 px-1 uppercase tracking-[0.2em] font-black text-slate-400">Costo de Adquisición</label>
                  <div className="relative">
                    <input
                      type="number" step="0.01"
                      name="precio_compra"
                      value={infoProducto.precio_compra}
                      onChange={manejarCambio}
                      className="input-standard h-[64px] pl-10 text-indigo-600 dark:text-indigo-400 font-black text-2xl"
                      required
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 font-bold text-xl">{currency}</span>
                  </div>
                </div>
                <div>
                  <label className="label-standard mb-3 px-1 uppercase tracking-[0.2em] font-black text-slate-400">Precio de Venta</label>
                  <div className="relative">
                    <input
                      type="number" step="0.01"
                      name="precio_original"
                      value={infoProducto.precio_original}
                      onChange={manejarCambio}
                      className="input-standard h-[64px] pl-10 text-emerald-600 dark:text-emerald-400 font-black text-2xl border-emerald-100 dark:border-emerald-900/30 focus:border-emerald-500"
                      required
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300 font-bold text-xl">{currency}</span>
                  </div>
                </div>
                <div>
                  <label className="label-standard mb-3 px-1 uppercase tracking-[0.2em] font-black text-slate-400">Precio en Oferta</label>
                  <div className="relative">
                    <input
                      type="number" step="0.01"
                      name="precio_oferta"
                      value={infoProducto.precio_oferta}
                      onChange={manejarCambio}
                      className="input-standard h-[64px] pl-10 text-rose-500 font-black text-2xl border-rose-100 dark:border-rose-900/30 focus:border-rose-500"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 font-bold text-xl">{currency}</span>
                  </div>
                </div>
              </div>

              {/* Margen Informativo */}
              {infoProducto.precio_compra && (infoProducto.precio_original || infoProducto.precio_oferta) && (
                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Margen Precio Normal */}
                  {infoProducto.precio_original && (
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-[2rem] border border-indigo-100 dark:border-indigo-800/20 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm border dark:border-slate-700/50">
                          <DollarSign size={28} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1.5 text-center md:text-left">Rendimiento Normal</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center md:text-left">
                            Utilidad base: <span className="text-indigo-600 dark:text-indigo-400 font-black">{currency}{(Number(infoProducto.precio_original) - Number(infoProducto.precio_compra)).toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl border dark:border-slate-700 shadow-inner min-w-[120px]">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Margen %</p>
                        <div className="text-center">
                          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                            +{((Number(infoProducto.precio_compra) > 0) ? (((Number(infoProducto.precio_original) - Number(infoProducto.precio_compra)) / Number(infoProducto.precio_compra)) * 100) : 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Margen Precio Oferta */}
                  {infoProducto.precio_oferta && (
                    <div className="bg-rose-50/50 dark:bg-rose-900/10 p-5 rounded-[2rem] border border-rose-100 dark:border-rose-800/20 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-rose-500 shadow-sm border dark:border-slate-700/50">
                          <Tag size={28} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1.5 text-center md:text-left">Rendimiento Oferta</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center md:text-left">
                            Utilidad oferta: <span className="text-rose-600 dark:text-rose-400 font-black">{currency}{(Number(infoProducto.precio_oferta) - Number(infoProducto.precio_compra)).toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl border dark:border-slate-700 shadow-inner min-w-[120px]">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Margen %</p>
                        <div className="text-center">
                          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">
                            +{((Number(infoProducto.precio_compra) > 0) ? (((Number(infoProducto.precio_oferta) - Number(infoProducto.precio_compra)) / Number(infoProducto.precio_compra)) * 100) : 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 mt-6 border-t dark:border-slate-700/50">
              <label className="flex items-center gap-4 cursor-pointer group bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700 transition-all hover:bg-white dark:hover:bg-slate-800">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={infoProducto.oferta}
                    onChange={e => manejarBooleano("oferta", e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded-lg"
                  />
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest">Activar Etiqueta de Oferta</span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 opacity-60">Visibilidad prioritaria en el POS</p>
                </div>
              </label>

              <button
                disabled={cargando}
                className="btn-primary w-full sm:w-auto px-12 h-[64px] bg-indigo-600 hover:bg-indigo-700 border-none shadow-xl shadow-indigo-500/20 gap-3"
              >
                {cargando ? (
                  <RefreshCw size={24} className="animate-spin" />
                ) : (
                  <>
                    <Save size={22} />
                    <span>CONFIRMAR ALTA DE PRODUCTO</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StoreAddProduct;
