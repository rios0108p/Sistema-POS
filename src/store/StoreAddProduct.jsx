import { useState, useEffect } from "react";
import { categoriasAPI, productosAPI, tiendasAPI } from "../services/api";
import { Plus, Save, RefreshCw, X, Box, Tag, Layers, AlertCircle, Percent, Barcode, Warehouse } from "lucide-react";
import { useNotify } from "../hooks/useNotify";
import { CURRENCY_SYMBOL } from "../utils/currency";

const TAX_OPTIONS = [
  { label: 'Exento de Impuestos (0%) - Alimentos básicos, medicinas, campo', value: '[]' },
  { label: 'IVA 16% (General) - Electrónica, abarrotes, ropa, etc.', value: '[{"tipo":"IVA","porcentaje":16}]' },
  { label: 'IVA 8% (Fronterizo) - Mayoría de productos en Zonas Fronterizas', value: '[{"tipo":"IVA","porcentaje":8}]' },
  { label: 'IEPS 8% (Chatarra) - Botanitas, papas, galletas, dulces', value: '[{"tipo":"IEPS","porcentaje":8}]' },
  { label: 'IEPS 8% + IVA 16% - Refrescos y bebidas azucaradas', value: '[{"tipo":"IEPS","porcentaje":8},{"tipo":"IVA","porcentaje":16}]' },
  { label: 'IEPS 26.5% + IVA 16% - Cervezas (hasta 14° GL)', value: '[{"tipo":"IEPS","porcentaje":26.5},{"tipo":"IVA","porcentaje":16}]' },
  { label: 'IEPS 30% + IVA 16% - Vinos y Licores (14° a 20° GL)', value: '[{"tipo":"IEPS","porcentaje":30},{"tipo":"IVA","porcentaje":16}]' },
  { label: 'IEPS 53% + IVA 16% - Vinos y Licores (Más de 20° GL)', value: '[{"tipo":"IEPS","porcentaje":53},{"tipo":"IVA","porcentaje":16}]' },
  { label: 'IEPS 160% + IVA 16% - Cigarros y Puros', value: '[{"tipo":"IEPS","porcentaje":160},{"tipo":"IVA","porcentaje":16}]' },
];

