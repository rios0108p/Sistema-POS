import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// ========================================
// TIENDAS CRUD
// ========================================

// Obtener todas las tiendas
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT t.*, 
                   (SELECT COUNT(*) FROM usuarios WHERE tienda_id = t.id) as total_empleados,
                   (SELECT COUNT(*) FROM inventario_tienda WHERE tienda_id = t.id AND activo = 1) as total_productos
            FROM tiendas t 
            ORDER BY t.nombre ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener tiendas:', error);
        res.status(500).json({ error: 'Error al obtener tiendas' });
    }
});

// Obtener tienda por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM tiendas WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener tienda:', error);
        res.status(500).json({ error: 'Error al obtener tienda' });
    }
});

// Crear nueva tienda
router.post('/', async (req, res) => {
    try {
        const { nombre, tipo, direccion, telefono, monto_base } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await db.query(
            'INSERT INTO tiendas (nombre, tipo, direccion, telefono, monto_base) VALUES (?, ?, ?, ?, ?)',
            [nombre, tipo || 'GENERAL', direccion || '', telefono || '', monto_base || 500]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Tienda creada exitosamente'
        });
    } catch (error) {
        console.error('Error al crear tienda:', error);
        res.status(500).json({ error: 'Error al crear tienda' });
    }
});

// Actualizar tienda
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, tipo, direccion, telefono, monto_base, activa } = req.body;

        await db.query(
            'UPDATE tiendas SET nombre = ?, tipo = ?, direccion = ?, telefono = ?, monto_base = ?, activa = ? WHERE id = ?',
            [nombre, tipo, direccion, telefono, monto_base, activa !== false, id]
        );

        res.json({ message: 'Tienda actualizada exitosamente' });
    } catch (error) {
        console.error('Error al actualizar tienda:', error);
        res.status(500).json({ error: 'Error al actualizar tienda' });
    }
});

// Eliminar tienda
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if tienda has associated users
        const [users] = await db.query('SELECT COUNT(*) as count FROM usuarios WHERE tienda_id = ?', [id]);
        if (users[0].count > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: hay usuarios asignados a esta tienda' });
        }

        await db.query('DELETE FROM tiendas WHERE id = ?', [id]);
        res.json({ message: 'Tienda eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar tienda:', error);
        res.status(500).json({ error: 'Error al eliminar tienda' });
    }
});

// ========================================
// INVENTARIO POR TIENDA
// ========================================

// Obtener alertas de stock bajo globales
router.get('/inventario/bajo', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                it.tienda_id,
                t.nombre as tienda_nombre,
                it.producto_id,
                p.nombre as producto_nombre,
                p.marca,
                it.cantidad,
                it.stock_minimo,
                p.precio_compra
            FROM inventario_tienda it
            JOIN tiendas t ON it.tienda_id = t.id
            JOIN productos p ON it.producto_id = p.id
            WHERE it.cantidad <= it.stock_minimo AND it.activo = 1
            ORDER BY it.cantidad ASC
            LIMIT 20
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener alertas de stock bajo:', error);
        res.status(500).json({ error: 'Error al obtener alertas' });
    }
});

