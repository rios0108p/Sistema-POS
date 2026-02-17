-- ===============================================
-- SISTEMA POS - ESQUEMA INTEGRAL (VERSIÓN DEFINITIVA V4)
-- ===============================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS detalle_ventas;
DROP TABLE IF EXISTS ventas_pagos;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS inventario_tienda;
DROP TABLE IF EXISTS producto_barcodes;
DROP TABLE IF EXISTS variaciones;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS turnos;
DROP TABLE IF EXISTS tiendas;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS configuracion;
DROP TABLE IF EXISTS logs_seguridad;
DROP TABLE IF EXISTS gastos;
DROP TABLE IF EXISTS promocion_productos;
DROP TABLE IF EXISTS promociones;
DROP TABLE IF EXISTS detalle_pedidos;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS compras;
DROP TABLE IF EXISTS traslados;
DROP TABLE IF EXISTS traslado_detalles;
DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS ajustes_inventario;
DROP TABLE IF EXISTS precios_especiales_clientes;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Usuarios
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(255) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) UNIQUE DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('admin', 'vendedor', 'gerente') DEFAULT 'vendedor',
  tienda_id INT DEFAULT NULL,
  turno_trabajo VARCHAR(100) DEFAULT 'COMPLETO',
  pin_seguridad VARCHAR(255) DEFAULT NULL,
  activo BOOLEAN DEFAULT TRUE,
  ultimo_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tiendas
CREATE TABLE tiendas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) DEFAULT 'GENERAL',
  direccion TEXT,
  telefono VARCHAR(50),
  email VARCHAR(255),
  monto_base DECIMAL(10, 2) DEFAULT 500.00,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Categorías
CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Proveedores
CREATE TABLE proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  contacto VARCHAR(255),
  telefono VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Clientes
CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefono VARCHAR(50),
  direccion TEXT,
  nit_dpi VARCHAR(100),
  codigo_barras VARCHAR(50) UNIQUE,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Productos
CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio_compra DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  precio_venta DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  precio_oferta DECIMAL(10, 2) DEFAULT NULL,
  categoria VARCHAR(100) NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  stock_minimo INT DEFAULT 5,
  marca VARCHAR(100),
  color VARCHAR(50),
  codigo_barras VARCHAR(100),
  sku VARCHAR(100),
  caracteristicas JSON,
  imagenes JSON,
  estrellas INT DEFAULT 0,
  oferta BOOLEAN DEFAULT FALSE,
  destacado BOOLEAN DEFAULT FALSE,
  es_nuevo BOOLEAN DEFAULT TRUE,
  activo BOOLEAN DEFAULT TRUE,
  proveedor_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Variaciones
CREATE TABLE variaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  nombre VARCHAR(255),
  atributo VARCHAR(100) DEFAULT 'Talla',
  stock INT DEFAULT 0,
  sku VARCHAR(100),
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- 8. Inventario por tienda
CREATE TABLE inventario_tienda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  stock_minimo INT DEFAULT 5,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tienda_producto (tienda_id, producto_id)
);

-- 9. Turnos
CREATE TABLE turnos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  usuario_nombre VARCHAR(255),
  tienda_id INT DEFAULT NULL,
  fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre TIMESTAMP NULL,
  monto_inicial DECIMAL(10, 2) DEFAULT 0.00,
  monto_final DECIMAL(10, 2) DEFAULT 0.00,
  ventas_efectivo DECIMAL(10, 2) DEFAULT 0.00,
  ventas_tarjeta DECIMAL(10, 2) DEFAULT 0.00,
  ventas_transferencia DECIMAL(10, 2) DEFAULT 0.00,
  ventas_mayoreo DECIMAL(10, 2) DEFAULT 0.00,
  total_ventas INT DEFAULT 0,
  total_monto DECIMAL(10, 2) DEFAULT 0.00,
  diferencia DECIMAL(10, 2) DEFAULT 0.00,
  estado ENUM('ABIERTO', 'CERRADO') DEFAULT 'ABIERTO',
  notas TEXT
);

-- 10. Ventas
CREATE TABLE ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_numero INT DEFAULT 1,
  tipo ENUM('VENTA', 'COTIZACION', 'DEVOLUCION') DEFAULT 'VENTA',
  estado ENUM('COMPLETADA', 'PENDIENTE', 'CANCELADA', 'CANCELADO') DEFAULT 'COMPLETADA',
  cliente_id INT DEFAULT NULL,
  tienda_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  turno_id INT DEFAULT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(10, 2) NOT NULL,
  descuento_global DECIMAL(10, 2) DEFAULT 0.00,
  items_count INT DEFAULT 0,
  resumen_productos TEXT,
  metodo_pago VARCHAR(50) DEFAULT 'Efectivo',
  es_mayoreo BOOLEAN DEFAULT FALSE,
  notas TEXT
);

-- 11. Detalle de ventas
CREATE TABLE detalle_ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_id INT NOT NULL,
  variacion_id INT DEFAULT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
);

-- 12. Pagos de ventas
CREATE TABLE ventas_pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  metodo VARCHAR(50) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  referencia VARCHAR(100) DEFAULT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
);

