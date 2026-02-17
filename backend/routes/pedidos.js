import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todos los pedidos (Solicitudes)
router.get('/', async (req, res) => {
    try {
        let { tienda_id } = req.query;

        // Limpiar tienda_id de posibles colones (ej: :1 -> 1)
        if (tienda_id && typeof tienda_id === 'string' && tienda_id.startsWith(':')) {
            tienda_id = tienda_id.substring(1);
        }

        let query = 'SELECT p.*, t.nombre as tienda_nombre FROM pedidos p LEFT JOIN tiendas t ON p.tienda_id = t.id';
        const params = [];

        if (tienda_id) {
            query += ' WHERE p.tienda_id = ?';
            params.push(tienda_id);
        }

        query += ' ORDER BY p.created_at DESC';
        const [pedidos] = await db.query(query, params);

        // Obtener detalles de cada pedido
        for (let pedido of pedidos) {
            const [detalles] = await db.query('SELECT * FROM detalle_pedidos WHERE pedido_id = ?', [pedido.id]);
            pedido.detalles = detalles; // Cambiado a .detalles para consistencia con el frontend
        }

        // Normalizar estados a mayúsculas y limpiar espacios antes de enviar al frontend
        const pedidosNormalizados = pedidos.map(p => ({
            ...p,
            estado: p.estado ? p.estado.toString().trim().toUpperCase() : 'PENDIENTE'
        }));

        res.json(pedidosNormalizados);
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
});

// Obtener pedido por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [pedidos] = await db.query('SELECT * FROM pedidos WHERE id = ?', [id]);

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const [detalles] = await db.query('SELECT * FROM detalle_pedidos WHERE pedido_id = ?', [id]);
        pedidos[0].productos = detalles;

        res.json(pedidos[0]);
    } catch (error) {
        console.error('Error al obtener pedido:', error);
        res.status(500).json({ error: 'Error al obtener pedido' });
    }
});

