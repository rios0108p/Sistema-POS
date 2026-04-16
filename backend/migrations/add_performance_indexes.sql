-- Índices para mejorar velocidad de búsqueda
ALTER TABLE productos ADD INDEX IF NOT EXISTS idx_prod_barcode (codigo_barras);
ALTER TABLE productos ADD INDEX IF NOT EXISTS idx_prod_nombre (nombre);

-- Índices para inventario por tienda
-- Como la tabla inventario_tienda se crea dinámicamente o por migración externa, 
-- aseguramos índices en las columnas de enlace
ALTER TABLE inventario_tienda ADD INDEX IF NOT EXISTS idx_it_tienda_prod (tienda_id, producto_id);

-- Índices para variaciones y códigos adicionales
ALTER TABLE variaciones ADD INDEX IF NOT EXISTS idx_var_prod (producto_id);
ALTER TABLE producto_barcodes ADD INDEX IF NOT EXISTS idx_pb_prod_barcode (producto_id, codigo_barras);

-- Índices para reportes de ventas y turnos
ALTER TABLE ventas ADD INDEX IF NOT EXISTS idx_v_turno (turno_id);
ALTER TABLE ventas ADD INDEX IF NOT EXISTS idx_v_tienda (tienda_id);
ALTER TABLE ventas ADD INDEX IF NOT EXISTS idx_v_usuario (usuario_id);

-- Índices para movimientos (Union All queries)
ALTER TABLE compras ADD INDEX IF NOT EXISTS idx_c_tienda (tienda_id);
ALTER TABLE gastos ADD INDEX IF NOT EXISTS idx_g_tienda (tienda_id);
