import { useState, useEffect } from 'react';
import { X, Plus, Trash2, DollarSign, CreditCard, Printer, RefreshCcw, Tag, Landmark, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function PaymentModal({ isOpen, onClose, total, onConfirm, isWholesale = false, loading = false }) {
    const { storeConfig } = useAuth();
    if (!isOpen) return null;

    const [payments, setPayments] = useState([]);
    const [currentMethod, setCurrentMethod] = useState('Efectivo');
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState(''); // For card auth code

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setPayments([]);
            setReference('');
            setCurrentMethod('Efectivo');
            setAmount(total.toFixed(2));
        }
    }, [isOpen, total]);

    const totalPaid = Math.round(payments.reduce((acc, curr) => acc + parseFloat(curr.monto), 0) * 100) / 100;
    const remaining = Math.round(Math.max(0, total - totalPaid) * 100) / 100;

    // Handle currency conversion suggestions
    useEffect(() => {
        if (currentMethod === 'Dólar') {
            const tc = storeConfig?.precio_dolar || 20;
            const suggestedUSD = (remaining / tc).toFixed(2);
            setAmount(suggestedUSD);
        } else if (payments.length === 0) {
            setAmount(total.toFixed(2));
        } else {
            setAmount(remaining.toFixed(2));
        }
    }, [currentMethod]);

    // Keyboard Hotkeys
    useEffect(() => {
        if (!isOpen || loading) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Check if current state allows confirmation
                const totalPaidNow = payments.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
                const canConfirmCurrent = payments.length > 0 && totalPaidNow >= total;
                const canConfirmSimpleCurrent = payments.length === 0 && parseFloat(amount || 0) >= total;

                if (canConfirmCurrent || canConfirmSimpleCurrent) {
                    if (e.ctrlKey) handleConfirm(true); // Ctrl+Enter: Print & Complete
                    else handleConfirm(false); // Enter: Just Save (No Ticket)
                } else {
                    handleAddPayment(); // Otherwise add as partial
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, total, amount, payments, currentMethod, loading]);

    // Auto-fill amount with remaining if payments list changes
    useEffect(() => {
        if (remaining > 0 && payments.length > 0) {
            setAmount(remaining.toFixed(2));
        }
    }, [totalPaid]);

    const handleAddPayment = () => {
        if (loading) return;
        const val = parseFloat(amount);
        if (!val || val <= 0) return;

        let finalMontoMXN = val;
        let montoDolar = 0;
        let tipoCambio = 1;

        if (currentMethod === 'Dólar') {
            tipoCambio = storeConfig?.precio_dolar || 20;
            finalMontoMXN = val * tipoCambio;
            montoDolar = val;
        }

        setPayments([...payments, {
            metodo: currentMethod,
            monto: finalMontoMXN,
            monto_dolar: montoDolar,
            tipo_cambio: tipoCambio,
            referencia: reference
        }]);

        setReference('');
        setAmount('');
    };

    const removePayment = (index) => {
        if (loading) return;
        const newPayments = [...payments];
        newPayments.splice(index, 1);
        setPayments(newPayments);
    };

    const handleConfirm = (shouldPrint = false) => {
        if (loading) return;
        let finalPayments = [...payments];

        // If single payment (implicit) and amount is valid
        if (finalPayments.length === 0) {
            const val = parseFloat(amount);
            if (val > 0) {
                let finalMontoMXN = val;
                let montoDolar = 0;
                let tipoCambio = 1;

                if (currentMethod === 'Dólar') {
                    tipoCambio = storeConfig?.precio_dolar || 20;
                    finalMontoMXN = val * tipoCambio;
                    montoDolar = val;
                }

                finalPayments = [{
                    metodo: currentMethod,
                    monto: finalMontoMXN,
                    monto_dolar: montoDolar,
                    tipo_cambio: tipoCambio,
                    referencia: reference
                }];
            }
        }

        const totalPaidCheck = finalPayments.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
        if (totalPaidCheck < total) return;

        onConfirm(finalPayments, shouldPrint);
    };

    const canConfirm = payments.length > 0 && totalPaid >= total;
    const canConfirmSimple = payments.length === 0 && parseFloat(amount || 0) >= total;

    return (
        <div className="modal-overlay">
            <div className="modal-container max-w-5xl h-[90vh] flex flex-col p-0">
                {/* Header */}
                <div className="modal-header p-6 md:p-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-2">
                            Cobrar Venta
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-1 bg-indigo-600 rounded-full"></span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Liquidación de Ticket</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={loading} className={`w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all text-slate-400 hover:text-rose-500 hover:rotate-90 active:scale-90 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <X size={24} strokeWidth={3} />
                    </button>
                </div>

                <div className="px-6 md:px-8 pb-6 md:pb-8 flex-1 overflow-y-auto mt-2 md:mt-4 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start h-full">

                        {/* LEFT COLUMN: TOTAL & METHODS */}
                        <div className="space-y-6 md:space-y-8 lg:sticky lg:top-0">
                            {/* Total Display */}
                            <div className="card-standard p-8 md:p-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border-none text-center shadow-2xl shadow-indigo-500/30 overflow-hidden relative">
                                <div className="absolute -top-24 -right-24 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
                                <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-400/20 rounded-full blur-3xl"></div>

                                <span className="relative z-10 text-[10px] font-black text-indigo-200 uppercase tracking-[0.4em] block mb-3 opacity-80">Monto Total a Liquidar</span>
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    <span className="text-sm font-black text-indigo-300/80 mb-auto mt-2">$</span>
                                    <span className="text-7xl font-black text-white tracking-tighter drop-shadow-lg leading-none">{total.toFixed(2)}</span>
                                    <span className="text-[10px] font-black text-indigo-300 mt-auto mb-4 uppercase tracking-[0.2em] bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">MXN</span>
                                </div>
                            </div>

                            {isWholesale && (
                                <div className="bg-amber-100 dark:bg-amber-900/30 py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-amber-200 dark:border-amber-800/50">
                                    <Tag className="text-amber-600 dark:text-amber-400" size={14} />
                                    <span className="text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest">Precio Especial de Mayoreo Aplicado</span>
                                </div>
                            )}

                            {/* Payment Method Selection */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 px-1">Selecciona Método</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'Efectivo', icon: DollarSign, color: 'emerald', label: 'Efectivo' },
                                        { id: 'Tarjeta', icon: CreditCard, color: 'blue', label: 'Tarjeta' },
                                        { id: 'Transferencia', icon: RefreshCcw, color: 'purple', label: 'Transf.' },
                                        { id: 'Dólar', icon: Landmark, color: 'amber', label: 'Dólares (USD)' }
                                    ].map(method => (
                                        <button
                                            key={method.id}
                                            disabled={loading}
                                            onClick={() => setCurrentMethod(method.id)}
                                            className={`relative p-5 rounded-[2rem] border-2 flex items-center gap-4 transition-all duration-300 group overflow-hidden
                                                ${currentMethod === method.id
                                                    ? `border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-xl shadow-indigo-600/10`
                                                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${currentMethod === method.id
                                                ? `bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110`
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                                }`}>
                                                <method.icon size={22} strokeWidth={2.5} />
                                            </div>
                                            <span className={`font-black text-[11px] uppercase tracking-wider transition-colors ${currentMethod === method.id ? 'text-indigo-900 dark:text-white' : 'text-slate-500'}`}>
                                                {method.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: INPUTS & ACTIONS */}
                        <div className="space-y-6 md:space-y-8 h-full flex flex-col">
                            {/* Amount Input */}
                            <div className="card-standard p-8 border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-800/40">
                                <div className="space-y-6">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 block text-center">
                                            {currentMethod === 'Dólar' ? 'Monto en Dólares (USD)' : 'Importe a Recibir'}
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-black text-indigo-500/50 group-focus-within:text-indigo-600 transition-colors">
                                                {currentMethod === 'Dólar' ? <Landmark size={28} /> : <DollarSign size={28} />}
                                            </div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                disabled={loading}
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddPayment()}
                                                className="w-full px-8 py-7 pl-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus:border-indigo-600 rounded-[2rem] text-5xl font-black text-slate-800 dark:text-white outline-none transition-all shadow-inner text-center tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed"
                                                placeholder="0.00"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {(currentMethod === 'Tarjeta' || currentMethod === 'Transferencia') && (
                                        <div className="animate-in zoom-in-95 duration-200">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block px-1">
                                                {currentMethod === 'Tarjeta' ? 'Núm. de Autorización' : 'Concepto de Transferencia'}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    disabled={loading}
                                                    value={reference}
                                                    onChange={e => setReference(e.target.value)}
                                                    className="input-standard py-4 uppercase placeholder:normal-case disabled:opacity-50 disabled:cursor-not-allowed"
                                                    placeholder={currentMethod === 'Tarjeta' ? "0000" : "EJ. TRANSFERENCIA COPPEL"}
                                                    maxLength={20}
                                                />
                                                <Tag className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                            </div>
                                        </div>
                                    )}

                                    {currentMethod === 'Dólar' && (
                                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                                            <p className="text-[11px] font-black text-amber-600 dark:text-amber-400 flex items-center justify-between uppercase tracking-widest">
                                                <span>Equivalente MXN</span>
                                                <span className="text-xl tracking-tighter font-black">${(parseFloat(amount || 0) * (storeConfig?.precio_dolar || 20)).toFixed(2)}</span>
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleAddPayment}
                                        disabled={loading || !parseFloat(amount || 0)}
                                        className={`btn-primary w-full py-5 rounded-[1.5rem] tracking-[0.2em] gap-3
                                            ${(parseFloat(amount || 0) > 0 && !loading) ? '' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed hover:bg-slate-100'}`}
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                        {payments.length === 0 ? 'Iniciar Pago Parcial' : 'Agregar Método Adicional'}
                                    </button>
                                </div>
                            </div>

                            {/* Summary & Confirm Area */}
                            <div className="flex-1 flex flex-col justify-end space-y-4">
                                {/* Payment List */}
                                {payments.length > 0 && (
                                    <div className="card-standard p-4 max-h-[160px] overflow-y-auto custom-scrollbar">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Resumen de Abonos</h4>
                                        <div className="space-y-2">
                                            {payments.map((p, idx) => (
                                                <div key={idx} className="flex justify-between items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                        <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 font-mono tracking-tighter">{p.metodo}</span>
                                                        {p.referencia && <span className="text-[10px] font-bold text-indigo-400/60 font-mono tracking-widest">{p.referencia}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm font-black text-indigo-900 dark:text-white font-mono">${p.monto.toFixed(2)}</span>
                                                        <button onClick={() => removePayment(idx)} disabled={loading} className={`text-indigo-300 hover:text-rose-500 transition-colors ${loading ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Calculation Footer */}
                                <div className="card-standard p-5 border-2 flex justify-between items-center gap-4 bg-white dark:bg-slate-900/50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Monto Pagado</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xs font-black text-slate-400">$</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">
                                                {(totalPaid + (payments.length === 0 ? (currentMethod === 'Dólar' ? (parseFloat(amount || 0) * (storeConfig?.precio_dolar || 20)) : parseFloat(amount || 0)) : 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {(totalPaid + (payments.length === 0 ? (currentMethod === 'Dólar' ? (parseFloat(amount || 0) * (storeConfig?.precio_dolar || 20)) : parseFloat(amount || 0)) : 0)) >= total ? (
                                        <div className="flex flex-col items-end group">
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
                                                <Zap size={10} className="fill-emerald-500" /> Cambio Entregar
                                            </span>
                                            <span className="text-5xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter group-hover:scale-110 transition-transform leading-none">
                                                ${((totalPaid + (payments.length === 0 ? (currentMethod === 'Dólar' ? (parseFloat(amount || 0) * (storeConfig?.precio_dolar || 20)) : parseFloat(amount || 0)) : 0)) - total).toFixed(2)}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Faltante</span>
                                            <span className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tighter leading-none">
                                                {(total - (totalPaid + (payments.length === 0 ? (currentMethod === 'Dólar' ? (parseFloat(amount || 0) * (storeConfig?.precio_dolar || 20)) : parseFloat(amount || 0)) : 0))).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Buttons */}
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => handleConfirm(false)}
                                        disabled={loading || (!canConfirm && !canConfirmSimple)}
                                        className={`btn-primary py-7 rounded-[2.5rem] flex items-center justify-center gap-4 shadow-xl shadow-indigo-600/30
                                            ${(canConfirm || canConfirmSimple) && !loading ? 'bg-gradient-to-r from-indigo-600 to-indigo-700' : 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800'}`}
                                    >
                                        {loading ? (
                                            <RefreshCcw size={22} className="animate-spin" />
                                        ) : (
                                            <div className="bg-white/20 p-2 rounded-xl">
                                                <Zap size={22} strokeWidth={3} className="fill-white" />
                                            </div>
                                        )}
                                        <span className="text-[13px] tracking-widest">{loading ? 'PROCESANDO...' : 'FINALIZAR (ENTER)'}</span>
                                    </button>

                                    <button
                                        onClick={() => handleConfirm(true)}
                                        disabled={loading || (!canConfirm && !canConfirmSimple)}
                                        className={`btn-secondary py-4 rounded-[2rem] flex items-center justify-center gap-4 tracking-[0.15em]
                                            ${(canConfirm || canConfirmSimple) && !loading ? 'text-slate-600' : 'text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed'}`}
                                    >
                                        <Printer size={18} className={(canConfirm || canConfirmSimple) && !loading ? "text-indigo-500" : ""} />
                                        <span>FINALIZAR E IMPRIMIR (CTRL+ENTER)</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
