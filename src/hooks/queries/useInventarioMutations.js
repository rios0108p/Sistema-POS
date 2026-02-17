import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ajustesAPI } from '../../services/api';
import { toast } from 'react-hot-toast';

export const useInventarioMutations = () => {
    const queryClient = useQueryClient();

    // Ajuste de Stock
    const realizarAjuste = useMutation({
        mutationFn: async (data) => {
            // data debe contener: { producto_id, variacion_id, tienda_id, cantidad_nueva, motivo, notas, usuario_id }
            return await ajustesAPI.create(data);
        },
        onSuccess: (_, variables) => {
            // Invalidar la caché de productos para la tienda afectada (o todas si es complex)
            // Simplemente invalidamos 'productos' para asegurar frescura
            queryClient.invalidateQueries({ queryKey: ['productos'] });
        },
        onError: (error) => {
            console.error("Error en ajuste:", error);
            // El toast se maneja en el componente generalmente, pero se puede aquí también
        }
    });

    return {
        realizarAjuste
    };
};
