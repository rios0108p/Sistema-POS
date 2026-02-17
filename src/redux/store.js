// src/redux/store.js
import { configureStore } from "@reduxjs/toolkit";
import productReducer from "./productSlice"; 
import cartReducer from "../features/cart/cartSlice";
import ratingReducer from "../features/rating/ratingSlice";


export const store = configureStore({
  reducer: {
            cart: cartReducer,
            product: productReducer,
            rating: ratingReducer,
  },
});
