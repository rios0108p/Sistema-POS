import { useState } from "react";
import AddressModal from "./AddressModal";
import { Pencil, MapPin, CheckCircle, Package, Clock, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { pedidosAPI } from "../../services/api";
import { useDispatch } from "react-redux";
import { clearCart } from "../../features/cart/cartSlice";
import { CURRENCY_SYMBOL } from "../../utils/currency";

// Recibimos totalPrice e items desde el componente Cart.jsx
const OrderSummary = ({ totalPrice, items, onConfirm }) => {
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [address, setAddress] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [orderConfirmed, setOrderConfirmed] = useState(false);
    const [orderDetails, setOrderDetails] = useState(null);

    const dispatch = useDispatch();
    const currency = CURRENCY_SYMBOL;

    // Simplificamos: Los valores ya vienen calculados del padre
    const subtotal = totalPrice;
    const envio = 0; // Envío gratis
    const total = subtotal + envio;
    const productosDetallados = items;

    const crearPedidoEnAPI = async (pedidoData) => {
        try {
            const response = await pedidosAPI.create(pedidoData);
            return response;
        } catch (error) {
            console.error("Error al crear pedido:", error);
            throw error;
        }
    };

    const handlePlaceOrder = async () => {
        if (!address) {
            toast.error("Por favor agrega una dirección antes de realizar el pedido.");
            return;
        }

        if (productosDetallados.length === 0) {
            toast.error("El carrito está vacío.");
            return;
        }

        setIsLoading(true);

        try {
            const pedidoData = {
                nombre_cliente: address.name,
                email_cliente: address.email,
                telefono_cliente: address.phone,
                direccion_envio: address.address,
                total,
                subtotal,
                envio,
                metodo_pago: "Contra entrega",
                estado: "pendiente",
                productos: productosDetallados.map(p => ({
                    producto_id: p.id,
                    cantidad: p.quantity,
                    precio_unitario: p.precioFinal
                }))
            };

            const pedidoCreado = await crearPedidoEnAPI(pedidoData);

            setOrderDetails({
                id: pedidoCreado.id,
                numero: pedidoCreado.id.toString().slice(0, 8).toUpperCase(),
                fecha: new Date().toLocaleDateString('es-GT'),
                hora: new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
                total: total
            });

            toast.success("¡Pedido confirmado!");

            // Limpiar carrito en Redux
            dispatch(clearCart());

            // Opcional: Ejecutar callback del padre si existe
            if (onConfirm) onConfirm();

            setOrderConfirmed(true);

        } catch (error) {
            toast.error(`Error al realizar el pedido: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Pantalla de Éxito
    if (orderConfirmed && orderDetails) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-md space-y-8 border border-slate-100">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">¡Pedido Confirmado!</h1>
                    <p className="text-slate-600 mb-6">Hemos recibido tu pedido con éxito.</p>
                </div>

                <div className="border border-green-200 bg-green-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Package size={20} /> Resumen de tu pedido
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Número de pedido:</span>
                            <span className="font-mono font-bold text-slate-800">{orderDetails.numero}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-4">
                            <span>Total pagado:</span>
                            <span className="text-green-600">{currency} {orderDetails.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 transition"
                >
                    Volver a la tienda
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto bg-white p-6 rounded-xl shadow-md space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Resumen del Pedido</h2>

            {/* Lista de productos */}
            <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Productos ({productosDetallados.length})
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-3">
                    {productosDetallados.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <img
                                    src={item.images?.[0] || "/default-image.png"}
                                    alt={item.name}
                                    className="w-10 h-10 object-cover rounded bg-slate-50"
                                />
                                <div className="flex flex-col">
                                    <p className="font-medium text-slate-800 text-sm line-clamp-1">{item.name}</p>
                                    <p className="text-slate-500 text-xs">
                                        {currency}{item.precioFinal.toFixed(2)} x {item.quantity}
                                    </p>
                                </div>
                            </div>
                            <p className="font-semibold text-sm">
                                {currency}{(item.precioFinal * item.quantity).toFixed(2)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dirección */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={16} /> Entrega
                </h3>
                {!address ? (
                    <button
                        onClick={() => setShowAddressModal(true)}
                        className="w-full bg-blue-100 text-slate-500 py-3 rounded-lg text-sm "
                    >
                        + Agregar dirección de envío
                    </button>
                ) : (
                    <div className="bg-slate-50 p-3 rounded-lg relative group">
                        <p className="font-bold text-sm text-slate-800">{address.name}</p>
                        <p className="text-xs text-slate-600 line-clamp-2">{address.address}</p>
                        <button
                            onClick={() => setShowAddressModal(true)}
                            className="text-blue-600 text-xs font-bold mt-2 flex items-center gap-1"
                        >
                            <Pencil size={12} /> Editar
                        </button>
                    </div>
                )}
            </div>

            {/* Totales */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-slate-600 text-sm">
                    <span>Subtotal</span>
                    <span>{currency} {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-sm">
                    <span>Envío</span>
                    <span className="text-green-600 font-medium">Gratis</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-slate-900 font-bold text-lg">
                    <span>Total</span>
                    <span>{currency} {total.toFixed(2)}</span>
                </div>
            </div>

            <button
                onClick={handlePlaceOrder}
                disabled={isLoading || !address || productosDetallados.length === 0}
                className="w-full bg-slate-800 text-white py-4 rounded-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-slate-200"
            >
                {isLoading ? "Procesando..." : "Confirmar Pedido"}
            </button>

            {showAddressModal && (
                <AddressModal
                    setShowAddressModal={setShowAddressModal}
                    onSaveAddress={setAddress}
                    existingAddress={address}
                />
            )}
        </div>
    );
};

export default OrderSummary;