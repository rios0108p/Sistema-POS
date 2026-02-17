import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Auto-migración (Crear tablas si no existen)
const migrate = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS promociones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                precio_combo DECIMAL(10, 2) NOT NULL,
                tienda_id INT,
                activo BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS promocion_productos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                promocion_id INT NOT NULL,
                producto_id INT NOT NULL,
                cantidad INT DEFAULT 1,
                FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE
            )
        `);
    } catch (err) {
        console.error('Error migrando promociones:', err);
    }
};
migrate();

// Obtener promociones activas (filtradas por tienda)
router.get('/', async (req, res) => {
    try {
        const { tienda_id } = req.query;
        let query = "SELECT * FROM promociones WHERE activo = 1";
        let params = [];

        if (tienda_id) {
            query += " AND (tienda_id = ? OR tienda_id IS NULL)";
            params.push(tienda_id);
        }

        const [promos] = await db.query(query, params);

        // Obtener productos de cada promoción
        for (let promo of promos) {
            const [productos] = await db.query(`
                SELECT pp.*, p.nombre, p.precio_venta 
                FROM promocion_productos pp
                JOIN productos p ON pp.producto_id = p.id
                WHERE pp.promocion_id = ?
            `, [promo.id]);
            promo.productos = productos;
        }

        res.json(promos);
    } catch (error) {
        console.error('Error obteniendo promociones:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
});

// Crear promoción
router.post('/', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { nombre, descripcion, precio_combo, tienda_id, productos } = req.body;

        const [result] = await connection.query(`
            INSERT INTO promociones (nombre, descripcion, precio_combo, tienda_id)
            VALUES (?, ?, ?, ?)
        `, [nombre, descripcion, precio_combo, tienda_id || null]);

        const promocion_id = result.insertId;

        for (const prod of productos) {
            await connection.query(`
                INSERT INTO promocion_productos (promocion_id, producto_id, cantidad)
                VALUES (?, ?, ?)
            `, [promocion_id, prod.producto_id, prod.cantidad]);
        }

        await connection.commit();
        res.status(201).json({ id: promocion_id, message: 'Promoción creada' });
    } catch (error) {
        await connection.rollback();
        console.error('Error creando promoción:', error);
        res.status(500).json({ error: 'Error al crear la promoción' });
    } finally {
        connection.release();
    }
});

// Eliminar promoción
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM promociones WHERE id = ?", [id]);
        res.json({ message: 'Promoción eliminada' });
    } catch (error) {
        console.error('Error eliminando promoción:', error);
        res.status(500).json({ error: 'Error al eliminar la promoción' });
    }
});

export default router;
