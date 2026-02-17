import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configurar multer para logo y fondo de tarjeta
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/config');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Usar prefijo basado en el nombre del campo para diferenciar
        const prefix = file.fieldname === 'card_bg_image' ? 'card_bg' : 'logo';
        cb(null, prefix + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Obtener configuración
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM configuracion LIMIT 1');
        const defaultConfig = {
            nombre_tienda: 'Mi Tienda',
            logo: '/images/compra.png',
            direccion: '',
            telefono: '',
            nit: '',
            moneda: '$',
            ancho_ticket: '58mm',
            mensaje_ticket: '',
            email: '',
            website: '',
            requerir_pin: true,
            card_primary_color: '#4f46e5',
            card_secondary_color: '#3730a3',
            card_text_color: '#ffffff',
            card_title: 'Cliente Preferencial',
            show_logo_on_card: false,
            card_template: 'vanguard',
            card_bg_image: null
        };

        if (rows.length === 0) {
            return res.json(defaultConfig);
        }

        const config = {
            ...defaultConfig,
            ...rows[0],
            mensaje_ticket: rows[0].mensaje_ticket || '',
            email: rows[0].email || '',
            website: rows[0].website || '',
            requerir_pin: rows[0].requerir_pin === 1 || rows[0].requerir_pin === true,
            card_primary_color: rows[0].card_primary_color || '#4f46e5',
            card_secondary_color: rows[0].card_secondary_color || '#3730a3',
            card_text_color: rows[0].card_text_color || '#ffffff',
            card_title: rows[0].card_title || 'Cliente Preferencial',
            show_logo_on_card: rows[0].show_logo_on_card === 1 || rows[0].show_logo_on_card === true,
            card_template: rows[0].card_template || 'vanguard'
        };

        res.json(config);
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// Actualizar configuración
router.put('/', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'card_bg_image', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            nombre_tienda, direccion, telefono, nit, moneda, ancho_ticket, requerir_pin, mensaje_ticket, email, website,
            card_primary_color, card_secondary_color, card_text_color, card_title, show_logo_on_card, card_template
        } = req.body;

        let logoPath = null;
        let cardBgPath = null;

        if (req.files) {
            if (req.files.logo) logoPath = `/uploads/config/${req.files.logo[0].filename}`;
            if (req.files.card_bg_image) cardBgPath = `/uploads/config/${req.files.card_bg_image[0].filename}`;
        }

        // Verificar si existe configuración
        const [existing] = await db.query('SELECT id FROM configuracion LIMIT 1');

        if (existing.length === 0) {
            // Insertar nueva configuración
            let query = `INSERT INTO configuracion (
                nombre_tienda, direccion, telefono, nit, moneda, ancho_ticket, requerir_pin, 
                mensaje_ticket, email, website, card_primary_color, card_secondary_color, 
                card_text_color, card_title, show_logo_on_card, card_template, logo, card_bg_image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            let values = [
                nombre_tienda || 'Mi Tienda',
                direccion || '',
                telefono || '',
                nit || '',
                moneda || '$',
                ancho_ticket || '58mm',
                requerir_pin !== undefined ? (requerir_pin === 'true' || requerir_pin === true) : true,
                mensaje_ticket || '',
                email || '',
                website || '',
                card_primary_color || '#4f46e5',
                card_secondary_color || '#3730a3',
                card_text_color || '#ffffff',
                card_title || 'Cliente Preferencial',
                show_logo_on_card === 'true' || show_logo_on_card === true ? 1 : 0,
                card_template || 'vanguard',
                logoPath || '/images/compra.png',
                cardBgPath
            ];

            await db.query(query, values);
        } else {
            // Actualizar existente
            let query = `UPDATE configuracion SET 
                nombre_tienda = ?, direccion = ?, telefono = ?, nit = ?, moneda = ?, 
                ancho_ticket = ?, requerir_pin = ?, mensaje_ticket = ?, email = ?, 
                website = ?, card_primary_color = ?, card_secondary_color = ?, 
                card_text_color = ?, card_title = ?, show_logo_on_card = ?, card_template = ?`;

            let params = [
                nombre_tienda, direccion, telefono, nit, moneda, ancho_ticket,
                requerir_pin !== undefined ? (requerir_pin === 'true' || requerir_pin === true) : true,
                mensaje_ticket, email, website, card_primary_color, card_secondary_color,
                card_text_color, card_title,
                show_logo_on_card === 'true' || show_logo_on_card === true ? 1 : 0,
                card_template
            ];

            if (logoPath) {
                query += ', logo = ?';
                params.push(logoPath);
            }
            if (cardBgPath) {
                query += ', card_bg_image = ?';
                params.push(cardBgPath);
            }

            query += ' WHERE id = ?';
            params.push(existing[0].id);

            await db.query(query, params);
        }

        const [updated] = await db.query('SELECT * FROM configuracion LIMIT 1');
        res.json(updated[0]);
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

export default router;
