// API Service para reemplazar Supabase
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper para manejar respuestas
const handleResponse = async (response) => {
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error('SERVER RESPONSE WAS NOT JSON:', text);
        alert('DEBUG: El servidor devolvió algo que no es JSON: \n' + text.substring(0, 150));
        throw new Error('Respuesta inválida del servidor (posible error de conexión o HTML)');
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
        return handleResponse(response);
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
    // Obtener todos los productos
    getAll: async () => {
        const response = await fetch(`${API_URL}/productos`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener producto por ID
    getById: async (id) => {
        const response = await fetch(`${API_URL}/productos/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Crear producto con imágenes
    create: async (productoData, imagenes) => {
        const formData = new FormData();

        // Agregar datos del producto con mapeo de campos JSON
        Object.keys(productoData).forEach(key => {
            const isJsonField = ['caracteristicas', 'variaciones', 'barcodes_agrupados', 'barcodesAgrupados'].includes(key);
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
            const isJsonField = ['caracteristicas', 'variaciones', 'barcodes_agrupados', 'barcodesAgrupados', 'imagenes_existentes'].includes(key);
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
    }
};

// ==================== CATEGORÍAS ====================
export const categoriasAPI = {
    // Obtener todas las categorías
    getAll: async () => {
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
    // Obtener todas las ventas
    getAll: async () => {
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
    // Obtener todos los turnos (para admin)
    getAll: async (range = "", tiendaId = "") => {
        let url = `${API_URL}/turnos`;
        const params = new URLSearchParams();
        if (range) params.append('range', range);
        if (tiendaId) params.append('tienda_id', tiendaId);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener turno activo
    getActivo: async (usuario_id = null) => {
        let url = `${API_URL}/turnos/activo`;
        if (usuario_id) url += `?usuario_id=${usuario_id}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Obtener detalle de turno
    getById: async (id) => {
        const response = await fetch(`${API_URL}/turnos/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    // Abrir turno
    abrir: async (monto_inicial, usuario_nombre = 'Vendedor', usuario_id = null, tienda_id = null) => {
        let payload;
        if (monto_inicial && typeof monto_inicial === 'object') {
            payload = monto_inicial;
        } else {
            payload = { monto_inicial, usuario_nombre, usuario_id, tienda_id };
        }
        const response = await fetch(`${API_URL}/turnos/abrir`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
    },

    // Cerrar turno
    cerrar: async (id, monto_final, notas = '') => {
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

    // Obtener productos de una tienda
    getProductos: async (tiendaId) => {
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
    }
};

// ==================== COMPRAS ====================
export const comprasAPI = {
    // Obtener todas las compras (filtradas por tienda si se provee)
    getAll: async (paramsOrTiendaId = null) => {
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
    getAll: async (tiendaId = "") => {
        let url = `${API_URL}/pedidos`;
        if (tiendaId) url += `?tienda_id=${tiendaId}`;
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
    get: async () => {
        const response = await fetch(`${API_URL}/configuracion`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
    update: async (formData) => {
        // Para FormData, no usamos getAuthHeaders() estándar porque fetch necesita setear el boundary automáticamente
        // Usamos getAuthHeadersMultipart que solo añade Authorization
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
        let url = `${API_URL}/gastos?tienda_id=${tiendaId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
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
    const base = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
    return `${base}${path}`;
};
