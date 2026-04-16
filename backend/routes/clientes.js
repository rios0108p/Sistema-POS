import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Obtener todos los clientes (Incluyendo código de barras)
router.get('/', async (req, res) => {
    try {
        // Ejecutar migración silenciosa si es necesario
        try {
            await db.query('SELECT codigo_barras FROM clientes LIMIT 1');
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query('ALTER TABLE clientes ADD COLUMN codigo_barras VARCHAR(50) UNIQUE AFTER nit_dpi');
                console.log('✅ Columna "codigo_barras" añadida a clientes.');
            }
        }

        // Migración para campos de crédito
        try {
            await db.query('SELECT credito_habilitado FROM clientes LIMIT 1');
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                await db.query('ALTER TABLE clientes ADD COLUMN credito_habilitado TINYINT(1) DEFAULT 0 AFTER codigo_barras');
                await db.query('ALTER TABLE clientes ADD COLUMN limite_credito DECIMAL(10, 2) DEFAULT 0 AFTER credito_habilitado');
                await db.query('ALTER TABLE clientes ADD COLUMN saldo_deudor DECIMAL(10, 2) DEFAULT 0 AFTER limite_credito');
                console.log('✅ Columnas de crédito añadidas a clientes.');
            }
        }

        // Migración para tabla de abonos
        try {
            await db.query('SELECT id FROM clientes_abonos LIMIT 1');
        } catch (e) {
            if (e.code === 'ER_NO_SUCH_TABLE') {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS clientes_abonos (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        cliente_id INT NOT NULL,
                        monto DECIMAL(10, 2) NOT NULL,
                        metodo_pago VARCHAR(50) NOT NULL,
                        nota TEXT,
                        usuario_id INT,
                        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB
                `);
                console.log('✅ Tabla "clientes_abonos" creada.');
            }
        }

        const [rows] = await db.query('SELECT * FROM clientes ORDER BY nombre ASC');

        // Auto-generar códigos faltantes para clientes antiguos
        let updated = false;
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i].codigo_barras) {
                const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
                const newCode = `CLI-${Date.now().toString().slice(-4)}-${randomStr}`;
                await db.query('UPDATE clientes SET codigo_barras = ? WHERE id = ?', [newCode, rows[i].id]);
                rows[i].codigo_barras = newCode;
                updated = true;
            }
        }

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// Obtener cliente por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// Obtener historial de cliente (Ventas, Pedidos y Abonos)
router.get('/:id/historial', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Movimientos (Ventas donde participó el cliente) con detalle de métodos de pago
        const [ventas] = await db.query(`
            SELECT v.*, ti.nombre as tienda_nombre,
                   GROUP_CONCAT(CONCAT(vp.metodo, CASE WHEN vp.referencia IS NOT NULL THEN CONCAT(' (', vp.referencia, ')') ELSE '' END) SEPARATOR ' + ') as metodo_detalle
            FROM ventas v
            LEFT JOIN tiendas ti ON v.tienda_id = ti.id
            LEFT JOIN ventas_pagos vp ON v.id = vp.venta_id
            WHERE v.cliente_id = ?
            GROUP BY v.id
            ORDER BY v.fecha DESC
        `, [id]);

        // 2. Abonos registrados
        const [abonos] = await db.query(`
            SELECT * FROM clientes_abonos 
            WHERE cliente_id = ? 
            ORDER BY fecha DESC
        `, [id]);

        // 3. Pedidos (con manejo de error por si la tabla no existe)
        let pedidos = [];
        try {
            const [pedidosRows] = await db.query(`
                SELECT * FROM pedidos 
                WHERE cliente_id = ? 
                ORDER BY created_at DESC
            `, [id]);
            pedidos = pedidosRows;
        } catch (e) {
            console.warn('Tabla pedidos no encontrada en historial');
        }

        res.json({ ventas, abonos, pedidos });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: `Error al obtener historial: ${error.message}` });
    }
});

// Obtener abonos de un cliente
router.get('/:id/abonos', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM clientes_abonos WHERE cliente_id = ? ORDER BY fecha DESC', [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener abonos:', error);
        res.status(500).json({ error: 'Error al obtener abonos' });
    }
});

// Registrar abono a un cliente
router.post('/:id/abonos', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const { monto, metodo_pago, nota, usuario_id } = req.body;

        if (!monto || monto <= 0) {
            return res.status(400).json({ error: 'El monto del abono debe ser mayor a 0' });
        }

        await conn.beginTransaction();

        // 1. Registrar el abono
        await conn.query(
            'INSERT INTO clientes_abonos (cliente_id, monto, metodo_pago, nota, usuario_id) VALUES (?, ?, ?, ?, ?)',
            [id, monto, metodo_pago, nota || null, usuario_id || null]
        );

        // 2. Actualizar el saldo deudor del cliente
        await conn.query(
            'UPDATE clientes SET saldo_deudor = saldo_deudor - ? WHERE id = ?',
            [monto, id]
        );

        await conn.commit();
        res.json({ message: 'Abono registrado exitosamente' });
    } catch (error) {
        await conn.rollback();
        console.error('Error al registrar abono:', error);
        res.status(500).json({ error: 'Error al registrar abono' });
    } finally {
        conn.release();
    }
});

// ==================== PRECIOS ESPECIALES ====================

// Obtener precios especiales de un cliente
router.get('/:id/precios-especiales', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT pec.*, p.nombre as producto_nombre, p.precio_venta as precio_regular
            FROM precios_especiales_clientes pec
            JOIN productos p ON pec.producto_id = p.id
            WHERE pec.cliente_id = ?
        `, [id]);
        res.json(rows);
    } catch (error) {
        // Si la tabla no existe aún o falta la columna min_cantidad
        if (error.code === 'ER_NO_SUCH_TABLE') {
            await db.query(`
                CREATE TABLE IF NOT EXISTS precios_especiales_clientes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cliente_id INT NOT NULL,
                    producto_id INT NOT NULL,
                    precio_especial DECIMAL(10, 2) NOT NULL,
                    min_cantidad INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_cliente_producto (cliente_id, producto_id),
                    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
                    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
                ) ENGINE=InnoDB
            `);
            return res.json([]);
        } else if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('min_cantidad')) {
            // Migración rápida si falta la columna
            await db.query('ALTER TABLE precios_especiales_clientes ADD COLUMN min_cantidad INT DEFAULT 1');
            const [rows] = await db.query(`
                SELECT pec.*, p.nombre as producto_nombre, p.precio_venta as precio_regular
                FROM precios_especiales_clientes pec
                JOIN productos p ON pec.producto_id = p.id
                WHERE pec.cliente_id = ?
            `, [id]);
            return res.json(rows);
        }
        res.status(500).json({ error: 'Error al obtener precios especiales' });
    }
});

