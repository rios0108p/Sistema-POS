import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener historial unificado de movimientos
router.get('/', async (req, res) => {
    const { startDate, endDate, tienda_id, turno_id, usuario_id } = req.query;

    let queryParams = [];
    let tiendaFilterV = '';
    let tiendaFilterC = '';
    let turnoFilterV = '';
    let turnoFilterC = '';
    let usuarioFilterV = '';
    let usuarioFilterC = '';

    if (tienda_id) {
        tiendaFilterV = 'AND v.tienda_id = ?';
        tiendaFilterC = 'AND c.tienda_id = ?';
        queryParams.push(tienda_id);
    }

    if (turno_id) {
        turnoFilterV = 'AND v.turno_id = ?';
        turnoFilterC = 'AND c.turno_id = ?';
        queryParams.push(turno_id);
    }

    if (usuario_id) {
        usuarioFilterV = 'AND (t.usuario_id = ?)';
        usuarioFilterC = 'AND (t.usuario_id = ?)';
        // Note: For now we filter by Turn owner to ensure isolation even if table schema is old
    }

    // Usar parámetros de fecha si existen, de lo contrario último mes por defecto - MySQL
    const dateRangeV = (startDate && endDate) ? 'AND v.fecha BETWEEN ? AND ?' : "AND v.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    const dateRangeC = (startDate && endDate) ? 'AND c.fecha BETWEEN ? AND ?' : "AND c.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";

    if (startDate && endDate) {
        queryParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    try {
        // Construir parámetros para la parte de VENTAS
        const paramsV = [];
        if (tienda_id) paramsV.push(tienda_id);
        if (turno_id) paramsV.push(turno_id);
        if (usuario_id) paramsV.push(usuario_id);
        if (startDate && endDate) paramsV.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);

        // Construir parámetros para la parte de COMPRAS
        const paramsC = [];
        if (tienda_id) paramsC.push(tienda_id);
        if (turno_id) paramsC.push(turno_id);
        if (usuario_id) paramsC.push(usuario_id);
        if (startDate && endDate) paramsC.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);

        // Construir parámetros para la parte de AJUSTES
        const paramsA = [];
        if (tienda_id) paramsA.push(tienda_id);
        // Turno no aplica a ajustes directamente, pero por consistencia de filtros podríamos ignorarlo o filtrar si se agregara columna turno_id
        // Para ajustes, usaremos created_at (o fecha según esquema)
        if (startDate && endDate) paramsA.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        if (usuario_id) paramsA.push(usuario_id);

        const query = `
            SELECT * FROM (
                SELECT 
                    'venta' COLLATE utf8mb4_unicode_ci as tipo, 
                    v.id, 
                    v.ticket_numero,
                    v.fecha, 
                    v.total as monto, 
                    v.resumen_productos as descripcion, 
                    t.usuario_nombre as usuario,
                    v.tienda_id,
                    GROUP_CONCAT(CONCAT(vp.metodo, CASE WHEN vp.referencia IS NOT NULL THEN CONCAT(' (', vp.referencia, ')') ELSE '' END) SEPARATOR ' + ') as metodo_pago,
                    ti.nombre as tienda_nombre,
                    v.turno_id,
                    v.estado,
                    v.es_mayoreo,
                    v.cliente_id,
                    cl.nombre as cliente_nombre
                FROM ventas v
                LEFT JOIN turnos t ON v.turno_id = t.id
                LEFT JOIN tiendas ti ON v.tienda_id = ti.id
                LEFT JOIN ventas_pagos vp ON v.id = vp.venta_id
                LEFT JOIN clientes cl ON v.cliente_id = cl.id
                WHERE v.tipo = 'VENTA' ${tiendaFilterV} ${turnoFilterV} ${usuarioFilterV} ${dateRangeV}
                GROUP BY v.id, v.ticket_numero, v.fecha, v.total, v.resumen_productos, t.usuario_nombre, v.tienda_id, ti.nombre, v.turno_id, v.estado, v.es_mayoreo, v.cliente_id, cl.nombre

                UNION ALL

                SELECT 
                    'compra' COLLATE utf8mb4_unicode_ci as tipo, 
                    c.id, 
                    NULL as ticket_numero,
                    c.fecha, 
                    c.total as monto, 
                    c.producto_nombre as descripcion, 
                    t.usuario_nombre as usuario,
                    c.tienda_id,
                    'Gasto' COLLATE utf8mb4_unicode_ci as metodo_pago,
                    ti.nombre as tienda_nombre,
                    c.turno_id,
                    'COMPLETADA' COLLATE utf8mb4_unicode_ci as estado,
                    0 as es_mayoreo,
                    NULL as cliente_id,
                    NULL as cliente_nombre
                FROM compras c
                LEFT JOIN turnos t ON c.turno_id = t.id
                LEFT JOIN tiendas ti ON c.tienda_id = ti.id
                WHERE 1=1 ${tiendaFilterC} ${turnoFilterC} ${usuarioFilterC} ${dateRangeC}

                UNION ALL

                SELECT 
                    'ajuste' COLLATE utf8mb4_unicode_ci as tipo, 
                    a.id, 
                    NULL as ticket_numero,
                    a.fecha, 
                    0.00 as monto, 
                    COALESCE(CONCAT(a.motivo, ' - ', p.nombre), 'Ajuste de Inventario' COLLATE utf8mb4_unicode_ci) as descripcion, 
                    COALESCE(u.nombre_usuario, 'Sistema' COLLATE utf8mb4_unicode_ci) as usuario,
                    a.tienda_id,
                    'Inventario' COLLATE utf8mb4_unicode_ci as metodo_pago,
                    ti.nombre as tienda_nombre,
                    NULL as turno_id,
                    'COMPLETADA' COLLATE utf8mb4_unicode_ci as estado,
                    0 as es_mayoreo,
                    NULL as cliente_id,
                    NULL as cliente_nombre
                FROM ajustes_inventario a
                LEFT JOIN productos p ON a.producto_id = p.id
                LEFT JOIN usuarios u ON a.usuario_id = u.id
                LEFT JOIN tiendas ti ON a.tienda_id = ti.id
                WHERE 1=1 
                ${tienda_id ? 'AND a.tienda_id = ?' : ''}
                ${startDate && endDate ? 'AND a.fecha BETWEEN ? AND ?' : "AND a.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"}
                ${usuario_id ? 'AND a.usuario_id = ?' : ''}
            ) as movimientos
            ORDER BY fecha DESC
        `;

        const [rows] = await db.query(query, [...paramsV, ...paramsC, ...paramsA]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({ error: 'Error al obtener historial de movimientos' });
    }
});

export default router;
