import db from './config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    try {
        console.log('🔄 Ejecutando migraciones...\n');

        // Migration 1: Create inventario_tienda table
        console.log('📦 Creando tabla inventario_tienda...');
        const migration1 = fs.readFileSync(
            path.join(__dirname, 'migrations', 'add_inventario_tienda.sql'),
            'utf8'
        );
        await db.query(migration1);
        console.log('✅ Tabla inventario_tienda creada\n');

        // Migration 2: Update compras table
        console.log('💰 Actualizando tabla compras...');
        const migration2 = fs.readFileSync(
            path.join(__dirname, 'migrations', 'update_compras_table.sql'),
            'utf8'
        );

        // Split by semicolons and execute each statement
        const statements = migration2.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                await db.query(statement);
            }
        }
        console.log('✅ Tabla compras actualizada\n');

        console.log('🎉 Migraciones completadas exitosamente!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migraciones:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigrations();
