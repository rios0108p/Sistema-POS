import express from 'express';
import db from '../config/db.js';

const router = express.Router();

/**
 * Helper para actualizar stock
 * @param {Object} conn Conexión con transacción
 * @param {Number} tiendaId ID de tienda (NULL = Almacén Central)
 * @param {Number} productoId ID del producto
 * @param {Number} variacionId ID de variación (opcional)
 * @param {Number} cantidad Cantidad a sumar (negativa para restar)
 */
async function updateStock(conn, tiendaId, productoId, variacionId, cantidad) {
    // Normalizar: 0 o "0" es Almacén Central (NULL)
    const idTienda = (tiendaId === 0 || tiendaId === "0" || !tiendaId) ? null : tiendaId;

    if (idTienda) {
        // En Tienda
        const [exists] = await conn.query(
            'SELECT id, cantidad FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?',
            [idTienda, productoId]
        );

        if (exists.length > 0) {
            await conn.query(
                'UPDATE inventario_tienda SET cantidad = cantidad + ? WHERE id = ?',
                [cantidad, exists[0].id]
            );
        } else {
            if (cantidad < 0) throw new Error('No hay stock suficiente en la tienda origen');
            await conn.query(
                'INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad) VALUES (?, ?, ?)',
                [tiendaId, productoId, cantidad]
            );
        }
    } else {
        // Almacén Central (Tablas Originales)
        if (variacionId) {
            const [v] = await conn.query('SELECT stock FROM variaciones WHERE id = ?', [variacionId]);
            if (v.length === 0) throw new Error('Variación no encontrada');
            if (v[0].stock + cantidad < 0) throw new Error('Stock insuficiente en Variación Central');
            await conn.query('UPDATE variaciones SET stock = stock + ? WHERE id = ?', [cantidad, variacionId]);
        } else {
            const [p] = await conn.query('SELECT cantidad FROM productos WHERE id = ?', [productoId]);
            if (p.length === 0) throw new Error('Producto no encontrado');
            if (p[0].cantidad + cantidad < 0) throw new Error('Stock insuficiente en Almacén Central');
            await conn.query('UPDATE productos SET cantidad = cantidad + ? WHERE id = ?', [cantidad, productoId]);
        }
    }
}

// 1. Iniciar traslado (RESTA de origen)
router.post('/', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { tienda_origen_id, tienda_destino_id, usuario_id, notas, productos } = req.body;

        const origen = (tienda_origen_id === 0 || tienda_origen_id === "0" || !tienda_origen_id) ? null : tienda_origen_id;
        const destino = (tienda_destino_id === 0 || tienda_destino_id === "0" || !tienda_destino_id) ? null : tienda_destino_id;

        if (!productos || productos.length === 0) throw new Error('Debe incluir productos');
        if (origen == destino) throw new Error('La tienda origen y destino no pueden ser iguales');

        // Insertar cabecera
        const [result] = await connection.query(
            'INSERT INTO traslados (tienda_origen_id, tienda_destino_id, usuario_id, notas, estado) VALUES (?, ?, ?, ?, ?)',
            [origen, destino, usuario_id, notas, 'PENDIENTE']
        );
        const trasladoId = result.insertId;

        for (const p of productos) {
            // Validar y registrar detalle
            await connection.query(
                'INSERT INTO traslado_detalles (traslado_id, producto_id, variacion_id, cantidad) VALUES (?, ?, ?, ?)',
                [trasladoId, p.producto_id, p.variacion_id || null, p.cantidad]
            );

            // DESCONTAR de origen
            await updateStock(connection, tienda_origen_id, p.producto_id, p.variacion_id, -p.cantidad);
        }

        await connection.commit();
        res.status(201).json({ message: 'Traslado iniciado correctamente', id: trasladoId });

    } catch (error) {
        await connection.rollback();
        console.error('Error Traslado:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 2. Completar traslado (SUMA a destino)
router.put('/:id/completar', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [t] = await connection.query('SELECT * FROM traslados WHERE id = ?', [req.params.id]);
        if (t.length === 0) throw new Error('Traslado no encontrado');
        if (t[0].estado !== 'PENDIENTE') throw new Error('Solo se pueden completar traslados pendientes');

        const [detalles] = await connection.query('SELECT * FROM traslado_detalles WHERE traslado_id = ?', [req.params.id]);

        for (const d of detalles) {
            // SUMAR a destino
            await updateStock(connection, t[0].tienda_destino_id, d.producto_id, d.variacion_id, d.cantidad);
        }

        await connection.query(
            'UPDATE traslados SET estado = ?, fecha_recepcion = CURRENT_TIMESTAMP WHERE id = ?',
            ['COMPLETADO', req.params.id]
        );

        await connection.commit();
        res.json({ message: 'Mercancía recibida y stock actualizado' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 3. Cancelar traslado (DEVUELVE a origen)
router.put('/:id/cancelar', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [t] = await connection.query('SELECT * FROM traslados WHERE id = ?', [req.params.id]);
        if (t.length === 0) throw new Error('Traslado no encontrado');
        if (t[0].estado !== 'PENDIENTE') throw new Error('Solo se pueden cancelar traslados pendientes');

        const [detalles] = await connection.query('SELECT * FROM traslado_detalles WHERE traslado_id = ?', [req.params.id]);

        for (const d of detalles) {
            // REGRESAR a origen
            await updateStock(connection, t[0].tienda_origen_id, d.producto_id, d.variacion_id, d.cantidad);
        }

        await connection.query('UPDATE traslados SET estado = ? WHERE id = ?', ['CANCELADO', req.params.id]);

        await connection.commit();
        res.json({ message: 'Traslado cancelado y stock devuelto al origen' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 4. Listar traslados
router.get('/', async (req, res) => {
    try {
        const { tienda_id, tipo } = req.query; // tipo: 'envios', 'recepciones'
        // Limpiar tienda_id de posibles caracteres extraños como ":"
        const cleanTiendaId = tienda_id ? tienda_id.toString().replace(':', '') : null;

        let query = `
            SELECT t.*, 
                   to_tienda.nombre as origen_nombre, 
                   td_tienda.nombre as destino_nombre,
                   u.nombre_usuario as usuario_nombre,
                   (SELECT COUNT(*) FROM traslado_detalles WHERE traslado_id = t.id) as total_items
            FROM traslados t
            LEFT JOIN tiendas to_tienda ON t.tienda_origen_id = to_tienda.id
            LEFT JOIN tiendas td_tienda ON t.tienda_destino_id = td_tienda.id
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (cleanTiendaId) {
            if (tipo === 'envios') {
                query += ' AND t.tienda_origen_id = ?';
                params.push(cleanTiendaId);
            } else if (tipo === 'recepciones') {
                query += ' AND t.tienda_destino_id = ?';
                params.push(cleanTiendaId);
            } else {
                query += ' AND (t.tienda_origen_id = ? OR t.tienda_destino_id = ?)';
                params.push(cleanTiendaId, cleanTiendaId);
            }
        }

        query += ' ORDER BY t.fecha_envio DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Detalles de un traslado
router.get('/:id', async (req, res) => {
    try {
        const [detalles] = await db.query(`
            SELECT d.*, p.nombre, p.sku, v.nombre as variacion_nombre
            FROM traslado_detalles d
            JOIN productos p ON d.producto_id = p.id
            LEFT JOIN variaciones v ON d.variacion_id = v.id
            WHERE d.traslado_id = ?
        `, [req.params.id]);
        res.json(detalles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
