-- =====================================================
-- TENDO-POS SQLite Local Schema (Mirror of MySQL VPS)
-- =====================================================
-- All tables include sync control columns:
--   sync_status   TEXT DEFAULT 'pending'
--   local_created_at TEXT DEFAULT CURRENT_TIMESTAMP
--   updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
--   is_deleted    INTEGER DEFAULT 0

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre_usuario TEXT NOT NULL,
  nombre TEXT DEFAULT '',
  email TEXT,
  password TEXT NOT NULL,
  rol TEXT DEFAULT 'vendedor',
  tienda_id INTEGER,
  turno_trabajo TEXT DEFAULT 'COMPLETO',
  pin_seguridad TEXT,
  permisos TEXT DEFAULT '{}',
  activo INTEGER DEFAULT 1,
  ultimo_login TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 2. Tiendas
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre TEXT NOT NULL,
  tipo TEXT DEFAULT 'GENERAL',
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  monto_base REAL DEFAULT 500.00,
  activa INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 3. Categorías
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 4. Marcas (Brands)
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 5. Proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 6. Productos
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_compra REAL DEFAULT 0.00,
  precio_venta REAL DEFAULT 0.00,
  precio_oferta REAL,
  categoria TEXT,
  cantidad INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 5,
  marca TEXT,
  color TEXT,
  codigo_barras TEXT,
  sku TEXT,
  caracteristicas TEXT,
  imagenes TEXT,
  barcodes_agrupados TEXT DEFAULT '[]',
  impuestos TEXT DEFAULT '[]',
  variaciones TEXT DEFAULT '[]',
  estrellas INTEGER DEFAULT 0,
  oferta INTEGER DEFAULT 0,
  destacado INTEGER DEFAULT 0,
  es_nuevo INTEGER DEFAULT 1,
  activo INTEGER DEFAULT 1,
  proveedor_id INTEGER,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 7. Variaciones de producto
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  producto_id TEXT NOT NULL,
  nombre TEXT,
  atributo TEXT DEFAULT 'Talla',
  stock INTEGER DEFAULT 0,
  precio REAL,
  codigo_barras TEXT,
  sku TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 8. Clientes
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  nit_dpi TEXT,
  codigo_barras TEXT,
  notas TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 8b. Alias: 'clients' apunta a 'customers' (Fix #3: unificar nombres)
-- Vista para que tanto 'clients' como 'customers' funcionen
CREATE VIEW IF NOT EXISTS clients AS SELECT * FROM customers;

-- 8c. Abonos de clientes
CREATE TABLE IF NOT EXISTS client_abonos (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  cliente_id TEXT NOT NULL,
  monto REAL NOT NULL,
  fecha TEXT DEFAULT (datetime('now')),
  descripcion TEXT,
  usuario_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 8d. Precios especiales de clientes (mayoreo)
CREATE TABLE IF NOT EXISTS client_special_prices (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  cliente_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  precio REAL NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 9. Ventas (append-only: nunca se sobreescriben)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  ticket_numero INTEGER DEFAULT 1,
  tipo TEXT DEFAULT 'VENTA',
  estado TEXT DEFAULT 'COMPLETADA',
  cliente_id TEXT,
  tienda_id TEXT,
  usuario_id TEXT,
  turno_id TEXT,
  fecha TEXT DEFAULT (datetime('now')),
  total REAL NOT NULL,
  descuento_global REAL DEFAULT 0.00,
  items_count INTEGER DEFAULT 0,
  resumen_productos TEXT,
  metodo_pago TEXT DEFAULT 'Efectivo',
  es_mayoreo INTEGER DEFAULT 0,
  notas TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 10. Detalle de ventas (append-only)
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  venta_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  variacion_id TEXT,
  cantidad INTEGER NOT NULL,
  precio_unitario REAL NOT NULL,
  subtotal REAL NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 11. Movimientos de inventario (append-only)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  producto_id TEXT NOT NULL,
  tienda_id TEXT,
  cantidad INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  motivo TEXT,
  usuario_id TEXT,
  fecha TEXT DEFAULT (datetime('now')),
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 12. Gastos
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  tienda_id TEXT,
  usuario_id TEXT,
  categoria TEXT NOT NULL,
  monto REAL NOT NULL,
  descripcion TEXT,
  fecha TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 13. Turnos / Caja Registradora (append-only)
CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT,
  tienda_id TEXT,
  fecha_apertura TEXT DEFAULT (datetime('now')),
  fecha_cierre TEXT,
  monto_inicial REAL DEFAULT 0.00,
  monto_final REAL DEFAULT 0.00,
  ventas_efectivo REAL DEFAULT 0.00,
  ventas_tarjeta REAL DEFAULT 0.00,
  ventas_transferencia REAL DEFAULT 0.00,
  ventas_mayoreo REAL DEFAULT 0.00,
  total_ventas INTEGER DEFAULT 0,
  total_monto REAL DEFAULT 0.00,
  diferencia REAL DEFAULT 0.00,
  estado TEXT DEFAULT 'ABIERTO',
  notas TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 14. Movimientos de caja (append-only)
CREATE TABLE IF NOT EXISTS cash_register_movements (
  id TEXT PRIMARY KEY,
  mysql_id INTEGER,
  turno_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  monto REAL NOT NULL,
  descripcion TEXT,
  fecha TEXT DEFAULT (datetime('now')),
  sync_status TEXT DEFAULT 'pending',
  local_created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0
);

-- 15. Sync Log
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  tabla TEXT NOT NULL,
  operacion TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  resultado TEXT NOT NULL,
  error_message TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- 16. Operaciones Pendientes (cola de sync)
CREATE TABLE IF NOT EXISTS pending_operations (
  id TEXT PRIMARY KEY,
  tabla TEXT NOT NULL,
  operacion TEXT NOT NULL,
  datos TEXT NOT NULL,
  intentos INTEGER DEFAULT 0,
  max_intentos INTEGER DEFAULT 5,
  ultimo_intento TEXT,
  error_message TEXT,
  estado TEXT DEFAULT 'pending',
  sync_status TEXT DEFAULT 'pending',
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 17. Schema Version (para migrations)
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now')),
  description TEXT
);

-- 18. Sync Metadata
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indices para rendimiento
CREATE INDEX IF NOT EXISTS idx_products_sync ON products(sync_status);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_products_nombre ON products(nombre);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_activo ON products(activo);
CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(sync_status);
CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(fecha);
CREATE INDEX IF NOT EXISTS idx_sales_turno ON sales(turno_id);
CREATE INDEX IF NOT EXISTS idx_sales_tienda ON sales(tienda_id);
CREATE INDEX IF NOT EXISTS idx_customers_sync ON customers(sync_status);
CREATE INDEX IF NOT EXISTS idx_pending_ops_estado ON pending_operations(estado);
CREATE INDEX IF NOT EXISTS idx_sync_log_tabla ON sync_log(tabla);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_sync ON inventory_movements(sync_status);
CREATE INDEX IF NOT EXISTS idx_expenses_sync ON expenses(sync_status);
CREATE INDEX IF NOT EXISTS idx_client_abonos_cliente ON client_abonos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_special_prices_cliente ON client_special_prices(cliente_id);