const StoreAddProduct = () => {
  const notify = useNotify();
  const currency = CURRENCY_SYMBOL;

  // Estados de datos
  const [categorias, setCategorias] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState("");
  const [pctGanancia, setPctGanancia] = useState("");
  
  const [infoProducto, setInfoProducto] = useState({
    nombre: "", 
    precio_compra: "", 
    precio_original: "",
    precio_oferta: "", 
    categoria: "", 
    cantidad: "", 
    stock_minimo: 5, 
    marca: "", 
    codigo_barras: "",
    caracteristicas: [],
    barcodes_agrupados: [],
    oferta: false, 
    destacado: false, 
    es_nuevo: true,
    impuestos: [],
  });

  const [tempBarcode, setTempBarcode] = useState("");
  const [cargando, setCargando] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");

  const cargarDatos = async () => {
    try {
      const [cats, stors] = await Promise.all([
        categoriasAPI.getAll(),
        tiendasAPI.getAll()
      ]);
      setCategorias(Array.isArray(cats) ? cats : []);
      setTiendas(Array.isArray(stors) ? stors : []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const manejarCambio = (e) => setInfoProducto({ ...infoProducto, [e.target.name]: e.target.value });

  const agregarCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return notify.error("Escribe el nombre de la categoría");
    try {
      await categoriasAPI.create(nuevaCategoria);
      notify.success("Categoría agregada exitosamente");
      setNuevaCategoria("");
      cargarDatos();
    } catch (error) {
      notify.error(error.message || "Error al agregar categoría");
    }
  };

  const eliminarCategoria = async (id) => {
    try {
      await categoriasAPI.delete(id);
      notify.success("Categoría eliminada");
      cargarDatos();
    } catch (error) {
      notify.error(error.message || "Error al eliminar categoría");
    }
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!infoProducto.categoria) return notify.error("Selecciona una categoría");
    
    setCargando(true);
    try {
      const productoData = { ...infoProducto, precio_venta: Number(infoProducto.precio_original) };
      
      const res = await productosAPI.create(productoData, []); // Sin fotos como pidió anteriormente

      if (tiendaSeleccionada) {
        await tiendasAPI.asignarProducto(
          tiendaSeleccionada, 
          res.id, 
          infoProducto.cantidad || 0, 
          infoProducto.stock_minimo || 5
        );
      }

      notify.success("¡Producto registrado con éxito!");
      
      setInfoProducto({
        nombre: "", precio_compra: "", precio_original: "",
        precio_oferta: "", categoria: "", cantidad: "", stock_minimo: 5,
        marca: "", codigo_barras: "",
        caracteristicas: [], barcodes_agrupados: [],
        oferta: false, destacado: false, es_nuevo: true, impuestos: []
      });
      setTempBarcode("");
      setTiendaSeleccionada("");
    } catch (error) {
      notify.error(error.message || "Error al procesar registro");
    }
    setCargando(false);
  };

  return (
    <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera Tipo Pill */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-inner shadow-indigo-400">
              <Plus size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">ALTA DE PRODUCTO</h1>
              <p className="text-xs font-bold text-slate-400 tracking-[0.2em] uppercase">Registro Maestro de Inventario</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowCatForm(!showCatForm)} className="flex items-center gap-2 px-6 py-3 border-2 border-slate-100 rounded-full text-xs font-bold text-indigo-600 hover:bg-slate-50 transition-colors">
            <Tag size={14} /> GESTIONAR CATEGORÍAS
          </button>
        </div>

        {/* Formulario Gestión de Categorías */}
        {showCatForm && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-indigo-800 uppercase tracking-wider">Gestionar Categorías</h3>
              <button type="button" onClick={() => setShowCatForm(false)} className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-xl"><X size={16}/></button>
            </div>
            <form onSubmit={agregarCategoria} className="flex items-center gap-3">
              <input autoFocus value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} placeholder="Nueva categoría..." className="flex-1 px-4 py-2 text-sm rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 text-sm whitespace-nowrap">+ Agregar</button>
            </form>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {categorias.length === 0 && <p className="text-xs text-slate-400 italic">Sin categorías registradas</p>}
              {categorias.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 bg-white border border-indigo-100 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-bold text-slate-700">{c.nombre}</span>
                  <button type="button" onClick={() => eliminarCategoria(c.id)} className="text-rose-400 hover:text-rose-600 transition-colors ml-1"><X size={11}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          
          <div className="space-y-6">
            {/* SECCIÓN 1: Identidad */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                <h3 className="text-xs font-black text-slate-400 tracking-[0.2em] uppercase flex items-center gap-2">
                  <Layers size={14} /> Identidad del Producto
                </h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-500 tracking-wider uppercase mb-1">Descriptor Comercial *</label>
                  <input name="nombre" value={infoProducto.nombre} onChange={manejarCambio} placeholder="Ej: Sabritas Original 45g" className="w-full text-lg font-bold text-slate-700 bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 focus:outline-none py-2 transition-colors placeholder:text-slate-300 placeholder:font-normal" required />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-500 tracking-wider uppercase mb-1">Categoría *</label>
                    <select name="categoria" value={infoProducto.categoria} onChange={manejarCambio} className="w-full text-sm font-bold text-slate-700 bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 focus:outline-none py-2 pb-3 transition-colors cursor-pointer" required>
                      <option value="">Seleccionar...</option>
                      {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Marca</label>
                    <input name="marca" value={infoProducto.marca} onChange={manejarCambio} placeholder="Ej: Coca Cola, Sabritas..." className="w-full text-sm font-bold text-slate-700 bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 focus:outline-none py-2 transition-colors placeholder:text-slate-300 placeholder:font-normal" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: Logística y Entradas */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-50 rounded-tl-full -mr-20 -mb-20 opacity-50 pointer-events-none"></div>
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                <h3 className="text-xs font-black text-slate-400 tracking-[0.2em] uppercase flex items-center gap-2">
                  <Box size={14} /> Logística y Existencias
                </h3>
              </div>
              
              <div className="space-y-8">
                <div className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                   <div className="flex-1">
                     <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2">
                       <Warehouse size={12} className="text-indigo-500" /> Destino (Sucursal)
                     </label>
                     <select value={tiendaSeleccionada} onChange={(e) => setTiendaSeleccionada(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-transparent border-b-2 border-indigo-200 focus:border-indigo-600 focus:outline-none py-2 pb-3 transition-colors cursor-pointer text-center">
                        <option value="" disabled>— Seleccione sucursal —</option>
                        {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2">
                      <Box size={12} className="text-slate-300" /> Entrada Inicial *
                    </label>
                    <input type="number" name="cantidad" value={infoProducto.cantidad} onChange={manejarCambio} placeholder="0" className="w-full text-center text-3xl font-black text-slate-700 bg-transparent py-2 border-b-2 border-slate-100 focus:border-emerald-500 focus:outline-none" required />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-rose-500 tracking-wider uppercase mb-2">
                      <AlertCircle size={12} /> Punto de Reorden
                    </label>
                    <input type="number" name="stock_minimo" value={infoProducto.stock_minimo} onChange={manejarCambio} placeholder="5" className="w-full text-center text-3xl font-black text-slate-700 bg-transparent py-2 border-b-2 border-slate-100 focus:border-rose-500 focus:outline-none" />
                  </div>
                </div>

                <div>
                   <label className="block text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3">Asignación de Códigos Maestros y Alias</label>
                   <div className="relative">
                      <Barcode size={18} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-300" />
                      <input 
                        value={tempBarcode} 
                        onChange={e => setTempBarcode(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!tempBarcode.trim()) return;
                            if (!infoProducto.codigo_barras) {
                              setInfoProducto({ ...infoProducto, codigo_barras: tempBarcode.trim() });
                            } else if (!infoProducto.barcodes_agrupados.includes(tempBarcode.trim()) && infoProducto.codigo_barras !== tempBarcode.trim()) {
                              setInfoProducto({ ...infoProducto, barcodes_agrupados: [...infoProducto.barcodes_agrupados, tempBarcode.trim()] });
                            }
                            setTempBarcode("");
                          }
                        }} 
                        placeholder="Escanea aquí para agrupar..." 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-slate-300" 
                      />
                   </div>
                   {(infoProducto.codigo_barras || infoProducto.barcodes_agrupados.length > 0) && (
                     <div className="flex flex-wrap gap-2 mt-4 p-4 bg-slate-50 rounded-xl">
                        {infoProducto.codigo_barras && (
                          <div className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2">
                            {infoProducto.codigo_barras}
                            <X size={14} className="cursor-pointer hover:text-indigo-200" onClick={() => {
                              if (infoProducto.barcodes_agrupados.length > 0) {
                                setInfoProducto({...infoProducto, codigo_barras: infoProducto.barcodes_agrupados[0], barcodes_agrupados: infoProducto.barcodes_agrupados.slice(1)});
                              } else {
                                setInfoProducto({...infoProducto, codigo_barras: ""});
                              }
                            }} />
                          </div>
                        )}
                        {infoProducto.barcodes_agrupados.map((b, idx) => (
                          <div key={b} className="bg-white border text-slate-600 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2">
                            {b} <X size={14} className="cursor-pointer hover:text-rose-500" onClick={() => setInfoProducto({...infoProducto, barcodes_agrupados: infoProducto.barcodes_agrupados.filter((_, i) => i !== idx)})} />
                          </div>
                        ))}
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA 2 */}
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                <h3 className="text-xs font-black text-slate-400 tracking-[0.2em] uppercase flex items-center gap-2">
                  <Percent size={14} /> Modelado de Precios
                </h3>
              </div>

              <div className="space-y-6 flex-col flex-1">

                {/* Marco Fiscal - arriba para que afecte los cálculos */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2">Marco Fiscal</label>
                  <select
                    value={JSON.stringify(infoProducto.impuestos)}
                    onChange={e => setInfoProducto({...infoProducto, impuestos: JSON.parse(e.target.value)})}
                    className="w-full text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none py-2.5 px-3 rounded-xl cursor-pointer"
                  >
                    {TAX_OPTIONS.map((opt, idx) => <option key={idx} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>

                {/* Costo */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1">Costo (Precio de Compra)</label>
                  <div className="flex items-center">
                    <span className="text-xl font-black text-slate-300 mr-2">{currency}</span>
                    <input type="number" step="0.01" name="precio_compra" value={infoProducto.precio_compra} onChange={manejarCambio} className="w-full text-2xl font-black text-slate-700 bg-transparent border-b-2 border-slate-100 focus:border-blue-500 focus:outline-none py-2 transition-colors" required />
                  </div>
                </div>

                {/* % Ganancia → calcula precio de venta automáticamente */}
                <div>
                  <label className="block text-[10px] font-bold text-amber-500 tracking-wider uppercase mb-1">% Ganancia deseada</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.1" placeholder="ej: 30"
                      value={pctGanancia}
                      onChange={e => {
                        setPctGanancia(e.target.value);
                        const costo = Number(infoProducto.precio_compra);
                        if (!costo || e.target.value === '') return;
                        const base = costo * (1 + parseFloat(e.target.value) / 100);
                        let final = base;
                        const ieps = infoProducto.impuestos.find(i => i.tipo === 'IEPS');
                        if (ieps) final *= (1 + ieps.porcentaje / 100);
                        const iva = infoProducto.impuestos.find(i => i.tipo === 'IVA');
                        if (iva) final *= (1 + iva.porcentaje / 100);
                        setInfoProducto(prev => ({ ...prev, precio_original: final.toFixed(2) }));
                      }}
                      className="w-full text-2xl font-black text-amber-600 bg-transparent border-b-2 border-slate-100 focus:border-amber-400 focus:outline-none py-2 transition-colors placeholder:text-slate-200 placeholder:text-xl"
                    />
                    <span className="text-2xl font-black text-amber-300">%</span>
                  </div>
                </div>

                {/* Precio de Venta (precio final que paga el cliente, YA incluye IVA) */}
                <div>
                  <label className="block text-[10px] font-bold text-emerald-500 tracking-wider uppercase mb-1">Precio de Venta Público <span className="text-slate-400 normal-case font-normal">(IVA incluido)</span></label>
                  <div className="flex items-center">
                    <span className="text-xl font-black text-emerald-300 mr-2">{currency}</span>
                    <input
                      type="number" step="0.01" name="precio_original" value={infoProducto.precio_original}
                      onChange={e => {
                        manejarCambio(e);
                        const costo = Number(infoProducto.precio_compra);
                        const final = Number(e.target.value);
                        if (!costo || !final) return;
                        let taxFactor = 1;
                        const ieps = infoProducto.impuestos.find(i => i.tipo === 'IEPS');
                        if (ieps) taxFactor *= (1 + ieps.porcentaje / 100);
                        const iva = infoProducto.impuestos.find(i => i.tipo === 'IVA');
                        if (iva) taxFactor *= (1 + iva.porcentaje / 100);
                        const base = final / taxFactor;
                        const pct = ((base - costo) / costo) * 100;
                        setPctGanancia(isFinite(pct) ? pct.toFixed(1) : '');
                      }}
                      className="w-full text-2xl font-black text-emerald-600 bg-transparent border-b-2 border-slate-100 focus:border-emerald-500 focus:outline-none py-2 transition-colors" required
                    />
                  </div>
                </div>

                {/* Precio en Oferta */}
                <div>
                  <label className="block text-[10px] font-bold text-rose-500 tracking-wider uppercase mb-1">Precio en Oferta (Opcional)</label>
                  <div className="flex items-center">
                    <span className="text-xl font-black text-rose-300 mr-2">{currency}</span>
                    <input type="number" step="0.01" name="precio_oferta" value={infoProducto.precio_oferta} onChange={manejarCambio} className="w-full text-2xl font-black text-rose-500 bg-transparent border-b-2 border-slate-100 focus:border-rose-500 focus:outline-none py-2 transition-colors" />
                  </div>
                </div>

                {/* Desglose estilo Eleventa */}
                {infoProducto.precio_compra && infoProducto.precio_original && (() => {
                  const costo = Number(infoProducto.precio_compra) || 0;
                  const final = Number(infoProducto.precio_original) || 0;
                  const ieps = infoProducto.impuestos.find(i => i.tipo === 'IEPS');
                  const iva  = infoProducto.impuestos.find(i => i.tipo === 'IVA');
                  let taxFactor = 1;
                  if (ieps) taxFactor *= (1 + ieps.porcentaje / 100);
                  if (iva)  taxFactor *= (1 + iva.porcentaje  / 100);
                  const base      = taxFactor > 1 ? final / taxFactor : final;
                  const iepsAmt   = ieps ? base * (ieps.porcentaje / 100) : 0;
                  const ivaAmt    = iva  ? (base + iepsAmt) * (iva.porcentaje / 100) : 0;
                  const ganancia  = base - costo;
                  const margen    = costo > 0 ? (ganancia / costo) * 100 : 0;
                  return (
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-emerald-50/20 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-3">Desglose de Precio</p>
                      <div className="space-y-2 text-sm font-bold">
                        <div className="flex justify-between text-slate-600">
                          <span>Precio sin impuestos</span>
                          <span className="font-black text-slate-800">{currency}{base.toFixed(2)}</span>
                        </div>
                        {ieps && (
                          <div className="flex justify-between text-amber-600">
                            <span>+ IEPS {ieps.porcentaje}%</span>
                            <span>+ {currency}{iepsAmt.toFixed(2)}</span>
                          </div>
                        )}
                        {iva && (
                          <div className="flex justify-between text-blue-600">
                            <span>+ IVA {iva.porcentaje}%</span>
                            <span>+ {currency}{ivaAmt.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-800 font-black">
                          <span>= Precio Final</span>
                          <span>{currency}{final.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className={`mt-4 flex items-center justify-between px-4 py-3 rounded-xl ${ganancia >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                        <span className="text-[10px] font-black tracking-wider uppercase text-slate-500">Ganancia</span>
                        <div>
                          <span className={`text-xl font-black ${ganancia >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{currency}{ganancia.toFixed(2)}</span>
                          <span className={`text-xs font-bold ml-2 ${margen >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>({margen.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>

            </div>
          </div>

          <div className="absolute -bottom-20 right-0 w-full flex justify-end">
            <button disabled={cargando} className="flex items-center gap-3 px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-70 disabled:cursor-not-allowed">
              {cargando ? <RefreshCw className="animate-spin" size={20} /> : 'Registrar Producto en Sistema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreAddProduct;
