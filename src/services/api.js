// API Service para reemplazar Supabase
const isDesktop = () => !!window.electronAPI?.isDesktop;

// Detección dinámica de la URL de la API
const getBaseUrl = () => {
    // Prioridad 1: Variable de entorno explícita (si existe)
    if (import.meta.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Prioridad 2: Si estamos en la Desktop App de Electron
    // Solo forzamos producción si NO estamos en localhost:5173 (que es el dev server)
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

// ... (This content is conceptual, I will apply multiple small edits due to file size)
// THIS TOOL CALL WILL BE REPLACED BY MULTI-REPLACE TO HANDLE THE WHOLE FILE

export const authAPI = {
    login: async (username, password) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al iniciar sesión');
        }
        return response.json();
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
        const response = await fetch(`${API_URL}/auth/verify-pin`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ pin })
        });
        return handleResponse(response);
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
        const response = await fetch(`${API_URL}/usuarios`, { headers: getAuthHeaders() });
        const data = await handleResponse(response);
        return data.map(u => ({
            ...u,
            permisos: typeof u.permisos === 'string' ? JSON.parse(u.permisos) : u.permisos
        }));
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
        if (isDesktop() && window.electronAPI?.localDB) {
            // Cuando es offline, retornamos todos los productos sin paginación por ahora 
            // (para no romper el grid en local que ya lo carga todo a veces).
            return await window.electronAPI.localDB.getAll('products', { orderBy: 'nombre ASC' });
        }

        const response = await fetch(`${API_URL}/productos?page=${page}&limit=${limit}`, { headers: getAuthHeaders() });
        const result = await handleResponse(response);
        
        // Si el backend devolvió el nuevo formato { data, pagination }, retornamos .data 
        // para no romper los componentes que esperan un array directo.
        // TODO: Actualizar componentes para usar .pagination
        return result.data || result;
    },

    // Obtener producto por ID
    getById: async (id) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            const product = await window.electronAPI.localDB.getById('products', id);
            return product;
        }

        const response = await fetch(`${API_URL}/productos/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Crear producto con imágenes
    create: async (productoData, imagenes) => {
        const formData = new FormData();

        // Agregar datos del producto con mapeo de campos JSON
        Object.keys(productoData).forEach(key => {
            const isJsonField = ['caracteristicas', 'variaciones', 'barcodes_agrupados', 'barcodesAgrupados', 'impuestos'].includes(key);
            if (isJsonField) {
                const backendKey = key === 'barcodesAgrupados' ? 'barcodes_agrupados' : key;
                formData.append(backendKey, JSON.stringify(productoData[key]));
            } else {
                formData.append(key, productoData[key]);
            }
        });

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
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.searchProducts(q);
        }
        let url = `${API_URL}/productos/buscar?q=${encodeURIComponent(q)}`;
        if (tiendaId) url += `&tienda_id=${tiendaId}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    }
};

