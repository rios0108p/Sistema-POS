import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todos los turnos (para admin) con filtros
router.get('/', async (req, res) => {
    const { range, tienda_id } = req.query; // day, week, month, year, tienda_id

    let dateFilter = '';
    let params = [];

    if (range === 'day') {
        dateFilter = "AND DATE(t.fecha_apertura) = CURDATE()";
    } else if (range === 'week') {
        dateFilter = "AND t.fecha_apertura >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    } else if (range === 'month') {
        dateFilter = "AND MONTH(t.fecha_apertura) = MONTH(NOW()) AND YEAR(t.fecha_apertura) = YEAR(NOW())";
    } else if (range === 'year') {
        dateFilter = "AND YEAR(t.fecha_apertura) = YEAR(NOW())";
    }

    let tiendaFilter = '';
    if (tienda_id) {
        tiendaFilter = 'AND t.tienda_id = ?';
        params.push(tienda_id);
    }

    try {
        const [rows] = await db.query(`
            SELECT t.*, u.turno_trabajo as shift_name,
                   (SELECT COUNT(*) FROM ventas WHERE turno_id = t.id) as num_ventas
            FROM turnos t
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            WHERE 1=1 ${dateFilter} ${tiendaFilter}
            ORDER BY t.fecha_apertura DESC
            LIMIT 100
        `, params);
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo turnos:', error);
        res.status(500).json({ error: 'Error obteniendo turnos' });
    }
});

// Obtener turno activo (filtrado por usuario o tienda para evitar traslapes)
router.get('/activo', async (req, res) => {
    try {
        const { usuario_id, tienda_id } = req.query;
        let query = "SELECT * FROM turnos WHERE estado = 'ABIERTO'";
        let params = [];

        if (usuario_id) {
            query += " AND usuario_id = ?";
            params.push(usuario_id);
        }
        if (tienda_id) {
            query += " AND tienda_id = ?";
            params.push(tienda_id);
        }

        query += " ORDER BY fecha_apertura DESC LIMIT 1";

        const [rows] = await db.query(query, params);

        if (rows.length === 0) {
            return res.json(null);
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error obteniendo turno activo:', error);
        res.status(500).json({ error: 'Error obteniendo turno activo' });
    }
});

// Obtener detalle de un turno
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener turno
        const [turno] = await db.query('SELECT * FROM turnos WHERE id = ?', [id]);
        if (turno.length === 0) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        // Obtener ventas del turno
        const [ventas] = await db.query(`
            SELECT v.*, c.nombre as cliente_nombre
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            WHERE v.turno_id = ?
            ORDER BY v.fecha DESC
        `, [id]);

        // Obtener totales por método de pago (SOLO COMPLETADAS)
        const [totales] = await db.query(`
            SELECT 
                vp.metodo,
                SUM(vp.monto) as total
            FROM ventas_pagos vp
            INNER JOIN ventas v ON vp.venta_id = v.id
            WHERE v.turno_id = ? AND v.estado = 'COMPLETADA' AND v.tipo = 'VENTA'
            GROUP BY vp.metodo
        `, [id]);

        // Obtener totales de MAYOREO por método de pago
        const [totalesMayoreo] = await db.query(`
            SELECT 
                vp.metodo,
                SUM(vp.monto) as total
            FROM ventas_pagos vp
            INNER JOIN ventas v ON vp.venta_id = v.id
            WHERE v.turno_id = ? AND v.es_mayoreo = 1 AND v.estado = 'COMPLETADA' AND v.tipo = 'VENTA'
            GROUP BY vp.metodo
        `, [id]);

        // Obtener resumen de MAYOREO
        const [resumenMayoreo] = await db.query(`
            SELECT COALESCE(SUM(total), 0) as total_mayoreo
            FROM ventas 
            WHERE turno_id = ? AND tipo = 'VENTA' AND estado = 'COMPLETADA' AND es_mayoreo = 1
        `, [id]);

        // Obtener total de ventas CANCELADAS
        const [resumenCancelados] = await db.query(`
            SELECT COALESCE(SUM(total), 0) as total_cancelado
            FROM ventas
            WHERE turno_id = ? AND estado = 'CANCELADO' AND tipo = 'VENTA'
        `, [id]);

        // Calcular venta_total sumando todos los métodos
        const ventaTotal = totales.reduce((acc, curr) => acc + Number(curr.total), 0);

        res.json({
            ...turno[0],
            ventas,
            totales_por_metodo: totales,
            totales_mayoreo_por_metodo: totalesMayoreo,
            mayoreo_total: resumenMayoreo[0].total_mayoreo,
            cancelado_total: resumenCancelados[0].total_cancelado,
            venta_total: ventaTotal
        });
    } catch (error) {
        console.error('Error obteniendo detalle de turno:', error);
        res.status(500).json({ error: 'Error obteniendo detalle' });
    }
});

