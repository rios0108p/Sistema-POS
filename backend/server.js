import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

// Importar middlewares de seguridad
import { verifyToken, isAdmin } from './middleware/auth.js';

// Importar rutas
import productosRoutes from './routes/productos.js';
import categoriasRoutes from './routes/categorias.js';
import ventasRoutes from './routes/ventas.js';
import comprasRoutes from './routes/compras.js';
import pedidosRoutes from './routes/pedidos.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import proveedoresRoutes from './routes/proveedores.js';
import clientesRoutes from './routes/clientes.js';
import usuariosRoutes from './routes/usuarios.js';
import configuracionRoutes from './routes/configuracion.js';
import turnosRoutes from './routes/turnos.js';
import tiendasRoutes from './routes/tiendas.js';
import movimientosRoutes from './routes/movimientos.js';
import promocionesRoutes from './routes/promociones.js';
import ajustesRoutes from './routes/ajustes.js';
import gastosRoutes from './routes/gastos.js';


// dotenv ya se cargó arriba

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(compression()); // Comprimir respuestas Gzip
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use((req, res, next) => {
    console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (imágenes)
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // retrocompatibilidad
app.use('/api/downloads', express.static(path.join(__dirname, 'downloads')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/productos', verifyToken, productosRoutes);
app.use('/api/categorias', verifyToken, categoriasRoutes);
app.use('/api/ventas', verifyToken, ventasRoutes);
app.use('/api/compras', verifyToken, comprasRoutes);
app.use('/api/pedidos', verifyToken, pedidosRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/api/proveedores', verifyToken, proveedoresRoutes);
app.use('/api/clientes', verifyToken, clientesRoutes);
app.use('/api/usuarios', verifyToken, isAdmin, usuariosRoutes);
app.use('/api/configuracion', verifyToken, isAdmin, configuracionRoutes);
app.use('/api/turnos', verifyToken, turnosRoutes);
app.use('/api/tiendas', verifyToken, isAdmin, tiendasRoutes);
app.use('/api/movimientos', verifyToken, movimientosRoutes);
app.use('/api/promociones', verifyToken, promocionesRoutes);
app.use('/api/ajustes', verifyToken, ajustesRoutes);
app.use('/api/gastos', verifyToken, gastosRoutes);


// Ruta de prueba básica
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'API funcionando correctamente',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Ruta de diagnóstico profundo (Base de Datos)
app.get('/api/db-check', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS result');
        res.json({
            status: 'CONNECTED',
            message: 'Conexión exitosa con TiDB Cloud/MySQL',
            db_host: process.env.DB_HOST || 'localhost',
            result: rows[0].result
        });
    } catch (error) {
        console.error('❌ Error de diagnóstico de DB:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'No se pudo conectar a la base de datos',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor', message: err.message });
});

// ✅ IMPORTANTE: Servir frontend estático en producción (modo portable)
// Si estamos en pkg, 'dist' estará AL LADO del ejecutable, no dentro.
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
// Si no es pkg, asumimos estructura normal ../dist. Si es pkg, asumimos ./dist
const distPath = isPkg ? path.join(baseDir, 'dist') : path.join(__dirname, '../dist');

console.log(`📂 Sirviendo frontend desde: ${distPath}`);
app.use(express.static(distPath));

// Cualquier otra ruta que no sea API, la mandamos al index.html (SPA)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.sendFile(path.join(distPath, 'index.html'));
    }
});

// Iniciar servidor encapsulado para Electron
export function startServer(port = 3001) {
    try {
        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`✅ API Backend lista en puerto ${port}`);
        });

        server.on('error', (err) => {
            console.error('❌ Error en el servidor backend:', err.message);
        });

        return server;
    } catch (e) {
        console.error('❌ No se pudo iniciar el servidor Express:', e.message);
        return null;
    }
}

// Iniciar automáticamente el servidor
startServer(PORT);

export default app;
