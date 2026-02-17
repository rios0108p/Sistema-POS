import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todas las categorías
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categorias ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// Crear nueva categoría
router.post('/', async (req, res) => {
    try {
        const { nombre } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await db.query('INSERT INTO categorias (nombre) VALUES (?)', [nombre.trim()]);
        res.status(201).json({ id: result.insertId, nombre: nombre.trim(), message: 'Categoría creada' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'La categoría ya existe' });
        }
        console.error('Error al crear categoría:', error);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});

// Actualizar categoría
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await db.query('UPDATE categorias SET nombre = ? WHERE id = ?', [nombre.trim(), id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ message: 'Categoría actualizada' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'La categoría ya existe' });
        }
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
});

// Eliminar categoría
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM categorias WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
});

export default router;