// Abrir turno
router.post('/abrir', async (req, res) => {
    try {
        const { monto_inicial, usuario_nombre = 'Vendedor', usuario_id = null, tienda_id = null } = req.body;

        // Verificar que no hay turno abierto para este usuario y tienda
        const [abiertos] = await db.query(`SELECT id FROM turnos WHERE estado = 'ABIERTO' AND usuario_id = ? AND tienda_id = ?`, [usuario_id, tienda_id]);
        if (abiertos.length > 0) {
            return res.status(400).json({ error: 'Ya tienes un turno abierto en esta tienda.' });
        }

        const [result] = await db.query(`
            INSERT INTO turnos (usuario_id, usuario_nombre, monto_inicial, estado, tienda_id)
            VALUES (?, ?, ?, 'ABIERTO', ?)
        `, [usuario_id, usuario_nombre, monto_inicial || 0, tienda_id]);

        res.status(201).json({
            message: 'Turno abierto exitosamente',
            id: result.insertId,
            monto_inicial
        });
    } catch (error) {
        console.error('Error abriendo turno:', error);
        res.status(500).json({ error: 'Error abriendo turno' });
    }
});

// Cerrar turno
router.post('/:id/cerrar', async (req, res) => {
    try {
        const { id } = req.params;
        const { monto_final, notas } = req.body;

        // Obtener turno
        const [turno] = await db.query('SELECT * FROM turnos WHERE id = ? AND estado = ?', [id, 'ABIERTO']);
        if (turno.length === 0) {
            return res.status(404).json({ error: 'Turno no encontrado o ya cerrado' });
        }

        // Calcular totales del turno
        const [totales] = await db.query(`
            SELECT 
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as total_monto,
                COALESCE(SUM(CASE WHEN es_mayoreo = 1 THEN total ELSE 0 END), 0) as total_mayoreo
            FROM ventas 
            WHERE turno_id = ? AND tipo = 'VENTA' AND estado = 'COMPLETADA'
        `, [id]);

        // Calcular por método de pago
        const [porMetodo] = await db.query(`
            SELECT 
                vp.metodo,
                COALESCE(SUM(vp.monto), 0) as total
            FROM ventas_pagos vp
            INNER JOIN ventas v ON vp.venta_id = v.id
            WHERE v.turno_id = ? AND v.tipo = 'VENTA' AND v.estado = 'COMPLETADA'
            GROUP BY vp.metodo
        `, [id]);

        const ventasEfectivo = porMetodo.find(p => p.metodo === 'Efectivo')?.total || 0;
        const ventasTarjeta = porMetodo.find(p => p.metodo === 'Tarjeta')?.total || 0;
        const ventasTransferencia = porMetodo.find(p => p.metodo === 'Transferencia')?.total || 0;
        const ventasDolar = porMetodo.find(p => p.metodo === 'Dolar')?.total || 0;

        // Calcular diferencia (monto_final vs monto_inicial + ventas_efectivo)
        const esperadoEnCaja = parseFloat(turno[0].monto_inicial) + parseFloat(ventasEfectivo);
        const diferencia = parseFloat(monto_final || 0) - esperadoEnCaja;

        // Actualizar turno
        try {
            await db.query(`
                UPDATE turnos SET
                    fecha_cierre = NOW(),
                    monto_final = ?,
                    ventas_efectivo = ?,
                    ventas_tarjeta = ?,
                    ventas_transferencia = ?,
                    ventas_mayoreo = ?,
                    total_ventas = ?,
                    total_monto = ?,
                    diferencia = ?,
                    notas = ?,
                    estado = 'CERRADO'
                WHERE id = ?
            `, [
                monto_final || 0,
                ventasEfectivo,
                ventasTarjeta,
                ventasTransferencia,
                totales[0].total_mayoreo,
                totales[0].total_ventas,
                totales[0].total_monto,
                diferencia,
                notas || '',
                id
            ]);
        } catch (updateError) {
            // Auto-migración si falta la columna ventas_mayoreo
            if (updateError.code === 'ER_BAD_FIELD_ERROR' && updateError.message.includes('ventas_mayoreo')) {
                await db.query('ALTER TABLE turnos ADD COLUMN ventas_mayoreo DECIMAL(10,2) DEFAULT 0 AFTER ventas_transferencia');
                // Re-intentar
                await db.query(`
                    UPDATE turnos SET
                        fecha_cierre = NOW(),
                        monto_final = ?,
                        ventas_efectivo = ?,
                        ventas_tarjeta = ?,
                        ventas_transferencia = ?,
                        ventas_mayoreo = ?,
                        total_ventas = ?,
                        total_monto = ?,
                        diferencia = ?,
                        notas = ?,
                        estado = 'CERRADO'
                    WHERE id = ?
                `, [monto_final || 0, ventasEfectivo, ventasTarjeta, ventasTransferencia, totales[0].total_mayoreo, totales[0].total_ventas, totales[0].total_monto, diferencia, notas || '', id]);
            } else {
                throw updateError;
            }
        }

        res.json({
            message: 'Turno cerrado exitosamente',
            resumen: {
                total_ventas: totales[0].total_ventas,
                total_monto: totales[0].total_monto,
                ventas_efectivo: ventasEfectivo,
                ventas_tarjeta: ventasTarjeta,
                ventas_transferencia: ventasTransferencia,
                ventas_mayoreo: totales[0].total_mayoreo,
                monto_inicial: turno[0].monto_inicial,
                monto_final: monto_final,
                esperado_en_caja: esperadoEnCaja,
                diferencia: diferencia
            }
        });
    } catch (error) {
        console.error('Error cerrando turno:', error);
        res.status(500).json({ error: 'Error cerrando turno' });
    }
});

export default router;
