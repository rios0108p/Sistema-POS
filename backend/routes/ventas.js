import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todas las ventas (Resumen)
router.get('/', async (req, res) => {
    try {
        const { tipo, tienda_id } = req.query;
        let query = `
            SELECT v.id, v.ticket_numero, v.fecha, v.total, v.metodo_pago, v.cliente_id, v.tipo, v.estado, v.items_count, v.resumen_productos,
                   v.turno_id, v.tienda_id,
                   c.nombre as cliente_nombre, v.usuario_id,
                   GROUP_CONCAT(CONCAT(vp.metodo, CASE WHEN vp.referencia IS NOT NULL THEN CONCAT(' (', vp.referencia, ')') ELSE '' END) SEPARATOR ' + ') as metodo_detalle
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN ventas_pagos vp ON v.id = vp.venta_id
        `;

        const params = [];
        let whereConditions = [];

        if (tipo) {
            whereConditions.push(`v.tipo = ?`);
            params.push(tipo);
        }
        if (tienda_id) {
            whereConditions.push(`v.tienda_id = ?`);
            params.push(tienda_id);
        }

        if (whereConditions.length > 0) {
            query += ` WHERE ` + whereConditions.join(' AND ');
        }

        query += ` GROUP BY v.id, v.ticket_numero, v.fecha, v.total, v.metodo_pago, v.cliente_id, v.tipo, v.estado, v.items_count, v.resumen_productos, v.turno_id, v.tienda_id, c.nombre, v.usuario_id ORDER BY v.fecha DESC`;

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

// Obtener detalle de una venta
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener cabecera
        const [venta] = await db.query(`
            SELECT v.*, c.nombre as cliente_nombre 
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            WHERE v.id = ?
        `, [id]);

        if (venta.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

        // Obtener detalles (productos)
        const [detalles] = await db.query(`
            SELECT dv.*, p.nombre as producto_nombre, var.nombre as variacion_nombre 
            FROM detalle_ventas dv
            LEFT JOIN productos p ON dv.producto_id = p.id
            LEFT JOIN variaciones var ON dv.variacion_id = var.id
            WHERE dv.venta_id = ?
        `, [id]);

        // Obtener pagos
        const [pagos] = await db.query(`
            SELECT * FROM ventas_pagos WHERE venta_id = ?
        `, [id]);

        res.json({ ...venta[0], detalles, pagos });
    } catch (error) {
        console.error('Error al obtener detalle de venta:', error);
        res.status(500).json({ error: 'Error al obtener detalle' });
    }
});

// Registrar nueva venta o cotización
router.post('/', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            cliente_id,
            productos,
            tipo = 'VENTA', // VENTA, COTIZACION
            descuento_global = 0,
            pagos = [], // Array de { metodo, monto, referencia }
            notas = ''
        } = req.body;

        // Obtener siguiente número de ticket DEL TURNO ACTUAL
        const turnoId = req.body.turno_id;
        const [lastTicket] = await connection.query(
            'SELECT MAX(ticket_numero) as max_ticket FROM ventas WHERE turno_id = ?',
            [turnoId]
        );
        const nextTicketNo = (lastTicket[0].max_ticket || 0) + 1;

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            throw new Error('No hay productos en la transacción');
        }

        let totalBruto = 0;
        let itemsCount = 0;
        const detallesVenta = [];
        const resumenProdNames = [];

        // 1. Procesar Productos (Validar Stock y Calcular Totales)
        for (const item of productos) {
            let stockDisponible = 0;
            let nombreProducto = '';

            // Obtener información base del producto y stock según contexto (Tienda o Global)
            if (req.body.tienda_id) {
                const [storeInfo] = await connection.query(`
                    SELECT p.nombre, it.cantidad 
                    FROM productos p
                    JOIN inventario_tienda it ON p.id = it.producto_id
                    WHERE it.tienda_id = ? AND p.id = ?
                `, [req.body.tienda_id, item.id]);

                if (storeInfo.length === 0) {
                    const [pBase] = await connection.query('SELECT nombre FROM productos WHERE id = ?', [item.id]);
                    if (pBase.length === 0) throw new Error(`Producto ID ${item.id} no encontrado`);
                    nombreProducto = pBase[0].nombre;
                    stockDisponible = 0;
                } else {
                    nombreProducto = storeInfo[0].nombre;
                    stockDisponible = storeInfo[0].cantidad;
                }
            } else {
                const [prodDB] = await connection.query('SELECT nombre, cantidad FROM productos WHERE id = ?', [item.id]);
                if (prodDB.length === 0) throw new Error(`Producto ID ${item.id} no encontrado`);
                nombreProducto = prodDB[0].nombre;
                stockDisponible = prodDB[0].cantidad;
            }

            let precioFinal = parseFloat(item.precio);

            // Validar variación si existe (Por ahora las variaciones parecen globales)
            if (item.variacion_id) {
                const [varDB] = await connection.query('SELECT nombre, stock FROM variaciones WHERE id = ?', [item.variacion_id]);
                if (varDB.length === 0) throw new Error(`Variación ID ${item.variacion_id} no encontrada`);
                stockDisponible = varDB[0].stock;
                nombreProducto += ` (${varDB[0].nombre})`;
            }

            // Validar Stock solo si es VENTA
            if (tipo === 'VENTA') {
                if (stockDisponible < item.cantidad) {
                    throw new Error(`Stock insuficiente para "${nombreProducto}". Disponible: ${stockDisponible}, Solicitado: ${item.cantidad}`);
                }
            }

            const subtotal = item.cantidad * precioFinal;
            totalBruto += subtotal;
            itemsCount += item.cantidad;

            if (resumenProdNames.length < 3) resumenProdNames.push(`${nombreProducto} x${item.cantidad}`);

            detallesVenta.push({
                producto_id: item.id,
                variacion_id: item.variacion_id || null,
                cantidad: item.cantidad,
                precio_unitario: precioFinal,
                subtotal: subtotal
            });

            // 2. Actualizar stock (VENTA)
            if (tipo === 'VENTA') {
                if (req.body.tienda_id) {
                    // SI HAY TIENDA: Solo descontamos del inventario LOCAL de esa sucursal
                    const [exists] = await connection.query(
                        'SELECT id FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
                        [req.body.tienda_id, item.id]
                    );

                    if (exists.length > 0) {
                        await connection.query(
                            'UPDATE inventario_tienda SET cantidad = GREATEST(0, CAST(cantidad AS SIGNED) - ?), activo = 1 WHERE id = ?',
                            [item.cantidad, exists[0].id]
                        );
                    } else {
                        // Si no existía rastro en la tienda, inicializamos en 0
                        await connection.query(
                            'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad) VALUES (?, ?, 0)',
                            [req.body.tienda_id, item.id]
                        );
                    }
                } else {
                    // SI NO HAY TIENDA (ADMIN/CENTRAL): Descontamos del almacén GLOBAL
                    if (item.variacion_id) {
                        await connection.query(
                            'UPDATE variaciones SET stock = GREATEST(0, CAST(stock AS SIGNED) - ?) WHERE id = ?',
                            [item.cantidad, item.variacion_id]
                        );
                    } else {
                        await connection.query(
                            'UPDATE productos SET cantidad = GREATEST(0, CAST(cantidad AS SIGNED) - ?) WHERE id = ?',
                            [item.cantidad, item.id]
                        );
                    }
                }
            }
        }

        const totalNeto = totalBruto - (parseFloat(descuento_global) || 0);
        const estadoInicial = tipo === 'COTIZACION' ? 'PENDIENTE' : 'COMPLETADA';
        const resumenStr = resumenProdNames.join(', ') + (productos.length > 3 ? '...' : '');

        // 2. Crear Venta/Cotización
        const [resultVenta] = await connection.query(`
            INSERT INTO ventas (
                ticket_numero, cliente_id, fecha, total, items_count, resumen_productos, 
                tipo, estado, descuento_global, notas, metodo_pago,
                tienda_id, turno_id, usuario_id, es_mayoreo
            ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
            nextTicketNo,
            cliente_id || null,
            totalNeto,
            itemsCount,
            resumenStr,
            tipo,
            estadoInicial,
            descuento_global,
            notas,
            pagos.length > 0 ? pagos[0].metodo : (req.body.metodo_pago || 'Efectivo'),
            req.body.tienda_id || null,
            req.body.turno_id || null,
            req.body.usuario_id || null,
            req.body.es_mayoreo || false
        ]);

        const ventaId = resultVenta.insertId;

        // 3. Insertar Detalles
        for (const det of detallesVenta) {
            await connection.query(`
                INSERT INTO detalle_ventas(venta_id, producto_id, variacion_id, cantidad, precio_unitario, subtotal)
        VALUES(?, ?, ?, ?, ?, ?)
            `, [ventaId, det.producto_id, det.variacion_id, det.cantidad, det.precio_unitario, det.subtotal]);
        }

        // 4. Registrar Pagos
        if (pagos && pagos.length > 0) {
            for (const pago of pagos) {
                await connection.query(`
                    INSERT INTO ventas_pagos(venta_id, metodo, monto, referencia)
        VALUES(?, ?, ?, ?)
            `, [ventaId, pago.metodo, pago.monto, pago.referencia || null]);
            }
        } else if (tipo === 'VENTA' && req.body.metodo_pago) {
            // Compatibilidad legacy
            await connection.query(`
                INSERT INTO ventas_pagos(venta_id, metodo, monto)
        VALUES(?, ?, ?)
            `, [ventaId, req.body.metodo_pago, totalNeto]);
        }

        await connection.commit();
        res.status(201).json({
            message: `${tipo === 'COTIZACION' ? 'Cotización' : 'Venta'} registrada con éxito`,
            id: ventaId,
            ticket_numero: nextTicketNo,
            total: totalNeto
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar transacción:', error);

        // Auto-migración de usuario_id si falla por campo inexistente
        if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('usuario_id')) {
            try {
                await db.query('ALTER TABLE ventas ADD COLUMN usuario_id INT NULL AFTER turno_id');
                console.log('Migración: columna usuario_id añadida a ventas');
            } catch (err2) { console.error('Error migrando ventas:', err2); }
        }

        if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('es_mayoreo')) {
            try {
                await db.query('ALTER TABLE ventas ADD COLUMN es_mayoreo BOOLEAN DEFAULT FALSE AFTER usuario_id');
                console.log('Migración: columna es_mayoreo añadida a ventas');
            } catch (err2) { console.error('Error migrando ventas:', err2); }
        }

        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Cancelar venta (Restaurar Stock)
router.post('/:id/cancelar', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;

        // Obtener venta
        const [venta] = await connection.query('SELECT * FROM ventas WHERE id = ?', [id]);
        if (venta.length === 0) {
            throw new Error('Venta no encontrada');
        }

        if (venta[0].estado === 'CANCELADA') {
            throw new Error('Esta venta ya fue cancelada');
        }

        // Solo restaurar stock si era VENTA (no cotización)
        if (venta[0].tipo === 'VENTA') {
            // Obtener detalles para restaurar stock
            const [detalles] = await connection.query('SELECT * FROM detalle_ventas WHERE venta_id = ?', [id]);

            for (const det of detalles) {
                if (venta[0].tienda_id) {
                    // Restaurar a la tienda específica
                    await connection.query(
                        'UPDATE inventario_tienda SET cantidad = cantidad + ? WHERE tienda_id = ? AND producto_id = ?',
                        [det.cantidad, venta[0].tienda_id, det.producto_id]
                    );
                } else {
                    // Restaurar al catálogo global
                    if (det.variacion_id) {
                        await connection.query('UPDATE variaciones SET stock = stock + ? WHERE id = ?', [det.cantidad, det.variacion_id]);
                    } else {
                        await connection.query('UPDATE productos SET cantidad = cantidad + ? WHERE id = ?', [det.cantidad, det.producto_id]);
                    }
                }
            }
        }

        // Marcar como cancelada
        await connection.query('UPDATE ventas SET estado = ? WHERE id = ?', ['CANCELADA', id]);

        await connection.commit();
        res.json({ message: 'Venta cancelada y stock restaurado' });

    } catch (error) {
        await connection.rollback();
        console.error('Error cancelando venta:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Eliminar cotización (solo cotizaciones pendientes)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que es una cotización pendiente
        const [venta] = await db.query('SELECT * FROM ventas WHERE id = ?', [id]);
        if (venta.length === 0) {
            return res.status(404).json({ error: 'No encontrado' });
        }

        if (venta[0].tipo !== 'COTIZACION') {
            return res.status(400).json({ error: 'Solo se pueden eliminar cotizaciones' });
        }

        // Eliminar (CASCADE borrará detalles y pagos)
        await db.query('DELETE FROM ventas WHERE id = ?', [id]);

        res.json({ message: 'Cotización eliminada' });
    } catch (error) {
        console.error('Error eliminando cotización:', error);
        res.status(500).json({ error: 'Error eliminando cotización' });
    }
});

export default router;
