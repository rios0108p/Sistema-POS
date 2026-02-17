import db from './config/db.js';

async function debugInventoryMismatch() {
    try {
        console.log('🔍 Investigando discrepancia de inventario...\n');

        const tiendaId = 1;
        const productoId = 165;

        // 1. Check current inventory
        const [inv] = await db.query(`
            SELECT cantidad FROM inventario_tienda 
            WHERE tienda_id = ? AND producto_id = ?
        `, [tiendaId, productoId]);

        console.log(`📦 Cantidad actual en inventario_tienda: ${inv[0]?.cantidad || 'NO ENCONTRADO'}`);

        // 2. Check all COMPRADO orders for this product and tienda
        const [pedidos] = await db.query(`
            SELECT p.id, p.estado, p.created_at, dp.cantidad
            FROM pedidos p
            JOIN detalle_pedidos dp ON p.id = dp.pedido_id
            WHERE p.tienda_id = ? 
            AND dp.producto_id = ?
            AND p.estado = 'COMPRADO'
            ORDER BY p.created_at DESC
        `, [tiendaId, productoId]);

        console.log(`\n📝 Pedidos COMPRADOS encontrados: ${pedidos.length}`);
        let totalEsperado = 0;
        pedidos.forEach(p => {
            console.log(`   Pedido #${p.id}: ${p.cantidad} unidades (${p.created_at})`);
            totalEsperado += p.cantidad;
        });
        console.log(`   Total esperado agregado: ${totalEsperado} unidades`);

        // 3. Check compras table
        const [compras] = await db.query(`
            SELECT COUNT(*) as total, SUM(cantidad) as total_cantidad
            FROM compras
            WHERE tienda_id = ? AND producto_id = ?
        `, [tiendaId, productoId]);

        console.log(`\n💰 Registros en tabla compras: ${compras[0].total}`);
        console.log(`   Total cantidad en compras: ${compras[0].total_cantidad || 0}`);

        // 4. Check if there were any ventas that reduced stock
        const [ventas] = await db.query(`
            SELECT SUM(dv.cantidad) as total_vendido
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.venta_id
            WHERE v.tienda_id = ? 
            AND dv.producto_id = ?
            AND v.estado = 'COMPLETADA'
        `, [tiendaId, productoId]);

        console.log(`\n🛒 Total vendido: ${ventas[0].total_vendido || 0} unidades`);

        // 5. Check history of inventario_tienda updates
        console.log(`\n🔄 Verificando si hay algún problema con la actualización...`);

        // Simulate what SHOULD be the quantity
        const cantidadActual = inv[0]?.cantidad || 0;
        const deberiaSerAproximadamente = totalEsperado - (ventas[0].total_vendido || 0);

        console.log(`\n📊 RESUMEN:`);
        console.log(`   Cantidad actual en BD: ${cantidadActual}`);
        console.log(`   Cantidad mostrada en frontend: 2100`);
        console.log(`   Diferencia: ${cantidadActual - 2100}`);
        console.log(`   Total agregado por pedidos: ${totalEsperado}`);
        console.log(`   Total vendido: ${ventas[0].total_vendido || 0}`);
        console.log(`   Debería ser aproximadamente: ${deberiaSerAproximadamente}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugInventoryMismatch();