// Asignar precio especial
router.post('/:id/precios-especiales', async (req, res) => {
    try {
        const { id } = req.params; // cliente_id
        const { producto_id, precio_especial, min_cantidad = 1 } = req.body;

        await db.query(`
            INSERT INTO precios_especiales_clientes (cliente_id, producto_id, precio_especial, min_cantidad)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE precio_especial = ?, min_cantidad = ?
        `, [id, producto_id, precio_especial, min_cantidad, precio_especial, min_cantidad]);

        res.json({ message: 'Precio especial asignado correctamente' });
    } catch (error) {
        console.error('Error al asignar precio especial:', error);

        // Si falta la columna, intentar migración y re-intentar
        if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('min_cantidad')) {
            try {
                await db.query('ALTER TABLE precios_especiales_clientes ADD COLUMN min_cantidad INT DEFAULT 1');
                const { id } = req.params;
                const { producto_id, precio_especial, min_cantidad = 1 } = req.body;
                await db.query(`
                    INSERT INTO precios_especiales_clientes (cliente_id, producto_id, precio_especial, min_cantidad)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE precio_especial = ?, min_cantidad = ?
                `, [id, producto_id, precio_especial, min_cantidad, precio_especial, min_cantidad]);
                return res.json({ message: 'Precio especial asignado tras migración' });
            } catch (err2) {
                console.error('Error en migración de emergencia:', err2);
            }
        }

        res.status(500).json({ error: 'Error al asignar precio especial', details: error.message });
    }
});

// Eliminar precio especial
router.delete('/:id/precios-especiales/:productoId', async (req, res) => {
    try {
        const { id, productoId } = req.params;
        await db.query('DELETE FROM precios_especiales_clientes WHERE cliente_id = ? AND producto_id = ?', [id, productoId]);
        res.json({ message: 'Precio especial eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar precio especial' });
    }
});

// Crear nuevo cliente
router.post('/', async (req, res) => {
    try {
        let { nombre, email, telefono, direccion, nit_dpi, codigo_barras, credito_habilitado, limite_credito } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        // Generar código de barras si no se proporciona
        if (!codigo_barras) {
            const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            codigo_barras = `CLI-${Date.now().toString().slice(-4)}-${randomStr}`;
        }

        const [result] = await db.query(
            'INSERT INTO clientes (nombre, email, telefono, direccion, nit_dpi, codigo_barras, credito_habilitado, limite_credito, saldo_deudor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
            [nombre, email || null, telefono || null, direccion || null, nit_dpi || null, codigo_barras, credito_habilitado ? 1 : 0, limite_credito || 0]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Cliente creado exitosamente',
            cliente: { id: result.insertId, nombre, email, telefono, direccion, nit_dpi, codigo_barras }
        });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

// Actualizar cliente
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, telefono, direccion, nit_dpi, codigo_barras, credito_habilitado, limite_credito } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        await db.query(
            'UPDATE clientes SET nombre = ?, email = ?, telefono = ?, direccion = ?, nit_dpi = ?, codigo_barras = ?, credito_habilitado = ?, limite_credito = ? WHERE id = ?',
            [nombre, email || null, telefono || null, direccion || null, nit_dpi || null, codigo_barras || null, credito_habilitado ? 1 : 0, limite_credito || 0, id]
        );

        res.json({
            message: 'Cliente actualizado exitosamente',
            cliente: { id, nombre, email, telefono, direccion, nit_dpi, codigo_barras }
        });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// Eliminar cliente
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si tiene historial? (Opcional, por fk con set null no debería romper integridad, pero es bueno avisar)
        // Por ahora eliminamos directo, FK en ventas/pedidos es SET NULL

        const [result] = await db.query('DELETE FROM clientes WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ message: 'Cliente eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

export default router;
