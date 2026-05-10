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
                   c.nombre as cliente_nombre, u.nombre_usuario as cajero, v.usuario_id,
                   GROUP_CONCAT(CONCAT(vp.metodo, CASE WHEN vp.referencia IS NOT NULL THEN CONCAT(' (', vp.referencia, ')') ELSE '' END) SEPARATOR ' + ') as metodo_detalle
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN usuarios u ON v.usuario_id = u.id
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

// Obtener siguiente número de ticket por turno
router.get('/proximo-folio', async (req, res) => {
    try {
        const { tienda_id, turno_id } = req.query;
        const tiendaId = tienda_id || req.user?.tienda_id;

        let query = 'SELECT MAX(ticket_numero) as max_ticket FROM ventas WHERE 1=1';
        const params = [];

        if (tiendaId) {
            query += ' AND tienda_id = ?';
            params.push(tiendaId);
        }
        if (turno_id) {
            query += ' AND turno_id = ?';
            params.push(turno_id);
        }

        const [result] = await db.query(query, params);
        const nextTicket = (result[0]?.max_ticket || 0) + 1;
        res.json({ nextTicket });
    } catch (error) {
        console.error('Error al obtener próximo folio:', error);
        res.status(500).json({ error: 'Error al obtener próximo folio' });
    }
});

