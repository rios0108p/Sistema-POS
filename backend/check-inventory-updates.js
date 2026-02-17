import db from './config/db.js';

async function checkInventoryUpdates() {
    try {
        console.log('🔍 Verificando actualizaciones de inventario para pedidos recientes...\n');

        // Get recent COMPRADO orders
        const [pedidos] = await db.query(`
            SELECT id, tienda_id, estado, created_at 
            FROM pedidos 
            WHERE estado = 'COMPRADO' 
            ORDER BY created_at DESC 
            LIMIT 3
        `);

        for (const pedido of pedidos) {
            console.log(`\n📦 Pedido #${pedido.id} (Tienda: ${pedido.tienda_id})`);
            console.log(`   Estado: ${pedido.estado}`);
            console.log(`   Fecha: ${pedido.created_at}`);

            // Get order details
            const [detalles] = await db.query(`
                SELECT producto_id, producto_nombre, cantidad 
                FROM detalle_pedidos 
                WHERE pedido_id = ?
            `, [pedido.id]);

            console.log(`   Productos en el pedido:`);
            for (const detalle of detalles) {
                console.log(`     - ${detalle.producto_nombre} (ID: ${detalle.producto_id}) x${detalle.cantidad}`);

                // Check if inventory was updated
                const [inventario] = await db.query(`
                    SELECT cantidad 
                    FROM inventario_tienda 
                    WHERE tienda_id = ? AND producto_id = ?
                `, [pedido.tienda_id, detalle.producto_id]);

                if (inventario.length > 0) {
                    console.log(`       ✅ En inventario: ${inventario[0].cantidad} unidades`);
                } else {
                    console.log(`       ❌ NO está en inventario_tienda`);
                }
            }

            // Check if compra was registered
            const [compras] = await db.query(`
                SELECT COUNT(*) as total 
                FROM compras 
                WHERE tienda_id = ? AND fecha >= ?
            `, [pedido.tienda_id, pedido.created_at]);

            console.log(`   Compras registradas: ${compras[0].total}`);
        }

        console.log('\n✅ Verificación completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkInventoryUpdates();
