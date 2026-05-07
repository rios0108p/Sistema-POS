import React, { createContext, useState, useContext, useEffect } from 'react';
import { configuracionAPI, getImageUrl } from '../services/api';
import { saveLastAuth, getLastAuth, verifyPassword } from '../utils/authUtils';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [turnoActivo, setTurnoActivo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [storeConfig, setStoreConfig] = useState({
        nombre_tienda: "POST",
        logo: "",
        moneda: "$",
        ancho_ticket: "58mm",
        card_template: "vanguard",
        card_primary_color: "#4f46e5",
        card_secondary_color: "#3730a3",
        card_text_color: "#ffffff"
    });

    useEffect(() => {
        const controller = new AbortController();
        console.log("🛠️ AuthProvider inicializado");
        
        const initAuth = async () => {
            const savedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            const savedTurno = localStorage.getItem('turnoActivo');
            const wasOffline = localStorage.getItem('isOfflineMode') === 'true';

            if (savedUser && token) {
                try {
                    const parsedUser = JSON.parse(savedUser);
                    if (!parsedUser.sessionStart) {
                        parsedUser.sessionStart = new Date().toISOString();
                    }
                    // Ensure permissions are always an object
                    if (typeof parsedUser.permisos === 'string') {
                        try { parsedUser.permisos = JSON.parse(parsedUser.permisos); } catch(e) { parsedUser.permisos = {}; }
                    }
                    parsedUser.permisos = parsedUser.permisos || {};
                    
                    setUser(parsedUser);
                    setIsOfflineMode(wasOffline);
                } catch (e) {
                    console.error("❌ Error parseando usuario:", e);
                    logout();
                }
            }
            if (savedTurno) {
                setTurnoActivo(JSON.parse(savedTurno));
            }

            try {
                await fetchStoreConfig(controller.signal);
            } finally {
                setLoading(false);
                console.log("🏁 Auth loading finalizado");
            }
        };

        initAuth();
        return () => controller.abort();
    }, []);

    const fetchStoreConfig = async (signal) => {
        try {
            const data = await configuracionAPI.get({ signal });
            if (data) {
                setStoreConfig({
                    ...data,
                    logoUrl: data.logo ? `${getImageUrl(data.logo)}?t=${new Date().getTime()}` : ''
                });
            }
        } catch (error) {
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                console.error("Error fetching store config:", error);
            }
        }
    };

    const login = async (userData, token, turno = null, password = null) => {
        const userWithSession = { ...userData, sessionStart: new Date().toISOString() };
        setUser(userWithSession);
        setIsOfflineMode(false);

        localStorage.setItem('user', JSON.stringify(userWithSession));
        localStorage.setItem('token', token);
        localStorage.setItem('isOfflineMode', 'false');

        // Save for future offline access if password is provided
        if (password) {
            const userNameToSave = userData.username || userData.nombre_usuario;
            await saveLastAuth(userNameToSave, password, userData, token);
        }

        if (turno) {
            setTurnoActivo(turno);
            localStorage.setItem('turnoActivo', JSON.stringify(turno));
        }

        // Populate local SQLite on first login so offline mode has data
        if (window.electronAPI?.sync?.full) {
            setTimeout(() => {
                window.electronAPI.sync.full(token)
                    .then(() => window.dispatchEvent(new CustomEvent('pos:sync-complete')))
                    .catch(() => {});
            }, 1500);
        }
    };

    const loginOffline = async (username, password) => {
        const lastAuth = getLastAuth();
        
        if (!lastAuth) {
            throw new Error("Se requiere conexión para el primer inicio de sesión");
        }

        if (!lastAuth.username || lastAuth.username.toLowerCase() !== username.toLowerCase()) {
            throw new Error("No hay datos guardados para este usuario offline");
        }

        const isValid = await verifyPassword(password, lastAuth.passwordHash);
        if (!isValid) {
            throw new Error("Contraseña incorrecta (Modo Offline)");
        }

        // Login successful offline
        const userWithSession = { 
            ...lastAuth.userData, 
            sessionStart: new Date().toISOString(),
            isOffline: true 
        };
        
        setUser(userWithSession);
        setIsOfflineMode(true);
        localStorage.setItem('user', JSON.stringify(userWithSession));
        localStorage.setItem('token', lastAuth.token);
        localStorage.setItem('isOfflineMode', 'true');
        
        return { user: userWithSession, token: lastAuth.token };
    };

    const updateUser = (data) => {
        setUser(prev => {
            const updated = { ...prev, ...data };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
    };

    const logout = () => {
        setUser(null);
        setTurnoActivo(null);
        setIsOfflineMode(false);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('turnoActivo');
        localStorage.removeItem('isOfflineMode');
    };

    const updateTurnoActivo = (turno) => {
        setTurnoActivo(turno);
        if (turno) {
            localStorage.setItem('turnoActivo', JSON.stringify(turno));
        } else {
            localStorage.removeItem('turnoActivo');
        }
    };

    const hasPermission = (permission) => {
        if (!user) return false;

        // Determinar permisos base (Admin suele tener casi todo)
        const isAdmin = user.rol === 'admin';

        // Parsear permisos si es necesario (ya debería estar parseado desde el login)
        const perms = user.permisos || {};

        // Si el permiso está explícitamente desactivado (false), retornamos false
        if (perms[permission] === false) return false;

        // Si el permiso está explícitamente activado (true), retornamos true
        if (perms[permission] === true) return true;

        // Fallback: Admin tiene permiso por defecto si no es explícitamente false
        // Otros roles NO tienen permiso si no es explícitamente true
        return isAdmin;
    };

    return (
        <AuthContext.Provider value={{
            user,
            turnoActivo,
            loading,
            isOfflineMode,
            storeConfig,
            login,
            loginOffline,
            logout,
            updateUser,
            updateTurnoActivo,
            fetchStoreConfig,
            hasPermission
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