// ==================== CATEGORÍAS ====================
export const categoriasAPI = {
    // Obtener todas las categorías
    getAll: async () => {
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getAll('categories', { orderBy: 'nombre ASC' });
        }
        const response = await fetch(`${API_URL}/categorias`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
    // Obtener todas las ventas (Fix #15: desktop now filters by tienda_id/turno_id)
    getAll: async (filters = {}) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            let where = '1=1';
            if (filters.tienda_id) where += ` AND tienda_id = '${String(filters.tienda_id).replace(/'/g, "''")}'`;
            if (filters.turno_id) where += ` AND turno_id = '${String(filters.turno_id).replace(/'/g, "''")}'`;
            if (filters.usuario_id) where += ` AND usuario_id = '${String(filters.usuario_id).replace(/'/g, "''")}'`;
            return await window.electronAPI.localDB.getAll('sales', { orderBy: 'fecha DESC', where });
        }
        const response = await fetch(`${API_URL}/ventas`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener venta por ID (para cotizaciones)
    getById: async (id) => {
        const response = await fetch(`${API_URL}/ventas/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Registrar venta
    create: async (ventaData) => {
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
export const turnosAPI = {
    // Obtener todos los turnos (para admin o filtrado por usuario)
    getAll: async (range = "", tiendaId = "", startDate = "", endDate = "", usuarioId = "") => {
        if (isDesktop() && window.electronAPI?.localDB) {
            let where = '1=1';
            if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
            if (usuarioId) where += ` AND usuario_id = '${String(usuarioId).replace(/'/g, "''")}'`;
            return await window.electronAPI.localDB.getAll('cash_registers', { orderBy: 'fecha_apertura DESC', where });
        }
        let url = `${API_URL}/turnos`;
        const params = new URLSearchParams();
        if (range) params.append('range', range);
        if (tiendaId) params.append('tienda_id', tiendaId);
        if (startDate && range === 'custom') params.append('startDate', startDate);
        if (endDate && range === 'custom') params.append('endDate', endDate);
        if (usuarioId) params.append('usuario_id', usuarioId);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener turno activo (Fix #19: desktop branch)
    getActivo: async (usuario_id = null, tienda_id = null) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            let where = `estado = 'ABIERTO'`;
            if (usuario_id) where += ` AND usuario_id = '${String(usuario_id).replace(/'/g, "''")}'`;
            if (tienda_id) where += ` AND tienda_id = '${String(tienda_id).replace(/'/g, "''")}'`;
            const turnos = await window.electronAPI.localDB.getAll('cash_registers', { where, orderBy: 'fecha_apertura DESC', limit: 1 });
            return turnos.length > 0 ? turnos[0] : null;
        }
        let url = `${API_URL}/turnos/activo`;
        const params = new URLSearchParams();
        if (usuario_id) params.append('usuario_id', usuario_id);
        if (tienda_id) params.append('tienda_id', tienda_id);
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener detalle de turno
    getById: async (id) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getById('cash_registers', id);
        }
        const response = await fetch(`${API_URL}/turnos/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
            await window.electronAPI.localDB.update('cash_registers', id, {
                monto_final,
                notas,
                estado: 'CERRADO',
                fecha_cierre: new Date().toISOString()
            });
            return { success: true, estado: 'CERRADO' };
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
        const response = await fetch(`${API_URL}/tiendas`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        if (isDesktop() && window.electronAPI?.localDB) {
            // In desktop mode, all products are local — filter not needed since all prods are synced
            return await window.electronAPI.localDB.getAll('products', { orderBy: 'nombre ASC' });
        }
        const response = await fetch(`${API_URL}/tiendas/${tiendaId}/productos`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getAll('customers', { orderBy: 'nombre ASC' });
        }
        const response = await fetch(`${API_URL}/clientes`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener cliente por ID
    getById: async (id) => {
        const response = await fetch(`${API_URL}/clientes/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener historial de cliente
    getHistory: async (id) => {
        if (isDesktop() && window.electronAPI?.localDB) {
            const ventas = await window.electronAPI.localDB.getAll('sales', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'` });
            let abonos = [];
            try {
                abonos = await window.electronAPI.localDB.getAll('client_abonos', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'` });
            } catch (e) { /* table may not exist yet */ }
            return { ventas, abonos };
        }
        const response = await fetch(`${API_URL}/clientes/${id}/historial`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        const response = await fetch(`${API_URL}/clientes/${id}/precios-especiales`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getAll('client_abonos', { where: `cliente_id = '${String(id).replace(/'/g, "''")}'`, orderBy: 'fecha DESC' });
        }
        const response = await fetch(`${API_URL}/clientes/${id}/abonos`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getAll('compras', { orderBy: 'fecha DESC' });
        }
        let url = `${API_URL}/compras`;
        const queryParams = new URLSearchParams();

        if (paramsOrTiendaId) {
            if (typeof paramsOrTiendaId === 'object') {
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
        return handleResponse(response);
    },

    // Registrar compra
    create: async (compraData) => {
        // compraData puede incluir proveedor_id
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
        if (isDesktop() && window.electronAPI?.localDB) {
            return await window.electronAPI.localDB.getAll('suppliers', { orderBy: 'nombre ASC' });
        }
        const response = await fetch(`${API_URL}/proveedores`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        let url = `${API_URL}/pedidos?`;
        if (tiendaId) url += `tienda_id=${tiendaId}&`;
        if (showAll) url += `show_all=true`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener pedido por ID
    getById: async (id) => {
        const response = await fetch(`${API_URL}/pedidos/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        let url = range ? `${API_URL}/dashboard?range=${range}` : `${API_URL}/dashboard`;
        if (tiendaId) url += (url.includes('?') ? '&' : '?') + `tienda_id=${tiendaId}`;
        if (turnoId) url += (url.includes('?') ? '&' : '?') + `turno_id=${turnoId}`;

        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
    // Listar tiendas para filtros
    getTiendas: async () => {
        const response = await fetch(`${API_URL}/tiendas`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
    // Listar turnos para filtros
    getTurnosByTienda: async (tiendaId) => {
        const url = tiendaId ? `${API_URL}/turnos?tienda_id=${tiendaId}` : `${API_URL}/turnos`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        // Fix #21: desktop branch
        if (isDesktop() && window.electronAPI?.localDB) {
            // Build combined view from sales + cash_register_movements
            let where = '1=1';
            if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
            if (turnoId) where += ` AND turno_id = '${String(turnoId).replace(/'/g, "''")}'`;
            if (usuarioId) where += ` AND usuario_id = '${String(usuarioId).replace(/'/g, "''")}'`;
            if (startDate) where += ` AND fecha >= '${startDate}'`;
            if (endDate) where += ` AND fecha <= '${endDate} 23:59:59'`;
            
            const ventas = await window.electronAPI.localDB.getAll('sales', { where, orderBy: 'fecha DESC' });
            return ventas.map(v => ({
                ...v,
                tipo: 'venta',
                monto: v.total,
                descripcion: `Ticket #${v.ticket_numero || 'S/N'}`
            }));
        }

        let url = `${API_URL}/movimientos`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (tiendaId) params.append('tienda_id', tiendaId);
        if (turnoId) params.append('turno_id', turnoId);
        if (usuarioId) params.append('usuario_id', usuarioId);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
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
        if (isDesktop() && window.electronAPI?.localDB) {
            let where = "1=1";
            if (tiendaId) where += ` AND tienda_id = '${String(tiendaId).replace(/'/g, "''")}'`;
            if (startDate) where += ` AND fecha >= '${String(startDate).replace(/'/g, "''")}'`;
            if (endDate) where += ` AND fecha <= '${String(endDate).replace(/'/g, "''")}'`;
            return await window.electronAPI.localDB.getAll('expenses', { where, orderBy: 'fecha DESC' });
        }

        let url = `${API_URL}/gastos?tienda_id=${tiendaId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
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
