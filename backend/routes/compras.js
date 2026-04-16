import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todas las compras (Filtrado por tienda y fecha)
router.get('/', async (req, res) => {
    const { tienda_id, range, fecha_inicio, fecha_fin } = req.query;
    try {
        let query = `
            SELECT c.*, p.nombre as proveedor_nombre, var.nombre as variacion_nombre,
                   t.usuario_nombre as usuario_nombre
            FROM compras c 
            LEFT JOIN proveedores p ON c.proveedor_id = p.id 
            LEFT JOIN variaciones var ON c.variacion_id = var.id
            LEFT JOIN turnos t ON c.turno_id = t.id
        `;
        let params = [];
        let conditions = [];

        // Filtro por Tienda
        if (tienda_id) {
            conditions.push('c.tienda_id = ?');
            params.push(tienda_id);
        }

        // Filtro por Fecha
        if (range === 'today') {
            conditions.push("DATE(c.fecha) = CURDATE()");
        } else if (range === 'custom' && fecha_inicio && fecha_fin) {
            conditions.push("DATE(c.fecha) BETWEEN ? AND ?");
            params.push(fecha_inicio, fecha_fin);
        } else if (range === 'week') {
            conditions.push("c.fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
        } else if (range === 'month') {
            conditions.push("MONTH(c.fecha) = MONTH(NOW()) AND YEAR(c.fecha) = YEAR(NOW())");
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY c.fecha DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener compras:', error);
        res.status(500).json({ error: 'Error al obtener compras' });
    }
});

// Registrar nueva compra
router.post('/', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user.id;
        const tiendaId = req.user.rol === 'admin' ? (req.body.tienda_id || null) : req.user.tienda_id;
        const { productos, proveedor_id, turno_id } = req.body;

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            throw new Error('Debe incluir al menos un producto');
        }

        const comprasRegistradas = [];

        for (const item of productos) {
            const { producto_id, variacion_id, cantidad, precio_unitario } = item;

            if (!producto_id || !cantidad || !precio_unitario) {
                throw new Error('Datos incompletos en producto');
            }

            // Obtener nombre del producto
            const [producto] = await connection.query('SELECT nombre FROM productos WHERE id = ?', [producto_id]);

            if (producto.length === 0) {
                throw new Error(`Producto con ID ${producto_id} no encontrado`);
            }

            const total = cantidad * precio_unitario;

            const [result] = await connection.query(
                'INSERT INTO compras (producto_id, variacion_id, producto_nombre, proveedor_id, cantidad, precio_unitario, total, tienda_id, turno_id, usuario_id, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [producto_id, variacion_id || null, producto[0].nombre, proveedor_id || null, cantidad, precio_unitario, total, tiendaId, turno_id || null, userId]
            );

            if (tiendaId) {
                // --- AISLAMIENTO: SOLO TIENDA LOCAL ---
                // No tocamos catálogo global si la compra es para una tienda específica
                const [existing] = await connection.query(
                    'SELECT id FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
                    [tiendaId, producto_id]
                );

                if (existing.length > 0) {
                    await connection.query(
                        'UPDATE inventario_tienda SET cantidad = cantidad + ?, activo = 1 WHERE id = ?',
                        [cantidad, existing[0].id]
                    );
                } else {
                    // Si el producto no estaba habilitado en la tienda, lo habilitamos automáticamente
                    await connection.query(
                        'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad) VALUES (?, ?, ?)',
                        [tiendaId, producto_id, cantidad]
                    );
                }
            } else {
                // --- ADMIN / GLOBAL ---
                // Actualizar inventario GLOBAL solo si NO hay tienda definida (Almacén Central)
                await connection.query(
                    'UPDATE productos SET cantidad = cantidad + ? WHERE id = ?',
                    [cantidad, producto_id]
                );

                if (variacion_id) {
                    await connection.query(
                        'UPDATE variaciones SET stock = stock + ? WHERE id = ?',
                        [cantidad, variacion_id]
                    );
                }
            }

            comprasRegistradas.push({
                id: result.insertId,
                producto_nombre: producto[0].nombre,
                cantidad,
                total
            });
        }

        await connection.commit();
        res.status(201).json({
            message: 'Compras registradas exitosamente',
            compras: comprasRegistradas
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar compra:', error);

        // Auto-migración si falta usuario_id
        if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('usuario_id')) {
            try {
                await db.query('ALTER TABLE compras ADD COLUMN usuario_id INT NULL AFTER turno_id');
                console.log('Migración: columna usuario_id añadida a compras');
            } catch (err2) { console.error('Error migrando compras:', err2); }
        }

        res.status(500).json({ error: error.message || 'Error al registrar compra' });
    } finally {
        connection.release();
    }
});

export default router;
