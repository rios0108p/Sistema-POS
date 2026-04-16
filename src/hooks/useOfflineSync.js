import { useState, useEffect, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
import { ventasAPI } from '../services/api'; // Ensure this matches your API location
import { toast } from 'react-hot-toast';

const OFFLINE_SALES_KEY = 'ventas_offline_queue';

export const useOfflineSync = () => {
    console.log("DEBUG: useOfflineSync Hook V1.0.7");
    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
    const [pendingSales, setPendingSales] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Monitor Network Status
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Conexión restaurada. Sincronizando...");
            syncSales();
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast("Modo Offline activado", { icon: '📡' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Load initial queue
        loadQueue();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const loadQueue = async () => {
        try {
            const queue = await get(OFFLINE_SALES_KEY) || [];
            setPendingSales(queue);
        } catch (error) {
            console.error("Error loading offline queue", error);
        }
    };

    const saveToQueue = async (ventaData) => {
        try {
            const currentQueue = await get(OFFLINE_SALES_KEY) || [];
            const newSale = {
                ...ventaData,
                offlineId: Date.now(), // Temp ID
                createdAt: new Date().toISOString()
            };
            const updatedQueue = [...currentQueue, newSale];

            await set(OFFLINE_SALES_KEY, updatedQueue);
            setPendingSales(updatedQueue);
            toast.success("Venta guardada localmente (Sin Internet)", { icon: '💾' });
            return newSale; // Return pseudo-success
        } catch (error) {
            console.error("Error saving offline sale", error);
            toast.error("Error crítico guardando venta offline");
            throw error;
        }
    };

    const syncSales = useCallback(async () => {
        if (isSyncing) return;

        try {
            const queue = await get(OFFLINE_SALES_KEY) || [];
            if (queue.length === 0) return;

            setIsSyncing(true);
            const successfulIds = [];
            const errors = [];

            // Process one by one carefully
            for (const sale of queue) {
                try {
                    // Remove offline-specific keys before sending
                    const { offlineId, createdAt, ...payload } = sale;

                    // Call API
                    await ventasAPI.create(payload);
                    successfulIds.push(offlineId);
                } catch (error) {
                    console.error("Sync error for sale", sale.offlineId, error);
                    // Decide strategy: keep in queue? drop? 
                    // For now, if 500/network error, keep. If 400 validation, maybe drop or alert.
                    // Simple logic: keep pending until success.
                    errors.push(sale);
                }
            }

            if (successfulIds.length > 0) {
                // Remove synced items from queue
                const remaining = queue.filter(s => !successfulIds.includes(s.offlineId));
                await set(OFFLINE_SALES_KEY, remaining);
                setPendingSales(remaining);
                toast.success(`${successfulIds.length} ventas sincronizadas exitosamente`);
            }

        } catch (error) {
            console.error("Sync process failed", error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    return {
        isOnline,
        pendingSales,
        saveToQueue,
        syncSales,
        isSyncing
    };
};
