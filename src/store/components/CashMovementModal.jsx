import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Save } from 'lucide-react';
import { gastosAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { printMovementTicket } from '../../utils/printUtils';

export default function CashMovementModal({ isOpen, onClose, type = 'SALIDA', turnoId, tiendaId }) {
    const { user } = useAuth();
    const [monto, setMonto] = useState('');
    const [comentario, setComentario] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMonto('');
            setComentario('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isExit = type === 'SALIDA';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!monto || parseFloat(monto) <= 0) {
            return toast.error("Ingrese un monto válido");
        }

        setLoading(true);
        try {
            await gastosAPI.create({
                tienda_id: tiendaId,
                usuario_id: user?.id,
                turno_id: turnoId,
                monto: parseFloat(monto),
                descripcion: comentario,
                categoria: isExit ? 'SALIDA CAJA' : 'ENTRADA CAJA',
                tipo: type, // Adding tipo for future proofing
                fecha: new Date().toISOString().split('T')[0]
            });

            // Imprimir Ticket
            await printMovementTicket({
                tipo: type,
                monto: monto,
                descripcion: comentario,
                usuario_nombre: user?.nombre_usuario || user?.username || 'Administrador',
                tienda: { nombre_tienda: 'SISTEMA POS' }, // Fallback if needed
                sucursal: null // Will fetch from printTicket context if needed
            });

            toast.success(isExit ? "Salida registrada" : "Entrada registrada");
            onClose();
        } catch (error) {
            toast.error("Error al registrar movimiento");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay flex items-center justify-center bg-slate-900/60 backdrop-blur-md z-[60] p-4">
            <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-[2rem] flex flex-col overflow-hidden shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className={`${isExit ? 'bg-rose-600' : 'bg-emerald-600'} px-8 py-4 flex justify-between items-center shrink-0`}>
                    <div className="flex items-center gap-3">
                        {isExit ? <TrendingDown className="text-white" size={24} /> : <TrendingUp className="text-white" size={24} />}
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-widest">{isExit ? 'Salida de Efectivo' : 'Entrada de Efectivo'}</h2>
                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{isExit ? 'F7 - Registrar Egreso' : 'F8 - Registrar Ingreso'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="label-standard mb-2">Cantidad de dinero ($) *</label>
                        <div className="relative">
                            <DollarSign className={`absolute left-4 top-1/2 -translate-y-1/2 ${isExit ? 'text-rose-500' : 'text-emerald-500'}`} size={24} />
                            <input
                                autoFocus
                                required
                                type="number"
                                step="0.01"
                                className={`input-standard pl-12 h-16 text-3xl font-black ${isExit ? 'text-rose-600' : 'text-emerald-600'}`}
                                placeholder="0.00"
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label-standard mb-2">Comentario / Motivo</label>
                        <textarea
                            className="input-standard h-24 py-4 resize-none font-bold text-sm"
                            placeholder="EJ: PAGO A PROVEEDOR, MÁS CAMBIO EN CAJA, ETC..."
                            value={comentario}
                            onChange={e => setComentario(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-white font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50
                                ${isExit ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}
                        >
                            {loading ? 'REGISTRANDO...' : (
                                <>
                                    <Save size={20} strokeWidth={3} />
                                    CONFIRMAR MOVIMIENTO
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                    >
                        Cancelar (ESC)
                    </button>
                </form>
            </div>
        </div>
    );
}
