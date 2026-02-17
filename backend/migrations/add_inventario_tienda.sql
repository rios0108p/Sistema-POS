-- Migration: Add inventario_tienda table
-- This table tracks inventory per store (tienda)

CREATE TABLE IF NOT EXISTS inventario_tienda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  stock_minimo INT DEFAULT 5,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tienda_producto (tienda_id, producto_id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  INDEX idx_tienda (tienda_id),
  INDEX idx_producto (producto_id),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