// Obtener detalle de una venta
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener cabecera
        const [venta] = await db.query(`
            SELECT v.*, c.nombre as cliente_nombre, u.nombre_usuario as cajero
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.id = ?
        `, [id]);

        if (venta.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

        // Verificación de propiedad (Multi-sucursal)
        if (req.user.rol !== 'admin' && String(venta[0].tienda_id) !== String(req.user.tienda_id)) {
            console.warn(`🛡️ Bloqueado intento de ver venta ajena: Usuario ${req.user.username} (Tienda ${req.user.tienda_id}) -> Venta ${id} (Tienda ${venta[0].tienda_id})`);
            return res.status(403).json({ error: 'No tienes permiso para ver esta venta.' });
        }

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
            // Ignoramos desglose_impuestos y total_impuestos del body por seguridad (SEC-007)
        } = req.body;

        const userId = req.body.usuario_id || null;
        const tiendaId = req.body.tienda_id || null;
        const turnoId = req.body.turno_id;

        if (!turnoId && tipo === 'VENTA') {
            throw new Error('Se requiere un turno activo para registrar una venta');
        }

        // Si es VENTA, validar que el turno esté ABIERTO
        if (tipo === 'VENTA') {
            const [turnoCheck] = await connection.query(
                'SELECT estado FROM turnos WHERE id = ?',
                [turnoId]
            );
            if (turnoCheck.length === 0 || turnoCheck[0].estado !== 'ABIERTO') {
                throw new Error('El turno se encuentra cerrado o no es válido. No se puede realizar la venta.');
            }
        }

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
        let totalImpuestosCalculados = 0;
        const desgloseImpuestosCalculado = {};
        const detallesVenta = [];
        const resumenProdNames = [];

        // 1. Procesar Productos (Validar Stock y Calcular Totales)
        for (const item of productos) {
            let stockDisponible = 0;
            let nombreProducto = '';
            let precioFinal = parseFloat(item.precio);
            let precioCompraActual = 0;
            let impuestosDB = null;

            // Obtener información base del producto y stock según contexto (Tienda o Global)
            if (tiendaId) {
                const [storeInfo] = await connection.query(`
                    SELECT p.nombre, p.precio_compra, it.cantidad, p.impuestos 
                    FROM productos p
                    JOIN inventario_tienda it ON p.id = it.producto_id
                    WHERE it.tienda_id = ? AND p.id = ?
                    FOR UPDATE
                `, [tiendaId, item.id]);

                if (storeInfo.length === 0) {
                    const [pBase] = await connection.query('SELECT nombre, precio_compra, impuestos FROM productos WHERE id = ?', [item.id]);
                    if (pBase.length === 0) throw new Error(`Producto ID ${item.id} no encontrado`);
                    nombreProducto = pBase[0].nombre;
                    precioCompraActual = pBase[0].precio_compra;
                    stockDisponible = 0;
                    impuestosDB = pBase[0].impuestos;
                } else {
                    nombreProducto = storeInfo[0].nombre;
                    precioCompraActual = storeInfo[0].precio_compra;
                    stockDisponible = storeInfo[0].cantidad;
                    impuestosDB = storeInfo[0].impuestos;
                }
            } else {
                const [prodDB] = await connection.query('SELECT nombre, precio_compra, cantidad, impuestos FROM productos WHERE id = ? FOR UPDATE', [item.id]);
                if (prodDB.length === 0) throw new Error(`Producto ID ${item.id} no encontrado`);
                nombreProducto = prodDB[0].nombre;
                precioCompraActual = prodDB[0].precio_compra;
                stockDisponible = prodDB[0].cantidad;
                impuestosDB = prodDB[0].impuestos;
            }

            // Validar variación si existe
            if (item.variacion_id) {
                const [varDB] = await connection.query('SELECT nombre, stock FROM variaciones WHERE id = ? FOR UPDATE', [item.variacion_id]);
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

            // --- RE-CÁLCULO DE IMPUESTOS (SEC-007) ---
            const subtotalItem = item.cantidad * precioFinal;
            let impuestosItemTotal = 0;
            const itemImpuestosDetalle = [];

            if (impuestosDB) {
                try {
                    const impList = typeof impuestosDB === 'string' ? JSON.parse(impuestosDB) : impuestosDB;
                    if (Array.isArray(impList)) {
                        impList.forEach(imp => {
                            if (!imp || !imp.tipo || imp.tipo === 'IVA Exento') return;
                            const pct = parseFloat(imp.porcentaje) || 0;
                            if (pct === 0 && !imp.tipo.includes('Retención')) return;

                            const taxVal = subtotalItem - (subtotalItem / (1 + (pct / 100)));
                            const isRetencion = imp.tipo.toLowerCase().includes('retención') || imp.tipo === 'ISR / Retención';
                            const finalTaxVal = isRetencion ? -taxVal : taxVal;

                            if (!desgloseImpuestosCalculado[imp.tipo]) {
                                desgloseImpuestosCalculado[imp.tipo] = { porcentaje: pct, total: 0 };
                            }
                            desgloseImpuestosCalculado[imp.tipo].total += finalTaxVal;
                            impuestosItemTotal += finalTaxVal;
                            itemImpuestosDetalle.push(imp);
                        });
                    }
                } catch (e) { console.error('Error parseando impuestos en server:', e); }
            }
            totalImpuestosCalculados += impuestosItemTotal;

            const subtotal = item.cantidad * precioFinal;
            totalBruto += subtotal;
            itemsCount += item.cantidad;

            if (resumenProdNames.length < 3) resumenProdNames.push(`${nombreProducto} x${item.cantidad}`);

            detallesVenta.push({
                producto_id: item.id,
                variacion_id: item.variacion_id || null,
                cantidad: item.cantidad,
                precio_unitario: precioFinal,
                costo_unitario: precioCompraActual,
                subtotal: subtotal,
                impuestos: itemImpuestosDetalle.length > 0 ? itemImpuestosDetalle : null,
                promocion_id: item.promocion_id || null
            });

            // 2. Actualizar stock (VENTA)
            if (tipo === 'VENTA') {
                if (tiendaId) {
                    const [exists] = await connection.query(
                        'SELECT id FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
                        [tiendaId, item.id]
                    );

                    if (exists.length > 0) {
                        await connection.query(
                            'UPDATE inventario_tienda SET cantidad = GREATEST(0, CAST(cantidad AS SIGNED) - ?), activo = 1 WHERE id = ?',
                            [item.cantidad, exists[0].id]
                        );
                    } else {
                        await connection.query(
                            'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad) VALUES (?, ?, 0)',
                            [tiendaId, item.id]
                        );
                    }
                } else {
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

        const totalNeto = totalBruto - (parseFloat(descuento_global) || 0) + parseFloat(totalImpuestosCalculados || 0);
        const estadoInicial = tipo === 'COTIZACION' ? 'PENDIENTE' : 'COMPLETADA';
        const resumenStr = resumenProdNames.join(', ') + (productos.length > 3 ? '...' : '');

        // 2. Crear Venta/Cotización
        const [resultVenta] = await connection.query(`
            INSERT INTO ventas (
                ticket_numero, cliente_id, fecha, total, items_count, resumen_productos, 
                tipo, estado, descuento_global, notas, metodo_pago,
                tienda_id, turno_id, usuario_id, es_mayoreo, desglose_impuestos, total_impuestos
            ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            tiendaId,
            turnoId,
            userId,
            req.body.es_mayoreo || false,
            JSON.stringify(desgloseImpuestosCalculado),
            parseFloat(totalImpuestosCalculados || 0)
        ]);

        const ventaId = resultVenta.insertId;

        // 3. Insertar Detalles
        for (const det of detallesVenta) {
            await connection.query(`
                INSERT INTO detalle_ventas(venta_id, producto_id, variacion_id, cantidad, precio_unitario, costo_unitario, subtotal, impuestos, promocion_id)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [ventaId, det.producto_id, det.variacion_id, det.cantidad, det.precio_unitario, det.costo_unitario, det.subtotal, det.impuestos ? JSON.stringify(det.impuestos) : null, det.promocion_id || null]);
        }

        // 4. Registrar Pagos y Validar Crédito
        let totalCredito = 0;
        if (pagos && pagos.length > 0) {
            for (const pago of pagos) {
                if (pago.metodo === 'Credito') {
                    totalCredito += parseFloat(pago.monto);
                }
                await connection.query(`
                    INSERT INTO ventas_pagos(venta_id, metodo, monto, referencia)
                    VALUES(?, ?, ?, ?)
                `, [ventaId, pago.metodo, pago.monto, pago.referencia || null]);
            }
        } else if (tipo === 'VENTA' && req.body.metodo_pago) {
            if (req.body.metodo_pago === 'Credito') totalCredito = totalNeto;
            await connection.query(`
                INSERT INTO ventas_pagos(venta_id, metodo, monto)
                VALUES(?, ?, ?)
            `, [ventaId, req.body.metodo_pago, totalNeto]);
        }

        if (totalCredito > 0) {
            if (!cliente_id) throw new Error('Se requiere seleccionar un cliente para ventas a crédito');
            const [clienteRows] = await connection.query('SELECT * FROM clientes WHERE id = ?', [cliente_id]);
            if (clienteRows.length === 0) throw new Error('Cliente no encontrado');
            const cli = clienteRows[0];
            if (!cli.credito_habilitado) throw new Error('El cliente no tiene habilitado el crédito por la administración');

            const nuevoSaldo = parseFloat(cli.saldo_deudor || 0) + totalCredito;
            if (nuevoSaldo > parseFloat(cli.limite_credito || 0)) {
                throw new Error(`Límite de crédito excedido. Disponible: $${(cli.limite_credito - cli.saldo_deudor).toFixed(2)}, Intento de cargo: $${totalCredito.toFixed(2)}`);
            }
            await connection.query('UPDATE clientes SET saldo_deudor = ? WHERE id = ?', [nuevoSaldo, cliente_id]);
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

        if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('costo_unitario')) {
            try {
                await db.query('ALTER TABLE detalle_ventas ADD COLUMN costo_unitario DECIMAL(10,2) NULL AFTER precio_unitario');
                console.log('Migración: columna costo_unitario añadida a detalle_ventas');
            } catch (err2) { console.error('Error migrando detalle_ventas (costo_unitario):', err2); }
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

        // Verificación de propiedad (Multi-sucursal)
        if (req.user.rol !== 'admin' && String(venta[0].tienda_id) !== String(req.user.tienda_id)) {
            console.warn(`🛡️ Bloqueado intento de cancelación IDOR: Usuario ${req.user.username} intentó cancelar Venta ${id}`);
            throw new Error('No tienes permiso para cancelar ventas de otra sucursal.');
        }

        if (venta[0].estado === 'CANCELADA') {
            throw new Error('Esta venta ya fue cancelada');
        }

        // Solo restaurar stock si era VENTA (no cotización)
        if (venta[0].tipo === 'VENTA') {
            // Restaurar saldo deudor si hubo crédito
            const [pagosVenta] = await connection.query('SELECT * FROM ventas_pagos WHERE venta_id = ? AND metodo = "Credito"', [id]);
            if (pagosVenta.length > 0 && venta[0].cliente_id) {
                const totalARestaurar = pagosVenta.reduce((acc, p) => acc + parseFloat(p.monto), 0);
                await connection.query('UPDATE clientes SET saldo_deudor = GREATEST(0, saldo_deudor - ?) WHERE id = ?', [totalARestaurar, venta[0].cliente_id]);
            }

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
