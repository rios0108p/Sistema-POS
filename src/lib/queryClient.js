import { QueryClient } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 Minutos (Datos frescos para POS)
            gcTime: 1000 * 60 * 60 * 24, // 24 Horas
            refetchOnWindowFocus: false,
            retry: 1,
            networkMode: 'always', // Critico para offline
        },
    },
});

export const persister = {
    persistClient: async (client) => {
        await set('reactQueryClient', client);
    },
    restoreClient: async () => {
        return await get('reactQueryClient');
    },
    removeClient: async () => {
        await del('reactQueryClient');
    },
};
