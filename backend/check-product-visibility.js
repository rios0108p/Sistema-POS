import db from './config/db.js';

async function checkProductInInventory() {
    try {
        const tiendaId = 1;
        const productoId = 165; // modelo 355ml

        console.log(`🔍 Verificando producto #${productoId} en tienda #${tiendaId}...\n`);

        // Check in inventario_tienda
        const [inventario] = await db.query(`
            SELECT * FROM inventario_tienda 
            WHERE tienda_id = ? AND producto_id = ?
        `, [tiendaId, productoId]);

        if (inventario.length === 0) {
            console.log('❌ Producto NO encontrado en inventario_tienda');
        } else {
            console.log('✅ Producto encontrado en inventario_tienda:');
            console.log(`   ID: ${inventario[0].id}`);
            console.log(`   Cantidad: ${inventario[0].cantidad}`);
            console.log(`   Stock Mínimo: ${inventario[0].stock_minimo}`);
            console.log(`   Activo: ${inventario[0].activo ? 'SÍ' : 'NO'} ⚠️`);
        }

        // Check what the API endpoint would return
        console.log('\n📡 Simulando llamada al endpoint GET /tiendas/:id/productos...');
        const [apiResult] = await db.query(`
            SELECT 
                it.id as inventario_id,
                it.cantidad,
                it.stock_minimo,
                it.activo,
                p.id as producto_id,
                p.nombre,
                p.categoria
            FROM inventario_tienda it
            JOIN productos p ON it.producto_id = p.id
            WHERE it.tienda_id = ? AND p.id = ?
        `, [tiendaId, productoId]);

        if (apiResult.length === 0) {
            console.log('❌ El endpoint NO devolvería este producto');
        } else {
            console.log('✅ El endpoint SÍ devolvería este producto:');
            console.log(`   Nombre: ${apiResult[0].nombre}`);
            console.log(`   Cantidad: ${apiResult[0].cantidad}`);
            console.log(`   Activo: ${apiResult[0].activo ? 'SÍ' : 'NO'}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkProductInInventory();
