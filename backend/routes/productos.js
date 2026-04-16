import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../config/db.js';
import { checkTienda } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes'));
    }
});

// Buscar producto (por código o nombre) para el verificador y POS
router.get('/buscar', checkTienda, async (req, res) => {
    try {
        const { q, tienda_id } = req.query;
        if (!q) return res.json([]);

        let queryParams = [`%${q}%`, q, q];
        let sql = `
            SELECT p.*, c.nombre as categoria_nombre,
            (SELECT SUM(cantidad) FROM inventario_tienda WHERE producto_id = p.id) as total_stock
            FROM productos p
            LEFT JOIN categorias c ON p.categoria = c.nombre
            WHERE p.activo = 1 
            AND (p.nombre LIKE ? OR p.codigo_barras = ? OR p.id IN (SELECT producto_id FROM producto_barcodes WHERE codigo_barras = ?))
        `;

        if (tienda_id) {
            sql = `
                SELECT p.*, c.nombre as categoria_nombre,
                COALESCE(it.cantidad, 0) as stock_sucursal,
                (SELECT SUM(cantidad) FROM inventario_tienda WHERE producto_id = p.id) as total_stock
                FROM productos p
                LEFT JOIN categorias c ON p.categoria = c.nombre
                LEFT JOIN inventario_tienda it ON p.id = it.producto_id AND it.tienda_id = ?
                WHERE p.activo = 1 
                AND (p.nombre LIKE ? OR p.codigo_barras = ? OR p.id IN (SELECT producto_id FROM producto_barcodes WHERE codigo_barras = ?))
            `;
            queryParams = [tienda_id, `%${q}%`, q, q];
        }

        const [rows] = await db.query(sql, queryParams);
        res.json(rows);
    } catch (error) {
        console.error('Error en búsqueda de productos:', error);
        res.status(500).json({ error: 'Error en el servidor al buscar productos' });
    }
});