// Obtener productos de una tienda
router.get('/:id/productos', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT 
                it.id as inventario_id,
                it.cantidad,
                it.stock_minimo,
                it.activo,
                p.id as producto_id,
                p.nombre,
                p.descripcion,
                p.precio_venta,
                p.precio_compra,
                p.categoria,
                p.marca,
                p.codigo_barras,
                p.imagenes,
                p.oferta,
                p.precio_oferta
            FROM inventario_tienda it
            JOIN productos p ON it.producto_id = p.id
            WHERE it.tienda_id = ?
            ORDER BY p.nombre ASC
        `, [id]);

        // Obtener variaciones y códigos de barras para estos productos
        if (rows.length > 0) {
            const productIds = rows.map(r => r.producto_id);
            const [variationRows] = await db.query('SELECT * FROM variaciones WHERE producto_id IN (?)', [productIds]);
            const [barcodeRows] = await db.query('SELECT * FROM producto_barcodes WHERE producto_id IN (?)', [productIds]);

            // Agrupar
            const variationsByProduct = variationRows.reduce((acc, v) => {
                if (!acc[v.producto_id]) acc[v.producto_id] = [];
                acc[v.producto_id].push(v);
                return acc;
            }, {});

            const barcodesByProduct = barcodeRows.reduce((acc, b) => {
                if (!acc[b.producto_id]) acc[b.producto_id] = [];
                acc[b.producto_id].push(b.codigo_barras);
                return acc;
            }, {});

            // Adjuntar a los productos
            const productsWithDetails = rows.map(p => ({
                ...p,
                id: p.producto_id, // Asegurar que tenga el ID del producto para el frontend
                variaciones: variationsByProduct[p.producto_id] || [],
                barcodes_agrupados: barcodesByProduct[p.producto_id] || []
            }));

            return res.json(productsWithDetails);
        }

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener productos de tienda:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// Asignar/Trasladar producto a tienda
router.post('/:id/productos', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { producto_id, cantidad, stock_minimo } = req.body;
        const qtyToTransfer = parseInt(cantidad || 0);

        if (!producto_id) {
            throw new Error('producto_id es requerido');
        }

        // 1. Obtener info del producto
        const [centralProd] = await connection.query(
            'SELECT cantidad, nombre FROM productos WHERE id = ?',
            [producto_id]
        );

        if (centralProd.length === 0) {
            throw new Error('Producto no encontrado en almacén central');
        }

        let message = '';

        // 2. Si hay cantidad > 0, es una transferencia. Si es 0, es solo un vinculado/habilitación.
        if (qtyToTransfer > 0) {
            if (centralProd[0].cantidad < qtyToTransfer) {
                throw new Error(`Stock insuficiente en almacén central. Disponible: ${centralProd[0].cantidad}`);
            }

            // Descontar del almacén central
            await connection.query(
                'UPDATE productos SET cantidad = cantidad - ? WHERE id = ?',
                [qtyToTransfer, producto_id]
            );
            message = `Se han trasladado ${qtyToTransfer} unidades de "${centralProd[0].nombre}" exitosamente.`;
        } else {
            message = `"${centralProd[0].nombre}" ha sido habilitado/vinculado a la tienda correctamente.`;
        }

        // 3. Aumentar stock en tienda (o crear registro)
        const [existing] = await connection.query(
            'SELECT id, cantidad FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
            [id, producto_id]
        );

        if (existing.length > 0) {
            await connection.query(
                'UPDATE inventario_tienda SET cantidad = cantidad + ?, stock_minimo = ?, activo = 1 WHERE id = ?',
                [qtyToTransfer, stock_minimo || 5, existing[0].id]
            );
        } else {
            await connection.query(
                'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad, stock_minimo) VALUES (?, ?, ?, ?)',
                [id, producto_id, qtyToTransfer, stock_minimo || 5]
            );
        }

        await connection.commit();
        res.status(201).json({ message });

    } catch (error) {
        await connection.rollback();
        console.error('Error al procesar asignación/traslado:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Actualizar inventario de producto en tienda
router.put('/:tiendaId/productos/:productoId', async (req, res) => {
    try {
        const { tiendaId, productoId } = req.params;
        const { cantidad, stock_minimo, activo } = req.body;

        await db.query(
            'UPDATE inventario_tienda SET cantidad = ?, stock_minimo = ?, activo = ? WHERE tienda_id = ? AND producto_id = ?',
            [cantidad, stock_minimo || 5, activo !== false, tiendaId, productoId]
        );

        res.json({ message: 'Inventario actualizado' });
    } catch (error) {
        console.error('Error al actualizar inventario:', error);
        res.status(500).json({ error: 'Error al actualizar inventario' });
    }
});

// Eliminar producto de tienda
router.delete('/:tiendaId/productos/:productoId', async (req, res) => {
    try {
        const { tiendaId, productoId } = req.params;

        await db.query(
            'DELETE FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
            [tiendaId, productoId]
        );

        res.json({ message: 'Producto eliminado de tienda' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

// ========================================
// EMPLEADOS DE TIENDA
// ========================================

// Obtener empleados de una tienda
router.get('/:id/empleados', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT id, nombre_usuario, rol, turno_trabajo, created_at
            FROM usuarios 
            WHERE tienda_id = ?
            ORDER BY nombre_usuario ASC
        `, [id]);

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener empleados:', error);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
});

// ========================================
// ESTADÍSTICAS DE TIENDA
// ========================================

