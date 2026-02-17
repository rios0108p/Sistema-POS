import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Registrar un gasto
router.post('/', async (req, res) => {
    try {
        const { tienda_id, categoria, monto, descripcion, fecha, usuario_id } = req.body;

        if (!monto || !categoria || !fecha) {
            return res.status(400).json({ error: 'Monto, categoría y fecha son obligatorios' });
        }

        const [result] = await db.query(
            'INSERT INTO gastos (tienda_id, categoria, monto, descripcion, fecha, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
            [tienda_id || null, categoria, monto, descripcion || null, fecha, usuario_id || null]
        );

        res.status(201).json({ message: 'Gasto registrado con éxito', id: result.insertId });
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
