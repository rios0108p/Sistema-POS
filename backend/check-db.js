import db from './config/db.js';

async function checkDatabase() {
    try {
        console.log('🔍 Verificando estructura de la base de datos...\n');

        // Check if inventario_tienda table exists
        console.log('📦 Verificando tabla inventario_tienda...');
        const [tables] = await db.query("SHOW TABLES LIKE 'inventario_tienda'");
        if (tables.length === 0) {
            console.log('❌ Tabla inventario_tienda NO EXISTE');
        } else {
            console.log('✅ Tabla inventario_tienda existe');

            // Show structure
            const [structure] = await db.query('DESCRIBE inventario_tienda');
            console.log('\n📋 Estructura de inventario_tienda:');
            structure.forEach(col => {
                console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
            });

            // Show count
            const [count] = await db.query('SELECT COUNT(*) as total FROM inventario_tienda');
            console.log(`\n📊 Registros en inventario_tienda: ${count[0].total}`);
        }

        // Check compras table structure
        console.log('\n💰 Verificando tabla compras...');
        const [comprasStructure] = await db.query('DESCRIBE compras');
        const hasTiendaId = comprasStructure.some(col => col.Field === 'tienda_id');
        const hasUsuarioId = comprasStructure.some(col => col.Field === 'usuario_id');

        console.log(`  tienda_id: ${hasTiendaId ? '✅' : '❌'}`);
        console.log(`  usuario_id: ${hasUsuarioId ? '✅' : '❌'}`);

        // Check recent pedidos
        console.log('\n📝 Últimos 3 pedidos:');
        const [pedidos] = await db.query('SELECT id, tienda_id, estado, created_at FROM pedidos ORDER BY created_at DESC LIMIT 3');
        pedidos.forEach(p => {
            console.log(`  #${p.id} - Tienda: ${p.tienda_id || 'N/A'} - Estado: ${p.estado} - ${p.created_at}`);
        });

        console.log('\n✅ Verificación completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkDatabase();