// Obtener todos los productos (CON PAGINACIÓN)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        // 1. Obtener total de productos para la paginación
        const [totalRows] = await db.query('SELECT COUNT(*) as total FROM productos WHERE activo = 1');
        const total = totalRows[0].total;

        // 2. Obtener los productos de la página actual
        // Optimizamos: cantidad_global se calcula con una subconsulta limitada solo a esta página
        const [rows] = await db.query(`
            SELECT p.*, 
                   (p.cantidad + COALESCE((SELECT SUM(it.cantidad) FROM inventario_tienda it WHERE it.producto_id = p.id), 0)) as cantidad_global,
                   c.nombre as categoria_nombre
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria = c.nombre
            WHERE p.activo = 1
            ORDER BY p.id DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        if (rows.length === 0) {
            return res.json({
                data: [],
                pagination: { total, page, limit, pages: Math.ceil(total / limit) }
            });
        }

        const productIds = rows.map(p => p.id);

        // 3. Obtener variaciones SOLO de los productos de esta página
        const [variationRows] = await db.query('SELECT * FROM variaciones WHERE producto_id IN (?)', [productIds]);
        const variationsByProduct = variationRows.reduce((acc, v) => {
            if (!acc[v.producto_id]) acc[v.producto_id] = [];
            acc[v.producto_id].push(v);
            return acc;
        }, {});

        // 4. Obtener códigos de barras agrupados SOLO de los productos de esta página
        const [barcodeRows] = await db.query('SELECT * FROM producto_barcodes WHERE producto_id IN (?)', [productIds]);
        const barcodesByProduct = barcodeRows.reduce((acc, b) => {
            if (!acc[b.producto_id]) acc[b.producto_id] = [];
            acc[b.producto_id].push(b.codigo_barras);
            return acc;
        }, {});

        // 5. Mapear y parsear campos JSON de forma segura
        const productos = rows.map(p => {
            const parseJson = (field, fallback = []) => {
                if (!field) return fallback;
                if (typeof field !== 'string') return Array.isArray(field) ? field : fallback;
                try { return JSON.parse(field); } catch (e) { return fallback; }
            };

            return {
                ...p,
                caracteristicas: parseJson(p.caracteristicas),
                impuestos: parseJson(p.impuestos),
                imagenes: parseJson(p.imagenes),
                variaciones: variationsByProduct[p.id] || [],
                barcodes_agrupados: barcodesByProduct[p.id] || [],
                oferta: Boolean(p.oferta),
                destacado: Boolean(p.destacado),
                es_nuevo: Boolean(p.es_nuevo)
            };
        });

        res.json({
            data: productos,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error al obtener productos paginados:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
        const [variationRows] = await db.query('SELECT * FROM variaciones WHERE producto_id = ?', [id]);
        const [barcodeRows] = await db.query('SELECT * FROM producto_barcodes WHERE producto_id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const p = rows[0];
        let imagenes = [];
        let caracteristicas = [];

        // Parsear imagenes de forma segura
        if (p.imagenes) {
            if (typeof p.imagenes === 'string') {
                try {
                    imagenes = JSON.parse(p.imagenes);
                } catch (e) {
                    console.error('Error parsing imagenes for product', p.id, e);
                    imagenes = [];
                }
            } else if (Array.isArray(p.imagenes)) {
                imagenes = p.imagenes;
            }
        }

        // Parsear caracteristicas de forma segura
        if (p.caracteristicas) {
            if (typeof p.caracteristicas === 'string') {
                try {
                    caracteristicas = JSON.parse(p.caracteristicas);
                } catch (e) {
                    console.error('Error parsing caracteristicas for product', p.id, e);
                    caracteristicas = [];
                }
            } else if (Array.isArray(p.caracteristicas)) {
                caracteristicas = p.caracteristicas;
            }
        }
        // Parsear impuestos de forma segura
        let impuestos = [];
        if (p.impuestos) {
            if (typeof p.impuestos === 'string') {
                try { impuestos = JSON.parse(p.impuestos); } catch (e) { impuestos = []; }
            } else if (Array.isArray(p.impuestos)) { impuestos = p.impuestos; }
        }

        const producto = {
            ...p,
            caracteristicas,
            impuestos,
            imagenes,
            variaciones: variationRows || [],
            barcodes_agrupados: barcodeRows.map(b => b.codigo_barras) || [],
            oferta: Boolean(p.oferta),
            destacado: Boolean(p.destacado),
            es_nuevo: Boolean(p.es_nuevo)
        };

        res.json(producto);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

// Importación masiva global
router.post('/importar', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { items } = req.body;

        if (!items || !Array.isArray(items)) {
            throw new Error('Se requiere un array de items');
        }

        let procesados = 0;
        let errores = [];

        for (const item of items) {
            try {
                let productoId = null;

                // Buscar por código de barras primero
                if (item.codigo_barras) {
                    const [prod] = await connection.query('SELECT id FROM productos WHERE codigo_barras = ?', [item.codigo_barras]);
                    if (prod.length > 0) {
                        productoId = prod[0].id;
                    } else {
                        const [bg] = await connection.query('SELECT producto_id FROM producto_barcodes WHERE codigo_barras = ?', [item.codigo_barras]);
                        if (bg.length > 0) productoId = bg[0].producto_id;
                    }
                }

                const nombre = item.nombre || 'Producto sin nombre';
                const cantidad = parseInt(item.cantidad || 0);
                const stockMinimo = parseInt(item.stock_minimo || 5);
                const precioCompra = parseFloat(item.precio_compra || 0);
                const precioVenta = parseFloat(item.precio_venta || 0);

                if (productoId) {
                    // Actualizar global stock
                    await connection.query(
                        'UPDATE productos SET cantidad = cantidad + ?, nombre = ?, precio_compra = ?, precio_venta = ? WHERE id = ?',
                        [cantidad, nombre, precioCompra, precioVenta, productoId]
                    );
                } else {
                    // Crear nuevo producto
                    const [result] = await connection.query(
                        `INSERT INTO productos 
                        (nombre, codigo_barras, precio_compra, precio_venta, cantidad, stock_minimo, categoria, imagenes, caracteristicas, activo) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', 1)`,
                        [nombre, item.codigo_barras || null, precioCompra, precioVenta, cantidad, stockMinimo, 'General']
                    );
                    productoId = result.insertId;
                }
                procesados++;
            } catch (err) {
                errores.push(`Error procesando item: ${err.message}`);
            }
        }

        await connection.commit();
        if (procesados === 0 && errores.length > 0) {
            return res.status(400).json({ error: 'Fallo total en la importación. Primer error: ' + errores[0], errores });
        }
        res.json({
            message: `Proceso completado. ${procesados} productos importados al almacén central.`,
            procesados,
            errores: errores.length > 0 ? errores : null
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error en importación global:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Crear producto con imágenes
router.post('/', upload.array('imagenes', 4), async (req, res) => {
    try {
        const {
            nombre, descripcion, precio_compra, precio_venta, precio_oferta,
            categoria, cantidad, stock_minimo, marca, color, proveedor_id, codigo_barras, caracteristicas,
            oferta, destacado, es_nuevo, variaciones, barcodes_agrupados, activo, impuestos
        } = req.body;

        // Validaciones
        if (!nombre || !categoria || !precio_compra || !precio_venta) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        // Procesar imágenes
        const imagenes = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        // Parsear JSONs con try-catch para evitar crashes por caché
        let caracteristicasArray = [];
        if (caracteristicas) {
            try {
                caracteristicasArray = typeof caracteristicas === 'string' ? (caracteristicas === '[object Object]' ? [] : JSON.parse(caracteristicas)) : caracteristicas;
            } catch (e) { caracteristicasArray = []; }
        }

        let impuestosArray = [];
        if (impuestos) {
            try {
                impuestosArray = typeof impuestos === 'string' ? (impuestos === '[object Object]' ? [] : JSON.parse(impuestos)) : impuestos;
            } catch (e) { impuestosArray = []; }
        }

        let variacionesArray = [];
        if (variaciones) {
            try {
                variacionesArray = typeof variaciones === 'string' ? (variaciones === '[object Object]' ? [] : JSON.parse(variaciones)) : variaciones;
            } catch (e) { variacionesArray = []; }
        }
        const [result] = await db.query(
            `INSERT INTO productos 
      (nombre, descripcion, precio_compra, precio_venta, precio_oferta, categoria, cantidad, stock_minimo,
       marca, color, proveedor_id, codigo_barras, caracteristicas, impuestos, imagenes, estrellas, oferta, destacado, es_nuevo, activo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre, descripcion || '',
                parseFloat(precio_compra), parseFloat(precio_venta),
                precio_oferta ? parseFloat(precio_oferta) : null,
                categoria, parseInt(cantidad || 0), parseInt(stock_minimo || 5),
                marca || '', color || '',
                proveedor_id ? parseInt(proveedor_id) : null,
                codigo_barras || null,
                JSON.stringify(caracteristicasArray),
                JSON.stringify(impuestosArray),
                JSON.stringify(imagenes),
                0,
                oferta === 'true' || oferta === true,
                destacado === 'true' || destacado === true,
                (es_nuevo === 'true' || es_nuevo === true),
                (activo === 'true' || activo === true || activo === 1 || activo === undefined ? true : false)
            ]
        );

        const productId = result.insertId;



        // Insertar variaciones si existen
        if (variacionesArray.length > 0) {
            for (const v of variacionesArray) {
                await db.query(
                    'INSERT INTO variaciones (producto_id, nombre, atributo, stock, sku) VALUES (?, ?, ?, ?, ?)',
                    [productId, v.nombre, v.atributo || 'Talla', parseInt(v.stock || 0), v.sku || '']
                );
            }
        }

        // Insertar códigos agrupados
        let barcodesArray = [];
        if (barcodes_agrupados) {
            barcodesArray = typeof barcodes_agrupados === 'string' ? JSON.parse(barcodes_agrupados) : barcodes_agrupados;
        }
        if (barcodesArray.length > 0) {
            for (const b of barcodesArray) {
                if (!b) continue;
                await db.query('INSERT IGNORE INTO producto_barcodes (producto_id, codigo_barras) VALUES (?, ?)', [productId, b]);
            }
        }

        res.status(201).json({
            id: productId,
            message: 'Producto creado exitosamente',
            imagenes
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'Error al crear producto', details: error.message });
    }
});

// Actualizar producto
// Actualizar producto
router.put('/:id', upload.array('imagenes', 4), async (req, res) => {
    try {
        const { id } = req.params;
        let { nombre, descripcion, precio_compra, precio_venta, precio_oferta,
            categoria, cantidad, stock_minimo, marca, color, proveedor_id, codigo_barras, caracteristicas,
            oferta, destacado, es_nuevo, imagenes_existentes, variaciones, barcodes_agrupados, activo, impuestos } = req.body;

        // Obtener producto actual
        const [currentRows] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        const current = currentRows[0];

        // Función para parsear campos JSON que pueden venir como arreglos (si hubo duplicados)
        const parseJsonField = (val) => {
            if (val === undefined || val === null || val === 'null' || val === '') return [];
            // Si viene un arreglo, tomamos el último valor (probablemente el JSON stringificado)
            const baseVal = Array.isArray(val) ? val[val.length - 1] : val;
            if (typeof baseVal !== 'string') return baseVal;
            try { return JSON.parse(baseVal); } catch (e) { return []; }
        };

        // Parsear campos
        let imagenes = parseJsonField(imagenes_existentes);
        if (req.files && req.files.length > 0) {
            const nuevasImagenes = req.files.map(file => `/uploads/${file.filename}`);
            imagenes = [...imagenes, ...nuevasImagenes];
        } else if (!imagenes_existentes && current.imagenes) {
            imagenes = parseJsonField(current.imagenes);
        }

        let caracteristicasArray = parseJsonField(caracteristicas);
        let impuestosArray = parseJsonField(impuestos);
        let variacionesArray = parseJsonField(variaciones);
        let barcodesArray = parseJsonField(barcodes_agrupados);

        // Preparar valores finales (mantener actuales si no vienen en la petición)
        const finalValues = {
            nombre: nombre !== undefined ? nombre : current.nombre,
            descripcion: descripcion !== undefined ? descripcion : current.descripcion,
            precio_compra: (precio_compra !== undefined && precio_compra !== '' && precio_compra !== 'null') ? parseFloat(precio_compra) : current.precio_compra,
            precio_venta: (precio_venta !== undefined && precio_venta !== '' && precio_venta !== 'null') ? parseFloat(precio_venta) : current.precio_venta,
            precio_oferta: (precio_oferta !== undefined && precio_oferta !== '' && precio_oferta !== 'null') ? parseFloat(precio_oferta) : (precio_oferta === 'null' ? null : current.precio_oferta),
            categoria: categoria !== undefined ? categoria : current.categoria,
            cantidad: (cantidad !== undefined && cantidad !== '') ? parseInt(cantidad) : current.cantidad,
            stock_minimo: (stock_minimo !== undefined && stock_minimo !== '') ? parseInt(stock_minimo) : current.stock_minimo,
            marca: marca !== undefined ? marca : current.marca,
            color: color !== undefined ? color : current.color,
            proveedor_id: (proveedor_id !== undefined && proveedor_id !== '' && proveedor_id !== 'null' && proveedor_id !== 'NaN') ? parseInt(proveedor_id) : (proveedor_id === 'null' ? null : current.proveedor_id),
            codigo_barras: codigo_barras !== undefined ? (codigo_barras === 'null' ? null : codigo_barras) : current.codigo_barras,
            oferta: oferta !== undefined ? (oferta === 'true' || oferta === true || oferta === 1) : current.oferta,
            destacado: destacado !== undefined ? (destacado === 'true' || destacado === true || destacado === 1) : current.destacado,
            es_nuevo: es_nuevo !== undefined ? (es_nuevo === 'true' || es_nuevo === true || es_nuevo === 1) : current.es_nuevo,
            activo: activo !== undefined ? (activo === 'true' || activo === true || activo === 1) : current.activo
        };

        await db.query(`UPDATE productos SET 
            nombre = ?, descripcion = ?, precio_compra = ?, precio_venta = ?, precio_oferta = ?, 
            categoria = ?, cantidad = ?, stock_minimo = ?, marca = ?, color = ?, proveedor_id = ?, codigo_barras = ?, 
            caracteristicas = ?, impuestos = ?, imagenes = ?, oferta = ?, destacado = ?, es_nuevo = ?, activo = ?
            WHERE id = ?`,
            [
                finalValues.nombre, finalValues.descripcion || '',
                finalValues.precio_compra || 0, finalValues.precio_venta || 0,
                finalValues.precio_oferta,
                finalValues.categoria, finalValues.cantidad || 0, finalValues.stock_minimo || 5,
                finalValues.marca || '', finalValues.color || '',
                finalValues.proveedor_id,
                finalValues.codigo_barras,
                JSON.stringify(caracteristicasArray),
                JSON.stringify(impuestosArray),
                JSON.stringify(imagenes),
                finalValues.oferta,
                finalValues.destacado,
                finalValues.es_nuevo,
                finalValues.activo,
                id
            ]
        );

        // Sincronizar variaciones: Eliminar las que no están en el nuevo arreglo y actualizar/insertar el resto
        const [variacionesExistentes] = await db.query('SELECT id FROM variaciones WHERE producto_id = ?', [id]);
        const idsExistentes = variacionesExistentes.map(v => v.id);
        const idsNuevos = variacionesArray.filter(v => v.id).map(v => v.id);

        // Eliminar
        const idsAEliminar = idsExistentes.filter(oid => !idsNuevos.includes(oid));
        if (idsAEliminar.length > 0) {
            await db.query('DELETE FROM variaciones WHERE id IN (?)', [idsAEliminar]);
        }

        // Actualizar o Insertar
        for (const v of variacionesArray) {
            if (v.id) {
                await db.query(
                    'UPDATE variaciones SET nombre = ?, atributo = ?, stock = ?, sku = ? WHERE id = ?',
                    [v.nombre, v.atributo || 'Talla', parseInt(v.stock || 0), v.sku || '', v.id]
                );
            } else {
                await db.query(
                    'INSERT INTO variaciones (producto_id, nombre, atributo, stock, sku) VALUES (?, ?, ?, ?, ?)',
                    [id, v.nombre, v.atributo || 'Talla', parseInt(v.stock || 0), v.sku || '']
                );
            }
        }

        // Sincronizar códigos agrupados
        if (barcodes_agrupados) {
            // Ya fue parseado arriba como barcodesArray
        }
        // Limpiar y re-insertar
        await db.query('DELETE FROM producto_barcodes WHERE producto_id = ?', [id]);
        if (barcodesArray.length > 0) {
            for (const b of barcodesArray) {
                if (!b) continue;
                await db.query('INSERT IGNORE INTO producto_barcodes (producto_id, codigo_barras) VALUES (?, ?)', [id, b]);
            }
        }

        res.json({ message: 'Producto actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error al actualizar producto', details: error.message });
    }
});

// Eliminar producto
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener imágenes antes de eliminar
        const [productoRows] = await db.query('SELECT imagenes FROM productos WHERE id = ?', [id]);
        if (productoRows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Eliminar producto
        await db.query('DELETE FROM productos WHERE id = ?', [id]);

        // Eliminar imágenes del servidor (opcional, pero recomendado)
        if (productoRows[0].imagenes) {
            try {
                const imagenes = JSON.parse(productoRows[0].imagenes);
                imagenes.forEach(img => {
                    const filePath = path.join(__dirname, '..', img);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            } catch (e) {
                console.error('Error al parsear o eliminar imágenes:', e);
            }
        }

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

// Vaciar inventario completo
router.delete('/bulk-delete/all', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Eliminar en orden para respetar FKs si existen
        await connection.query('DELETE FROM inventario_tienda');
        await connection.query('DELETE FROM producto_barcodes');
        await connection.query('DELETE FROM variaciones');
        await connection.query('DELETE FROM productos');

        await connection.commit();
        res.json({ message: 'Inventario vaciado completamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al vaciar inventario:', error);
        res.status(500).json({ error: 'Error al vaciar inventario', details: error.message });
    } finally {
        connection.release();
    }
});

// Importar catálogo desde Eleventa
router.post('/importar-eleventa', async (req, res) => {
    try {
        const { items, tienda_id } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Formato de datos inválido' });
        }

        let procesados = 0;
        let errores = [];

        for (const item of items) {
            try {
                // Mapeo esperado
                const codigo = item.codigo_barras || null;
                const nombre = item.nombre || 'Sin nombre';
                const p_compra = parseFloat(item.precio_compra) || 0;
                const p_venta = parseFloat(item.precio_venta) || 0;
                const p_oferta = item.precio_oferta ? parseFloat(item.precio_oferta) : null;
                const cantidad = parseInt(item.cantidad) || 0;
                const s_minimo = parseInt(item.stock_minimo) || 5;
                const categoria = item.categoria || 'General';

                // 1. Validar y crear categoría si no existe
                let [catRows] = await db.query('SELECT id FROM categorias WHERE nombre = ?', [categoria]);
                if (catRows.length === 0) {
                    await db.query('INSERT IGNORE INTO categorias (nombre) VALUES (?)', [categoria]);
                }

                // 2. Buscar si el producto existe por codigo_barras o nombre
                let productoId = null;
                let existe = false;

                if (codigo) {
                    const [prodRows] = await db.query('SELECT id FROM productos WHERE codigo_barras = ?', [codigo]);
                    if (prodRows.length > 0) {
                        productoId = prodRows[0].id;
                        existe = true;
                    } else {
                        const [bg] = await db.query('SELECT producto_id FROM producto_barcodes WHERE codigo_barras = ?', [codigo]);
                        if (bg.length > 0) {
                            productoId = bg[0].producto_id;
                            existe = true;
                        }
                    }
                }
                if (!existe && nombre) {
                    const [prodRows] = await db.query('SELECT id FROM productos WHERE nombre = ?', [nombre]);
                    if (prodRows.length > 0) {
                        productoId = prodRows[0].id;
                        existe = true;
                    }
                }

                if (existe && productoId) {
                    // Actualizar
                    await db.query(`
                        UPDATE productos 
                        SET nombre = ?, precio_compra = ?, precio_venta = ?, precio_oferta = ?, 
                            categoria = ?, cantidad = ?, stock_minimo = ?, oferta = ?
                        WHERE id = ?
                    `, [
                        nombre, p_compra, p_venta, p_oferta, categoria, cantidad, s_minimo,
                        p_oferta ? 1 : 0, productoId
                    ]);
                } else {
                    // Insertar
                    const [insertResult] = await db.query(`
                        INSERT INTO productos 
                        (nombre, precio_compra, precio_venta, precio_oferta, categoria, cantidad, stock_minimo, codigo_barras, oferta, activo) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    `, [
                        nombre, p_compra, p_venta, p_oferta, categoria, cantidad, s_minimo, codigo,
                        p_oferta ? 1 : 0
                    ]);
                    productoId = insertResult.insertId;
                }

                // Si se proporcionó un tienda_id, actualizar inventario de la tienda
                if (tienda_id && productoId) {
                    const [invRows] = await db.query('SELECT id FROM inventario_tienda WHERE tienda_id = ? AND producto_id = ?', [tienda_id, productoId]);
                    if (invRows.length > 0) {
                        await db.query('UPDATE inventario_tienda SET cantidad = ?, stock_minimo = ?, activo = 1 WHERE id = ?', [cantidad, s_minimo, invRows[0].id]);
                    } else {
                        await db.query('INSERT INTO inventario_tienda (tienda_id, producto_id, cantidad, stock_minimo, activo) VALUES (?, ?, ?, ?, 1)', [tienda_id, productoId, cantidad, s_minimo]);
                    }
                }

                procesados++;
            } catch (err) {
                console.error('Error importando item Eleventa:', item, err);
                errores.push(err.message);
            }
        }

        if (procesados === 0 && errores.length > 0) {
            return res.status(400).json({ error: 'Fallo total en importación. Primer error: ' + errores[0] });
        }
        res.json({ message: `Importación finalizada. Procesados: ${procesados}. Errores: ${errores.length}` });
    } catch (error) {
        console.error('Error en importación Eleventa:', error);
        res.status(500).json({ error: 'Error en la importación', details: error.message });
    }
});

export default router;
