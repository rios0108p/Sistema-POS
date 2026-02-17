-- Tabla de Promociones (Cabecera)
CREATE TABLE IF NOT EXISTS promociones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_combo DECIMAL(10, 2) NOT NULL,
    tienda_id INT, -- NULL para todas las tiendas
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE
);

-- Tabla de Productos en la Promoción (Detalle)
CREATE TABLE IF NOT EXISTS promocion_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    promocion_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT DEFAULT 1,
    FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);
