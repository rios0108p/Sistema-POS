/**
 * utilidades para normalizar objetos de producto y evitar errores de NULL/Undefined.
 */

/**
 * Normaliza un producto crudo proveniente de la API para su uso en componentes.
 */
export const normalizeProduct = (p, isGlobal = false) => {
  if (!p) return null;

  // Manejo de imágenes (pueden ser string JSON o Array)
  let images = [];
  try {
    if (p.imagenes) {
      images = Array.isArray(p.imagenes) ? p.imagenes : JSON.parse(p.imagenes);
    }
  } catch (e) {
    console.error("Error parsing images for product", p.id);
  }

  // Manejo de variaciones
  let variaciones = [];
  try {
    if (p.variaciones) {
      variaciones = Array.isArray(p.variaciones) ? p.variaciones : JSON.parse(p.variaciones);
    }
  } catch (e) { }

  // Manejo de atributos agrupados (barcodes)
  let barcodesAgrupados = [];
  try {
    if (p.barcodes_agrupados) {
      barcodesAgrupados = Array.isArray(p.barcodes_agrupados) ? p.barcodes_agrupados : JSON.parse(p.barcodes_agrupados);
    }
  } catch (e) { }

  return {
    id: p.id || p.producto_id,
    nombre: p.nombre || "Producto sin nombre",
    name: p.nombre || "Producto sin nombre", // Alias
    descripcion: p.descripcion || "",
    precio_venta: Number(p.precio_venta || 0),
    mrp: Number(p.precio_venta || 0), // Alias
    precio_compra: Number(p.precio_compra || 0),
    precio_oferta: p.precio_oferta ? Number(p.precio_oferta) : null,
    price: p.precio_oferta ? Number(p.precio_oferta) : Number(p.precio_venta || 0), // Alias
    oferta: Boolean(p.oferta || p.oferta_activa),
    ofertaActiva: Boolean(p.oferta || p.oferta_activa), // Alias
    cantidad: isGlobal ? (p.cantidad_global ?? p.cantidad ?? 0) : (p.cantidad ?? 0),
    enStock: (p.cantidad ?? 0) > 0, // Alias
    stock_minimo: p.stock_minimo ?? 5,
    stockMinimo: p.stock_minimo ?? 5, // Alias
    codigo_barras: p.codigo_barras || "",
    categoria: p.categoria || "General",
    marca: p.marca || "",
    imagenes: Array.isArray(images) ? images : [],
    images: Array.isArray(images) ? images : [], // Alias compatible con UI
    variaciones: Array.isArray(variaciones) ? variaciones : [],
    barcodes_agrupados: Array.isArray(barcodesAgrupados) ? barcodesAgrupados : [],
    barcodesAgrupados: Array.isArray(barcodesAgrupados) ? barcodesAgrupados : [], // Alias
    impuestos: Array.isArray(p.impuestos) ? p.impuestos : (typeof p.impuestos === 'string' ? JSON.parse(p.impuestos || '[]') : []),
    activo: Boolean(p.activo !== false), // default true
    barcode: p.codigo_barras || "", // Alias compatible con UI
    datosOriginales: p // Para operaciones de guardado que requieran campos extra
  };
};

/**
 * Calcula los totales de inventario (Inversión y Ganancia Estimada).
 */
export const calculateInventoryStats = (products = []) => {
  return products.reduce((acc, p) => {
    const cost = Number(p.precio_compra || 0);
    const price = Number(p.precio_venta || 0);
    const qty = Number(p.cantidad || 0);

    acc.totalInversion += cost * qty;
    acc.totalGananciaEstimada += (price - cost) * qty;
    return acc;
  }, { totalInversion: 0, totalGananciaEstimada: 0 });
};
