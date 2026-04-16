/**
 * Utilidades de formateo y limpieza de datos para el POS
 */

/**
 * Limpia una cadena de moneda o número para obtener un valor flotante puro
 * Maneja formatos como "$ 1,234.56", "1234.56", etc.
 */
export const cleanCurrency = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    // Quitar símbolos de moneda, comas y espacios
    const cleaned = String(val).replace(/[$, ]/g, '');
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : num;
};

/**
 * Formatea un número como moneda local (MXN)
 */
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount || 0);
};

/**
 * Formatea un número con decimales fijos (por defecto 2)
 */
export const formatNumber = (num, decimals = 2) => {
    const n = parseFloat(num);
    return isNaN(n) ? (0).toFixed(decimals) : n.toFixed(decimals);
};

/**
 * Normaliza un objeto de búsqueda para ignorar acentos y mayúsculas
 */
export const normalizeText = (text) => {
    if (!text) return '';
    return text.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Valida si un código de barras es válido (no vacío y longitud mínima)
 */
export const isValidBarcode = (code) => {
    if (!code) return false;
    const cleanCode = code.toString().trim();
    return cleanCode.length >= 3;
};
