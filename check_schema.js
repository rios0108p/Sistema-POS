import db from './backend/config/db.js';

async function check() {
    try {
        const [variaciones] = await db.query("DESCRIBE variaciones");
        console.log("Variaciones Columns:", variaciones.map(c => c.Field));
        
        const [inventarioTienda] = await db.query("DESCRIBE inventario_tienda");
        console.log("Inventario Tienda Columns:", inventarioTienda.map(c => c.Field));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
