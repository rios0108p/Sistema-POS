import db from './config/db.js';

async function createTestProduct() {
    try {
        console.log("Iniciando creación de producto de prueba...");
        
        // 1. Insertar en productos
        const [result] = await db.query(
            `INSERT INTO productos 
            (nombre, descripcion, precio_compra, precio_venta, categoria, cantidad, stock_minimo, codigo_barras, activo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                'PRODUCTO DE PRUEBA ANTIGRAVITY',
                'Producto creado para debuggear la búsqueda de alias',
                10.00,
                25.00,
                'General',
                50,
                5,
                'BARCODE-MAESTRO-AG',
                1
            ]
        );

        const productId = result.insertId;
        console.log(`Producto creado con ID: ${productId}`);

        // 2. Insertar alias en producto_barcodes
        const alias = ['pp1', 'ANTIGRAVITY', 'AG-X'];
        for (const item of alias) {
            await db.query(
                'INSERT INTO producto_barcodes (producto_id, codigo_barras) VALUES (?, ?)',
                [productId, item]
            );
            console.log(`Alias '${item}' vinculado.`);
        }

        console.log("--- PROCESO COMPLETADO ---");
        console.log("Busca 'pp1' o 'ANTIGRAVITY' en el POS.");
        process.exit(0);
    } catch (error) {
        console.error("ERROR:", error);
        process.exit(1);
    }
}

createTestProduct();
