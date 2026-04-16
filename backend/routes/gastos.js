import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Auto-migración
const migrate = async () => {
    try {
        await db.query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo ENUM('ENTRADA', 'SALIDA') DEFAULT 'SALIDA' AFTER monto`);
        await db.query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS turno_id INT DEFAULT NULL AFTER usuario_id`);
        console.log('✅ Tabla gastos actualizada');
    } catch (err) {
        console.error('Error migrando gastos:', err.message);
    }
};
migrate();

// Registrar un gasto / movimiento
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const tiendaId = req.user.rol === 'admin' ? (req.body.tienda_id || null) : req.user.tienda_id;
        const { categoria, monto, descripcion, fecha, tipo, turno_id } = req.body;

        if (!monto || !categoria || !fecha) {
            return res.status(400).json({ error: 'Monto, categoría y fecha son obligatorios' });
        }

        const [result] = await db.query(
            'INSERT INTO gastos (tienda_id, categoria, monto, descripcion, fecha, usuario_id, tipo, turno_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [tiendaId, categoria, monto, descripcion || null, fecha, userId, tipo || 'SALIDA', turno_id || null]
        );

        res.status(201).json({ message: 'Registro exitoso', id: result.insertId });
    } catch (error) {
        console.error('Error al registrar gasto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener gastos
router.get('/', async (req, res) => {
    try {
        const { tienda_id, startDate, endDate } = req.query;
        // Limpiar tienda_id de posibles caracteres extraños como ":"
        const cleanTiendaId = tienda_id ? tienda_id.toString().replace(':', '') : null;

        let query = 'SELECT g.*, u.nombre_usuario as usuario_nombre FROM gastos g LEFT JOIN usuarios u ON g.usuario_id = u.id WHERE 1=1';
        const params = [];

        if (cleanTiendaId) {
            query += ' AND g.tienda_id = ?';
            params.push(cleanTiendaId);
        }

        if (startDate && endDate) {
            query += ' AND g.fecha BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        query += ' ORDER BY g.fecha DESC';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener gastos:', error);
        res.status(500).json({ error: 'Error al obtener gastos' });
    }
});

// Actualizar un gasto
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { tienda_id, categoria, monto, descripcion, fecha } = req.body;

        await db.query(`
            UPDATE gastos 
            SET tienda_id = ?, categoria = ?, monto = ?, descripcion = ?, fecha = ?
            WHERE id = ?
        `, [tienda_id || null, categoria, monto, descripcion || null, fecha, id]);

        res.json({ message: 'Gasto actualizado con éxito' });
    } catch (error) {
        console.error('Error al actualizar gasto:', error);
        res.status(500).json({ error: 'Error al actualizar el gasto' });
    }
});

// Eliminar un gasto
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM gastos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Gasto eliminado' });
    } catch (error) {
        console.error('Error al eliminar gasto:', error);
        res.status(500).json({ error: 'Error al eliminar gasto' });
    }
});

export default router;
