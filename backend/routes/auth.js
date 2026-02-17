import express from 'express';
import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Get user with tienda info
        const [rows] = await db.query(`
            SELECT u.*, t.nombre as tienda_nombre, t.monto_base
            FROM usuarios u
            LEFT JOIN tiendas t ON u.tienda_id = t.id
            WHERE u.nombre_usuario = ?
        `, [username]);

        console.log('🔍 LOGIN ATTEMPT:', { username, passedPassword: !!password });
        console.log('🔍 LOGIN RESULT:', rows.length > 0 ? 'USER FOUND' : 'USER NOT FOUND');
        if (rows.length > 0) console.log('🔍 USER DATA:', rows[0].nombre_usuario, rows[0].password.substring(0, 10) + '...');

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // Check for active shift for this SPECIFIC user
        let turnoActivo = null;

        // Search for an open shift specifically for this user (isolated session)
        const [turnosAbiertos] = await db.query(`
            SELECT * FROM turnos 
            WHERE usuario_id = ? AND estado = 'ABIERTO'
            ORDER BY fecha_apertura DESC LIMIT 1
        `, [user.id]);

        if (turnosAbiertos.length > 0) {
            turnoActivo = turnosAbiertos[0];
        } else if (user.rol !== 'admin' && user.tienda_id) {
            // Auto-open shift only for non-admin store users if configured
            // (Optional: keep as is or make it explicit in POS)
            const montoBase = user.monto_base || 500;
            const [result] = await db.query(`
                INSERT INTO turnos (usuario_id, tienda_id, monto_inicial, estado, usuario_nombre)
                VALUES (?, ?, ?, 'ABIERTO', ?)
            `, [user.id, user.tienda_id, montoBase, user.nombre_usuario]);

            turnoActivo = {
                id: result.insertId,
                usuario_id: user.id,
                tienda_id: user.tienda_id,
                monto_inicial: montoBase,
                estado: 'ABIERTO',
                fecha_apertura: new Date()
            };
        }

        // Create Token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.nombre_usuario,
                rol: user.rol,
                tienda_id: user.tienda_id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.nombre_usuario,
                rol: user.rol,
                tienda_id: user.tienda_id,
                tienda_nombre: user.tienda_nombre,
                turno_trabajo: user.turno_trabajo
            },
            turnoActivo
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Verificar Token (opcional pero útil)
router.get('/verify', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No hay token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ valid: true, user: decoded });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

// Actualizar Perfil propio
router.put('/update-profile', async (req, res) => {
    const { id, username, password } = req.body;

    try {
        let query = 'UPDATE usuarios SET nombre_usuario = ? WHERE id = ?';
        let params = [username, id];

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query = 'UPDATE usuarios SET nombre_usuario = ?, password = ? WHERE id = ?';
            params = [username, hashedPassword, id];
        }

        await db.query(query, params);
        res.json({ message: 'Perfil actualizado' });
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

// Verificar PIN de seguridad (Cualquier usuario con PIN)
router.post('/verify-pin', async (req, res) => {
    const { pin } = req.body;

    try {
        // Obtenemos todos los usuarios que tengan PIN configurado
        const [users] = await db.query('SELECT id, nombre_usuario, pin_seguridad, rol FROM usuarios WHERE pin_seguridad IS NOT NULL');

        if (users.length === 0) {
            return res.status(404).json({ error: 'No hay usuarios con PIN configurado' });
        }

        // Buscamos si el PIN coincide con alguno de los usuarios
        let authorizedUser = null;
        for (const user of users) {
            const match = await bcrypt.compare(pin.toString(), user.pin_seguridad);
            if (match) {
                authorizedUser = { id: user.id, nombre: user.nombre_usuario, rol: user.rol };
                break;
            }
        }

        if (authorizedUser) {
            res.json({ valid: true, user: authorizedUser });
        } else {
            res.status(401).json({ valid: false, error: 'PIN incorrecto' });
        }
    } catch (error) {
        console.error('Error al verificar PIN:', error);
        res.status(500).json({ error: 'Error al verificar PIN' });
    }
});

// Guardar log de seguridad
router.post('/log-security-action', async (req, res) => {
    const { usuario_id, accion, descripcion, entidad_id } = req.body;

    try {
        await db.query(
            'INSERT INTO logs_seguridad (usuario_id, accion, descripcion, entidad_id) VALUES (?, ?, ?, ?)',
            [usuario_id, accion, descripcion, entidad_id || null]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar log de seguridad:', error);
        res.status(500).json({ error: 'Error al guardar log de seguridad' });
    }
});

export default router;
