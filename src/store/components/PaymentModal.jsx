import { useState, useEffect } from 'react';
import { X, Plus, Trash2, DollarSign, CreditCard, Printer, RefreshCcw, Tag, Landmark, Zap, UserCheck, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function PaymentModal({ isOpen, onClose, total, onConfirm, isWholesale = false, loading = false, selectedCustomer = null, cartItemsCount = 0 }) {
    const { storeConfig } = useAuth();

    const [payments, setPayments] = useState([]);
    const [currentMethod, setCurrentMethod] = useState('Efectivo');
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const [mixedAmounts, setMixedAmounts] = useState({
        Efectivo: '',
        Tarjeta: '',
        Transferencia: '',
        Dólar: ''
    });

    const currency = storeConfig?.moneda_simbolo || '$';

    // Safely parse numbers to avoid NaN crashes
    const parseNum = (val) => {
        const n = parseFloat(val);
        return isNaN(n) ? 0 : n;
    };

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setPayments([]);
            setReference('');
            setCurrentMethod('Efectivo');
            setAmount(total.toFixed(2));
            setMixedAmounts({
                Efectivo: '',
                Tarjeta: '',
                Transferencia: '',
                Dólar: ''
            });
        }
    }, [isOpen, total]);

    // Calculate totals
    const totalPaidFromList = payments.reduce((acc, curr) => acc + parseNum(curr.monto), 0);

    const mixedTotal = Object.entries(mixedAmounts).reduce((acc, [method, val]) => {
        const numVal = parseNum(val);
        if (method === 'Dólar') {
            return acc + (numVal * (storeConfig?.precio_dolar || 18));
        }
        return acc + numVal;
    }, 0);

    const amountNum = parseNum(amount);
    const amountInMXN = currentMethod === 'Dólar' ? (amountNum * (storeConfig?.precio_dolar || 18)) : amountNum;

    const effectiveTotalPaid = currentMethod === 'Mixto'
        ? mixedTotal
        : (totalPaidFromList > 0 ? totalPaidFromList : amountInMXN);

    // Keyboard Hotkeys
    useEffect(() => {
        if (!isOpen || loading) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                // If it's a number input, only confirm if amount is sufficient
                const canConfirmCurrent = (currentMethod === 'Mixto' && mixedTotal >= total) || (totalPaidFromList >= total);
                const canConfirmSimpleCurrent = currentMethod !== 'Mixto' && totalPaidFromList === 0 && amountInMXN >= total;

                if (canConfirmCurrent || canConfirmSimpleCurrent) {
                    e.preventDefault();
                    if (e.ctrlKey) handleConfirm(true);
                    else handleConfirm(false);
                }
            } else if (e.key === 'F1') {
                e.preventDefault();
                handleConfirm(true);
            } else if (e.key === 'F2') {
                e.preventDefault();
                handleConfirm(false);
            } else if (e.key === 'F4') {
                e.preventDefault();
                document.getElementById('payment-reference')?.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, total, amount, payments, currentMethod, loading, mixedTotal, mixedAmounts, effectiveTotalPaid]);

    // Handle suggested amounts when switching methods
    useEffect(() => {
        if (currentMethod === 'Dólar') {
            const tc = storeConfig?.precio_dolar || 18;
            const currentBalance = totalPaidFromList > 0 ? (total - totalPaidFromList) : total;
            setAmount((currentBalance / tc).toFixed(2));
        } else if (currentMethod !== 'Mixto') {
            const currentBalance = totalPaidFromList > 0 ? (total - totalPaidFromList) : total;
            setAmount(currentBalance.toFixed(2));
        }
    }, [currentMethod, totalPaidFromList, total]);

    // MOVED AFTER ALL HOOKS
    if (!isOpen) return null;

    const handleConfirm = (shouldPrint = false) => {
        if (loading) return;

        const canConfirmCheck = (currentMethod === 'Mixto' && mixedTotal >= total) || (totalPaidFromList >= total);
        const canConfirmSimpleCheck = currentMethod !== 'Mixto' && totalPaidFromList === 0 && amountInMXN >= total;
        if (!canConfirmCheck && !canConfirmSimpleCheck) return;

        let finalPayments = [];

        if (currentMethod === 'Mixto') {
            Object.entries(mixedAmounts).forEach(([method, val]) => {
                const numVal = parseNum(val);
                if (numVal > 0) {
                    let finalMontoMXN = numVal;
                    let montoDolar = 0;
                    let tipoCambio = 1;
                    if (method === 'Dólar') {
                        tipoCambio = storeConfig?.precio_dolar || 18;
                        finalMontoMXN = numVal * tipoCambio;
                        montoDolar = numVal;
                    }
                    finalPayments.push({
                        metodo: method,
                        monto: finalMontoMXN,
                        monto_dolar: montoDolar,
                        tipo_cambio: tipoCambio,
                        referencia: ''
                    });
                }
            });
        } else if (payments.length > 0) {
            finalPayments = [...payments];
        } else {
            const val = parseNum(amount);
            if (val > 0) {
                let finalMontoMXN = val;
                let montoDolar = 0;
                let tipoCambio = 1;

                if (currentMethod === 'Dólar') {
                    tipoCambio = storeConfig?.precio_dolar || 18;
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

        const totalPaidCheck = finalPayments.reduce((acc, curr) => acc + parseNum(curr.monto), 0);
        if (totalPaidCheck < total) return;

        onConfirm(finalPayments, shouldPrint);
    };

    const canConfirm = (currentMethod === 'Mixto' && mixedTotal >= total) || (totalPaidFromList >= total);
    const canConfirmSimple = currentMethod !== 'Mixto' && totalPaidFromList === 0 && amountInMXN >= total;

    return (
        <div className="modal-overlay flex items-center justify-center bg-slate-900/60 backdrop-blur-md z-50 p-0 sm:p-4">
            {/* Main Wrapper - Compact & Professional */}
            <div className="bg-slate-50 dark:bg-slate-950 w-full sm:max-w-[1000px] h-full sm:h-[640px] sm:max-h-[90vh] rounded-none sm:rounded-[1.5rem] flex flex-col overflow-hidden shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] border-none sm:border dark:border-slate-800 animate-in zoom-in-95 duration-500">

                {/* Header Area */}
                <div className="bg-indigo-600 px-6 py-3 flex justify-between items-center shadow-lg relative overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-white/10 to-transparent"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-1.5 h-5 bg-white rounded-full"></div>
                        <h2 className="text-base font-black text-white tracking-[0.2em] uppercase">Liquidar Venta</h2>
                    </div>
                    <button onClick={onClose} disabled={loading} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all relative z-10">
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">

                    {/* MAIN AREA */}
                    <div className="flex-1 flex flex-col p-6 bg-white dark:bg-slate-900 border-r dark:border-slate-800 overflow-y-auto custom-scrollbar">

                        {/* 1. Large Total at Top */}
                        <div className="text-center mb-4 shrink-0">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] block mb-1 opacity-80">Total a Cobrar</span>
                            <span className="text-6xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter leading-none">
                                {currency}{total.toFixed(2)}
                            </span>
                        </div>

                        {/* 2. Payment Methods Row */}
                        <div className="flex justify-center gap-2 mb-6 border-b dark:border-slate-800 pb-6 flex-wrap shrink-0">
                            {[
                                { id: 'Efectivo', icon: DollarSign, label: 'Efectivo' },
                                { id: 'Dólar', icon: Landmark, label: 'Dólares' },
                                { id: 'Tarjeta', icon: CreditCard, label: 'Tarjeta' },
                                { id: 'Transferencia', icon: RefreshCcw, label: 'Transf.' },
                                { id: 'Crédito', icon: UserCheck, label: 'A Crédito', hidden: !selectedCustomer },
                                { id: 'Mixto', icon: Layers, label: 'Mixto' }
                            ].filter(m => !m.hidden).map(method => {
                                const isActive = currentMethod === method.id;
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => {
                                            setCurrentMethod(method.id);
                                            if (method.id !== 'Mixto') setPayments([]);
                                        }}
                                        className={`flex flex-col items-center gap-1.5 transition-all p-2.5 rounded-xl w-24 group ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-800 opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md transition-all ${isActive ? 'bg-indigo-600 text-white scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                            <method.icon size={24} strokeWidth={2.5} />
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>{method.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 3. Input & Calculation Area */}
                        <div className="flex-1 flex flex-col justify-start">
                            {currentMethod === 'Mixto' ? (
                                <div className="w-full max-w-xl mx-auto grid grid-cols-2 gap-3 pb-2">
                                    {[
                                        { id: 'Efectivo', label: 'EFECTIVO' },
                                        { id: 'Tarjeta', label: 'TARJETA' },
                                        { id: 'Transferencia', label: 'TRANSF.' },
                                        { id: 'Dólar', label: 'USD' }
                                    ].map(m => (
                                        <div key={m.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border-2 border-transparent focus-within:border-indigo-500 transition-all">
                                            <label className="text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest block opacity-80">{m.label}</label>
                                            <input
                                                type="number"
                                                value={mixedAmounts[m.id]}
                                                onChange={e => setMixedAmounts({ ...mixedAmounts, [m.id]: e.target.value })}
                                                className="w-full bg-transparent border-none text-3xl font-black text-slate-800 dark:text-white outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="w-full max-w-xl mx-auto flex flex-col items-center pb-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-5 rounded-[2rem] border-2 border-indigo-500/30 focus-within:border-indigo-500 transition-all text-center shadow-sm">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2 opacity-80">
                                                {currentMethod === 'Crédito' ? 'Cargar a Cuenta:' : 'Pagó Con:'}
                                            </label>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                className="w-full bg-transparent border-none text-5xl font-black text-slate-800 dark:text-white text-center outline-none tracking-tighter"
                                                placeholder="0.00"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-5 rounded-[2rem] border-2 border-transparent focus-within:border-indigo-500 transition-all text-center shadow-sm">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2 opacity-80">
                                                Referencia / Nota:
                                            </label>
                                            <input
                                                id="payment-reference"
                                                type="text"
                                                value={reference}
                                                onChange={e => setReference(e.target.value)}
                                                className="w-full bg-transparent border-none text-2xl font-black text-indigo-600 dark:text-indigo-400 text-center outline-none uppercase tracking-widest"
                                                placeholder="NINGUNA"
                                            />
                                        </div>
                                    </div>

                                    {currentMethod === 'Dólar' && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 w-full rounded-xl flex items-center justify-between mb-4 shadow-sm">
                                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">En Pesos:</span>
                                            <span className="text-xl font-black text-amber-700">${(parseNum(amount) * (storeConfig?.precio_dolar || 18)).toFixed(2)}</span>
                                        </div>
                                    )}

                                    <div className="flex flex-col items-center justify-center mt-2 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 w-full">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mb-2 ${effectiveTotalPaid >= total ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {effectiveTotalPaid >= total ? (currentMethod === 'Crédito' ? 'Diferido' : 'Cambio') : 'Faltante'}
                                        </span>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-5xl font-black tracking-tighter ${effectiveTotalPaid >= total ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {currency}{Math.abs(effectiveTotalPaid - total).toFixed(2)}
                                            </span>
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${effectiveTotalPaid >= total ? 'bg-emerald-600' : 'bg-rose-600'} text-white shadow-lg`}>
                                                {effectiveTotalPaid >= total ? <CheckCircle size={24} strokeWidth={3} /> : <AlertTriangle size={24} strokeWidth={3} />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SIDEBAR (Action Buttons) */}
                    <div className="w-[280px] bg-slate-100 dark:bg-slate-950 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar shrink-0">

                        {/* Status / Customer Area */}
                        <div className="mb-4">
                            {selectedCustomer ? (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border-2 border-indigo-600 shadow-md">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                                            <UserCheck size={16} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-none mb-0.5">Cliente</span>
                                            <span className="text-xs font-black text-slate-800 dark:text-white truncate block">{selectedCustomer.nombre}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-2 border-t dark:border-slate-800 border-dashed">
                                        <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase">
                                            <span>Límite</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-black">{currency}{parseNum(selectedCustomer.limite_credito).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase">
                                            <span>Deuda</span>
                                            <span className="text-rose-500 font-black">{currency}{parseNum(selectedCustomer.saldo_deudor).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t dark:border-slate-800 border-dashed mt-1">
                                            <span className="text-[9px] font-black text-indigo-600 uppercase">Disp.</span>
                                            <span className="text-sm font-black text-emerald-500">
                                                {currency}{(parseNum(selectedCustomer.limite_credito) - parseNum(selectedCustomer.saldo_deudor)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-200 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-2 opacity-80 min-h-[100px]">
                                    <UserCheck size={28} className="text-slate-400" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Venta al Público<br />(Sin Crédito)</span>
                                </div>
                            )}
                        </div>

                        {/* Actions Area */}
                        <div className="flex flex-col gap-3 flex-1 justify-center">
                            <button
                                onClick={() => handleConfirm(true)}
                                disabled={loading || (!canConfirm && !canConfirmSimple)}
                                className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all
                                    ${(canConfirm || canConfirmSimple) && !loading
                                        ? 'bg-white dark:bg-slate-900 border-indigo-600/40 text-slate-800 dark:text-white shadow-md hover:-translate-y-0.5 hover:border-indigo-600'
                                        : 'opacity-50 grayscale cursor-not-allowed border-transparent text-slate-400 bg-slate-50/50 dark:bg-slate-900'}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    {loading ? (
                                        <RefreshCcw size={20} className="text-indigo-600 animate-spin" />
                                    ) : (
                                        <Printer size={20} className="text-indigo-600" />
                                    )}
                                    <span className="font-black text-sm uppercase tracking-widest">
                                        {loading ? 'Procesando...' : 'F1 - Cobrar'}
                                    </span>
                                </div>
                                <span className="text-[9px] opacity-60 font-medium uppercase tracking-widest italic">Con Ticket</span>
                            </button>

                            <button
                                onClick={() => handleConfirm(false)}
                                disabled={loading || (!canConfirm && !canConfirmSimple)}
                                className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all
                                    ${(canConfirm || canConfirmSimple) && !loading
                                        ? 'bg-white dark:bg-slate-900 border-amber-600/40 text-slate-800 dark:text-white shadow-md hover:-translate-y-0.5 hover:border-amber-600'
                                        : 'opacity-50 grayscale cursor-not-allowed border-transparent text-slate-400 bg-slate-50/50 dark:bg-slate-900'}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    {loading ? (
                                        <RefreshCcw size={20} className="text-amber-500 animate-spin" />
                                    ) : (
                                        <Zap size={20} className="text-amber-500 fill-amber-500" />
                                    )}
                                    <span className="font-black text-sm uppercase tracking-widest">
                                        {loading ? 'Preparando...' : 'F2 - Cobrar'}
                                    </span>
                                </div>
                                <span className="text-[9px] opacity-60 font-medium uppercase tracking-widest italic">Sin Ticket</span>
                            </button>
                        </div>

                        {/* Footer / Cancel */}
                        <div className="mt-3 flex gap-2 h-14 shrink-0">
                            <div className="flex-1 bg-slate-900 dark:bg-indigo-700 rounded-xl text-white flex flex-col justify-center items-center px-2 relative overflow-hidden">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70 z-10 w-full text-center">Arts.</span>
                                <span className="text-2xl font-black leading-none z-10">{cartItemsCount}</span>
                                <Layers size={40} className="absolute -right-2 -bottom-2 opacity-10" />
                            </div>

                            <button
                                onClick={onClose}
                                className="flex-1 flex flex-col items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all text-slate-700 dark:text-white group"
                            >
                                <span className="font-black text-[10px] uppercase tracking-widest group-hover:text-rose-600 mb-0.5">Cancelar</span>
                                <span className="text-[8px] opacity-50 uppercase tracking-widest leading-none">ESC</span>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

const parseNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
};
