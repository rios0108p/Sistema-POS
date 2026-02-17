// src/features/cart/cartSlice.js
import { createSlice } from "@reduxjs/toolkit";

const cartSlice = createSlice({
  name: "cart",
  initialState: {
    total: 0,       // Total de unidades en el carrito
    cartItems: {},  // Guardará los productos con su cantidad { productId: cantidad }
  },
  reducers: {
    // Agregar producto al carrito
    addToCart: (state, action) => {
      const { productId } = action.payload;
      if (state.cartItems[productId]) {
        state.cartItems[productId] += 1; // Si ya existe, aumenta la cantidad
      } else {
        state.cartItems[productId] = 1;  // Si no existe, lo agrega con cantidad 1
      }
      state.total += 1; // Incrementa el total general
    },

    // Quitar una unidad del producto
    removeFromCart: (state, action) => {
      const { productId } = action.payload;
      if (state.cartItems[productId]) {
        state.cartItems[productId] -= 1;
        if (state.cartItems[productId] <= 0) {
          delete state.cartItems[productId]; // Elimina si llega a 0
        }
        state.total -= 1;
      }
    },

    // Eliminar completamente un producto del carrito
    deleteItemFromCart: (state, action) => {
      const { productId } = action.payload;
      if (state.cartItems[productId]) {
        state.total -= state.cartItems[productId]; // Resta la cantidad total
        delete state.cartItems[productId];
      }
    },

    // Vaciar todo el carrito
    clearCart: (state) => {
      state.cartItems = {};
      state.total = 0;
    },
  },
});

// Exportar las acciones
export const { addToCart, removeFromCart, deleteItemFromCart, clearCart } =
  cartSlice.actions;

  

// Exportar el reducer
export default cartSlice.reducer;
