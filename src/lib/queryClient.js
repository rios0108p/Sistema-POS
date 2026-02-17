import { QueryClient } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 60 * 24, // 24 Horas (Offline First: Preferimos cache viejo a nada)
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 Días
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
