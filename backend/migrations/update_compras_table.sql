-- Agregar campos faltantes a la tabla compras para soporte multi-tienda
ALTER TABLE compras 
ADD COLUMN IF NOT EXISTS tienda_id INT DEFAULT NULL AFTER proveedor_id,
ADD COLUMN IF NOT EXISTS usuario_id INT DEFAULT NULL AFTER tienda_id;

-- Agregar índices para mejor rendimiento
ALTER TABLE compras
ADD INDEX IF NOT EXISTS idx_tienda (tienda_id),
ADD INDEX IF NOT EXISTS idx_usuario (usuario_id);
