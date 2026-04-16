/**
 * utilidades para el manejo de fechas en el sistema POS.
 * Centraliza el locale y los formatos para consistencia visual.
 */

const DEFAULT_LOCALE = "es-MX";

/**
 * Formatea una fecha a string legible (DD/MM/YYYY).
 */
export const formatDate = (date, options = {}) => {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? new Date(date.replace(/-/g, '/')) : new Date(date);
  
  if (isNaN(d.getTime())) return "Fecha Inválida";

  return d.toLocaleDateString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options
  });
};

/**
 * Formatea una fecha y hora.
 */
export const formatDateTime = (date) => {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? new Date(date.replace(/-/g, '/')) : new Date(date);
  
  if (isNaN(d.getTime())) return "Fecha/Hora Inválida";

  return d.toLocaleString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
