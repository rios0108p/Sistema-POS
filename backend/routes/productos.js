import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../config/db.js';

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

// Obtener todos los productos
router.get('/', async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT p.*, 
                   (p.cantidad + COALESCE((SELECT SUM(it.cantidad) FROM inventario_tienda it WHERE it.producto_id = p.id), 0)) as cantidad_global
            FROM productos p 
            ORDER BY p.id DESC
        `);

        // Obtener variaciones de todos los productos
        const [variationRows] = await db.query('SELECT * FROM variaciones');
        const variationsByProduct = variationRows.reduce((acc, v) => {
            if (!acc[v.producto_id]) acc[v.producto_id] = [];
            acc[v.producto_id].push(v);
            return acc;
        }, {});

        // Obtener códigos de barras agrupados
        const [barcodeRows] = await db.query('SELECT * FROM producto_barcodes');
        const barcodesByProduct = barcodeRows.reduce((acc, b) => {
            if (!acc[b.producto_id]) acc[b.producto_id] = [];
            acc[b.producto_id].push(b.codigo_barras);
            return acc;
        }, {});

        const productos = rows.map(p => {
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

            return {
                ...p,
                caracteristicas,
                imagenes,
                variaciones: variationsByProduct[p.id] || [],
                barcodes_agrupados: barcodesByProduct[p.id] || [],
                oferta: Boolean(p.oferta),
                destacado: Boolean(p.destacado),
                es_nuevo: Boolean(p.es_nuevo)
            };
        });

        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos:', error);
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

        const producto = {
            ...p,
            caracteristicas,
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
            oferta, destacado, es_nuevo, variaciones, barcodes_agrupados, activo
        } = req.body;

        // Validaciones
        if (!nombre || !categoria || !precio_compra || !precio_venta) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        // Procesar imágenes
        const imagenes = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        // Parsear características y variaciones
        let caracteristicasArray = [];
        if (caracteristicas) {
            caracteristicasArray = typeof caracteristicas === 'string' ? JSON.parse(caracteristicas) : caracteristicas;
        }

        let variacionesArray = [];
        if (variaciones) {
            variacionesArray = typeof variaciones === 'string' ? JSON.parse(variaciones) : variaciones;
        }
        const [result] = await db.query(
            `INSERT INTO productos 
      (nombre, descripcion, precio_compra, precio_venta, precio_oferta, categoria, cantidad, stock_minimo,
       marca, color, proveedor_id, codigo_barras, caracteristicas, imagenes, estrellas, oferta, destacado, es_nuevo, activo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre, descripcion || '',
                parseFloat(precio_compra), parseFloat(precio_venta),
                precio_oferta ? parseFloat(precio_oferta) : null,
                categoria, parseInt(cantidad || 0), parseInt(stock_minimo || 5),
                marca || '', color || '',
                proveedor_id ? parseInt(proveedor_id) : null,
                codigo_barras || null,
                JSON.stringify(caracteristicasArray),
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
            oferta, destacado, es_nuevo, imagenes_existentes, variaciones, barcodes_agrupados, activo } = req.body;

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
            caracteristicas = ?, imagenes = ?, oferta = ?, destacado = ?, es_nuevo = ?, activo = ?
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

export default router;
