// API Service para reemplazar las versiones previas
import { getLastAuth, verifyPassword } from '../utils/authUtils';

const isDesktop = () => !!window.electronAPI?.isDesktop;

// Detección dinámica de la URL de la API
const getBaseUrl = () => {
    // Prioridad 1: Variable de entorno explícita (si existe)
    if (import.meta.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Prioridad 2: Si estamos en la Desktop App de Electron
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isDevPort = window.location.port === '5173';

    if ((window.location.protocol === 'file:' || isDesktop()) && !(isLocalDev && isDevPort)) {
        return 'https://tendopos.cloud/api';
    }

    // Prioridad 3: Fallback para web o dev con el proxy de vite
    return '/api';
};

const API_URL = getBaseUrl();

// Helper para manejar respuestas
const handleResponse = async (response) => {
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error('❌ ERROR FATAL DEL SERVIDOR (No es JSON):', text);
        // Eliminado el alert() intrusivo según auditoría (Punto 71)
        throw new Error('El servidor respondió con un formato inesperado (posible error de red o de servidor).');
    }

    if (!response.ok) {
        throw new Error(data.details || data.error || 'Error en la petición');
    }
    return data;
};

// Helper para headers de autenticación
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

// Helper para headers con FormData (sin Content-Type explícito)
const getAuthHeadersMultipart = () => {
    const token = localStorage.getItem('token');
    return {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

/**
 * fetchWithTimeout — en desktop usa timeout corto (5s) para detectar
 * rápido si el servidor no está disponible y caer al fallback local.
 * En web usa fetch normal sin timeout artificial.
 */
const fetchWithTimeout = (url, options = {}) => {
    if (!isDesktop()) return fetch(url, options);

    const TIMEOUT_MS = 5000; // 5 segundos máximo esperando al VPS
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
};


export const authAPI = {
    login: async (username, password, tiendaId) => {
        // Try network first
        try {
            let url = `${API_URL}/auth/login`;
            if (tiendaId) url += `?tienda_id=${tiendaId}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ username, password })
            });
            
            const result = await handleResponse(response);
            
            // Cache user for offline login (Electronic only)
            if (isDesktop() && window.electronAPI?.localDB && result.user) {
                try {
                    const userData = {
                        id: result.user.id,
                        nombre_usuario: result.user.username || result.user.nombre_usuario,
                        nombre: result.user.nombre,
                        rol: result.user.rol,
                        tienda_id: result.user.tienda_id,
                        password: result.user.password_hash || 'REMOVED_FOR_SECURITY',
                        permisos: result.user.permisos || {},
                        sync_status: 'synced',
                        updated_at: new Date().toISOString()
                    };
                    await window.electronAPI.localDB.upsert('users', userData);

                    // TRIGGER FULL SYNC: Download all products, stock, etc. to make POS functional offline
                    // This happens in background but we start it now.
                    window.electronAPI.sync.full(result.token).catch(err => console.error("Initial full sync failed:", err));
                } catch (e) { console.error("Error caching user for offline:", e); }
            }
            return result;
        } catch (error) {
            // VPS unreachable — attempt offline login using last saved credentials (Desktop only)
            if (isDesktop()) {
                console.warn("🔐 VPS unreachable — Attempting verified local login...");
                try {
                    const lastAuth = getLastAuth();

                    if (!lastAuth) {
                        throw new Error("No hay sesión guardada. Conéctate a internet para el primer inicio de sesión.");
                    }
                    if (!lastAuth.username || lastAuth.username.toLowerCase() !== (username || '').toLowerCase()) {
                        throw new Error("No hay datos guardados para este usuario. Conéctate a internet.");
                    }

                    // Always verify password — never skip this check
                    const isValid = await verifyPassword(password, lastAuth.passwordHash);
                    if (!isValid) {
                        throw new Error("Contraseña incorrecta (Modo Offline)");
                    }

                    return {
                        success: true,
                        token: lastAuth.token,  // Real JWT, not a fake token
                        user: lastAuth.userData,
                        isOffline: true
                    };
                } catch (localError) {
                    throw localError;
                }
            }
            throw error;
        }
    },
    updateProfile: async (id, data) => {
        const response = await fetch(`${API_URL}/auth/update-profile`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id, ...data })
        });
        return handleResponse(response);
    },
    verifyPin: async (pin) => {
        try {
            const response = await fetch(`${API_URL}/auth/verify-pin`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ pin })
            });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                console.warn("🔐 VPS unreachable — Attempting local PIN verify...");
                try {
                    const match = await window.electronAPI.localDB.getUserByPin(pin);
                    if (match) return { success: true };
                } catch (e) { console.error("Local PIN verify failed:", e); }
            }
            throw error;
        }
    },
    logSecurityAction: async (logData) => {
        const response = await fetch(`${API_URL}/auth/log-security-action`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(logData)
        });
        return handleResponse(response);
    }
};

// ==================== USUARIOS ====================
export const usuariosAPI = {
    getAll: async () => {
        try {
            const response = await fetch(`${API_URL}/usuarios`, { headers: getAuthHeaders() });
            const data = await handleResponse(response);
            return data.map(u => ({
                ...u,
                permisos: typeof u.permisos === 'string' ? JSON.parse(u.permisos) : u.permisos
            }));
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    const users = await window.electronAPI.localDB.getAll('users', { orderBy: 'nombre ASC' });
                    return (Array.isArray(users) ? users : []).map(u => ({
                        ...u,
                        permisos: (typeof u.permisos === 'string' ? JSON.parse(u.permisos) : u.permisos) || {}
                    }));
                } catch(e) { return []; }
            }
            throw error;
        }
    },
    create: async (data) => {
        const response = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    update: async (id, data) => {
        const response = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    delete: async (id) => {
        const response = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ==================== PRODUCTOS ====================
export const productosAPI = {
    // Obtener todos los productos (Soporta paginación)
    getAll: async (page = 1, limit = 100) => {
        try {
            const response = await fetch(`${API_URL}/productos?page=${page}&limit=${limit}`, { headers: getAuthHeaders() });
            const result = await handleResponse(response);
            return result.data || result;
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    const products = await window.electronAPI.localDB.getAll('products', { orderBy: 'nombre ASC' });
                    return Array.isArray(products) ? products : [];
                } catch(e) { return []; }
            }
            throw error;
        }
    },

    // Obtener producto por ID
    getById: async (id) => {
        try {
            const response = await fetch(`${API_URL}/productos/${id}`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                return await window.electronAPI.localDB.getById('products', id);
            }
            throw error;
        }
    },

    // Crear producto con imágenes
    create: async (productoData, imagenes) => {
        const formData = new FormData();

        // Agregar datos del producto con mapeo de campos JSON
        if (productoData && typeof productoData === 'object') {
            Object.keys(productoData).forEach(key => {
                const isJsonField = ['caracteristicas', 'variaciones', 'barcodes_agrupados', 'barcodesAgrupados', 'impuestos'].includes(key);
                if (isJsonField) {
                    const backendKey = key === 'barcodesAgrupados' ? 'barcodes_agrupados' : key;
                    formData.append(backendKey, JSON.stringify(productoData[key]));
                } else {
                    formData.append(key, productoData[key]);
                }
            });
        }

        // Agregar imágenes
        imagenes.forEach(imagen => {
            if (imagen) {
                formData.append('imagenes', imagen);
            }
        });

        const response = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            body: formData,
            headers: getAuthHeadersMultipart()
        });
        return handleResponse(response);
    },

    // Actualizar producto
    update: async (id, productoData, imagenes = [], imagenesExistentes = []) => {
        const formData = new FormData();

        // Agregar datos del producto
        if (productoData && typeof productoData === 'object') {
            Object.keys(productoData).forEach(key => {
                const isJsonField = ['caracteristicas', 'variaciones', 'barcodes_agrupados', 'barcodesAgrupados', 'imagenes_existentes', 'impuestos'].includes(key);
                if (isJsonField) {
                    // Normalizar nombre de campo para el backend
                    const backendKey = key === 'barcodesAgrupados' ? 'barcodes_agrupados' : key;
                    formData.append(backendKey, typeof productoData[key] === 'string' ? productoData[key] : JSON.stringify(productoData[key]));
                } else if (key === 'imagenes' || key === 'datosOriginales') {
                    // Ignorar o manejar por separado
                } else {
                    formData.append(key, productoData[key]);
                }
            });
        }

        // Si hay imágenes en productoData, usarlas como existentes
        let todasLasImagenesExistentes = imagenesExistentes;
        if (productoData.imagenes && Array.isArray(productoData.imagenes) && productoData.imagenes.length > 0) {
            todasLasImagenesExistentes = productoData.imagenes;
        }

        // Agregar imágenes (archivos)
        imagenes.forEach(imagen => {
            if (imagen) {
                formData.append('imagenes', imagen);
            }
        });

        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'PUT',
            body: formData,
            headers: getAuthHeadersMultipart()
        });
        return handleResponse(response);
    },

    // Importar masivo global (Excel)
    importarMasivo: async (items) => {
        const response = await fetch(`${API_URL}/productos/importar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ items })
        });
        return handleResponse(response);
    },

    // Eliminar producto
    delete: async (id) => {
        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    // Importar Eleventa
    importarEleventa: async (items, tiendaId = "") => {
        const payload = { items };
        if (tiendaId) {
            payload.tienda_id = tiendaId;
        }
        const response = await fetch(`${API_URL}/productos/importar-eleventa`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
    },

    // Vaciar todo el inventario
    deleteAll: async () => {
        const response = await fetch(`${API_URL}/productos/bulk-delete/all`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    // Buscar producto (por código o nombre)
    buscar: async (q, tiendaId = "") => {
        try {
            let url = `${API_URL}/productos/buscar?q=${encodeURIComponent(q)}`;
            if (tiendaId) url += `&tienda_id=${tiendaId}`;
            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                return await window.electronAPI.localDB.searchProducts(q);
            }
            throw error;
        }
    }
};

// ==================== CATEGORÍAS ====================
export const categoriasAPI = {
    // Obtener todas las categorías
    getAll: async () => {
        try {
            const response = await fetch(`${API_URL}/categorias`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    const categories = await window.electronAPI.localDB.getAll('categories', { orderBy: 'nombre ASC' });
                    return Array.isArray(categories) ? categories : [];
                } catch(e) { return []; }
            }
            throw error;
        }
    },

    // Crear categoría
    create: async (nombre) => {
        const response = await fetch(`${API_URL}/categorias`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ nombre })
        });
        return handleResponse(response);
    },

    // Actualizar categoría
    update: async (id, nombre) => {
        const response = await fetch(`${API_URL}/categorias/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ nombre })
        });
        return handleResponse(response);
    },

    // Eliminar categoría
    delete: async (id) => {
        const response = await fetch(`${API_URL}/categorias/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ==================== VENTAS ====================
export const ventasAPI = {
    // Obtener siguiente número de ticket (Optimizado v1.1.4)
    getProximoTicket: async (params = {}) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            try {
                const { tienda_id } = params;
                // turno_id intentionally excluded: online mode returns MySQL integer (42)
                // while offline SQLite stores it as 'mysql-42', causing a mismatch that
                // resets the counter to 1 after every sale. Tickets are store-sequential.
                let where = 'is_deleted = 0';
                if (tienda_id) where += ` AND tienda_id = '${String(tienda_id).replace(/'/g, "''")}'`;

                const result = await window.electronAPI.localDB.getAll('sales', {
                    orderBy: 'ticket_numero DESC',
                    where,
                    limit: 1
                });
                const lastTicket = (result && result.length > 0) ? (Number(result[0].ticket_numero) || 0) : 0;
                return { nextTicket: lastTicket + 1 };
            } catch (e) {
                console.error("Local ticket fetch failed:", e);
                return { nextTicket: 1 };
            }
        }

        try {
            const query = new URLSearchParams(params).toString();
            const response = await fetch(`${API_URL}/ventas/proximo-folio?${query}`, { 
                headers: getAuthHeaders() 
            });
            if (!response.ok) throw new Error("Server don't support proximo-folio");
            return await handleResponse(response);
        } catch (error) {
            // Fallback para Web si el servidor no tiene el endpoint
            console.warn("Falling back to history-based ticket calculation on web");
            const history = await ventasAPI.getAll(params);
            const safeHistory = Array.isArray(history) ? history : [];
            const maxTicket = safeHistory.reduce((max, v) => (v?.ticket_numero > max ? v.ticket_numero : max), 0);
            return { nextTicket: maxTicket + 1 };
        }
    },

    // Obtener todas las ventas (Fix #17: desktop branch)
    getAll: async (paramsOrTiendaId = null) => {
        try {
            let url = `${API_URL}/ventas`;
            const queryParams = new URLSearchParams();

            if (paramsOrTiendaId && typeof paramsOrTiendaId === 'object') {
                Object.keys(paramsOrTiendaId).forEach(key => {
                    if (paramsOrTiendaId[key] !== undefined && paramsOrTiendaId[key] !== null) {
                        queryParams.append(key, paramsOrTiendaId[key]);
                    }
                });
            } else if (paramsOrTiendaId) {
                queryParams.append('tienda_id', paramsOrTiendaId);
            }

            if (queryParams.toString()) url += `?${queryParams.toString()}`;

            const response = await fetchWithTimeout(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    let where = '1=1';
                    const filters = (paramsOrTiendaId && typeof paramsOrTiendaId === 'object') ? paramsOrTiendaId : { tienda_id: paramsOrTiendaId };
                    
                    if (filters.tienda_id) where += ` AND tienda_id = '${String(filters.tienda_id).replace(/'/g, "''")}'`;
                    if (filters.turno_id) where += ` AND turno_id = '${String(filters.turno_id).replace(/'/g, "''")}'`;
                    if (filters.usuario_id) where += ` AND usuario_id = '${String(filters.usuario_id).replace(/'/g, "''")}'`;

                    const sales = await window.electronAPI.localDB.getAll('sales', { orderBy: 'fecha DESC', where });
                    return Array.isArray(sales) ? sales : [];
                } catch(e) { return []; }
            }
            throw error;
        }
    },

    // Obtener venta por ID (para cotizaciones)
    getById: async (id) => {
        const response = await fetchWithTimeout(`${API_URL}/ventas/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Registrar venta (Fix: local persistence in Electron)
    create: async (ventaData) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            try {
                const saleId = ventaData.id || `local-${Date.now()}`;
                const { items, ...saleBase } = ventaData;
                
                const localSale = {
                    id: saleId,
                    tienda_id: saleBase.tienda_id || null,
                    turno_id: saleBase.turno_id || null,
                    id:                saleId,
                    ticket_numero:     ventaData.ticket_numero    || null,
                    tipo:              ventaData.tipo              || 'VENTA',
                    estado:            ventaData.estado            || 'COMPLETADA',
                    cliente_id:        ventaData.cliente_id        || null,
                    tienda_id:         ventaData.tienda_id         || null,
                    usuario_id:        ventaData.usuario_id        || null,
                    turno_id:          ventaData.turno_id          || null,
                    fecha:             ventaData.fecha             || new Date().toISOString(),
                    total:             ventaData.total             || 0,
                    descuento_global:  ventaData.descuento_global  || ventaData.descuento || 0,
                    items_count:       ventaData.items_count       || (ventaData.items || ventaData.productos || []).length || 0,
                    resumen_productos: ventaData.resumen_productos || null,
                    metodo_pago:       ventaData.metodo_pago       || 'Efectivo',
                    es_mayoreo:        ventaData.es_mayoreo        ? 1 : 0,
                    notas:             ventaData.notas             || null,
                    sync_status:       'pending'
                };

                // Guardar venta localmente
                await window.electronAPI.localDB.insert('sales', localSale);

                // Guardar ítems en sale_items (sea que vengan como 'items' o 'productos')
                const lineItems = ventaData.items || ventaData.productos || [];
                for (const item of lineItems) {
                    try {
                        await window.electronAPI.localDB.insert('sale_items', {
                            venta_id:        saleId,
                            producto_id:     item.producto_id    || item.id    || '',
                            variacion_id:    item.variacion_id   || null,
                            cantidad:        item.cantidad        || 1,
                            precio_unitario: item.precio_unitario || item.precio || 0,
                            subtotal:        item.subtotal        || (item.cantidad * (item.precio_unitario || item.precio || 0)),
                            sync_status:     'pending'
                        });
                    } catch (itemErr) {
                        console.warn('Error saving sale_item locally:', itemErr.message);
                    }
                }

                // Deducir stock en SQLite sin marcar sync_status='pending'
                // (el servidor deduce stock cuando recibe la venta en el push)
                if (window.electronAPI.localDB.decrementStock) {
                    for (const item of lineItems) {
                        const pid = item.producto_id || item.id || '';
                        const qty = Number(item.cantidad) || 1;
                        if (pid && qty > 0) {
                            window.electronAPI.localDB.decrementStock(String(pid), qty).catch(() => {});
                        }
                    }
                }

                // Intentar sincronizar en background (sin bloquear al usuario)
                fetch(`${API_URL}/ventas`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(ventaData)
                }).then(async (response) => {
                    if (response.ok) {
                        const result = await response.json();
                        await window.electronAPI.localDB.update('sales', saleId, {
                            sync_status: 'synced',
                            mysql_id: result.id
                        });
                    }
                }).catch(() => {}); // Silencioso — sin internet es normal que falle

                return { id: saleId, status: 'saved_locally', ...localSale };
            } catch (error) {
                console.error("Error saving sale locally:", error);
            }
        }

        const response = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(ventaData)
        });
        return handleResponse(response);
    },

    // Cancelar venta (restaura stock)
    cancelar: async (id) => {
        const response = await fetch(`${API_URL}/ventas/${id}/cancelar`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    // Eliminar cotización
    delete: async (id) => {
        const response = await fetch(`${API_URL}/ventas/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ==================== TURNOS ====================
let _offlineShiftId = null; // prevents race-condition double-creation of offline fallback shifts

export const turnosAPI = {
    // Obtener todos los turnos (para admin o filtrado por usuario)
    getAll: async (range = "", tiendaId = "", startDate = "", endDate = "", usuarioId = "") => {
        try {
            let url = `${API_URL}/turnos`;
            const params = new URLSearchParams();
            if (range) params.append('range', range);
            if (tiendaId) params.append('tienda_id', tiendaId);
            if (startDate && range === 'custom') params.append('startDate', startDate);
            if (endDate && range === 'custom') params.append('endDate', endDate);
            if (usuarioId) params.append('usuario_id', usuarioId);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                let where = '1=1';
                if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
                if (usuarioId) where += ` AND usuario_id = '${String(usuarioId).replace(/'/g, "''")}'`;
                return await window.electronAPI.localDB.getAll('cash_registers', { orderBy: 'fecha_apertura DESC', where });
            }
            throw error;
        }
    },

    // Obtener turno activo (Fix #19: desktop branch)
    getActivo: async (usuario_id = null, tienda_id = null) => {
        try {
            let url = `${API_URL}/turnos/activo`;
            const params = new URLSearchParams();
            if (usuario_id) params.append('usuario_id', usuario_id);
            if (tienda_id) params.append('tienda_id', tienda_id);
            if (params.toString()) url += `?${params.toString()}`;
            
            const response = await fetchWithTimeout(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                let where = `estado = 'ABIERTO'`;
                if (usuario_id) where += ` AND usuario_id = '${String(usuario_id).replace(/'/g, "''")}'`;
                if (tienda_id) where += ` AND tienda_id = '${String(tienda_id).replace(/'/g, "''")}'`;
                const turnos = await window.electronAPI.localDB.getAll('cash_registers', { where, orderBy: 'fecha_apertura DESC', limit: 1 });
                
                if (turnos.length > 0) return turnos[0];

                // Race-condition guard: if another call already started creating the fallback, reuse it
                if (_offlineShiftId) {
                    try {
                        const existing = await window.electronAPI.localDB.getById('cash_registers', _offlineShiftId);
                        if (existing) return existing;
                    } catch(e) {}
                }

                console.warn("No active shift found offline. Auto-creating offline fallback shift...");
                const fallbackShiftId = `offline-shift-${Date.now()}`;
                _offlineShiftId = fallbackShiftId;
                const fallbackShift = {
                    id: fallbackShiftId,
                    usuario_id: usuario_id || 1,
                    usuario_nombre: 'Usuario Offline',
                    tienda_id: tienda_id || 1,
                    monto_inicial: 0,
                    estado: 'ABIERTO',
                    fecha_apertura: new Date().toISOString(),
                    sync_status: 'pending'
                };

                try {
                    await window.electronAPI.localDB.insert('cash_registers', fallbackShift);
                } catch(e) {}

                return fallbackShift;
            }
            throw error;
        }
    },

    // Obtener detalle de turno
    getById: async (id) => {
        // Offline-only IDs never exist on MySQL — skip API entirely
        if (String(id).startsWith('offline-shift-') && isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getById('cash_registers', id);
        }
        try {
            const response = await fetchWithTimeout(`${API_URL}/turnos/${id}`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                return await window.electronAPI.localDB.getById('cash_registers', id);
            }
            throw error;
        }
    },

    // Abrir turno (Fix #17: desktop branch)
    abrir: async (monto_inicial, usuario_nombre = 'Vendedor', usuario_id = null, tienda_id = null) => {
        let payload;
        if (monto_inicial && typeof monto_inicial === 'object') {
            payload = monto_inicial;
        } else {
            payload = { monto_inicial, usuario_nombre, usuario_id, tienda_id };
        }

        if (isDesktop() && window.electronAPI?.localDB) {
            const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
            await window.electronAPI.localDB.insert('cash_registers', {
                id,
                usuario_id: payload.usuario_id,
                usuario_nombre: payload.usuario_nombre,
                tienda_id: payload.tienda_id,
                monto_inicial: payload.monto_inicial || 0,
                estado: 'ABIERTO',
                fecha_apertura: new Date().toISOString()
            });
            return { id, estado: 'ABIERTO', monto_inicial: payload.monto_inicial || 0 };
        }

        const response = await fetch(`${API_URL}/turnos/abrir`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
    },

    // Cerrar turno (Fix #18: desktop branch)
    cerrar: async (id, monto_final, notas = '') => {
        if (isDesktop() && window.electronAPI?.localDB) {
            try {
                const shiftId = String(id);
                const existing = await window.electronAPI.localDB.getById('cash_registers', shiftId);
                const closureData = {
                    monto_final,
                    notas,
                    estado: 'CERRADO',
                    fecha_cierre: new Date().toISOString(),
                    sync_status: 'pending'
                };

                if (existing) {
                    await window.electronAPI.localDB.update('cash_registers', shiftId, closureData);
                } else {
                    // Fallback: If shift record is missing locally (opened online), create a record for it
                    console.warn(`Shift ${shiftId} not found locally for closure. Creating placeholder.`);
                    let uId = 1, uNombre = 'Vendedor', tId = 1;
                    try {
                        const user = JSON.parse(localStorage.getItem('user') || '{}');
                        if (user.id || user.ID) uId = user.id || user.ID;
                        if (user.username || user.nombre_usuario) uNombre = user.username || user.nombre_usuario;
                        if (user.tienda_id) tId = user.tienda_id;
                    } catch(e) {}

                    await window.electronAPI.localDB.insert('cash_registers', {
                        id: shiftId,
                        usuario_id: uId,
                        usuario_nombre: uNombre,
                        tienda_id: tId,
                        ...closureData,
                        fecha_apertura: new Date().toISOString(), // Mocking start time if unknown
                        monto_inicial: 0
                    });
                }
                return { success: true, estado: 'CERRADO' };
            } catch (err) {
                console.error("Error closing shift locally:", err);
                throw new Error("No se pudo cerrar el turno localmente: " + err.message);
            }
        }
        const response = await fetch(`${API_URL}/turnos/${id}/cerrar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ monto_final, notas })
        });
        return handleResponse(response);
    }
};

// ==================== TIENDAS ====================
export const tiendasAPI = {
    // Obtener todas las tiendas
    getAll: async () => {
        try {
            const response = await fetchWithTimeout(`${API_URL}/tiendas`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                return await window.electronAPI.localDB.getAll('stores', { orderBy: 'nombre ASC' });
            }
            throw error;
        }
    },

    // Obtener tienda por ID
    getById: async (id) => {
        const response = await fetch(`${API_URL}/tiendas/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Crear tienda
    create: async (data) => {
        const response = await fetch(`${API_URL}/tiendas`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    // Actualizar tienda
    update: async (id, data) => {
        const response = await fetch(`${API_URL}/tiendas/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    // Eliminar tienda
    delete: async (id) => {
        const response = await fetch(`${API_URL}/tiendas/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    // Obtener productos de una tienda (Fix #16: desktop branch)
    getProductos: async (tiendaId) => {
        try {
            const response = await fetchWithTimeout(`${API_URL}/tiendas/${tiendaId}/productos`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                // In desktop mode, all products are local — filter not needed since all prods are synced
                return await window.electronAPI.localDB.getAll('products', { orderBy: 'nombre ASC' });
            }
            throw error;
        }
    },

    // Asignar producto a tienda
    asignarProducto: async (tiendaId, productoId, cantidad = 0, stockMinimo = 5) => {
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/productos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ producto_id: productoId, cantidad, stock_minimo: stockMinimo })
        });
        return handleResponse(response);
    },

    // Actualizar inventario de producto en tienda
    actualizarInventario: async (tiendaId, productoId, data) => {
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/productos/${productoId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    eliminarProducto: async (tiendaId, productoId) => {
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/productos/${productoId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    // Importación masiva de inventario a tienda
    importarInventario: async (tiendaId, items) => {
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/importar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ items })
        });
        return handleResponse(response);
    },

    // Obtener empleados de tienda
    getEmpleados: async (tiendaId) => {
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/empleados`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener resumen de tienda
    getResumen: async (tiendaId) => {
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/resumen`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener alertas de stock bajo globales
    getAlertasBajoStock: async () => {
        const response = await fetch(`${API_URL}/tiendas/inventario/bajo`, { headers: getAuthHeaders() });
        return handleResponse(response);
    }
};

// ==================== CLIENTES ====================
export const clientesAPI = {
    // Obtener todos los clientes
    getAll: async () => {
        try {
            const response = await fetch(`${API_URL}/clientes`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    const customers = await window.electronAPI.localDB.getAll('customers', { orderBy: 'nombre ASC' });
                    return Array.isArray(customers) ? customers : [];
                } catch(e) { return []; }
            }
            throw error;
        }
    },

    // Obtener cliente por ID
    getById: async (id) => {
        const response = await fetch(`${API_URL}/clientes/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener historial de cliente
    getHistory: async (id) => {
        try {
            const response = await fetch(`${API_URL}/clientes/${id}/historial`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                const ventas = await window.electronAPI.localDB.getAll('sales', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'` });
                let abonos = [];
                try {
                    abonos = await window.electronAPI.localDB.getAll('client_abonos', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'` });
                } catch (e) { /* table may not exist yet */ }
                return { ventas, abonos };
            }
            throw error;
        }
    },

    // Crear cliente
    create: async (clienteData) => {
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(clienteData)
        });
        return handleResponse(response);
    },

    // Actualizar cliente
    update: async (id, clienteData) => {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(clienteData)
        });
        return handleResponse(response);
    },

    // Eliminar cliente
    delete: async (id) => {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    // Precios Especiales
    getPreciosEspeciales: async (id) => {
        try {
            const response = await fetch(`${API_URL}/clientes/${id}/precios-especiales`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                // Se necesita hacer un JOIN con productos para obtener el nombre manual, o enviarlo en la respuesta.
                // Para simplificar, obtenemos los precios y luego parseamos.
                const precios = await window.electronAPI.localDB.getAll('client_special_prices', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'` });
                const productos = await window.electronAPI.localDB.getAll('products', {});
                return precios.map(p => {
                    const prod = productos.find(pr => pr.id == p.producto_id);
                    return {
                        ...p,
                        producto_nombre: prod ? prod.nombre : `Producto ${p.producto_id}`,
                        precio_regular: prod ? prod.precio_venta : 0
                    };
                });
            }
            throw error;
        }
    },

    savePrecioEspecial: async (id, data) => {
        const response = await fetch(`${API_URL}/clientes/${id}/precios-especiales`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },

    deletePrecioEspecial: async (id, productoId) => {
        const response = await fetch(`${API_URL}/clientes/${id}/precios-especiales/${productoId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },
    getAbonos: async (id) => {
        try {
            const response = await fetch(`${API_URL}/clientes/${id}/abonos`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                return await window.electronAPI.localDB.getAll('client_abonos', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'`, orderBy: 'fecha DESC' });
            }
            throw error;
        }
    },
    registrarAbono: async (id, abonoData) => {
        const response = await fetch(`${API_URL}/clientes/${id}/abonos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(abonoData)
        });
        return handleResponse(response);
    }
};

// ==================== COMPRAS ====================
export const comprasAPI = {
    // Obtener todas las compras (filtradas por tienda si se provee)
    getAll: async (paramsOrTiendaId = null) => {
        try {
            let url = `${API_URL}/compras`;
            const queryParams = new URLSearchParams();

            if (paramsOrTiendaId) {
                if (paramsOrTiendaId && typeof paramsOrTiendaId === 'object') {
                    Object.keys(paramsOrTiendaId).forEach(key => {
                        if (paramsOrTiendaId[key]) queryParams.append(key, paramsOrTiendaId[key]);
                    });
                } else {
                    queryParams.append('tienda_id', paramsOrTiendaId);
                }
            }

            if (queryParams.toString()) {
                url += `?${queryParams.toString()}`;
            }

            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    const compras = await window.electronAPI.localDB.getAll('compras', { orderBy: 'fecha DESC' });
                    return Array.isArray(compras) ? compras : [];
                } catch(e) { return []; }
            }
            throw error;
        }
    },

    // Registrar compra
    create: async (compraData) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            try {
                const id = `compra-${Date.now()}`;
                const localCompra = { ...compraData, id, sync_status: 'pending', fecha: new Date().toISOString() };
                await window.electronAPI.localDB.insert('compras', localCompra);
                
                // Background sync
                fetch(`${API_URL}/compras`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(localCompra)
                }).catch(err => console.warn("Background purchase sync failed:", err));

                return { id, status: 'saved_locally', ...localCompra };
            } catch (e) {
                console.error("Local purchase save error:", e);
            }
        }

        const response = await fetch(`${API_URL}/compras`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(compraData)
        });
        return handleResponse(response);
    }
};

// ==================== PROVEEDORES ====================
export const proveedoresAPI = {
    // Obtener todos los proveedores
    getAll: async () => {
        try {
            const response = await fetch(`${API_URL}/proveedores`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI && window.electronAPI.localDB) {
                try {
                    const suppliers = await window.electronAPI.localDB.getAll('suppliers', { orderBy: 'nombre ASC' });
                    return Array.isArray(suppliers) ? suppliers : [];
                } catch(e) { return []; }
            }
            throw error;
        }
    },

    // Obtener proveedor por ID
    getById: async (id) => {
        const response = await fetch(`${API_URL}/proveedores/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Crear proveedor
    create: async (proveedorData) => {
        const response = await fetch(`${API_URL}/proveedores`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(proveedorData)
        });
        return handleResponse(response);
    },

    // Actualizar proveedor
    update: async (id, proveedorData) => {
        const response = await fetch(`${API_URL}/proveedores/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(proveedorData)
        });
        return handleResponse(response);
    },

    // Eliminar proveedor
    delete: async (id) => {
        const response = await fetch(`${API_URL}/proveedores/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ==================== PEDIDOS ====================
export const pedidosAPI = {
    // Obtener todos los pedidos (Solicitudes)
    getAll: async (tiendaId = "", showAll = false) => {
        try {
            let url = `${API_URL}/pedidos?`;
            if (tiendaId) url += `tienda_id=${tiendaId}&`;
            if (showAll) url += `show_all=true`;
            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                let where = '1=1';
                if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
                return await window.electronAPI.localDB.getAll('pedidos', { where, orderBy: 'created_at DESC' });
            }
            throw error;
        }
    },

    // Obtener pedido por ID
    getById: async (id) => {
        try {
            const response = await fetch(`${API_URL}/pedidos/${id}`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                return await window.electronAPI.localDB.getById('pedidos', id);
            }
            throw error;
        }
    },

    // Crear pedido
    create: async (pedidoData) => {
        const response = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(pedidoData)
        });
        return handleResponse(response);
    },

    // Actualizar estado del pedido
    updateEstado: async (id, data) => {
        const response = await fetch(`${API_URL}/pedidos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(typeof data === 'string' ? { estado: data } : data)
        });
        return handleResponse(response);
    },

    // Eliminar pedido
    delete: async (id) => {
        const response = await fetch(`${API_URL}/pedidos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ==================== DASHBOARD ====================
export const dashboardAPI = {
    // Obtener estadísticas
    getStats: async (range, tiendaId = "", turnoId = "") => {
        try {
            let url = range ? `${API_URL}/dashboard?range=${range}` : `${API_URL}/dashboard`;
            if (tiendaId) url += (url.includes('?') ? '&' : '?') + `tienda_id=${tiendaId}`;
            if (turnoId) url += (url.includes('?') ? '&' : '?') + `turno_id=${turnoId}`;

            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                console.warn("📊 VPS unreachable — Loading local stats...");
                try {
                    // Return basic local stats to prevent UI crash
                    const products = await window.electronAPI.localDB.getAll('products');
                    const sales = await window.electronAPI.localDB.getAll('sales');
                    
                    const safeProducts = Array.isArray(products) ? products : [];
                    const safeSales = Array.isArray(sales) ? sales : [];

                    const lowStock = safeProducts.filter(p => p && (Number(p.cantidad) <= (Number(p.stock_minimo) || 5))).length;
                    const totalRevenue = safeSales.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
                    const totalProfit = totalRevenue * 0.3; 

                    return {
                        totalProductos: safeProducts.length,
                        financiero: {
                            ingresos: totalRevenue,
                            ganancia: totalProfit,
                            gastos: 0,
                            costo: totalRevenue * 0.7
                        },
                        totalVentas: { cantidad: safeSales.length },
                        bajoStock: lowStock,
                        productosStock: safeProducts,
                        tendenciaVentas: [],
                        topProductos: safeProducts.slice(0, 10),
                        mejorProducto: safeProducts[0] || null,
                        tendencias: { ingresos: 0, ganancia: 0, ventas: 0 }
                    };
                } catch (e) {
                    console.error("Local dashboard stats error:", e);
                }
            }
            throw error;
        }
    },
    // Listar tiendas para filtros
    getTiendas: async () => {
        try {
            const response = await fetch(`${API_URL}/tiendas`, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop()) return []; // Simplified for offline
            throw error;
        }
    },
    // Listar turnos para filtros
    getTurnosByTienda: async (tiendaId) => {
        try {
            const url = tiendaId ? `${API_URL}/turnos?tienda_id=${tiendaId}` : `${API_URL}/turnos`;
            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop()) return [];
            throw error;
        }
    }
};

// ==================== CONFIGURACION ====================
export const configuracionAPI = {
    get: async (options = {}) => {
        // Fix #22: Try cached config first for desktop
        if (isDesktop()) {
            try {
                const response = await fetch(`${API_URL}/configuracion`, { headers: getAuthHeaders(), signal: options?.signal });
                const data = await handleResponse(response);
                // Cache it for offline use
                try { localStorage.setItem('cached_store_config', JSON.stringify(data)); } catch(e) {}
                return data;
            } catch (e) {
                // Fallback to cached config if offline
                const cached = localStorage.getItem('cached_store_config');
                if (cached) return JSON.parse(cached);
                return null;
            }
        }
        const response = await fetch(`${API_URL}/configuracion`, { headers: getAuthHeaders(), signal: options?.signal });
        return handleResponse(response);
    },
    update: async (formData) => {
        const response = await fetch(`${API_URL}/configuracion`, {
            method: 'PUT',
            body: formData,
            headers: getAuthHeadersMultipart()
        });
        return handleResponse(response);
    }
};

// ==================== PROMOCIONES ====================
export const promocionesAPI = {
    getAll: async (tiendaId = null) => {
        // Fix #20: desktop fallback — return empty if offline
        if (isDesktop() && window.electronAPI?.localDB) {
            try {
                let url = `${API_URL}/promociones`;
                if (tiendaId) url += `?tienda_id=${tiendaId}`;
                const response = await fetch(url, { headers: getAuthHeaders() });
                const data = await handleResponse(response);
                // Cache for offline
                try { localStorage.setItem('cached_promociones', JSON.stringify(data)); } catch(e) {}
                return data;
            } catch (e) {
                const cached = localStorage.getItem('cached_promociones');
                return cached ? JSON.parse(cached) : [];
            }
        }
        let url = `${API_URL}/promociones`;
        if (tiendaId) url += `?tienda_id=${tiendaId}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
    create: async (data) => {
        const response = await fetch(`${API_URL}/promociones`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    update: async (id, data) => {
        const response = await fetch(`${API_URL}/promociones/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    delete: async (id) => {
        const response = await fetch(`${API_URL}/promociones/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// ==================== MOVIMIENTOS ====================
export const movimientosAPI = {
    getAll: async (startDate = "", endDate = "", tiendaId = "", turnoId = "", usuarioId = "") => {
        try {
            let url = `${API_URL}/movimientos`;
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (tiendaId) params.append('tienda_id', tiendaId);
            if (turnoId) params.append('turno_id', turnoId);
            if (usuarioId) params.append('usuario_id', usuarioId);

            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetchWithTimeout(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                // Build combined view from sales
                let where = 'is_deleted = 0';
                if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
                if (turnoId) where += ` AND turno_id = '${String(turnoId).replace(/'/g, "''")}'`;
                if (usuarioId) where += ` AND usuario_id = '${String(usuarioId).replace(/'/g, "''")}'`;
                
                try {
                    const ventas = await window.electronAPI.localDB.getAll('sales', { where, orderBy: 'fecha DESC' });
                    return (ventas || []).map(v => ({
                        ...v,
                        tipo: 'venta',
                        monto: v.total,
                        descripcion: `Ticket #${v.ticket_numero || 'S/N'} - ${v.cliente_nombre || 'Venta General'}`,
                        fecha: v.fecha
                    }));
                } catch (e) {
                    console.error("Local movements error:", e);
                    return [];
                }
            }
            throw error;
        }
    }
};

