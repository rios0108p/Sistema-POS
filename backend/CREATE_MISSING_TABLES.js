
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const CREATE_MISSING_TABLES = async () => {
    console.log('🚀 Checking and Creating missing tables...');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sistema_inventario',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    };

    let connection;

    try {
        connection = await mysql.createConnection(config);

        // PEDIDOS table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre_cliente VARCHAR(255) NOT NULL,
                email_cliente VARCHAR(255),
                telefono_cliente VARCHAR(50),
                direccion_envio TEXT,
                subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                envio DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                metodo_pago VARCHAR(50),
                notas TEXT,
                estado ENUM('PENDIENTE', 'EN_PROCESO', 'ENVIADO', 'ENTREGADO', 'CANCELADO') DEFAULT 'PENDIENTE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "pedidos" checked/created.');

        // DETALLE_PEDIDOS table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS detalle_pedidos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido_id INT NOT NULL,
                producto_id INT NOT NULL,
                producto_nombre VARCHAR(255),
                cantidad INT NOT NULL,
                precio_unitario DECIMAL(10, 2) NOT NULL,
                subtotal DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "detalle_pedidos" checked/created.');

        // PRODUCTO_BARCODES table (referenced in plan but maybe missing)
        await connection.query(`
             CREATE TABLE IF NOT EXISTS producto_barcodes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                producto_id INT NOT NULL,
                codigo_barras VARCHAR(100) NOT NULL,
                FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "producto_barcodes" checked/created.');


    } catch (err) {
        console.error('❌ ERROR:', err);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
};

CREATE_MISSING_TABLES();
