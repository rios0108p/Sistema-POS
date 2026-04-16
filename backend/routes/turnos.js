import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todos los turnos (para admin) con filtros
router.get('/', async (req, res) => {
    const { range, tienda_id, startDate, endDate, usuario_id } = req.query; // day, week, month, year, custom, tienda_id, usuario_id

    let dateFilter = '';
    let params = [];

    if (range === 'day') {
        if (startDate) {
            dateFilter = "AND DATE(t.fecha_apertura) = ?";
            params.push(startDate);
        } else {
            dateFilter = "AND DATE(t.fecha_apertura) = CURDATE()";
        }
    } else if (range === 'week') {
        dateFilter = "AND t.fecha_apertura >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    } else if (range === 'month') {
        dateFilter = "AND MONTH(t.fecha_apertura) = MONTH(NOW()) AND YEAR(t.fecha_apertura) = YEAR(NOW())";
    } else if (range === 'year') {
        dateFilter = "AND YEAR(t.fecha_apertura) = YEAR(NOW())";
    } else if (range === 'custom' && startDate && endDate) {
        dateFilter = "AND t.fecha_apertura BETWEEN ? AND ?";
        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    let tiendaFilter = '';
    if (tienda_id) {
        tiendaFilter = 'AND t.tienda_id = ?';
        params.push(tienda_id);
    }

    let usuarioFilter = '';
    if (usuario_id) {
        usuarioFilter = 'AND t.usuario_id = ?';
        params.push(usuario_id);
    }

    try {
        const [rows] = await db.query(`
            SELECT t.*, u.turno_trabajo as shift_name,
                   (SELECT COUNT(*) FROM ventas WHERE turno_id = t.id AND estado = 'COMPLETADA') as num_ventas,
                   (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE turno_id = t.id AND estado = 'COMPLETADA') as total_actual
            FROM turnos t
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            WHERE 1=1 ${dateFilter} ${tiendaFilter} ${usuarioFilter}
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

        // Obtener turno con el nombre del turno de trabajo del usuario
        const [turno] = await db.query(`
            SELECT t.*, u.turno_trabajo as shift_name
            FROM turnos t
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            WHERE t.id = ?
        `, [id]);
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

        // Obtener resumen de ventas (Mayoreo, Cancelados, etc) en una sola consulta
        const [resumenVentas] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN es_mayoreo = 1 AND estado = 'COMPLETADA' AND tipo = 'VENTA' THEN total ELSE 0 END), 0) as total_mayoreo,
                COALESCE(SUM(CASE WHEN estado = 'CANCELADA' AND tipo = 'VENTA' THEN total ELSE 0 END), 0) as total_cancelado,
                COUNT(CASE WHEN estado = 'CANCELADA' AND tipo = 'VENTA' THEN 1 END) as num_cancelados
            FROM ventas 
            WHERE turno_id = ?
        `, [id]);
        const stats = resumenVentas[0];

        // Obtener ventas por CATEGORÍA (Departamentos)
        const [ventasPorCategoria] = await db.query(`
            SELECT 
                c.nombre as categoria,
                SUM(dv.subtotal) as total,
                COUNT(dv.id) as num_items
            FROM detalle_ventas dv
            INNER JOIN ventas v ON dv.venta_id = v.id
            INNER JOIN productos p ON dv.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria = c.nombre OR (p.categoria IS NULL AND c.id IS NULL)
            WHERE v.turno_id = ? AND v.estado = 'COMPLETADA' AND v.tipo = 'VENTA'
            GROUP BY c.nombre
            ORDER BY total DESC
        `, [id]);
 
        // Obtener Entradas y Salidas de efectivo para este turno
        const [movimientos] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN monto ELSE 0 END), 0) as total_entradas,
                COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN monto ELSE 0 END), 0) as total_salidas
            FROM gastos
            WHERE turno_id = ?
        `, [id]);

        // Calcular venta_total sumando todos los métodos
        const ventaTotal = Array.isArray(totales) ? totales.reduce((acc, curr) => acc + Number(curr.total || 0), 0) : 0;
 
        res.json({
            ...turno[0],
            ventas: Array.isArray(ventas) ? ventas : [],
            totales_por_metodo: Array.isArray(totales) ? totales : [],
            totales_mayoreo_por_metodo: Array.isArray(totalesMayoreo) ? totalesMayoreo : [],
            mayoreo_total: stats.total_mayoreo,
            cancelado_total: stats.total_cancelado,
            num_cancelados: stats.num_cancelados,
            ventas_por_categoria: Array.isArray(ventasPorCategoria) ? ventasPorCategoria : [],
            total_entradas: movimientos && movimientos[0] ? movimientos[0].total_entradas : 0,
            total_salidas: movimientos && movimientos[0] ? movimientos[0].total_salidas : 0,
            venta_total: ventaTotal
        });
    } catch (error) {
        console.error('Error detallado obteniendo detalle de turno:', error);
        res.status(500).json({ 
            error: 'Error obteniendo detalle', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Abrir turno
router.post('/abrir', async (req, res) => {
    try {
        const userId = req.user.id;
        const username = req.user.username;
        const tiendaId = req.user.rol === 'admin' ? (req.body.tienda_id || null) : req.user.tienda_id;
        
        const { monto_inicial } = req.body;

        // Verificar que no hay turno abierto para este usuario y tienda
        const [abiertos] = await db.query(`SELECT id FROM turnos WHERE estado = 'ABIERTO' AND usuario_id = ? AND tienda_id = ?`, [userId, tiendaId]);
        if (abiertos.length > 0) {
            return res.status(400).json({ 
                error: `Ya tienes un turno abierto en la tienda con ID: ${tiendaId}. Debes cerrarlo antes de abrir uno nuevo.` 
            });
        }

        const [result] = await db.query(`
            INSERT INTO turnos (usuario_id, usuario_nombre, monto_inicial, estado, tienda_id)
            VALUES (?, ?, ?, 'ABIERTO', ?)
        `, [userId, username, monto_inicial || 0, tiendaId]);

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

        // Calcular movimientos de efectivo (gastos/entradas)
        const [movimientos] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN monto ELSE 0 END), 0) as entradas,
                COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN monto ELSE 0 END), 0) as salidas
            FROM gastos
            WHERE turno_id = ?
        `, [id]);

        const ventasEfectivo = porMetodo.find(p => p.metodo === 'Efectivo')?.total || 0;
        const ventasTarjeta = porMetodo.find(p => p.metodo === 'Tarjeta')?.total || 0;
        const ventasTransferencia = porMetodo.find(p => p.metodo === 'Transferencia')?.total || 0;
        const totalEntradas = movimientos[0]?.entradas || 0;
        const totalSalidas = movimientos[0]?.salidas || 0;

        // Calcular diferencia (monto_final vs ventas_efectivo + entradas - salidas)
        // El arqueo es lo que queda en caja: Ventas en Efectivo + Lo que entró - Lo que salió
        const esperadoEnCaja = (parseFloat(turno[0].monto_inicial || 0) + parseFloat(ventasEfectivo || 0) + parseFloat(totalEntradas || 0)) - parseFloat(totalSalidas || 0);
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
        console.error('Error detallado cerrando turno:', error);
        res.status(500).json({ 
            error: 'Error cerrando turno', 
            details: error.message 
        });
    }
});

export default router;