// Obtener resumen de ventas de tienda
router.get('/:id/resumen', async (req, res) => {
    try {
        const { id } = req.params;

        // Ventas del día
        const [ventasHoy] = await db.query(`
            SELECT 
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as monto_total
            FROM ventas 
            WHERE tienda_id = ? 
            AND DATE(fecha) = CURDATE()
            AND tipo = 'VENTA'
            AND estado = 'COMPLETADA'
        `, [id]);

        // Ventas del mes
        const [ventasMes] = await db.query(`
            SELECT 
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as monto_total
            FROM ventas 
            WHERE tienda_id = ? 
            AND MONTH(fecha) = MONTH(NOW())
            AND YEAR(fecha) = YEAR(NOW())
            AND tipo = 'VENTA'
            AND estado = 'COMPLETADA'
        `, [id]);

        res.json({
            hoy: ventasHoy[0],
            mes: ventasMes[0]
        });
    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

// Importación masiva de inventario a tienda (Sobrescribir y crear nuevos)
router.post('/:id/importar', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { items } = req.body; // Array de { producto_id o codigo_barras, cantidad, stock_minimo, nombre, precio_compra, precio_venta }

        if (!items || !Array.isArray(items)) {
            throw new Error('Se requiere un array de items');
        }

        let procesados = 0;
        let errores = [];

        for (const item of items) {
            try {
                let productoId = item.producto_id;

                // Si no hay productoId pero hay codigo_barras, buscarlo
                if (!productoId && item.codigo_barras) {
                    const [prod] = await connection.query('SELECT id FROM productos WHERE codigo_barras = ?', [item.codigo_barras]);
                    if (prod.length > 0) {
                        productoId = prod[0].id;
                    } else {
                        // Buscar en códigos agrupados
                        const [bg] = await connection.query('SELECT producto_id FROM producto_barcodes WHERE codigo_barras = ?', [item.codigo_barras]);
                        if (bg.length > 0) {
                            productoId = bg[0].producto_id;
                        }
                    }
                }

                const nombre = item.nombre || 'Producto de Excel ' + (item.codigo_barras || Date.now());
                const precioCompra = parseFloat(item.precio_compra || 0);
                const precioVenta = parseFloat(item.precio_venta || 0);
                const cantidad = parseInt(item.cantidad || 0);
                const stockMinimo = parseInt(item.stock_minimo || 5);

                // Si aún no hay productoId, se CREA uno nuevo de forma global primero
                if (!productoId) {
                    const [result] = await connection.query(
                        `INSERT INTO productos 
                        (nombre, codigo_barras, precio_compra, precio_venta, cantidad, stock_minimo, categoria, imagenes, caracteristicas, activo) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', 1)`,
                        [nombre, item.codigo_barras || null, precioCompra, precioVenta, 0, stockMinimo, 'General']
                    );
                    productoId = result.insertId;
                } else if (item.nombre && item.precio_venta) {
                    // Update global product basics just in case
                    await connection.query(
                        'UPDATE productos SET nombre = ?, precio_compra = ?, precio_venta = ? WHERE id = ?',
                        [item.nombre, precioCompra, precioVenta, productoId]
                    );
                }

                if (!productoId) {
                    errores.push(`Fallo catastrófico creando el producto: ${item.codigo_barras}`);
                    continue;
                }

                // Sobrescribir el inventario de la tienda específica
                const [existing] = await connection.query(
                    'SELECT id FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
                    [id, productoId]
                );

                if (existing.length > 0) {
                    await connection.query(
                        'UPDATE inventario_tienda SET cantidad = cantidad + ?, stock_minimo = ?, activo = 1 WHERE id = ?',
                        [cantidad, stockMinimo, existing[0].id]
                    );
                } else {
                    await connection.query(
                        'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad, stock_minimo, activo) VALUES (?, ?, ?, ?, 1)',
                        [id, productoId, cantidad, stockMinimo]
                    );
                }
                procesados++;
            } catch (err) {
                errores.push(`Error procesando item: ${err.message}`);
            }
        }

        await connection.commit();
        res.json({
            message: `Proceso completado. ${procesados} productos vinculados a la tienda.`,
            procesados,
            errores: errores.length > 0 ? errores : null
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error en importación:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

export default router;
