import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkSchema() {
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sistema_inventario'
    });

    try {
        const [rows] = await connection.query('DESCRIBE detalle_ventas');
        console.log('Estructura de detalle_ventas:');
        console.table(rows);
        const hasCosto = rows.find(r => r.Field === 'costo_unitario');
        if (hasCosto) {
            console.log('✅ ÉXITO: La columna costo_unitario existe.');
        } else {
            console.log('❌ ERROR: La columna costo_unitario NO existe.');
        }
    } catch (e) {
        console.error('Error verificando esquema:', e.message);
    } finally {
        await connection.end();
    }
}

checkSchema();
