import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, ShieldAlert, Delete, ArrowRight } from 'lucide-react';
import { authAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const PinValidationModal = ({ isOpen, onClose, onSuccess, title = "Autorización Requerida", actionType = "ACCION_GENERAL", entityId = null }) => {
    const { user: currentUser } = useAuth();
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');

            // Bypass if user is admin
            if (currentUser?.rol === 'admin') {
                onSuccess(); // Somete éxito inmediato
                onClose();
            }
        }
    }, [isOpen, currentUser, onSuccess, onClose]);

    // Keyboard support
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key >= '0' && e.key <= '9') {
                handleNumberClick(e.key);
            } else if (e.key === 'Backspace') {
                handleDelete();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, pin, loading]);

    const handleNumberClick = (num) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = async () => {
        // Allow submission from keyboard effect which might call this before state update in closure, 
        // but state 'pin' is in dependency array so it should be fine.
        // Actually, for the effect to work with latest state, we need to be careful.
        // The effect uses [pin] dependency so it recreates listener on change.
        if (pin.length < 4) {
            setError('El PIN debe tener 4 dígitos');
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.verifyPin(pin);

            // Log security action
            await authAPI.logSecurityAction({
                usuario_id: response.user.id,
                accion: actionType,
                descripcion: `Autorización exitosa por ${response.user.nombre} (${response.user.rol})`,
                entidad_id: entityId
            });

            toast.success("Autorización concedida");
            onSuccess(response.user); // Enviar datos del autorizador
            onClose();
        } catch (err) {
            setError(err.message || 'PIN Incorrecto');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container w-full max-w-sm rounded-[2.5rem] overflow-hidden p-0">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${error ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'} dark:bg-slate-700`}>
                                {error ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tighter">{title}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="text-center mb-8">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Ingrese 4 dígitos de seguridad</p>
                        <div className="flex justify-center gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${pin.length >= i
                                        ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-lg shadow-indigo-500/40'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'
                                        } ${error && pin.length === 0 ? 'border-rose-500 animate-shake' : ''}`}
                                >
                                    {pin.length >= i && (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {error && <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-4 animate-in fade-in slide-in-from-top-1">{error}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                onClick={() => handleNumberClick(num.toString())}
                                className="h-16 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-xl font-black text-slate-700 dark:text-white rounded-2xl transition-all active:scale-90 border dark:border-slate-700/50"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={handleDelete}
                            className="h-16 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-2xl flex items-center justify-center transition-all active:scale-90"
                        >
                            <Delete size={24} />
                        </button>
                        <button
                            onClick={() => handleNumberClick('0')}
                            className="h-16 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-xl font-black text-slate-700 dark:text-white rounded-2xl transition-all active:scale-90 border dark:border-slate-700/50"
                        >
                            0
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`h-16 flex items-center justify-center rounded-2xl transition-all active:scale-90 shadow-lg ${pin.length === 4
                                ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-300 pointer-events-none'
                                }`}
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight size={24} />}
                        </button>
                    </div>

                    <p className="text-[9px] text-center text-slate-300 dark:text-slate-600 font-bold uppercase tracking-[0.2em]">
                        Solo personal administrador
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PinValidationModal;