-- 13. Compras
CREATE TABLE compras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  variacion_id INT DEFAULT NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  proveedor_id INT DEFAULT NULL,
  tienda_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  turno_id INT DEFAULT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Pedidos (Solicitudes)
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id INT DEFAULT NULL,
  usuario_solicitante_id INT DEFAULT NULL,
  nombre_cliente VARCHAR(255) DEFAULT 'SUMINISTRO INTERNO',
  email_cliente VARCHAR(255),
  telefono_cliente VARCHAR(50),
  direccion_envio TEXT,
  subtotal DECIMAL(10, 2) NOT NULL,
  envio DECIMAL(10, 2) DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  metodo_pago VARCHAR(50) DEFAULT 'SOLICITUD',
  notas TEXT,
  estado VARCHAR(50) DEFAULT 'PENDIENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 15. Detalle de pedidos
CREATE TABLE detalle_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NOT NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- 16. Traslados
CREATE TABLE traslados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_origen_id INT DEFAULT NULL,
  tienda_destino_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  notas TEXT,
  estado VARCHAR(50) DEFAULT 'PENDIENTE',
  fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_recepcion TIMESTAMP NULL
);

-- 17. Detalle de traslados
CREATE TABLE traslado_detalles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traslado_id INT NOT NULL,
  producto_id INT NOT NULL,
  variacion_id INT DEFAULT NULL,
  cantidad INT NOT NULL,
  FOREIGN KEY (traslado_id) REFERENCES traslados(id) ON DELETE CASCADE
);

-- 18. Producto Barcodes
CREATE TABLE producto_barcodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  codigo_barras VARCHAR(100) NOT NULL UNIQUE
);

-- 19. Gastos
CREATE TABLE gastos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  categoria VARCHAR(100) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. Movimientos de Inventario
CREATE TABLE movimientos_inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  tienda_id INT DEFAULT NULL,
  cantidad INT NOT NULL,
  tipo ENUM('ENTRADA', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA') NOT NULL,
  motivo TEXT,
  usuario_id INT DEFAULT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. Configuración (Estructura de Fila Única)
CREATE TABLE configuracion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_tienda VARCHAR(255) DEFAULT 'Mi Tienda',
  logo VARCHAR(255) DEFAULT '/images/compra.png',
  direccion TEXT,
  telefono VARCHAR(50),
  nit VARCHAR(100),
  moneda VARCHAR(20) DEFAULT '$',
  ancho_ticket VARCHAR(20) DEFAULT '58mm',
  mensaje_ticket TEXT,
  email VARCHAR(255),
  website VARCHAR(255),
  requerir_pin BOOLEAN DEFAULT TRUE,
  card_primary_color VARCHAR(10) DEFAULT '#4f46e5',
  card_secondary_color VARCHAR(10) DEFAULT '#3730a3',
  card_text_color VARCHAR(10) DEFAULT '#ffffff',
  card_title VARCHAR(100) DEFAULT 'Cliente Preferencial',
  show_logo_on_card BOOLEAN DEFAULT FALSE,
  card_template VARCHAR(50) DEFAULT 'vanguard',
  card_bg_image VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 22. Logs de Seguridad
CREATE TABLE logs_seguridad (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT DEFAULT NULL,
  accion VARCHAR(255) NOT NULL,
  descripcion TEXT,
  entidad_id INT DEFAULT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 23. Ajustes de Inventario
CREATE TABLE ajustes_inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  variacion_id INT DEFAULT NULL,
  tienda_id INT DEFAULT NULL,
  cantidad_anterior INT DEFAULT 0,
  cantidad_nueva INT DEFAULT 0,
  diferencia INT DEFAULT 0,
  motivo TEXT,
  notas TEXT,
  usuario_id INT DEFAULT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24. Precios Especiales Clientes
CREATE TABLE precios_especiales_clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    producto_id INT NOT NULL,
    precio_especial DECIMAL(10, 2) NOT NULL,
    min_cantidad INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_cliente_producto (cliente_id, producto_id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 25. Promociones (Alineado con promociones.js)
CREATE TABLE promociones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_combo DECIMAL(10, 2) NOT NULL,
    tienda_id INT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. Promocion Productos (Alineado con promociones.js)
CREATE TABLE promocion_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    promocion_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT DEFAULT 1,
    FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE
);

-- ===============================================
-- DATOS INICIALES
-- ===============================================

INSERT INTO tiendas (nombre, direccion, activa) VALUES ('Tienda Principal', 'Centro', 1);

-- ADMIN: admin123
INSERT INTO usuarios (nombre_usuario, nombre, email, password, rol, activo, tienda_id) 
VALUES ('admin@sistema.com', 'Administrador', 'admin@sistema.com', '$2b$10$QWEPVEtHzGMtlWG0I9eQtOrAKXbsvK4Q/evae9DSB5r4JdtVYMzPS', 'admin', 1, 1);

INSERT INTO configuracion (nombre_tienda, moneda) VALUES ('MINISUPER', 'MXN');

INSERT INTO clientes (nombre, email, codigo_barras) VALUES ('Cliente General', 'cliente@sistema.com', 'CLI-0001-GEN');
