
import { useDispatch, useSelector } from "react-redux";
import {  addToCart, removeFromCart } from "../../features/cart/cartSlice";


const Counter = ({ productId }) => {
  // Obtener el estado del carrito desde Redux
  const { cartItems } = useSelector((state) => state.cart);

  // Inicializar el dispatch para ejecutar acciones
  const dispatch = useDispatch();
  

  // Función para aumentar la cantidad
  const addToCartHandler = () => {
    dispatch(addToCart({ productId }));
  };

  // Función para disminuir la cantidad
  const removeFromCartHandler = () => {
    dispatch(removeFromCart({ productId }));
  };

  return (
    <div className="inline-flex items-center gap-1 sm:gap-3 px-3 py-1 rounded border border-slate-200 max-sm:text-sm text-slate-600">
      {/* Botón para restar cantidad */}
      <button onClick={removeFromCartHandler} className="p-1 select-none">
        -
      </button>

      {/* Mostrar cantidad actual */}
      <p className="p-1">{cartItems[productId] ?? 0}</p>

      {/* Botón para sumar cantidad */}
      <button onClick={addToCartHandler} className="p-1 select-none">
        +
      </button>
    </div>
  );
};

export default Counter;
