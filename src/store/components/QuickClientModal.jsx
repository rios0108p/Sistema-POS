import React, { useState } from 'react';
import { X, Save, User, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { clientesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function QuickClientModal({ isOpen, onClose, onSuccess }) {
    const { user } = useAuth();
    const isAdmin = user?.rol === 'admin';

    if (!isOpen) return null;

    const [formData, setFormData] = useState({
        nombre: '',
        telefono: '',
        email: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = await clientesAPI.create(formData);
            toast.success('Cliente creado rápidamente');
            onSuccess({ id: data.id, nombre: formData.nombre });
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('No se pudo crear el cliente');
        }
    };

    if (!isAdmin) {
        return (
            <div className="modal-overlay">
                <div className="modal-container w-full max-w-md text-center p-8">
                    <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tighter mb-2">Acceso Restringido</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">
                        Solo los <span className="text-rose-500 font-bold">Administradores</span> están autorizados para registrar nuevos clientes en la base de datos nacional.
                    </p>
                    <button
                        onClick={onClose}
                        className="btn-primary w-full py-3"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-container w-full max-w-md p-0 overflow-hidden">
                <div className="modal-header bg-slate-50 dark:bg-slate-900/50 p-4 border-b dark:border-slate-700/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tighter text-sm">
                        <User size={18} className="text-indigo-500" /> Registrar Cliente
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="label-standard">Nombre Completo *</label>
                        <input
                            required
                            className="input-standard"
                            value={formData.nombre}
                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            placeholder="Nombre del cliente"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label-standard">Teléfono</label>
                            <input
                                className="input-standard"
                                value={formData.telefono}
                                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                placeholder="Opcional"
                            />
                        </div>
                        <div>
                            <label className="label-standard">Email</label>
                            <input
                                type="email"
                                className="input-standard"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="Opcional"
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary w-full py-4 mt-2">
                        Sincronizar Cliente
                    </button>
                </form>
            </div>
        </div>
    );
}