// ==================== AJUSTES ====================
export const ajustesAPI = {
    create: async (data) => {
        const response = await fetch(`${API_URL}/ajustes`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    getAll: async (tiendaId = "") => {
        let url = `${API_URL}/ajustes`;
        if (tiendaId) url += `?tienda_id=${tiendaId}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    }
};

// ==================== GASTOS ====================
export const gastosAPI = {
    create: async (data) => {
        const response = await fetch(`${API_URL}/gastos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    getAll: async (tiendaId = "", startDate = "", endDate = "") => {
        try {
            let url = `${API_URL}/gastos?tienda_id=${tiendaId}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            const response = await fetch(url, { headers: getAuthHeaders() });
            return await handleResponse(response);
        } catch (error) {
            if (isDesktop() && window.electronAPI?.localDB) {
                let where = "1=1";
                if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
                if (startDate) where += ` AND fecha >= '${String(startDate).replace(/'/g, "''")}'`;
                if (endDate) where += ` AND fecha <= '${String(endDate).replace(/'/g, "''")}'`;
                return await window.electronAPI.localDB.getAll('expenses', { where, orderBy: 'fecha DESC' });
            }
            throw error;
        }
    },
    update: async (id, data) => {
        const response = await fetch(`${API_URL}/gastos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(response);
    },
    delete: async (id) => {
        const response = await fetch(`${API_URL}/gastos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    }
};

// Exportar URL base para imágenes
export const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    let urlPath = path;
    // Asegurar que las imágenes pasen por el proxy /api para llegar al backend
    if (urlPath.startsWith('/uploads')) {
        urlPath = `/api${urlPath}`;
    }

    const apiBaseUrl = API_URL;
    const baseHost = apiBaseUrl.replace(/\/api$/, '');

    return `${baseHost}${urlPath}`;
};
