/**
 * utilidades para cálculos de carrito, promociones e impuestos.
 * Centraliza la lógica de negocio para evitar discrepancias entre pantallas.
 */
import { cleanCurrency } from './formatUtils';

/**
 * Obtiene el precio efectivo de un producto basándose en reglas de mayoreo y ofertas globales.
 */
export const getEffectivePrice = (producto, cantidad = 1, reglasMayoreo = {}) => {
  if (!producto) return { precio: 0, isWholesale: false, isPromo: false };

  const special = reglasMayoreo[producto.id];
  const originalPrice = cleanCurrency(producto.precio_venta);
  const globalOffer = cleanCurrency(producto.precio_oferta);

  // 1. Regla de Mayoreo (Prioridad si se cumple el mínimo)
  if (special && cantidad >= (special.min_cantidad || 1)) {
    return {
      precio: Number(special.precio),
      isWholesale: true,
      originalPrice,
      isPromo: true,
      promoLabel: 'MAYOREO'
    };
  }

  // 2. Oferta Global
  if (producto.oferta && globalOffer > 0) {
    return {
      precio: globalOffer,
      isWholesale: false,
      originalPrice,
      isPromo: true,
      promoLabel: 'OFERTA'
    };
  }

  // 3. Precio Regular
  return {
    precio: originalPrice,
    isWholesale: false,
    originalPrice,
    isPromo: false,
    promoLabel: ''
  };
};

/**
 * Calcula el desglose de impuestos para un conjunto de items.
 */
export const calculateTaxBreakdown = (cart, allProducts = []) => {
  let desglose = {};
  let totalTax = 0;

  cart.forEach(item => {
    const prod = allProducts.find(p => p.id === item.id) || item; 
    let impuestosArray = [];

    if (prod.impuestos) {
      if (typeof prod.impuestos === 'string') {
        try { impuestosArray = JSON.parse(prod.impuestos) || []; } catch (e) { }
      } else if (Array.isArray(prod.impuestos)) {
        impuestosArray = prod.impuestos;
      }
    }

    if (impuestosArray.length > 0) {
      const itemSubtotal = cleanCurrency(item.precio) * (Number(item.cantidad) || 0);

      impuestosArray.forEach(imp => {
        if (!imp || !imp.tipo || imp.tipo === 'IVA Exento') return;
        const pct = parseFloat(imp.porcentaje) || 0;
        if (pct === 0 && !imp.tipo.includes('Retención')) return;

        // Fórmula Impuesto Incluido: Extraer impuesto del precio final
        const taxVal = itemSubtotal - (itemSubtotal / (1 + (pct / 100)));

        const isRetencion = imp.tipo.toLowerCase().includes('retención') || imp.tipo === 'ISR / Retención';
        const finalTaxVal = isRetencion ? -taxVal : taxVal;

        if (!desglose[imp.tipo]) desglose[imp.tipo] = { porcentaje: pct, total: 0 };
        desglose[imp.tipo].total += finalTaxVal;
        totalTax += finalTaxVal;
      });
    }
  });

  return { desglose, total: totalTax };
};

/**
 * Calcula los totales finales del carrito.
 */
export const getCartTotals = (cart, discountGlobal = 0, allProducts = []) => {
  const subtotal = cart.reduce((acc, item) => acc + (cleanCurrency(item.precio) * (Number(item.cantidad) || 0)), 0);
  const taxInfo = calculateTaxBreakdown(cart, allProducts);
  const total = Math.max(0, subtotal - cleanCurrency(discountGlobal));

  return {
    subtotal,
    totalTax: taxInfo.total,
    taxBreakdown: taxInfo.desglose,
    total
  };
};

/**
 * Parsea la cantidad desde el texto de búsqueda (ej: 6*producto o *6 producto).
 */
export const parseSearchQuantity = (searchText) => {
  if (!searchText) return { cantidad: 1, query: "" };
  // Pattern: number* or *number at start. Product part is now optional.
  const match = searchText.match(/^(\d+)\*(.*)$/) || searchText.match(/^\*(\d+)\s*(.*)$/);
  if (match) {
    const parsedCant = parseInt(match[1]);
    return { cantidad: parsedCant < 1 ? 1 : parsedCant, query: match[2].trim() };
  }
  return { cantidad: 1, query: searchText };
};
