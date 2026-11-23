-- =====================================================================
-- schema.sql - Estructura de la base de datos del sistema de inventario
-- Se ejecuta una sola vez para crear la base de datos y sus tablas.
-- =====================================================================

-- 1) Crear la base de datos (si no existe todavía).
--    utf8mb4 permite guardar tildes, ñ y hasta emojis sin problemas.
--    "IF NOT EXISTS" evita un error si la ejecutas dos veces.
CREATE DATABASE IF NOT EXISTS inventario_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Decirle a MySQL que a partir de aquí trabajamos dentro de esa base.
USE inventario_db;

-- =====================================================================
-- TABLA: productos
-- Guarda cada objeto del inventario y cuántas unidades hay AHORA.
-- =====================================================================
CREATE TABLE IF NOT EXISTS productos (
  -- Identificador único. AUTO_INCREMENT: MySQL le pone 1, 2, 3... solo.
  -- PRIMARY KEY: es lo que distingue una fila de otra.
  id            INT AUTO_INCREMENT PRIMARY KEY,

-- Nombre del objeto. NOT NULL = obligatorio. UNIQUE = no se repite.
nombre VARCHAR(100) NOT NULL UNIQUE,

-- Descripción larga y opcional (NULL = puede quedar vacía).
descripcion TEXT NULL,

-- Cantidad disponible hoy. Empieza en 0 si no se indica otra cosa.
-- Se actualiza con cada entrada (suma) o salida (resta).
cantidad INT NOT NULL DEFAULT 0,

-- Ruta de la imagen (ej: "uploads/1732200000-silla.jpg").
-- Guardamos solo el texto de la ruta, no la imagen, para no pesar.
imagen VARCHAR(255) NULL,

-- Fecha en que se creó el producto (se llena sola).
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-- Fecha de la última modificación (se actualiza sola con cada cambio).
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

-- Regla de seguridad: la cantidad nunca puede ser negativa.
-- Si algo intenta dejarla en -3, MySQL rechaza el cambio.
CONSTRAINT chk_productos_cantidad CHECK (cantidad >= 0) );

-- =====================================================================
-- TABLA: movimientos
-- Historial de todo lo que entra y sale. Una sola tabla para ambos:
-- la columna "tipo" dice si fue 'entrada' o 'salida'.
-- =====================================================================
CREATE TABLE IF NOT EXISTS movimientos (
  id            INT AUTO_INCREMENT PRIMARY KEY,

-- A qué producto pertenece este movimiento (el id de la tabla productos).
-- Puede quedar vacío (NULL): pasa cuando el objeto se elimina.
producto_id INT NULL,

-- Copia del nombre del objeto. Así, aunque el objeto se elimine, el
-- historial sigue diciendo qué era.
producto_nombre VARCHAR(100) NOT NULL,

-- ENUM: solo acepta uno de estos dos valores, cualquier otro da error.
tipo ENUM('entrada', 'salida') NOT NULL,

-- Cuántas unidades entraron o salieron en este movimiento.
cantidad INT NOT NULL,

-- Quién entregó y quién recibió: texto libre, como acordamos.
entrego VARCHAR(100) NOT NULL,
recibio VARCHAR(100) NOT NULL,

-- Nota opcional (ej: "Para la oficina del segundo piso").
observacion VARCHAR(255) NULL,

-- Fecha y hora del movimiento (se llena sola con el momento actual).
fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

-- Regla: un movimiento debe mover al menos 1 unidad.
CONSTRAINT chk_movimientos_cantidad CHECK (cantidad > 0),

-- Llave foránea: producto_id solo puede ser un id que EXISTA en productos.
-- ON DELETE SET NULL: si se elimina el producto, su historial se conserva
-- y producto_id queda vacío (el nombre sigue en producto_nombre).
CONSTRAINT fk_movimientos_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL,

-- Índices: aceleran las búsquedas por producto y por fecha
-- (como el índice de un libro, para no leer todo desde el principio).
INDEX idx_movimientos_producto (producto_id),
  INDEX idx_movimientos_fecha (fecha)
);