// seed.js - Script para poblar la base de datos con datos de prueba
import db from './config/db.js';

const seed = async () => {
    console.log('🌱 Iniciando seed de datos de prueba...\n');

    try {
        // ==================== CATEGORÍAS ====================
        console.log('📁 Creando categorías...');
        const categorias = [
            'Herramientas Manuales',
            'Herramientas Eléctricas',
            'Plomería',
            'Electricidad',
            'Pinturas',
            'Cerraduras',
            'Tornillería',
            'Jardinería',
            'Construcción',
            'Seguridad'
        ];

        for (const cat of categorias) {
            await db.query(
                'INSERT IGNORE INTO categorias (nombre) VALUES (?)',
                [cat]
            );
        }
        console.log(`   ✅ ${categorias.length} categorías creadas\n`);

        // ==================== PROVEEDORES ====================
        console.log('🚚 Creando proveedores...');
        const proveedores = [
            { nombre: 'Truper México', contacto: 'Carlos Mendoza', telefono: '555-123-4567', email: 'ventas@truper.mx', direccion: 'Av. Industrial #456, CDMX' },
            { nombre: 'Stanley Tools', contacto: 'Ana García', telefono: '555-234-5678', email: 'distribuidor@stanley.com', direccion: 'Blvd. Comercial #789, Monterrey' },
            { nombre: 'DeWalt Professional', contacto: 'Roberto López', telefono: '555-345-6789', email: 'pedidos@dewalt.mx', direccion: 'Calle Principal #123, Guadalajara' },
            { nombre: 'Comex Pinturas', contacto: 'María Hernández', telefono: '555-456-7890', email: 'ventas@comex.com.mx', direccion: 'Zona Industrial, Puebla' },
            { nombre: 'Ferretería El Tornillo', contacto: 'Juan Pérez', telefono: '555-567-8901', email: 'compras@eltornillo.mx', direccion: 'Centro Histórico #45, Mérida' }
        ];

        for (const prov of proveedores) {
            await db.query(
                'INSERT INTO proveedores (nombre, contacto, telefono, email, direccion) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre=nombre',
                [prov.nombre, prov.contacto, prov.telefono, prov.email, prov.direccion]
            );
        }
        console.log(`   ✅ ${proveedores.length} proveedores creados\n`);

        // ==================== PRODUCTOS ====================
        console.log('📦 Creando productos...');
        const productos = [
            // Herramientas Manuales
            { nombre: 'Martillo de Uña 16oz Truper', descripcion: 'Martillo profesional con mango de fibra de vidrio', precio_compra: 85, precio_venta: 159, categoria: 'Herramientas Manuales', cantidad: 45, marca: 'Truper', color: 'Negro/Amarillo' },
            { nombre: 'Destornillador Phillips #2', descripcion: 'Destornillador de punta magnética', precio_compra: 25, precio_venta: 49, categoria: 'Herramientas Manuales', cantidad: 120, marca: 'Stanley', color: 'Amarillo' },
            { nombre: 'Llave Ajustable 10"', descripcion: 'Llave ajustable cromada profesional', precio_compra: 120, precio_venta: 225, categoria: 'Herramientas Manuales', cantidad: 35, marca: 'Truper', color: 'Cromado' },
            { nombre: 'Juego de Llaves Allen 9 pzas', descripcion: 'Set de llaves hexagonales métricas', precio_compra: 45, precio_venta: 89, categoria: 'Herramientas Manuales', cantidad: 60, marca: 'Stanley', color: 'Negro' },
            { nombre: 'Pinzas de Presión 10"', descripcion: 'Pinzas de presión mordaza curva', precio_compra: 75, precio_venta: 145, categoria: 'Herramientas Manuales', cantidad: 40, marca: 'Truper', color: 'Plateado' },

            // Herramientas Eléctricas
            { nombre: 'Taladro Inalámbrico 20V', descripcion: 'Taladro con 2 baterías y maletín', precio_compra: 1200, precio_venta: 2299, categoria: 'Herramientas Eléctricas', cantidad: 15, marca: 'DeWalt', color: 'Amarillo' },
            { nombre: 'Esmeriladora Angular 4.5"', descripcion: 'Esmeriladora 850W con disco incluido', precio_compra: 650, precio_venta: 1199, categoria: 'Herramientas Eléctricas', cantidad: 20, marca: 'DeWalt', color: 'Amarillo' },
            { nombre: 'Sierra Circular 7.25"', descripcion: 'Sierra profesional 1400W', precio_compra: 1500, precio_venta: 2799, categoria: 'Herramientas Eléctricas', cantidad: 8, marca: 'DeWalt', color: 'Amarillo' },
            { nombre: 'Rotomartillo SDS Plus', descripcion: 'Rotomartillo 800W con maletín', precio_compra: 1800, precio_venta: 3499, categoria: 'Herramientas Eléctricas', cantidad: 6, marca: 'DeWalt', color: 'Amarillo' },
            { nombre: 'Lijadora Orbital 1/4"', descripcion: 'Lijadora eléctrica 220W', precio_compra: 400, precio_venta: 749, categoria: 'Herramientas Eléctricas', cantidad: 18, marca: 'Stanley', color: 'Amarillo' },

            // Plomería
            { nombre: 'Llave Stillson 14"', descripcion: 'Llave para tubo profesional', precio_compra: 150, precio_venta: 289, categoria: 'Plomería', cantidad: 25, marca: 'Truper', color: 'Naranja' },
            { nombre: 'Cinta Teflón 3/4"', descripcion: 'Cinta selladora para roscas', precio_compra: 8, precio_venta: 19, categoria: 'Plomería', cantidad: 200, marca: 'Truper', color: 'Blanco' },
            { nombre: 'Llave de Lavabo', descripcion: 'Llave cromada para lavabo', precio_compra: 180, precio_venta: 349, categoria: 'Plomería', cantidad: 30, marca: 'Coflex', color: 'Cromado' },
            { nombre: 'Válvula Check 1/2"', descripcion: 'Válvula de retención de bronce', precio_compra: 45, precio_venta: 89, categoria: 'Plomería', cantidad: 50, marca: 'Truper', color: 'Bronce' },

            // Electricidad
            { nombre: 'Cable THW 12 AWG (100m)', descripcion: 'Cable eléctrico calibre 12', precio_compra: 850, precio_venta: 1599, categoria: 'Electricidad', cantidad: 25, marca: 'Condumex', color: 'Negro' },
            { nombre: 'Interruptor Termomagnético 2x20A', descripcion: 'Pastilla termomagnética bifásica', precio_compra: 120, precio_venta: 229, categoria: 'Electricidad', cantidad: 40, marca: 'Square D', color: 'Negro' },
            { nombre: 'Centro de Carga 8 circuitos', descripcion: 'Tablero eléctrico residencial', precio_compra: 450, precio_venta: 849, categoria: 'Electricidad', cantidad: 12, marca: 'Square D', color: 'Gris' },
            { nombre: 'Apagador Sencillo', descripcion: 'Interruptor de luz decorativo', precio_compra: 35, precio_venta: 69, categoria: 'Electricidad', cantidad: 100, marca: 'Leviton', color: 'Blanco' },

            // Pinturas
            { nombre: 'Pintura Vinílica 19L (Blanco)', descripcion: 'Pintura lavable para interiores', precio_compra: 650, precio_venta: 1249, categoria: 'Pinturas', cantidad: 20, marca: 'Comex', color: 'Blanco' },
            { nombre: 'Esmalte Anticorrosivo 4L', descripcion: 'Esmalte para metal y herrería', precio_compra: 280, precio_venta: 549, categoria: 'Pinturas', cantidad: 35, marca: 'Comex', color: 'Negro' },
            { nombre: 'Rodillo para Pintar 9"', descripcion: 'Rodillo con felpa de alta calidad', precio_compra: 45, precio_venta: 89, categoria: 'Pinturas', cantidad: 60, marca: 'Truper', color: 'Amarillo' },
            { nombre: 'Brocha 4" Pelo Mixto', descripcion: 'Brocha profesional para pintura', precio_compra: 35, precio_venta: 69, categoria: 'Pinturas', cantidad: 80, marca: 'Truper', color: 'Natural' },

            // Cerraduras
            { nombre: 'Cerradura Principal Phillips', descripcion: 'Cerradura de alta seguridad', precio_compra: 450, precio_venta: 849, categoria: 'Cerraduras', cantidad: 15, marca: 'Phillips', color: 'Níquel' },
            { nombre: 'Candado de Acero 50mm', descripcion: 'Candado con llave de seguridad', precio_compra: 85, precio_venta: 159, categoria: 'Cerraduras', cantidad: 45, marca: 'Master Lock', color: 'Plateado' },
            { nombre: 'Cerradura Digital Smart', descripcion: 'Cerradura con código y huella', precio_compra: 1500, precio_venta: 2899, categoria: 'Cerraduras', cantidad: 5, marca: 'Yale', color: 'Negro' },

            // Tornillería
            { nombre: 'Tornillo para Madera 2" (100 pzas)', descripcion: 'Tornillo punta plana cabeza Phillips', precio_compra: 35, precio_venta: 69, categoria: 'Tornillería', cantidad: 150, marca: 'Segufix', color: 'Negro' },
            { nombre: 'Taquete de Plástico 1/4" (100 pzas)', descripcion: 'Taquete expansivo para concreto', precio_compra: 20, precio_venta: 39, categoria: 'Tornillería', cantidad: 200, marca: 'Fischer', color: 'Naranja' },
            { nombre: 'Clavo para Concreto 2" (1kg)', descripcion: 'Clavo de acero endurecido', precio_compra: 45, precio_venta: 89, categoria: 'Tornillería', cantidad: 80, marca: 'Truper', color: 'Plateado' },

            // Jardinería  
            { nombre: 'Manguera Reforzada 1/2" (30m)', descripcion: 'Manguera anti torceduras', precio_compra: 180, precio_venta: 349, categoria: 'Jardinería', cantidad: 25, marca: 'Truper', color: 'Verde' },
            { nombre: 'Tijeras para Podar', descripcion: 'Tijeras bypass profesionales', precio_compra: 120, precio_venta: 229, categoria: 'Jardinería', cantidad: 30, marca: 'Truper', color: 'Rojo/Negro' },
            { nombre: 'Pala Cuadrada Mango Largo', descripcion: 'Pala de acero con mango de madera', precio_compra: 95, precio_venta: 179, categoria: 'Jardinería', cantidad: 20, marca: 'Truper', color: 'Plateado' },

            // Construcción
            { nombre: 'Cemento Gris 50kg', descripcion: 'Cemento Portland tipo I', precio_compra: 160, precio_venta: 249, categoria: 'Construcción', cantidad: 100, marca: 'Cruz Azul', color: 'Gris' },
            { nombre: 'Varilla 3/8" (12m)', descripcion: 'Varilla corrugada de acero', precio_compra: 85, precio_venta: 159, categoria: 'Construcción', cantidad: 80, marca: 'Deacero', color: 'Gris' },
            { nombre: 'Block de Concreto 15x20x40', descripcion: 'Block estructural ligero', precio_compra: 12, precio_venta: 22, categoria: 'Construcción', cantidad: 500, marca: 'Nacional', color: 'Gris' },

            // Seguridad
            { nombre: 'Casco de Seguridad', descripcion: 'Casco industrial con suspensión', precio_compra: 65, precio_venta: 129, categoria: 'Seguridad', cantidad: 40, marca: 'Truper', color: 'Amarillo' },
            { nombre: 'Guantes de Carnaza', descripcion: 'Guantes para soldador', precio_compra: 45, precio_venta: 89, categoria: 'Seguridad', cantidad: 60, marca: 'Truper', color: 'Amarillo' },
            { nombre: 'Lentes de Seguridad', descripcion: 'Lentes transparentes antiempañantes', precio_compra: 35, precio_venta: 69, categoria: 'Seguridad', cantidad: 80, marca: '3M', color: 'Transparente' },
            { nombre: 'Chaleco Reflejante', descripcion: 'Chaleco de alta visibilidad', precio_compra: 55, precio_venta: 99, categoria: 'Seguridad', cantidad: 50, marca: 'Truper', color: 'Naranja' },

            // Productos con bajo stock para probar alertas
            { nombre: 'Multímetro Digital Pro', descripcion: 'Multímetro con pinza amperimétrica', precio_compra: 350, precio_venta: 699, categoria: 'Electricidad', cantidad: 3, marca: 'Fluke', color: 'Amarillo' },
            { nombre: 'Soldadora Inversora 200A', descripcion: 'Soldadora portátil profesional', precio_compra: 3500, precio_venta: 6499, categoria: 'Herramientas Eléctricas', cantidad: 2, marca: 'Lincoln', color: 'Rojo' },
            { nombre: 'Compresor 50L 2HP', descripcion: 'Compresor de aire lubricado', precio_compra: 2800, precio_venta: 5299, categoria: 'Herramientas Eléctricas', cantidad: 1, marca: 'Evans', color: 'Azul' }
        ];

        const productIds = [];
        for (const prod of productos) {
            const [result] = await db.query(
                `INSERT INTO productos (nombre, descripcion, precio_compra, precio_venta, categoria, cantidad, marca, color, caracteristicas, oferta, destacado, es_nuevo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
                [prod.nombre, prod.descripcion, prod.precio_compra, prod.precio_venta, prod.categoria, prod.cantidad, prod.marca, prod.color, JSON.stringify(['Alta calidad', 'Garantía de fábrica', 'Envío gratis']), Math.random() > 0.7, Math.random() > 0.8, Math.random() > 0.5]
            );
            productIds.push(result.insertId);
        }
        console.log(`   ✅ ${productos.length} productos creados\n`);

        // ==================== VENTAS ====================
        console.log('💰 Creando ventas (últimos 30 días)...');
        let ventasCreadas = 0;

        // Generar ventas de los últimos 30 días
        for (let dias = 0; dias < 30; dias++) {
            const numVentas = Math.floor(Math.random() * 8) + 3; // 3-10 ventas por día

            for (let v = 0; v < numVentas; v++) {
                const prodIndex = Math.floor(Math.random() * productos.length);
                const prod = productos[prodIndex];
                const prodId = productIds[prodIndex];
                const cantidad = Math.floor(Math.random() * 5) + 1;
                const precio = prod.precio_venta;
                const total = cantidad * precio;

                const fecha = new Date();
                fecha.setDate(fecha.getDate() - dias);
                fecha.setHours(Math.floor(Math.random() * 12) + 8); // Entre 8am y 8pm
                fecha.setMinutes(Math.floor(Math.random() * 60));

                await db.query(
                    'INSERT INTO ventas (producto_id, producto_nombre, cantidad, precio_unitario, total, fecha) VALUES (?, ?, ?, ?, ?, ?)',
                    [prodId, prod.nombre, cantidad, precio, total, fecha]
                );
                ventasCreadas++;
            }
        }
        console.log(`   ✅ ${ventasCreadas} ventas creadas\n`);

        // ==================== COMPRAS ====================
        console.log('📥 Creando compras (últimos 30 días)...');
        let comprasCreadas = 0;

        const [provs] = await db.query('SELECT id FROM proveedores');
        const proveedorIds = provs.map(p => p.id);

        for (let dias = 0; dias < 30; dias += 3) { // Compras cada 3 días aprox
            const numCompras = Math.floor(Math.random() * 4) + 1; // 1-4 compras

            for (let c = 0; c < numCompras; c++) {
                const prodIndex = Math.floor(Math.random() * productos.length);
                const prod = productos[prodIndex];
                const prodId = productIds[prodIndex];
                const cantidad = Math.floor(Math.random() * 20) + 5;
                const precio = prod.precio_compra;
                const total = cantidad * precio;
                const provId = proveedorIds[Math.floor(Math.random() * proveedorIds.length)];

                const fecha = new Date();
                fecha.setDate(fecha.getDate() - dias);
                fecha.setHours(Math.floor(Math.random() * 8) + 9);

                await db.query(
                    'INSERT INTO compras (producto_id, producto_nombre, proveedor_id, cantidad, precio_unitario, total, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [prodId, prod.nombre, provId, cantidad, precio, total, fecha]
                );
                comprasCreadas++;
            }
        }
        console.log(`   ✅ ${comprasCreadas} compras creadas\n`);

        // ==================== PEDIDOS ====================
        console.log('📋 Creando pedidos...');
        const clientes = [
            { nombre: 'Juan García', email: 'juan.garcia@email.com', telefono: '555-111-2222', direccion: 'Calle Reforma #123, Col. Centro' },
            { nombre: 'María López', email: 'maria.lopez@email.com', telefono: '555-222-3333', direccion: 'Av. Principal #456, Col. Norte' },
            { nombre: 'Carlos Martínez', email: 'carlos.m@email.com', telefono: '555-333-4444', direccion: 'Blvd. Industrial #789, Zona Sur' },
            { nombre: 'Ana Hernández', email: 'ana.h@email.com', telefono: '555-444-5555', direccion: 'Calle Juárez #321, Centro Histórico' },
            { nombre: 'Roberto Sánchez', email: 'roberto.s@email.com', telefono: '555-555-6666', direccion: 'Av. Constitución #654, Col. Moderna' }
        ];

        const estados = ['pendiente', 'confirmado', 'en_proceso', 'enviado', 'entregado'];
        const metodosPago = ['efectivo', 'tarjeta', 'transferencia'];

        for (let i = 0; i < 15; i++) {
            const cliente = clientes[Math.floor(Math.random() * clientes.length)];
            const estado = estados[Math.floor(Math.random() * estados.length)];
            const metodo = metodosPago[Math.floor(Math.random() * metodosPago.length)];

            // Seleccionar 1-4 productos para el pedido
            const numProductos = Math.floor(Math.random() * 4) + 1;
            let subtotal = 0;
            const detalles = [];

            for (let p = 0; p < numProductos; p++) {
                const prodIndex = Math.floor(Math.random() * productos.length);
                const prod = productos[prodIndex];
                const cantidad = Math.floor(Math.random() * 3) + 1;
                const precioUnit = prod.precio_venta;
                const subProd = cantidad * precioUnit;
                subtotal += subProd;

                detalles.push({
                    producto_id: productIds[prodIndex],
                    producto_nombre: prod.nombre,
                    cantidad,
                    precio_unitario: precioUnit,
                    subtotal: subProd
                });
            }

            const envio = Math.random() > 0.5 ? 0 : 99;
            const total = subtotal + envio;

            const fecha = new Date();
            fecha.setDate(fecha.getDate() - Math.floor(Math.random() * 20));

            const [pedidoResult] = await db.query(
                'INSERT INTO pedidos (nombre_cliente, email_cliente, telefono_cliente, direccion_envio, subtotal, envio, total, estado, metodo_pago, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [cliente.nombre, cliente.email, cliente.telefono, cliente.direccion, subtotal, envio, total, estado, metodo, fecha]
            );

            const pedidoId = pedidoResult.insertId;

            for (const det of detalles) {
                await db.query(
                    'INSERT INTO detalle_pedidos (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                    [pedidoId, det.producto_id, det.producto_nombre, det.cantidad, det.precio_unitario, det.subtotal]
                );
            }
        }
        console.log(`   ✅ 15 pedidos creados\n`);

        console.log('═══════════════════════════════════════════');
        console.log('🎉 ¡Seed completado exitosamente!');
        console.log('═══════════════════════════════════════════');
        console.log(`
📊 Resumen:
   • ${categorias.length} categorías
   • ${proveedores.length} proveedores
   • ${productos.length} productos
   • ${ventasCreadas} ventas
   • ${comprasCreadas} compras
   • 15 pedidos
    `);

    } catch (error) {
        console.error('❌ Error en seed:', error);
    } finally {
        process.exit(0);
    }
};

seed();
