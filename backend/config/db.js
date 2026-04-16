// VERSIÓN DE EMERGENCIA: 2026-03-05_14:15 - REMOVIENDO SSL TOTALMENTE
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log(`� Conectando a Base de Datos: ${process.env.DB_HOST || 'localhost'}`);
if (!process.env.DB_HOST) {
    console.log('🐬 Usando configuración local por defecto');
}


const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sistema_inventario',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    timezone: '-05:00', // Actualizado para Cancún (UTC-5)
});

// Forzar la zona horaria en cada nueva conexión del pool real
pool.on('connection', function (connection) {
    connection.query("SET time_zone = '-05:00';");
});

// Adapter simplificado para MySQL (Cumpliendo con la interfaz que el backend espera)
const adapter = {
    query: async (sql, params = []) => {
        try {
            const [rows] = await pool.query(sql, params);
            return [rows]; // Retornar en el formato [rows, fields] que el resto del código espera
        } catch (error) {
            console.error(' MYSQL ERROR:', error.message);
            throw error;
        }
    },
    execute: async (sql, params = []) => {
        return adapter.query(sql, params);
    },
    getConnection: async () => {
        const connection = await pool.getConnection();
        return {
            query: async (sql, params) => connection.query(sql, params),
            execute: async (sql, params) => connection.execute(sql, params),
            beginTransaction: async () => connection.beginTransaction(),
            commit: async () => connection.commit(),
            rollback: async () => connection.rollback(),
            release: () => connection.release()
        };
    }
};

export default adapter;

