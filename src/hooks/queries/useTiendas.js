import { useQuery } from '@tanstack/react-query';
import { tiendasAPI } from '../../services/api';

export const useTiendas = (user) => {
    return useQuery({
        queryKey: ['tiendas'],
        queryFn: async () => {
            return await tiendasAPI.getAll();
        },
        enabled: user?.rol === 'admin', // Solo fetching si es admin
        staleTime: 1000 * 60 * 60, // Las tiendas cambian poco, caché de 1 hora
    });
};
