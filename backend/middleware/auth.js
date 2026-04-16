import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET no definido en el entorno (.env). El sistema no es seguro.');
    // En producción esto debería detener el proceso, en desarrollo avisamos.
}

/**
 * Middleware para verificar el token JWT en las peticiones
 */
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token de seguridad.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Adjuntar datos del usuario a la petición
        next();
    } catch (error) {
        console.error('❌ Error de verificación de token:', error.message);
        return res.status(403).json({ error: 'Token inválido o expirado. Por favor, inicia sesión de nuevo.' });
    }
};

/**
 * Middleware para restringir acceso solo a administradores
 */
export const isAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso restringido. Esta acción requiere permisos de administrador.' });
    }
    next();
};

/**
 * Middleware para verificar permisos específicos
 * @param {string} permission - Nombre del permiso a verificar
 */
export const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuario no autenticado.' });
        }

        // El admin siempre tiene permiso a menos que se restrinja explícitamente
        if (req.user.rol === 'admin') {
            return next();
        }

        const permisos = req.user.permisos || {};
        
        // Si permisos es un string (guardado así en algunas versiones), lo parseamos
        let permsObj = permisos;
        if (typeof permisos === 'string') {
            try {
                permsObj = JSON.parse(permisos);
            } catch (e) {
                permsObj = {};
            }
        }

        if (permsObj[permission] === true) {
            return next();
        }

        return res.status(403).json({ error: `No tienes el permiso necesario: ${permission}` });
    };
};

/**
 * Middleware para prevenir IDOR (Insecure Direct Object Reference)
 * Verifica que un usuario solo acceda a recursos de su propia tienda
 */
export const checkTienda = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    // El admin puede ver cualquier tienda
    if (req.user.rol === 'admin') {
        return next();
    }

    // Obtener el tienda_id de diferentes fuentes posibles
    const tiendaIdRequested = req.params.tiendaId || req.params.id || req.query.tienda_id || req.body.tienda_id;
    
    // Si la petición no especifica tienda, pero el usuario NO es admin, 
    // forzamos su tienda_id en req.query para que las consultas SQL filtren por su sucursal (SEC-005)
    if (!tiendaIdRequested) {
        req.query.tienda_id = req.user.tienda_id;
        return next(); 
    }

    // Verificar coincidencia estricta
    if (String(tiendaIdRequested) === String(req.user.tienda_id)) {
        return next();
    }

    console.warn(`🛡️ Bloqueado intento de acceso IDOR: Usuario ${req.user.username} intentó acceder a Tienda ${tiendaIdRequested}`);
    return res.status(403).json({ 
        error: 'Acceso denegado. No tienes permisos para acceder a los datos de esta sucursal.' 
    });
};
