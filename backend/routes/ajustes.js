import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Registrar un ajuste de inventario
router.post('/', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            producto_id,
            variacion_id,
            tienda_id,
            cantidad_nueva,
            motivo,
            notas,
            usuario_id
        } = req.body;

        if (!producto_id) {
            throw new Error('El producto_id es obligatorio');
        }

        // 1. Obtener cantidad actual
        let cantidad_anterior = 0;
        if (tienda_id) {
            const [rows] = await connection.query(
                'SELECT cantidad FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
                [tienda_id, producto_id]
            );
            if (rows.length > 0) {
                cantidad_anterior = rows[0].cantidad;
            } else {
                // Si no existe el registro en la tienda, lo creamos más adelante
                cantidad_anterior = 0;
            }
        } else {
            if (variacion_id) {
                const [rows] = await connection.query('SELECT stock FROM variaciones WHERE id = ?', [variacion_id]);
                if (rows.length === 0) throw new Error('Variación no encontrada');
                cantidad_anterior = rows[0].stock;
            } else {
                const [rows] = await connection.query('SELECT cantidad FROM productos WHERE id = ?', [producto_id]);
                if (rows.length === 0) throw new Error('Producto no encontrado');
                cantidad_anterior = rows[0].cantidad;
            }
        }

        const diferencia = cantidad_nueva - cantidad_anterior;

        // 2. Registrar el ajuste en el historial
        await connection.query(`
            INSERT INTO ajustes_inventario 
            (producto_id, variacion_id, tienda_id, cantidad_anterior, cantidad_nueva, diferencia, motivo, notas, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [producto_id, variacion_id || null, tienda_id || null, cantidad_anterior, cantidad_nueva, diferencia, motivo, notas, usuario_id || null]);

        // 3. Actualizar el stock real
        if (tienda_id) {
            const [exists] = await connection.query(
                'SELECT id FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
                [tienda_id, producto_id]
            );

            if (exists.length > 0) {
                await connection.query(
                    'UPDATE inventario_tienda SET cantidad = ?, activo = 1 WHERE id = ?',
                    [cantidad_nueva, exists[0].id]
                );
            } else {
                await connection.query(
                    'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad) VALUES (?, ?, ?)',
                    [tienda_id, producto_id, cantidad_nueva]
                );
            }
        } else {
            if (variacion_id) {
                await connection.query('UPDATE variaciones SET stock = ? WHERE id = ?', [cantidad_nueva, variacion_id]);
            } else {
                await connection.query('UPDATE productos SET cantidad = ? WHERE id = ?', [cantidad_nueva, producto_id]);
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Ajuste de inventario registrado con éxito', diferencia });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar ajuste:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Obtener historial de ajustes
router.get('/', async (req, res) => {
    try {
        const { tienda_id } = req.query;
        // Limpiar tienda_id de posibles caracteres extraños como ":"
        const cleanTiendaId = tienda_id ? tienda_id.toString().replace(':', '') : null;

        let query = `
            SELECT a.*, p.nombre as producto_nombre, v.nombre as variacion_nombre, u.nombre_usuario as usuario_nombre
            FROM ajustes_inventario a
            LEFT JOIN productos p ON a.producto_id = p.id
            LEFT JOIN variaciones v ON a.variacion_id = v.id
            LEFT JOIN usuarios u ON a.usuario_id = u.id
        `;
        const params = [];
        if (cleanTiendaId) {
            query += ' WHERE a.tienda_id = ?';
            params.push(cleanTiendaId);
        }
        query += ' ORDER BY a.fecha DESC LIMIT 100';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener ajustes:', error);
        res.status(500).json({ error: 'Error al obtener historial de ajustes' });
    }
});

export default router;
