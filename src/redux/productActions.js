import { createAsyncThunk } from '@reduxjs/toolkit';
import { productosAPI, getImageUrl } from '../services/api';

// Acción para traer todos los productos
export const fetchProducts = createAsyncThunk(
  'products/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const data = await productosAPI.getAll();

      const formattedData = (data || []).map(item => ({
        id: item.id,
        name: item.nombre || "Producto sin nombre",
        description: item.descripcion || "",
        precio_compra: Number(item.precio_compra) || 0,
        precio_venta: Number(item.precio_venta) || 0,
        precio_oferta: item.precio_oferta !== null ? Number(item.precio_oferta) : null,
        categoria: item.categoria || "",
        cantidad: Number(item.cantidad) || 0,
        marca: item.marca || "",
        color: item.color || "",
        caracteristicas: Array.isArray(item.caracteristicas) ? item.caracteristicas : [],

        // Convertir URLs de imágenes
        images: Array.isArray(item.imagenes) ? item.imagenes.map(img => getImageUrl(img)) : [],

        // Variaciones
        variaciones: Array.isArray(item.variaciones) ? item.variaciones : [],

        // Rating
        estrellas: Number(item.estrellas) || 4,

        // Flags
        oferta: Boolean(item.oferta),
        destacado: Boolean(item.destacado),
        es_nuevo: Boolean(item.es_nuevo),

        createdAt: item.created_at || null,
      }));

      return formattedData;

    } catch (error) {
      console.error("Error fetching products:", error);
      return rejectWithValue(error.message || "Error desconocido");
    }
  }
);
