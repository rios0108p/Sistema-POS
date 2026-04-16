import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener estadísticas del dashboard
router.get('/', async (req, res) => {
    const { range, tienda_id, turno_id } = req.query; // day, week, month, year, tienda_id, turno_id
    let dateFilter = '';
    let prevDateFilter = '';
    let tiendaFilter = '';
    let turnoFilter = '';

    if (tienda_id) {
        tiendaFilter = 'AND tienda_id = ?';
    }

    if (turno_id) {
        turnoFilter = 'AND turno_id = ?';
        // Si hay turno, usualmente no necesitamos filtro de fecha ya que el turno define el periodo
        dateFilter = '';
        prevDateFilter = 'AND 1=0'; // No comparar con anterior si filtramos por un turno específico
    } else {
        // Filtros de fecha actual y período anterior para comparación
        if (range === 'day') {
            // MySQL syntax
            dateFilter = "AND DATE(fecha) = CURDATE()";
            prevDateFilter = "AND DATE(fecha) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        } else if (range === 'week') {
            // MySQL syntax
            dateFilter = "AND fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            prevDateFilter = "AND fecha >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND fecha < DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } else if (range === 'month') {
            // MySQL syntax
            dateFilter = "AND MONTH(fecha) = MONTH(NOW()) AND YEAR(fecha) = YEAR(NOW())";
            prevDateFilter = "AND MONTH(fecha) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND YEAR(fecha) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))";
        } else if (range === 'year') {
            // MySQL syntax
            dateFilter = "AND YEAR(fecha) = YEAR(NOW())";
            prevDateFilter = "AND YEAR(fecha) = YEAR(DATE_SUB(NOW(), INTERVAL 1 YEAR))";
        }
    }

    const filterParams = [];
    if (tienda_id) filterParams.push(tienda_id);
    if (turno_id) filterParams.push(turno_id);

    const prevFilterParams = [...filterParams]; // Para las consultas de comparación

    try {
        // Total de productos y bajo stock
        let totalProductos, bajoStock, rowsProductos;

        if (tienda_id) {
            // Stats for a specific store
            [totalProductos] = await db.query('SELECT COUNT(*) as total FROM inventario_tienda WHERE tienda_id = ? AND activo = 1', [tienda_id]);
            [bajoStock] = await db.query('SELECT COUNT(*) as total FROM inventario_tienda WHERE tienda_id = ? AND cantidad <= stock_minimo AND activo = 1', [tienda_id]);
            [rowsProductos] = await db.query(`
                SELECT p.id, p.nombre, p.categoria, it.cantidad, it.stock_minimo, p.precio_venta, p.imagenes, it.tienda_id 
                FROM inventario_tienda it
                JOIN productos p ON it.producto_id = p.id
                WHERE it.tienda_id = ? AND it.activo = 1
                ORDER BY it.cantidad ASC LIMIT 15
            `, [tienda_id]);
        } else {
            // Global View (Aggregated from inventario_tienda)
            // Total productos: count unique productos in inventory
            [totalProductos] = await db.query('SELECT COUNT(DISTINCT producto_id) as total FROM inventario_tienda WHERE activo = 1');

            // Bajo stock: sum quantity per product across all stores, then compare to stock_minimo (using MAX or ANY stock_minimo, here assuming product stock_minimo or store default)
            // For simplicity in global view, we check if TOTAL quantity < 5 (hardcoded global min) or check per store
            // Better approach: Count how many (store, product) pairs are low stock OR how many products globally are low.
            // Let's stick to: Count products where SUM(quantity) <= 5 (Global Warning)
            [bajoStock] = await db.query(`
                SELECT COUNT(*) as total FROM (
                    SELECT producto_id, SUM(cantidad) as total_cantidad 
                    FROM inventario_tienda 
                    WHERE activo = 1 
                    GROUP BY producto_id 
                    HAVING total_cantidad <= 10
                ) as low_stock
            `);

            [rowsProductos] = await db.query(`
                SELECT p.id, p.nombre, p.categoria, it.cantidad, it.stock_minimo, p.precio_venta, p.imagenes, t.nombre as tienda_nombre, it.tienda_id
                FROM inventario_tienda it
                JOIN productos p ON it.producto_id = p.id
                JOIN tiendas t ON it.tienda_id = t.id
                WHERE it.activo = 1 AND it.cantidad <= it.stock_minimo
                ORDER BY it.cantidad ASC LIMIT 15
            `);
        }

        const safeJsonParse = (str) => {
            try {
                return (str && str !== '') ? JSON.parse(str) : [];
            } catch (e) {
                return [];
            }
        };

        const productos = rowsProductos.map(p => ({
            ...p,
            imagenes: safeJsonParse(p.imagenes)
        }));

        const buildFilter = (baseFilter, prefix = '') => {
            let filter = baseFilter;
            if (tienda_id) filter += ` AND ${prefix}tienda_id = ?`;
            if (turno_id) filter += ` AND ${prefix}turno_id = ?`;
            return filter;
        };

        // Total de ventas (con filtro)
        const vFilter = buildFilter(dateFilter);
        const [totalVentas] = await db.query(`SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto FROM ventas WHERE tipo = 'VENTA' AND estado = 'COMPLETADA' ${vFilter}`, filterParams);

        // Ventas período anterior (para comparación)
        const vPrevFilter = buildFilter(prevDateFilter);
        const [prevVentas] = await db.query(`SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto FROM ventas WHERE tipo = 'VENTA' AND estado = 'COMPLETADA' ${vPrevFilter}`, prevFilterParams);

        // Total de compras (con filtro)
        // Nota: compras aún no tiene tienda_id/turno_id en todas las versiones, pero aplicamos tienda_id si existe
        const [totalCompras] = await db.query(`SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto FROM compras WHERE 1=1 ${dateFilter}`, []);

        // Cálculo de Ganancia Real (Revenue - Costo de ventas)
        const profitFilter = buildFilter(dateFilter, 'v.');
        const [profitData] = await db.query(`
            SELECT 
                COALESCE(SUM(dv.subtotal), 0) as revenue,
                COALESCE(SUM(COALESCE(dv.costo_unitario, p.precio_compra) * dv.cantidad), 0) as cost
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${profitFilter}
        `, filterParams);

        // Ganancia período anterior
        const profitPrevFilter = buildFilter(prevDateFilter, 'v.');
        const [prevProfit] = await db.query(`
            SELECT 
                COALESCE(SUM(dv.subtotal), 0) as revenue,
                COALESCE(SUM(COALESCE(dv.costo_unitario, p.precio_compra) * dv.cantidad), 0) as cost
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${profitPrevFilter}
        `, prevFilterParams);

        // Ventas recientes
        const recentFilter = buildFilter('');
        const [ventasRecientes] = await db.query(`SELECT * FROM ventas WHERE tipo = 'VENTA' ${recentFilter} ORDER BY fecha DESC LIMIT 10`, filterParams);

        // Ventas por categoría
        const catFilter = buildFilter(dateFilter, 'v.');
        const [ventasPorCategoria] = await db.query(`
            SELECT p.categoria, COUNT(DISTINCT v.id) as ventas, COALESCE(SUM(dv.subtotal), 0) as total
            FROM detalle_ventas dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${catFilter}
            GROUP BY p.categoria
            ORDER BY total DESC
        `, filterParams);

        // Tendencia de ventas
        let groupFormat = '%Y-%m-%d';
        if (range === 'year') groupFormat = '%Y-%m';

        const trendFilter = buildFilter(dateFilter);
        const igFilter = buildFilter(dateFilter, 'v.');

        const mysqlFormat = groupFormat === '%Y-%m-%d' ? '%Y-%m-%d' : '%Y-%m';
        const [tendenciaVentas] = await db.query(`
            SELECT DATE_FORMAT(fecha, '${mysqlFormat}') as label, COALESCE(SUM(total), 0) as total
            FROM ventas
            WHERE tipo = 'VENTA' AND estado = 'COMPLETADA' ${trendFilter}
            GROUP BY label
            ORDER BY label ASC
        `, filterParams);

        // Top 5 Productos (Con stock de la tienda si aplica)
        const topFilter = buildFilter(dateFilter, 'v.');
        const stockSelect = tienda_id ? ', it.cantidad' : ', SUM(it.cantidad) as cantidad';
        const stockJoin = tienda_id
            ? 'LEFT JOIN inventario_tienda it ON p.id = it.producto_id AND it.tienda_id = ?'
            : 'LEFT JOIN inventario_tienda it ON p.id = it.producto_id';

        const [topProductos] = await db.query(`
            SELECT 
                p.id, p.nombre, p.imagenes, p.precio_venta, p.precio_oferta, p.oferta
                ${stockSelect},
                SUM(dv.cantidad) as unidades_vendidas, 
                SUM(dv.subtotal) as total_vendido
            FROM detalle_ventas dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            ${stockJoin}
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${topFilter}
            GROUP BY p.id, p.nombre, p.imagenes, p.precio_venta, p.precio_oferta, p.oferta ${tienda_id ? ', it.cantidad' : ''}
            ORDER BY unidades_vendidas DESC
            LIMIT 5
        `, tienda_id ? [tienda_id, ...filterParams] : filterParams);
        const topProductosFormatted = topProductos.map(p => ({
            ...p,
            imagenes: safeJsonParse(p.imagenes)
        }));

        // Ingresos vs Gastos
        const [ingresosVsGastos] = await db.query(`
            SELECT 
                DATE_FORMAT(v.fecha, '${mysqlFormat}') as label,
                COALESCE(SUM(v.total), 0) as ingresos
            FROM ventas v
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${igFilter}
            GROUP BY label
            ORDER BY label ASC
        `, filterParams);

        const [gastosData] = await db.query(`
            SELECT DATE_FORMAT(fecha, '${mysqlFormat}') as label, COALESCE(SUM(total), 0) as gastos
            FROM compras WHERE 1=1 ${dateFilter} GROUP BY label ORDER BY label ASC
        `);

        const ingresosGastosMap = new Map();
        ingresosVsGastos.forEach(item => ingresosGastosMap.set(item.label, { label: item.label, ingresos: parseFloat(item.ingresos), gastos: 0 }));
        gastosData.forEach(item => {
            if (ingresosGastosMap.has(item.label)) ingresosGastosMap.get(item.label).gastos = parseFloat(item.gastos);
            else ingresosGastosMap.set(item.label, { label: item.label, ingresos: 0, gastos: parseFloat(item.gastos) });
        });
        const ingresosGastosCombinados = Array.from(ingresosGastosMap.values()).sort((a, b) => a.label.localeCompare(b.label));

        // Actividad Reciente (SOLO HOY para el Dashboard) - MySQL
        const actFilter = buildFilter("AND DATE(v.fecha) = CURDATE()", 'v.');
        const [actividadVentas] = await db.query(`
            SELECT 'venta' as tipo, v.id, v.resumen_productos as descripcion, v.total as monto, v.fecha, v.items_count as cantidad, t.usuario_nombre as usuario
            FROM ventas v 
            LEFT JOIN turnos t ON v.turno_id = t.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${actFilter}
            ORDER BY v.fecha DESC LIMIT 10
        `, filterParams);

        const actFilterC = buildFilter("AND DATE(c.fecha) = CURDATE()", 'c.');
        const [actividadCompras] = await db.query(`
            SELECT 'compra' as tipo, c.id, c.producto_nombre as descripcion, c.total as monto, c.fecha, c.cantidad, t.usuario_nombre as usuario
            FROM compras c 
            LEFT JOIN turnos t ON c.turno_id = t.id
            WHERE 1=1 ${actFilterC}
            ORDER BY c.fecha DESC LIMIT 10
        `, filterParams);

        const actividadReciente = [...actividadVentas, ...actividadCompras].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);

        // Mejor Producto
        const bestPFilter = buildFilter(dateFilter, 'v.');
        const [mejorProducto] = await db.query(`
            SELECT p.id, p.nombre, p.imagenes, SUM(dv.cantidad) as unidades, SUM(dv.subtotal) as total
            FROM detalle_ventas dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${bestPFilter}
            GROUP BY p.id, p.nombre, p.imagenes ORDER BY total DESC LIMIT 1
        `, filterParams);

        // Mejor Categoría
        const bestCFilter = buildFilter(dateFilter, 'v.');
        const [mejorCategoria] = await db.query(`
            SELECT p.categoria, COUNT(DISTINCT v.id) as ventas, SUM(dv.subtotal) as total
            FROM detalle_ventas dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${bestCFilter}
            GROUP BY p.categoria ORDER BY total DESC LIMIT 1
        `, filterParams);

        // Mejor Tienda (Basado en el mismo rango pero Global si no hay tienda seleccionada)
        const bestTFilter = buildFilter(dateFilter, 'v.');
        const [mejorTienda] = await db.query(`
            SELECT t.id, t.nombre, COUNT(DISTINCT v.id) as ventas, SUM(v.total) as total
            FROM ventas v
            JOIN tiendas t ON v.tienda_id = t.id
            WHERE v.tipo = 'VENTA' AND v.estado = 'COMPLETADA' ${bestTFilter}
            GROUP BY t.id, t.nombre ORDER BY total DESC LIMIT 1
        `, filterParams);

        // Calcular tendencias (porcentaje de cambio)
        const ingresoActual = parseFloat(profitData[0]?.revenue || 0);
        const ingresoAnterior = parseFloat(prevProfit[0]?.revenue || 0);
        const gananciaActual = parseFloat(profitData[0]?.revenue || 0) - parseFloat(profitData[0]?.cost || 0);
        const gananciaAnterior = parseFloat(prevProfit[0]?.revenue || 0) - parseFloat(prevProfit[0]?.cost || 0);
        const ventasActual = totalVentas[0]?.total || 0;
        const ventasAnterior = prevVentas[0]?.total || 0;

        // GASTOS (con filtros)
        const gFilter = buildFilter(dateFilter, 'g.');
        const [totalGastos] = await db.query(`SELECT COALESCE(SUM(monto), 0) as monto FROM gastos g WHERE 1=1 ${gFilter}`, filterParams);

        const gPrevFilter = buildFilter(prevDateFilter, 'g.');
        const [prevGastos] = await db.query(`SELECT COALESCE(SUM(monto), 0) as monto FROM gastos g WHERE 1=1 ${gPrevFilter}`, prevFilterParams);

        const gastoActual = parseFloat(totalGastos[0]?.monto || 0);
        const gastoAnterior = parseFloat(prevGastos[0]?.monto || 0);

        const calcularTendencia = (actual, anterior) => {
            if (anterior === 0) return actual > 0 ? 100 : 0;
            return ((actual - anterior) / anterior * 100).toFixed(1);
        };

        // Pedidos pendientes (Solicitudes)
        const [pedidosPendientesCount] = await db.query('SELECT COUNT(*) as total FROM pedidos WHERE estado = "PENDIENTE" AND (fecha_programada IS NULL OR fecha_programada <= CURDATE())');
        // Total de tickets (número máximo de ticket)
        const [tickets] = await db.query('SELECT COUNT(*) as total_tickets FROM ventas');
        const totalTickets = tickets[0].total_tickets;

        res.json({
            pedidosPendientes: pedidosPendientesCount[0]?.total || 0,
            totalTickets: totalTickets,
            totalProductos: totalProductos[0]?.total || 0,
            bajoStock: bajoStock[0]?.total || 0,
            totalVentas: {
                cantidad: totalVentas[0]?.total || 0,
                monto: parseFloat(totalVentas[0]?.monto || 0)
            },
            totalCompras: {
                cantidad: totalCompras[0]?.total || 0,
                monto: parseFloat(totalCompras[0]?.monto || 0)
            },
            financiero: {
                ingresos: ingresoActual,
                costo: parseFloat(profitData[0]?.cost || 0),
                gastos: gastoActual,
                ganancia_bruta: gananciaActual,
                ganancia_neta: gananciaActual - gastoActual
            },
            ventasRecientes,
            productosStock: productos,
            ventasPorCategoria,
            tendenciaVentas,

            // Nuevos datos
            topProductos: topProductosFormatted,
            ingresosVsGastos: ingresosGastosCombinados,
            actividadReciente,
            mejorProducto: mejorProducto[0] ? {
                ...mejorProducto[0],
                imagenes: safeJsonParse(mejorProducto[0].imagenes)
            } : null,
            mejorCategoria: mejorCategoria[0] || null,
            mejorTienda: mejorTienda[0] || null,
            tendencias: {
                ingresos: parseFloat(calcularTendencia(ingresoActual, ingresoAnterior)),
                ganancia: parseFloat(calcularTendencia(gananciaActual - gastoActual, gananciaAnterior - gastoAnterior)),
                ventas: parseFloat(calcularTendencia(ventasActual, ventasAnterior)),
                gastos: parseFloat(calcularTendencia(gastoActual, gastoAnterior))
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

export default router;
