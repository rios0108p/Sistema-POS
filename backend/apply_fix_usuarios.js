import db from './config/db.js';

async function applyFix() {
    console.log('--- APLICANDO CORRECCIÓN DE ESQUEMA: USUARIOS ---');
    try {
        // Paso 1: Eliminar el índice único para poder modificar la columna
        console.log('Eliminando índice email...');
        try {
            await db.query('ALTER TABLE usuarios DROP INDEX email');
        } catch (e) {
            console.log('El índice no existía o ya fue eliminado.');
        }

        // Paso 2: Cambiar la columna email para que sea opcional
        console.log('Modificando columna email en la tabla usuarios...');
        await db.query('ALTER TABLE usuarios MODIFY COLUMN email VARCHAR(255) DEFAULT NULL');

        // Paso 3: Volver a crear el índice único
        console.log('Recreando índice único para email...');
        await db.query('ALTER TABLE usuarios ADD UNIQUE (email)');

        console.log('✅ Cambio aplicado exitosamente.');

        // Verificar
        const [columns] = await db.query('SHOW COLUMNS FROM usuarios LIKE "email"');
        console.log('Estado actual de la columna email:', columns[0]);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al aplicar la corrección:', error.message);
        process.exit(1);
    }
}

applyFix();
