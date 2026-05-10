import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Loading from "../Components/Common/Loading";
import { productosAPI, getImageUrl, tiendasAPI } from "../services/api";
import PinValidationModal from "./components/PinValidationModal";
import BarcodeTagGenerator from "./components/BarcodeTagGenerator";
import { useAuth } from "../context/AuthContext";
import useOfflineOperation from "../hooks/useOfflineOperation";
import { Pencil, Trash2, Save, X, RefreshCw, Package, Barcode, DollarSign, Tag, Layers, Search, Store, Download, Upload, FileText, ChevronRight, LayoutDashboard, List, TrendingUp, TrendingDown, PieChart as PieChartIcon, ArrowRight, AlertTriangle } from "lucide-react";
import { CURRENCY_SYMBOL } from "../utils/currency";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { normalizeProduct, calculateInventoryStats } from "../utils/productUtils";
import { formatDate } from "../utils/dateUtils";
import { cleanCurrency, normalizeText } from "../utils/formatUtils";

const StoreManageProducts = () => {
  const { storeConfig, user } = useAuth();
  const moneda = CURRENCY_SYMBOL;

  const { execute: executeProduct } = useOfflineOperation('products');
  const { execute: executeInventory } = useOfflineOperation('store_inventory');

  const [viewMode, setViewMode] = useState("list"); // "list" o "analytics"

  const [cargando, setCargando] = useState(true);
  const [productos, setProductos] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(user?.tienda_id || ""); // Default a la tienda del usuario
  const [editandoId, setEditandoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formularioEdicion, setFormularioEdicion] = useState({
    nombre: "",
    codigo_barras: "",
    descripcion: "",
    precio_compra: 0,
    precio_venta: 0,
    precio_oferta: 0,
    imagenes: [],
    oferta: false,
    stock_minimo: 5,
    variaciones: [],
    barcodes_agrupados: [],
    impuestos: [],
  });
  const [tempBarcode, setTempBarcode] = useState("");
  const [nuevoImpuesto, setNuevoImpuesto] = useState({ tipo: "IVA", porcentaje: 16 });

  // --- Security PIN ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'DELETE_PRODUCT', id: 123 }
  const [tagModal, setTagModal] = useState({ open: false, product: null });

  const obtenerTiendas = async () => {
    try {
      const data = await tiendasAPI.getAll();
      setTiendas(data || []);
      // Auto-seleccionar primera tienda si no hay ninguna seleccionada
      if (!tiendaSeleccionada && data?.length > 0) {
        setTiendaSeleccionada(data[0].id);
      }
    } catch (error) {
      console.error("Error al cargar tiendas:", error);
    }
  };

  const obtenerProductos = async () => {
    setCargando(true);
    try {
      let data;
      if (tiendaSeleccionada) {
        data = await tiendasAPI.getProductos(tiendaSeleccionada);
      } else {
        data = await productosAPI.getAll();
      }

      const fixedData = (Array.isArray(data) ? data : []).map((item) => {
        return normalizeProduct(item, !tiendaSeleccionada);
      }).filter(Boolean);
      setProductos(fixedData);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar productos");
    } finally {
      setCargando(false);
    }
  };

  const alternarStock = async (productoId, estadoActual) => {
    const nuevoEstado = !estadoActual;
    try {
      const producto = productos.find(p => p.id === productoId);

      if (tiendaSeleccionada) {
        await executeInventory('update', {
          ...producto.datosOriginales,
          activo: nuevoEstado
        }, `${tiendaSeleccionada}_${productoId}`);
      } else {
        const payload = { ...producto.datosOriginales, activo: nuevoEstado };
        if (payload.precio_oferta === null) payload.precio_oferta = "";
        if (payload.proveedor_id === null) payload.proveedor_id = "";
        if (payload.codigo_barras === null) payload.codigo_barras = "";
        const r1 = await executeProduct('update', payload, productoId);
        if (r1?.mode === 'api') await productosAPI.update(producto.datosOriginales.id || productoId, payload);
      }

      setProductos(prev => prev.map(p => p.id === productoId ? { ...p, enStock: nuevoEstado } : p));
      toast.success("Visibilidad actualizada");
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar");
    }
  };

  const alternarOferta = async (productoId, estadoActual) => {
    const nuevoEstado = !estadoActual;
    try {
      const producto = productos.find(p => p.id === productoId);
      const payload = { ...producto.datosOriginales, oferta: nuevoEstado };
      if (payload.precio_oferta === null) payload.precio_oferta = "";
      if (payload.proveedor_id === null) payload.proveedor_id = "";
      if (payload.codigo_barras === null) payload.codigo_barras = "";

      const r2 = await executeProduct('update', payload, productoId);
      if (r2?.mode === 'api') await productosAPI.update(producto.datosOriginales.id || productoId, payload);
      setProductos(prev => prev.map(p => p.id === productoId ? { ...p, ofertaActiva: nuevoEstado } : p));
      toast.success("Estado de oferta actualizado");
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar");
    }
  };

  const iniciarEdicion = (producto) => {
    if (storeConfig && storeConfig.requerir_pin === false) {
      executeIniciarEdicion(producto);
      return;
    }
    setPendingAction({ type: 'EDIT_PRODUCT', producto });
    setShowPinModal(true);
  };

  const executeIniciarEdicion = (producto) => {
    setEditandoId(producto.id);
    setFormularioEdicion({
      nombre: producto.datosOriginales.nombre,
      codigo_barras: producto.datosOriginales.codigo_barras || "",
      descripcion: producto.datosOriginales.descripcion,
      precio_compra: producto.datosOriginales.precio_compra || 0,
      precio_venta: producto.datosOriginales.precio_venta,
      precio_oferta: producto.datosOriginales.precio_oferta,
      imagenes: producto.datosOriginales.imagenes,
      oferta: Boolean(producto.datosOriginales.oferta),
      stock_minimo: producto.datosOriginales.stock_minimo ?? 5,
      variaciones: producto.datosOriginales.variaciones || [],
      barcodes_agrupados: producto.datosOriginales.barcodes_agrupados || [],
      impuestos: producto.datosOriginales.impuestos || [],
    });
    setTempBarcode("");
    setNuevoImpuesto({ tipo: "IVA", porcentaje: 16 });
  };

  const exportToExcel = () => {
    try {
      const data = filteredProducts.map(p => ({
        "ID Producto": p.id,
        "Nombre": p.name,
        "Código de Barras": p.barcode,
        "Precio Compra": p.datosOriginales.precio_compra || 0,
        "Precio Venta": p.mrp,
        "Precio Oferta": p.ofertaActiva ? p.price : "N/A",
        "Stock Actual": p.cantidad,
        "Stock Mínimo": p.stockMinimo,
        "Categoría": p.datosOriginales.categoria || ""
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventario");
      const fileName = `Inventario_${tiendaSeleccionada ? tiendas.find(t => t.id === tiendaSeleccionada)?.nombre : "Global"}_${formatDate(new Date())}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Excel generado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar a Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const title = `Inventario - ${tiendaSeleccionada ? tiendas.find(t => t.id === tiendaSeleccionada)?.nombre : "Almacén Global"}`;

      doc.setFontSize(18);
      doc.text(title, 14, 22);
      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 30);

      const tableData = filteredProducts.map(p => [
        p.id,
        p.name,
        p.barcode,
        `${moneda}${p.mrp.toFixed(2)}`,
        p.cantidad,
        p.stockMinimo
      ]);

      doc.autoTable({
        startY: 35,
        head: [['ID', 'Producto', 'Código', 'Precio', 'Stock', 'Mín']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [63, 81, 181] }
      });

      doc.save(`Inventario_${new Date().getTime()}.pdf`);
      toast.success("PDF generado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar a PDF");
    }
  };

  const handleImportExcel = async (e) => {
    // Ya no se restringe a que haya una tienda seleccionada
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        const normalizeKey = (k) => normalizeText(k).trim();

        const items = data.map(rawRow => {
          const row = {};
          for (const key in rawRow) {
            row[normalizeKey(key)] = rawRow[key];
          }

          let nombreDetectado = row["descripcion del producto"] || row["descripcion"] || row["producto"] || row["nombre"] || row["articulo"] || row["detalle"];

          return {
            producto_id: row["id producto"] || row["id"] || row["producto_id"],
            codigo_barras: row["codigo de barras"] || row["codigo"] || row["codigo_barras"] || row["barcode"] || "",
            nombre: nombreDetectado ? String(nombreDetectado).trim() : "",
            precio_compra: cleanCurrency(row["costo"] || row["precio compra"] || row["precio_compra"] || 0),
            precio_venta: cleanCurrency(row["precio venta"] || row["precio_venta"] || row["venta"] || 0),
            cantidad: row["existencia"] || row["stock actual"] || row["cantidad"] || row["stock"] || 0,
            stock_minimo: row["inv minimo"] || row["stock minimo"] || row["stock_minimo"] || row["minimo"] || 5,
            categoria: row["categoria"] || row["departamento"] || row["departamentos"] || "General"
          };
        }).filter(item => item.producto_id || item.codigo_barras !== "" || item.nombre !== "");

        const sinNombre = items.filter(item => item.nombre === "");
        if (sinNombre.length === items.length && items.length > 0) {
          const firstRowKeys = Object.keys(data[0] || {}).join(", ");
          toast.error(`No se reconoció la columna del Nombre.\nColumnas en tu archivo: ${firstRowKeys}`, { duration: 8000 });
          return;
        }

        // Asignar nombre preventivo a los que rebotan
        for (let item of items) {
          if (item.nombre === "") {
            item.nombre = "Excel " + (item.codigo_barras || Date.now());
          }
        }

        if (items.length === 0) {
          toast.error("No se encontraron productos válidos en el archivo (Ej: Faltan columnas 'Código' o 'Descripción')");
          return;
        }

        const loadingToast = toast.loading(`Importando ${items.length} productos...`);
        try {
          let res;
          if (tiendaSeleccionada) {
            res = await tiendasAPI.importarInventario(tiendaSeleccionada, items);
          } else {
            res = await productosAPI.importarMasivo(items);
          }

          toast.success(res.message, { id: loadingToast });
          await obtenerProductos();
        } catch (err) {
          toast.error(`Error en la importación: ${err.message}`, { id: loadingToast, duration: 5000 });
        }
      } catch (error) {
        console.error(error);
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Reset
  };

  const handleImportEleventa = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        console.log("Datos crudos de Eleventa:", data);

        const cleanCurrency = (val) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          let str = val.toString().trim();
          str = str.replace(/\$/g, '').replace(/,/g, ''); // Fix para México: Quita $ y comas de miles -> "1,200.50" a "1200.50"
          const parsed = parseFloat(str);
          return isNaN(parsed) ? 0 : parsed;
        };

        const normalizeKey = (k) => k ? k.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

        const items = data.map(rawRow => {
          const row = {};
          for (const key in rawRow) {
            row[normalizeKey(key)] = rawRow[key];
          }

          const keys = Object.keys(row);

          let nombreKey = keys.find(k => k === "producto" || k.includes("descripcion") || k === "nombre" || k === "articulo");
          let codigoKey = keys.find(k => k.includes("codigo") || k.includes("barras"));
          let costoKey = keys.find(k => k.includes("costo") || k.includes("compra"));
          let ventaKey = keys.find(k => k.includes("venta") && !k.includes("mayoreo"));
          let mayoreoKey = keys.find(k => k.includes("mayoreo"));
          let stockKey = keys.find(k => k.includes("existencia") || k.includes("cantidad") || k === "stock");
          let minimoKey = keys.find(k => k.includes("minimo"));
          let deptoKey = keys.find(k => k.includes("departamento") || k.includes("categoria"));

          let nombreDetectado = nombreKey ? row[nombreKey] : "";

          return {
            codigo_barras: codigoKey ? row[codigoKey] : "",
            nombre: nombreDetectado ? String(nombreDetectado).trim() : "",
            precio_compra: cleanCurrency(costoKey ? row[costoKey] : 0),
            precio_venta: cleanCurrency(ventaKey ? row[ventaKey] : 0),
            precio_oferta: (mayoreoKey && row[mayoreoKey]) ? cleanCurrency(row[mayoreoKey]) : null,
            cantidad: parseInt(stockKey ? row[stockKey] : 0),
            stock_minimo: parseInt(minimoKey ? row[minimoKey] : 5),
            categoria: deptoKey ? row[deptoKey] : "General"
          };
        }).filter(item => item.nombre !== "" || item.codigo_barras !== "");

        const sinNombre = items.filter(item => item.nombre === "");
        if (sinNombre.length === items.length && items.length > 0) {
          const firstRowKeys = Object.keys(data[0] || {}).join(", ");
          toast.error(`Formato de Eleventa: No se reconoció la columna "Nombre" o "Descripción" en el archivo.\nColumnas: ${firstRowKeys}`, { duration: 8000 });
          return;
        }

        for (let item of items) {
          if (item.nombre === "") {
            item.nombre = "Eleventa " + (item.codigo_barras || Date.now());
          }
        }

        if (items.length === 0) {
          const firstRowKeys = Object.keys(data[0] || {}).join(", ");
          alert(`No se detectaron las columnas requeridas.\n\nEl archivo contiene estas columnas:\n${firstRowKeys}\n\nPor favor, repórtalas para ajustar el sistema.`);
          toast.error("Formato de Excel no reconocido. Revisa la alerta en pantalla.");
          return;
        }

        const loadingToast = toast.loading("Importando desde Eleventa...");
        try {
          const res = await productosAPI.importarEleventa(items, tiendaSeleccionada);
          toast.success(res.message, { id: loadingToast });
          await obtenerProductos();
        } catch (err) {
          toast.error(`Error en la importación: ${err.message}`, { id: loadingToast });
        }
      } catch (error) {
        console.error(error);
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const guardarEdicion = async () => {
    try {
      const original = productos.find(p => p.id === editandoId).datosOriginales;
      const dataAEnviar = {
        ...original,
        nombre: formularioEdicion.nombre,
        codigo_barras: formularioEdicion.codigo_barras,
        descripcion: formularioEdicion.descripcion,
        precio_compra: parseFloat(formularioEdicion.precio_compra) || 0,
        precio_venta: parseFloat(formularioEdicion.precio_venta),
        precio_oferta: parseFloat(formularioEdicion.precio_oferta) || null,
        oferta: formularioEdicion.oferta,
        stock_minimo: parseInt(formularioEdicion.stock_minimo),
        variaciones: formularioEdicion.variaciones,
        barcodes_agrupados: formularioEdicion.barcodes_agrupados,
        impuestos: formularioEdicion.impuestos || [],
      };

      const result = await executeProduct('update', dataAEnviar, editandoId);

      // En modo web, executeProduct no llama la API — hay que hacerlo directamente
      if (result?.mode === 'api') {
        const apiId = original.id || editandoId;
        await productosAPI.update(apiId, dataAEnviar);
      }

      toast.success("Producto actualizado correctamente");
      setEditandoId(null);
      await obtenerProductos();
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error(`Error al actualizar: ${error.message}`);
    }
  };

  const eliminarProducto = (id) => {
    if (storeConfig && storeConfig.requerir_pin === false) {
      executeDeleteProduct(id);
      return;
    }
    setPendingAction({ type: 'DELETE_PRODUCT', id });
    setShowPinModal(true);
  };

  const executeDeleteProduct = async (id) => {
    try {
      if (tiendaSeleccionada) {
        await executeInventory('delete', {}, `${tiendaSeleccionada}_${id}`);
        toast.success("Producto removido de la tienda");
      } else {
        await executeProduct('delete', {}, id);
        toast.success("Producto eliminado globalmente");
      }
      setProductos(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handlePinSuccess = () => {
    if (pendingAction?.type === 'DELETE_PRODUCT') {
      executeDeleteProduct(pendingAction.id);
    } else if (pendingAction?.type === 'EDIT_PRODUCT') {
      executeIniciarEdicion(pendingAction.producto);
    }
    setPendingAction(null);
  };

  const handleEmptyInventory = async () => {
    if (!window.confirm("¿ESTÁS COMPLETAMENTE SEGURO? Esta acción ELIMINARÁ TODO EL CATÁLOGO de productos, variaciones e inventarios de forma PERMANENTE.")) {
      return;
    }

    const pin = window.prompt("Para confirmar esta acción destructiva, escribe 'BORRAR TODO' (en mayúsculas):");
    if (pin !== 'BORRAR TODO') {
      toast.error("Confirmación incorrecta");
      return;
    }

    const loadingToast = toast.loading("Vaciando inventario...");
    try {
      await productosAPI.deleteAll();
      toast.success("Catálogo vaciado completamente", { id: loadingToast });
      await obtenerProductos();
    } catch (error) {
      toast.error(`Error: ${error.message}`, { id: loadingToast });
    }
  };

  useEffect(() => {
    obtenerTiendas();
  }, []);

  useEffect(() => {
    obtenerProductos();
  }, [tiendaSeleccionada]);

  const filteredProducts = productos.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  if (cargando && productos.length === 0) return <Loading />;

  const { totalInversion, totalGananciaEstimada } = calculateInventoryStats(productos);

  return (
    <div className="p-4 sm:p-6 mb-28 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase">
              <Package className="text-indigo-600" size={32} />
              PRODUCTOS E <span className="text-indigo-600">INVENTARIO</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest">
              {tiendaSeleccionada
                ? `Sucursal: ${tiendas.find(t => t.id === tiendaSeleccionada)?.nombre || 'Tienda'}`
                : "Visión Global del Catálogo Maestro"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-violet-500/20 font-bold uppercase text-[10px] tracking-widest" title="Crear productos e importar Stock desde Excel">
              <Upload size={18} />
              Importar
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportEleventa} />
            </label>
            <button
              onClick={exportToExcel}
              className="h-[48px] px-6 rounded-2xl flex items-center gap-3 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
            >
              <Download size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">EXCEL</span>
            </button>
            <button
              onClick={exportToPDF}
              className="h-[48px] px-6 rounded-2xl flex items-center gap-3 bg-white dark:bg-slate-800 text-rose-600 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group"
            >
              <FileText size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">PDF</span>
            </button>
            <button
              onClick={obtenerProductos}
              className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700/50 rounded-2xl hover:shadow-xl transition-all text-slate-400 hover:text-indigo-500 active:scale-95 shadow-lg group"
            >
              <RefreshCw size={22} className={cargando ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
            </button>
            {user?.rol === 'admin' && (
              <button
                onClick={handleEmptyInventory}
                className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/20 rounded-2xl hover:shadow-xl transition-all text-rose-500 hover:text-rose-600 active:scale-95 shadow-lg group"
                title="Vaciar Inventario Completo"
              >
                <Trash2 size={22} className="group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div >

        {/* Store Filter Bar */}
        {
          user?.rol === 'admin' && (
            <div className="card-standard p-4 mb-8 flex flex-col md:flex-row items-center gap-5 border-dashed">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-[0.2em] shrink-0 px-2">
                <Store size={18} /> FILTRAR POR UBICACIÓN:
              </div>
              <div className="flex flex-wrap gap-2 w-full">
                <button
                  onClick={() => setTiendaSeleccionada("")}
                  className="hidden"
                >
                  ALMACÉN CENTRAL
                </button>
                {tiendas.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTiendaSeleccionada(t.id)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2
                                        ${tiendaSeleccionada === t.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800 hover:border-indigo-200'}
                                    `}
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>
            </div>
          )
        }

        {/* Navigation and Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10 items-end">
          <div className="lg:col-span-12 flex flex-wrap gap-4">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 ${viewMode === "list" ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-500/20" : "bg-white dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-200 shadow-sm"}`}
            >
              <List size={20} /> Lista Maestra
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 ${viewMode === "analytics" ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-500/20" : "bg-white dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-200 shadow-sm"}`}
            >
              <TrendingUp size={20} /> Rendimiento
            </button>
          </div>

          <div className="lg:col-span-6">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={24} />
              <input
                type="text"
                placeholder="Localizar por nombre o escanear código..."
                className="input-standard pl-16 pr-8 py-6 h-[72px] text-lg font-black shadow-2xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-6 font-bold">
            <div className="card-standard p-5 flex flex-col justify-center items-center h-[100px] border-indigo-100 dark:border-indigo-900/30">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Surtido de Items</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">{productos.length}</p>
            </div>
            <div className="card-standard p-5 flex flex-col justify-center items-center h-[100px] bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">
                <TrendingUp size={10} /> Inversión Total
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tighter">
                {moneda}{totalInversion.toLocaleString()}
              </p>
            </div>
            <div className="hidden sm:flex card-standard p-5 flex-col justify-center items-center h-[100px] bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5">
                <DollarSign size={10} /> Utilidad Bruta
              </div>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none tracking-tighter">
                {moneda}{totalGananciaEstimada.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {
          viewMode === "list" ? (
            <div className="card-standard p-0 overflow-hidden shadow-2xl border-none transition-all duration-500">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-md border-b dark:border-slate-700/50">
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Descriptor de Producto</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">PVP Base</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Estrategia Promo</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Existencia</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Estado</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Gestión</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-24 text-center">
                          <div className="flex flex-col items-center gap-6 opacity-20">
                            <Search size={80} className="text-slate-400" />
                            <p className="font-black uppercase tracking-[0.3em] text-xs">No se encontraron coincidencias en el catálogo</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((producto) => (
                        <tr key={producto.id} className={`group transition-all ${editandoId === producto.id ? "bg-indigo-50/30 dark:bg-indigo-900/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-700/20"}`}>
                          {editandoId === producto.id ? (
                            <td colSpan="6" className="p-8">
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border-2 border-indigo-500/30">
                                <div className="lg:col-span-4 space-y-6">
                                  <div>
                                    <label className="label-standard mb-3 px-1 text-indigo-500">Nombre del Producto</label>
                                    <input
                                      value={formularioEdicion.nombre}
                                      onChange={(e) => setFormularioEdicion({ ...formularioEdicion, nombre: e.target.value })}
                                      className="input-standard h-[52px] font-black"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="label-standard mb-3 px-1">ISBN/EAN Maestro</label>
                                      <input
                                        value={formularioEdicion.codigo_barras}
                                        onChange={(e) => setFormularioEdicion({ ...formularioEdicion, codigo_barras: e.target.value })}
                                        className="input-standard h-[50px] font-mono font-bold text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="label-standard mb-3 px-1">Añadir Alias</label>
                                      <input
                                        value={tempBarcode}
                                        onChange={(e) => setTempBarcode(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (tempBarcode.trim() && !formularioEdicion.barcodes_agrupados.includes(tempBarcode.trim())) {
                                              setFormularioEdicion({ ...formularioEdicion, barcodes_agrupados: [...formularioEdicion.barcodes_agrupados, tempBarcode.trim()] });
                                              setTempBarcode("");
                                            }
                                          }
                                        }}
                                        className="input-standard h-[50px] font-mono text-xs"
                                        placeholder="+ Enter"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {formularioEdicion.barcodes_agrupados.map((b, idx) => (
                                      <span key={idx} className="badge-standard bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 py-1 px-2 border-none font-mono">
                                        {b}
                                        <button type="button" onClick={() => setFormularioEdicion({ ...formularioEdicion, barcodes_agrupados: formularioEdicion.barcodes_agrupados.filter((_, i) => i !== idx) })} className="hover:text-rose-500 ml-1">×</button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="lg:col-span-4 grid grid-cols-2 gap-6">
                                  <div className="col-span-2">
                                    <label className="label-standard mb-3 px-1">Costo de Adquisición</label>
                                    <input
                                      type="number"
                                      value={formularioEdicion.precio_compra || ""}
                                      onChange={(e) => setFormularioEdicion({ ...formularioEdicion, precio_compra: e.target.value === "" ? "" : e.target.value })}
                                      className="input-standard h-[52px] font-black text-indigo-600"
                                    />
                                  </div>
                                  <div>
                                    <label className="label-standard mb-3 px-1 text-emerald-500 font-black">Precio de Venta</label>
                                    <input
                                      type="number"
                                      value={formularioEdicion.precio_venta || ""}
                                      onChange={(e) => setFormularioEdicion({ ...formularioEdicion, precio_venta: e.target.value === "" ? "" : e.target.value })}
                                      className="input-standard h-[52px] font-black text-emerald-600 border-emerald-500/30"
                                    />
                                  </div>
                                  <div>
                                    <label className="label-standard mb-3 px-1 text-rose-500 font-bold">Precio Promo</label>
                                    <input
                                      type="number"
                                      value={formularioEdicion.precio_oferta || ""}
                                      onChange={(e) => setFormularioEdicion({ ...formularioEdicion, precio_oferta: e.target.value === "" ? null : e.target.value })}
                                      className="input-standard h-[52px] font-black text-rose-500 border-rose-500/30"
                                    />
                                  </div>
                                </div>
                                <div className="lg:col-span-4 flex flex-col justify-start space-y-4">
                                  <label className="label-standard px-1">Margen Actual</label>
                                  <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700/50 text-center flex flex-col justify-center h-[90px]">
                                    <p className="text-2xl font-black text-indigo-500 leading-none">
                                      +{formularioEdicion.precio_venta > 0 ? (((formularioEdicion.precio_venta - formularioEdicion.precio_compra) / formularioEdicion.precio_compra) * 100).toFixed(1) : 0}%
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-80">Rendimiento sobre costo</p>
                                  </div>
                                </div>

                                {/* Bloque Impuestos Edición */}
                                <div className="lg:col-span-12 p-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed dark:border-slate-700/50 mt-2">
                                  <label className="text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-4 block flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> IMPUESTOS APLICABLES AL PRODUCTO
                                  </label>

                                  <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                                    <div className="flex-1 min-w-[200px]">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Añadir Impuesto</label>
                                      <select
                                        value={nuevoImpuesto.tipo}
                                        onChange={e => {
                                          const val = e.target.value;
                                          let defaultPorc = val === 'IVA' ? 16 : 0;
                                          if (val === 'IVA Exento') defaultPorc = 0;
                                          setNuevoImpuesto({ ...nuevoImpuesto, tipo: val, porcentaje: defaultPorc });
                                        }}
                                        className="select-standard h-[48px] text-xs font-black text-slate-700 dark:text-slate-200"
                                      >
                                        <option value="IVA">IVA (16%, 8%, 0%)</option>
                                        <option value="IVA Exento">IVA Exento</option>
                                        <option value="IEPS">IEPS</option>
                                        <option value="Retención IVA">Retención IVA</option>
                                        <option value="ISR / Retención">ISR / Retención ISR</option>
                                        <option value="ISH">ISH (Hospedaje)</option>
                                      </select>
                                    </div>
                                    <div className="w-32">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Tasa (%)</label>
                                      <input
                                        type="number" step="0.01"
                                        value={nuevoImpuesto.porcentaje}
                                        disabled={nuevoImpuesto.tipo === 'IVA Exento'}
                                        onChange={e => setNuevoImpuesto({ ...nuevoImpuesto, porcentaje: parseFloat(e.target.value) || 0 })}
                                        className="input-standard h-[48px] font-black text-center text-lg bg-slate-50 dark:bg-slate-900"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (formularioEdicion.impuestos.some(i => i.tipo === nuevoImpuesto.tipo && nuevoImpuesto.tipo !== 'IEPS')) {
                                          return toast.error("Ya existe un impuesto principal de este tipo.");
                                        }
                                        setFormularioEdicion({ ...formularioEdicion, impuestos: [...formularioEdicion.impuestos, nuevoImpuesto] });
                                        setNuevoImpuesto({ tipo: "IEPS", porcentaje: 8 });
                                      }}
                                      className="btn-secondary h-[48px] px-6 text-indigo-600 bg-indigo-50 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:hover:bg-indigo-700/40"
                                    >
                                      Agregar
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap gap-2 mt-4 px-1">
                                    {formularioEdicion.impuestos.length === 0 && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic opacity-70">Exento o No Configurado (Precio Venta es Neto)</span>}
                                    {formularioEdicion.impuestos.map((imp, idx) => (
                                      <div key={idx} className="badge-standard bg-white dark:bg-slate-800 pr-2 py-1.5 border dark:border-slate-700 shadow-sm flex items-center gap-2">
                                        <span className="font-black text-[9px] tracking-[0.2em] uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">{imp.tipo}</span>
                                        <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-200">{imp.porcentaje}%</span>
                                        <button type="button" onClick={() => setFormularioEdicion({ ...formularioEdicion, impuestos: formularioEdicion.impuestos.filter((_, i) => i !== idx) })} className="hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 p-1 rounded-md text-slate-300 transition-colors"><X size={14} /></button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="lg:col-span-12 flex justify-end gap-4 mt-6 border-t dark:border-slate-700/50 pt-8">
                                  <button onClick={guardarEdicion} className="btn-primary flex-1 h-[56px] bg-indigo-600 shadow-indigo-500/20"><Save size={18} /> GUARDAR</button>
                                  <button onClick={() => setEditandoId(null)} className="btn-secondary px-6 h-[56px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><X size={18} /></button>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700/50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-colors shadow-inner overflow-hidden">
                                    {producto?.images?.[0] ? (
                                      <img src={producto.images[0]} className="w-full h-full object-cover" alt={producto.name} />
                                    ) : (
                                      <Package size={28} />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2 text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{producto.name}</p>
                                    <div className="flex items-center gap-2">
                                      {producto.barcode ? (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700/80 rounded-lg text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                          <Barcode size={10} /> {producto.barcode}
                                        </div>
                                      ) : (
                                        <div className="text-[9px] font-black text-slate-300 uppercase italic">Sin GTIN</div>
                                      )}
                                      {producto.barcodesAgrupados?.length > 0 && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm border border-indigo-100 dark:border-indigo-800/20">
                                          <Layers size={10} /> +{producto.barcodesAgrupados.length} Alias
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <p className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">{moneda}{producto.mrp.toFixed(2)}</p>
                              </td>
                              <td className="px-8 py-6">
                                <button
                                  onClick={() => alternarOferta(producto.id, producto.ofertaActiva)}
                                  className={`inline-flex flex-col items-start gap-1 p-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95 border-2 ${producto.ofertaActiva ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30' : 'bg-slate-50/50 dark:bg-slate-900/20 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                >
                                  {producto.ofertaActiva ? (
                                    <>
                                      <div className="flex items-center gap-1.5 bg-orange-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/30">
                                        <Tag size={8} /> Promo
                                      </div>
                                      <span className="text-lg font-black text-orange-600 dark:text-orange-400 tracking-tighter leading-none mt-1">{moneda}{producto.price.toFixed(2)}</span>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-slate-400 px-2 py-1 opacity-40">
                                      <TrendingUp size={14} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Activar Promo</span>
                                    </div>
                                  )}
                                </button>
                              </td>
                              <td className="px-8 py-6 text-center">
                                <div className="flex flex-col items-center">
                                  <span className={`text-3xl font-black tracking-tighter leading-none ${producto.cantidad > producto.stockMinimo ? 'text-slate-800 dark:text-white' : producto.cantidad > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {producto.cantidad}
                                  </span>
                                  {producto.cantidad <= producto.stockMinimo && (
                                    <div className={`mt-2 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm border ${producto.cantidad > 0 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}>
                                      <AlertTriangle size={8} /> {producto.cantidad > 0 ? "Bajo Stock" : "Agotado"}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-6 text-center">
                                <button
                                  onClick={() => alternarStock(producto.id, producto.enStock)}
                                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all shadow-inner ${producto.enStock ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                                >
                                  <span className={`inline-block h-5 w-5 transform rounded-full shadow-2xl transition-transform duration-300 ${producto.enStock ? 'translate-x-8 bg-white' : 'translate-x-1 bg-slate-400'}`} />
                                </button>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                  <button
                                    onClick={() => setTagModal({ open: true, product: producto })}
                                    className="p-3.5 text-slate-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-md active:scale-90 border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/30"
                                    title="Generar Viñeta"
                                  >
                                    <Barcode size={20} />
                                  </button>
                                  <button
                                    onClick={() => iniciarEdicion(producto)}
                                    className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-md active:scale-90 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30"
                                    title="Editar Master Data"
                                  >
                                    <Pencil size={20} />
                                  </button>
                                  <button
                                    onClick={() => eliminarProducto(producto.id)}
                                    className="p-3.5 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-md active:scale-90 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                                    title="Baja de Catálogo"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="card-standard p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="flex items-center gap-3 mb-8">
                    <TrendingUp className="text-indigo-500" size={24} />
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Ranking de Rentabilidad (Top 10)</h3>
                  </div>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={
                        (Array.isArray(productos) ? [...productos] : [])
                          .map(p => ({
                            name: p.name.substring(0, 15),
                            ganancia: (parseFloat(p.datosOriginales.precio_venta || 0) - parseFloat(p.datosOriginales.precio_compra || 0))
                          }))
                          .sort((a, b) => b.ganancia - a.ganancia)
                          .slice(0, 10)
                      }>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                        <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} fontStyles="bold" dy={10} />
                        <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={(val) => `${moneda}${val}`} />
                        <Tooltip
                          contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '15px' }}
                          itemStyle={{ fontWeight: 'black', fontSize: '11px', textTransform: 'uppercase' }}
                          formatter={(val) => [`${moneda}${val.toFixed(2)}`, 'Utilidad por Unidad']}
                        />
                        <Bar dataKey="ganancia" fill="#4f46e5" radius={[10, 10, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card-standard p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="flex items-center gap-3 mb-8">
                    <PieChartIcon className="text-emerald-500" size={24} />
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Concentración de Activos (Top 5)</h3>
                  </div>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            [...productos]
                              .map(p => ({
                                name: p.name.substring(0, 15),
                                value: (parseFloat(p.datosOriginales.precio_compra || 0) * p.cantidad)
                              }))
                              .sort((a, b) => b.value - a.value)
                              .slice(0, 5)
                          }
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {[0, 1, 2, 3, 4].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val) => [`${moneda}${val.toLocaleString()}`, 'Valor de Inventario']}
                          contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'black', paddingTop: '20px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card-standard p-0 overflow-hidden shadow-2xl border-none">
                <div className="p-8 border-b dark:border-slate-700/50 bg-slate-900 text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard size={22} className="text-indigo-400" />
                    <h3 className="text-xs font-black uppercase tracking-[0.3em]">Auditoría Financiera de Stock</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">Valores en Tiempo Real</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-900/40 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em] border-b dark:border-slate-700/50">
                        <th className="px-8 py-5">Item del Catálogo</th>
                        <th className="px-8 py-5 text-right">Costo Acumulado</th>
                        <th className="px-8 py-5 text-right">Potencial de Venta</th>
                        <th className="px-8 py-5 text-right">Margen Operativo</th>
                        <th className="px-8 py-5 text-center">Riesgo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {Array.isArray(filteredProducts) && filteredProducts.map(p => {
                        const compra = parseFloat(p.datosOriginales.precio_compra || 0);
                        const venta = parseFloat(p.datosOriginales.precio_venta || 0);
                        const inversion = compra * p.cantidad;
                        const ganancia = (venta - compra) * p.cantidad;
                        const margenPercent = compra > 0 ? ((venta - compra) / compra) * 100 : 0;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all font-bold group">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-500 transition-colors"></div>
                                <span className="text-xs uppercase font-black text-slate-700 dark:text-slate-200 tracking-tight">{p.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right text-xs font-black text-slate-800 dark:text-white">
                              {moneda}{inversion.toLocaleString()}
                            </td>
                            <td className="px-8 py-5 text-right text-xs font-black text-emerald-600 dark:text-emerald-400">
                              {moneda}{(venta * p.cantidad).toLocaleString()}
                            </td>
                            <td className="px-8 py-5 text-right">
                              <span className="text-xs font-black text-indigo-500">+{margenPercent.toFixed(1)}%</span>
                            </td>
                            <td className="px-8 py-5 text-center">
                              {p.cantidad <= p.stockMinimo ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-800/20 shadow-sm animate-pulse">
                                  <TrendingDown size={10} /> Quiebre
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                  <ArrowRight size={10} /> Estable
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        }
      </div >

      {/* Modals remain functional */}
      < PinValidationModal
        isOpen={showPinModal}
        onClose={() => { setShowPinModal(false); setPendingAction(null); }}
        onSuccess={handlePinSuccess}
      />

      {
        tagModal.open && tagModal.product && (
          <BarcodeTagGenerator
            product={tagModal.product}
            onClose={() => setTagModal({ open: false, product: null })}
          />
        )
      }
    </div >
  );
};

export default StoreManageProducts;