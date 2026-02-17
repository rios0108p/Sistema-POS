import React, { createContext, useState, useContext, useEffect } from 'react';
import { configuracionAPI, getImageUrl } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [turnoActivo, setTurnoActivo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [storeConfig, setStoreConfig] = useState({
        nombre_tienda: "Minisuper",
        logo: "",
        moneda: "$",
        ancho_ticket: "58mm",
        card_template: "vanguard",
        card_primary_color: "#4f46e5",
        card_secondary_color: "#3730a3",
        card_text_color: "#ffffff"
    });

    useEffect(() => {
        console.log("🛠️ AuthProvider inicializado");
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        const savedTurno = localStorage.getItem('turnoActivo');
        if (savedUser && token) {
            setUser(JSON.parse(savedUser));
        }
        if (savedTurno) {
            setTurnoActivo(JSON.parse(savedTurno));
        }
        fetchStoreConfig();
        setLoading(false);
    }, []);

    const fetchStoreConfig = async () => {
        try {
            const data = await configuracionAPI.get();
            if (data) {
                setStoreConfig({
                    ...data,
                    logoUrl: data.logo ? `${getImageUrl(data.logo)}?t=${new Date().getTime()}` : ''
                });
            }
        } catch (error) {
            console.error("Error fetching store config:", error);
        }
    };

    const login = (userData, token, turno = null) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        if (turno) {
            setTurnoActivo(turno);
            localStorage.setItem('turnoActivo', JSON.stringify(turno));
        }
    };

    const logout = () => {
        setUser(null);
        setTurnoActivo(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('turnoActivo');
    };

    const updateTurnoActivo = (turno) => {
        setTurnoActivo(turno);
        if (turno) {
            localStorage.setItem('turnoActivo', JSON.stringify(turno));
        } else {
            localStorage.removeItem('turnoActivo');
        }
    };

    const updateUser = (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    return (
        <AuthContext.Provider value={{
            user,
            turnoActivo,
            loading,
            storeConfig,
            login,
            logout,
            updateUser,
            updateTurnoActivo,
            fetchStoreConfig
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
