import React, { useState, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { X, Printer, Minus, Plus, Tag, Eye, Barcode as BarcodeIcon } from "lucide-react";
import Barcode from "react-barcode";
import { CURRENCY_SYMBOL } from "../../utils/currency";

const BarcodeTagGenerator = ({ isOpen, onClose, product }) => {
    const [quantity, setQuantity] = useState(1);
    const [showPreview, setShowPreview] = useState(true);
    const barcodeRef = useRef(null);
    const currency = CURRENCY_SYMBOL;

    if (!product) return null;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');

        // Obtener el SVG o Canvas generado del DOM de la vista previa
        const barcodeSvgString = barcodeRef.current ? barcodeRef.current.innerHTML : '';

        const labelsHtml = Array(quantity).fill(0).map(() => `
            <div class="label-container">
                <div class="product-name">${product.nombre || product.name || ''}</div>
                <div class="barcode-wrapper">
                    ${barcodeSvgString}
                </div>
                <div class="product-price">${currency}${parseFloat(product.precio_venta || product.mrp || 0).toFixed(2)}</div>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Etiquetas - ${product.nombre || product.name}</title>
                    <style>
                        @page {
                            margin: 0;
                        }
                        body {
                            margin: 10mm;
                            font-family: 'Inter', sans-serif;
                        }
                        .labels-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fill, 50mm);
                            gap: 5mm;
                            justify-content: center;
                        }
                        .label-container {
                            width: 50mm;
                            height: 38mm;
                            border: 0.1mm solid #eee;
                            padding: 2mm;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            text-align: center;
                            box-sizing: border-box;
                            page-break-inside: avoid;
                        }
                        .product-name {
                            font-size: 8pt;
                            font-weight: bold;
                            text-transform: uppercase;
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                        }
                        .barcode-wrapper svg {
                            max-width: 45mm;
                            max-height: 15mm;
                            width: 100%;
                            height: auto;
                        }
                        .product-price {
                            font-size: 10pt;
                            font-weight: 900;
                        }
                    </style>
                </head>
                <body>
                    <div class="labels-grid">
                        ${labelsHtml}
                    </div>
                    <script>
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container max-w-lg p-10 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20">
                            <BarcodeIcon className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">GENERADOR DE <span className="text-indigo-600">ETIQUETAS</span></h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">Impresión de códigos de barras bajo demanda</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 transition-all">
                        <X size={28} />
                    </button>
                </div>

                <div className="space-y-10">
                    {/* Preview Box */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center relative group">
                        <div className="absolute top-6 left-8 flex items-center gap-2">
                            <Eye size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">VISTA PREVIA DE IMPRESIÓN</span>
                        </div>

                        <div className="bg-white dark:bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center justify-between gap-4 w-56 h-48 border border-slate-100 transition-transform group-hover:scale-105 duration-500">
                            <p className="text-[10px] font-black text-black uppercase tracking-tighter text-center leading-tight line-clamp-2">
                                {product.nombre || product.name}
                            </p>
                            <div ref={barcodeRef} className="scale-75 origin-center -my-2 flex justify-center w-full overflow-hidden">
                                <Barcode
                                    value={product.codigo_barras || product.barcode || "123456"}
                                    width={1.5}
                                    height={45}
                                    fontSize={12}
                                    margin={0}
                                    background="transparent"
                                />
                            </div>
                            <p className="text-base font-black text-black tracking-tighter">
                                {currency}{parseFloat(product.precio_venta || product.mrp || 0).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="space-y-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block text-center opacity-60">CANTIDAD DE ETIQUETAS A GENERAR</label>
                        <div className="flex items-center justify-center gap-8">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90 shadow-sm"
                            >
                                <Minus size={24} />
                            </button>
                            <div className="flex flex-col items-center min-w-[3rem]">
                                <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                    {quantity}
                                </span>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Unidades</span>
                            </div>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all active:scale-90 shadow-sm"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button
                            onClick={onClose}
                            className="btn-secondary flex-1 h-[60px] text-[10px]"
                        >
                            CANCELAR
                        </button>
                        <button
                            onClick={handlePrint}
                            className="btn-primary flex-1 h-[60px] text-[10px] shadow-indigo-600/20"
                        >
                            <Printer size={20} />
                            PROCEDER A IMPRIMIR
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BarcodeTagGenerator;
