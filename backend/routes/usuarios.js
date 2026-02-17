import express from 'express';
import db from '../config/db.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Obtener todos los usuarios (Solo Admin)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.id, u.nombre_usuario, u.rol, u.tienda_id, u.turno_trabajo, u.created_at, u.pin_seguridad,
                   t.nombre as tienda_nombre
            FROM usuarios u
            LEFT JOIN tiendas t ON u.tienda_id = t.id
            ORDER BY u.nombre_usuario ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Crear nuevo usuario
router.post('/', async (req, res) => {
    try {
        const { nombre_usuario, password, rol, tienda_id, turno_trabajo, pin_seguridad } = req.body;

        if (!nombre_usuario || !password) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        // Hashear password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Hashear PIN if provided
        let hashedPin = null;
        if (pin_seguridad && pin_seguridad.trim() !== '') {
            hashedPin = await bcrypt.hash(pin_seguridad.toString(), salt);
        }

        const [result] = await db.query(
            'INSERT INTO usuarios (nombre_usuario, password, rol, tienda_id, turno_trabajo, pin_seguridad, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre_usuario, hashedPassword, rol || 'vendedor', tienda_id || null, turno_trabajo || 'COMPLETO', hashedPin, req.body.email || null]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Usuario creado exitosamente'
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Actualizar usuario
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_usuario, password, rol, tienda_id, turno_trabajo, pin_seguridad } = req.body;

        const updates = [];
        const params = [];

        updates.push('nombre_usuario = ?');
        params.push(nombre_usuario);

        updates.push('rol = ?');
        params.push(rol);

        updates.push('tienda_id = ?');
        params.push(tienda_id || null);

        updates.push('turno_trabajo = ?');
        params.push(turno_trabajo || 'COMPLETO');

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (pin_seguridad && pin_seguridad.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPin = await bcrypt.hash(pin_seguridad.toString(), salt);
            updates.push('pin_seguridad = ?');
            params.push(hashedPin);
        }

        params.push(id);
        const query = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`;

        await db.query(query, params);

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Eliminar usuario
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Evitar que el admin se borre a sí mismo si fuera necesario, 
        // pero lo dejaremos simple por ahora o lo validamos en el front

        await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

export default router;
