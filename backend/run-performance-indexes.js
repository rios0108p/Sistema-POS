import db from './config/db.js';

async function runPerformanceIndexes() {
    try {
        console.log('🚀 Iniciando optimización de índices (Debug Mode)...\n');

        // Test connection
        try {
            const [test] = await db.query('SELECT 1+1 as result');
            console.log('📶 Conexión activa. Resultado:', test[0].result);
        } catch (e) {
            console.error('❌ Error de conexión inicial:', e);
            process.exit(1);
        }

        const indexes = [
            { table: 'productos', name: 'idx_prod_barcode', column: 'codigo_barras' },
            { table: 'productos', name: 'idx_prod_nombre', column: 'nombre' },
            { table: 'inventario_tienda', name: 'idx_it_tienda_prod', column: 'tienda_id, producto_id' },
            { table: 'variaciones', name: 'idx_var_prod', column: 'producto_id' },
            { table: 'producto_barcodes', name: 'idx_pb_prod_barcode', column: 'producto_id, codigo_barras' },
            { table: 'ventas', name: 'idx_v_turno', column: 'turno_id' },
            { table: 'ventas', name: 'idx_v_tienda', column: 'tienda_id' },
            { table: 'ventas', name: 'idx_v_usuario', column: 'usuario_id' },
            { table: 'compras', name: 'idx_c_tienda', column: 'tienda_id' },
            { table: 'gastos', name: 'idx_g_tienda', column: 'tienda_id' }
        ];

        for (const idx of indexes) {
            console.log(`⏳ Procesando ${idx.table} (${idx.name})...`);
            
            try {
                // Verificar si el índice ya existe
                const [existing] = await db.query(`
                    SELECT COUNT(1) as has_index
                    FROM information_schema.statistics 
                    WHERE table_schema = DATABASE() 
                    AND table_name = ? 
                    AND index_name = ?
                `, [idx.table, idx.name]);

                if (existing[0].has_index > 0) {
                    console.log(`  ℹ️  El índice '${idx.name}' ya existe.`);
                    continue;
                }

                // Crear índice
                console.log(`  🔨 Creando índice on ${idx.table}(${idx.column})...`);
                await db.query(`ALTER TABLE ${idx.table} ADD INDEX ${idx.name} (${idx.column})`);
                console.log(`  ✅ Creado con éxito.`);
            } catch (err) {
                console.error(`  ❌ Error detectado:`, err);
            }
        }

        console.log('\n🎉 Optimización de índices completada!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR FATAL:', error);
        process.exit(1);
    }
}

runPerformanceIndexes();