// Crear nuevo pedido
router.post('/', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            tienda_id, usuario_solicitante_id, nombre_cliente, email_cliente, telefono_cliente,
            direccion_envio, subtotal, envio, total, metodo_pago, notas, productos
        } = req.body;

        if ((!nombre_cliente && !tienda_id) || !productos || productos.length === 0) {
            throw new Error('Faltan datos requeridos (Tienda/Cliente y Productos)');
        }

        // Crear pedido / solicitud
        const [pedidoResult] = await connection.query(
            `INSERT INTO pedidos 
       (tienda_id, usuario_solicitante_id, nombre_cliente, email_cliente, telefono_cliente, direccion_envio, subtotal, envio, total, metodo_pago, notas, estado) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tienda_id || null, usuario_solicitante_id || null, nombre_cliente || 'SUMINISTRO INTERNO', email_cliente || null,
            telefono_cliente || null, direccion_envio || null, subtotal, envio || 0, total, metodo_pago || 'SOLICITUD', notas || null, 'PENDIENTE']
        );

        const pedidoId = pedidoResult.insertId;

        // Insertar detalles del pedido
        for (const item of productos) {
            const { producto_id, cantidad, precio_unitario } = item;

            // Obtener nombre del producto
            const [producto] = await connection.query('SELECT nombre FROM productos WHERE id = ?', [producto_id]);

            if (producto.length === 0) {
                throw new Error(`Producto con ID ${producto_id} no encontrado`);
            }

            const subtotalItem = cantidad * precio_unitario;

            await connection.query(
                'INSERT INTO detalle_pedidos (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [pedidoId, producto_id, producto[0].nombre, cantidad, precio_unitario, subtotalItem]
            );
        }

        await connection.commit();
        res.status(201).json({
            id: pedidoId,
            message: 'Pedido creado exitosamente'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al crear pedido:', error);
        res.status(500).json({ error: error.message || 'Error al crear pedido' });
    } finally {
        connection.release();
    }
});

// Actualizar estado del pedido
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pedidoId = parseInt(id, 10);
        const { estado, usuario_id } = req.body;

        if (!estado) {
            return res.status(400).json({ error: 'El estado es requerido' });
        }

        const nuevoEstado = estado.toString().trim().toUpperCase();
        console.log(`[PEDIDO] Recibida petición para actualizar #${pedidoId} a ${nuevoEstado}`);

        // Obtener estado actual SIN transacción
        const [pedido] = await db.query('SELECT estado, tienda_id FROM pedidos WHERE id = ?', [pedidoId]);
        if (pedido.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const estadoAnterior = pedido[0].estado ? pedido[0].estado.toString().trim().toUpperCase() : 'PENDIENTE';
        const tiendaId = pedido[0].tienda_id;
        console.log(`[PEDIDO] Estado actual en BD: "${pedido[0].estado}" (normalizado: ${estadoAnterior})`);

        // --- BLOQUEO DE SEGURIDAD ---
        if (estadoAnterior === 'COMPRADO' || estadoAnterior === 'CANCELADO') {
            console.log(`[BLOCKED] Pedido ${pedidoId} ya está ${estadoAnterior}`);
            return res.status(400).json({ error: `Este pedido ya está ${estadoAnterior} y no puede modificarse` });
        }

        // Actualizar estado DIRECTAMENTE sin transacción
        console.log(`[PEDIDO] Ejecutando UPDATE: estado = "${nuevoEstado}" WHERE id = ${pedidoId}`);
        const [updateResult] = await db.query('UPDATE pedidos SET estado = ? WHERE id = ?', [nuevoEstado, pedidoId]);
        console.log(`[PEDIDO] Resultado UPDATE:`, JSON.stringify(updateResult));

        // Verificar que el UPDATE funcionó
        const [verificacion] = await db.query('SELECT estado FROM pedidos WHERE id = ?', [pedidoId]);
        console.log(`[PEDIDO] Verificación después del UPDATE: estado = "${verificacion[0]?.estado}"`);

        // Procesar inventario si es COMPRADO
        if (nuevoEstado === 'COMPRADO' && estadoAnterior !== 'COMPRADO' && tiendaId) {
            console.log(`[INVENTARIO] 🔄 Procesando para tienda ${tiendaId}`);
            try {
                const [detalles] = await db.query('SELECT producto_id, producto_nombre, cantidad, precio_unitario, subtotal FROM detalle_pedidos WHERE pedido_id = ?', [pedidoId]);
                console.log(`[INVENTARIO] 📦 Encontrados ${detalles.length} items:`, JSON.stringify(detalles));

                for (const item of detalles) {
                    console.log(`[INVENTARIO] ➕ Agregando producto_id=${item.producto_id}, cantidad=${item.cantidad} a tienda ${tiendaId}`);

                    const [invResult] = await db.query(`
                        INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad, stock_minimo)
                        VALUES (?, ?, ?, 5)
                        ON DUPLICATE KEY UPDATE cantidad = cantidad + ?
                    `, [tiendaId, item.producto_id, item.cantidad, item.cantidad]);
                    console.log(`[INVENTARIO] ✅ Inventario actualizado:`, JSON.stringify(invResult));

                    const [compraResult] = await db.query(`
                        INSERT INTO compras (producto_id, producto_nombre, cantidad, precio_unitario, total, tienda_id, usuario_id, fecha)
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                    `, [item.producto_id, item.producto_nombre, item.cantidad, item.precio_unitario, item.subtotal, tiendaId, usuario_id]);
                    console.log(`[INVENTARIO] 💰 Compra registrada:`, JSON.stringify(compraResult));
                }
                console.log(`[INVENTARIO] ✅ Procesados ${detalles.length} items exitosamente`);
            } catch (invError) {
                console.error(`[INVENTARIO ERROR] ❌ ${invError.message}`);
                console.error(`[INVENTARIO ERROR] Stack:`, invError.stack);
            }
        }

        res.json({ message: 'Estado actualizado exitosamente', estado: nuevoEstado });
    } catch (error) {
        console.error('[PEDIDO ERROR]', error);
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

// Eliminar pedido (Solo si está CANCELADO)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar estado antes de borrar
        const [pedido] = await db.query('SELECT estado FROM pedidos WHERE id = ?', [id]);
        if (pedido.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        if (pedido[0].estado !== 'CANCELADO') {
            return res.status(400).json({ error: 'Solo se pueden eliminar pedidos con estado CANCELADO' });
        }

        await db.query('DELETE FROM pedidos WHERE id = ?', [id]);
        res.json({ message: 'Pedido eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar pedido:', error);
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
});

export default router;
