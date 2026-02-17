import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todos los proveedores
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM proveedores ORDER BY nombre ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

// Obtener un proveedor por ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM proveedores WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener el proveedor:', error);
        res.status(500).json({ error: 'Error al obtener el proveedor' });
    }
});

// Crear un nuevo proveedor
router.post('/', async (req, res) => {
    const { nombre, contacto, telefono, email, direccion } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO proveedores (nombre, contacto, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)',
            [nombre, contacto, telefono, email, direccion]
        );
        res.status(201).json({ id: result.insertId, message: 'Proveedor creado exitosamente' });
    } catch (error) {
        console.error('Error al crear proveedor:', error);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
});

// Actualizar un proveedor
router.put('/:id', async (req, res) => {
    const { nombre, contacto, telefono, email, direccion } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    try {
        const [result] = await db.query(
            'UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?',
            [nombre, contacto, telefono, email, direccion, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ message: 'Proveedor actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
});

// Eliminar un proveedor
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ message: 'Proveedor eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'No se puede eliminar el proveedor porque tiene compras asociadas' });
        }
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});

export default router;
