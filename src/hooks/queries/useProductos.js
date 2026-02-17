import { useQuery } from '@tanstack/react-query';
import { productosAPI, tiendasAPI } from '../../services/api';

/**
 * Hook para obtener productos.
 * @param {string} tiendaId - ID de la tienda para filtrar (o null/empty para central si es admin).
 * @param {object} user - Objeto de usuario actual (para determinar permisos).
 */
export const useProductos = (tiendaId, user) => {
    return useQuery({
        queryKey: ['productos', tiendaId || 'central'], // Clave única para caché por tienda
        queryFn: async () => {
            let data;
            // Lógica de Tienda vs Central:
            // Si hay tiendaId explícito, buscar stocks de esa tienda.
            // Si no, y es usuario normal, buscar su tienda_id.
            // Si es admin y no hay tiendaId, buscar todo (Central).

            const targetId = user?.rol === 'admin' ? tiendaId : user?.tienda_id;

            if (targetId) {
                data = await tiendasAPI.getProductos(targetId);
            } else {
                data = await productosAPI.getAll();
            }

            // Normalización de datos para evitar errores de NaN
            return data.map((p) => ({
                ...p,
                precio_compra: Number(p.precio_compra) || 0,
                precio_venta: Number(p.precio_venta) || 0,
                precio_oferta: p.precio_oferta !== null ? Number(p.precio_oferta) : null,
                stockReal: Number(p.cantidad) || 0,
                stock_minimo: Number(p.stock_minimo) || 5
            }));
        },
        enabled: !!user, // Solo ejecutar si el usuario está cargado
        staleTime: 10000, // Consider data stale after 10 seconds
        refetchInterval: 30000, // Auto-refetch every 30 seconds
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });
};
