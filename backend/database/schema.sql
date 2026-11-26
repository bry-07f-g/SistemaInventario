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

-- Cantidad mínima: cuando hay esta cantidad o menos (pero todavía hay),
-- el objeto se marca como "próximo a agotar". 0 = sin aviso.
cantidad_minima INT NOT NULL DEFAULT 0,

-- Ruta de la imagen (ej: "uploads/1732200000-silla.jpg").
-- Guardamos solo el texto de la ruta, no la imagen, para no pesar.
imagen VARCHAR(255) NULL,

-- Fecha en que se creó el producto (se llena sola).
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-- Fecha de la última modificación (se actualiza sola con cada cambio).
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

-- Reglas de seguridad: ni la cantidad ni la cantidad mínima pueden ser
-- negativas. Si algo intenta dejarlas en -3, MySQL rechaza el cambio.
CONSTRAINT chk_productos_cantidad CHECK (cantidad >= 0),
  CONSTRAINT chk_productos_cantidad_minima CHECK (cantidad_minima >= 0)
);

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
entrego VARCHAR(100) NOT NULL, recibio VARCHAR(100) NOT NULL,

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

-- =====================================================================
-- migracion_v2.sql - Convierte una base de la VERSIÓN 1 en VERSIÓN 2
-- sin perder datos: todos los objetos y movimientos que ya existen
-- pasan a un inventario llamado "Inventario 1".
--
-- IMPORTANTE:
--  * Ejecútalo UNA sola vez, de arriba a abajo (selecciona todo y Run).
--  * Haz primero una copia de seguridad o pruébalo en tu MySQL local.
--  * En TiDB (la base de la página publicada) ejecútalo SOLO cuando
--    vayamos a publicar el backend de la versión 2: el backend de la
--    versión 1 no sabe llenar inventario_id y dejaría de poder crear
--    objetos.
--  * Cada ALTER hace UN solo cambio a propósito: TiDB es más estricto
--    con varios cambios en la misma sentencia.
-- =====================================================================

USE inventario_db;

-- ---------------------------------------------------------------------
-- 1) Tablas nuevas (idénticas a las de schema.sql)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    es_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    version_sesion INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permisos (
    usuario_id INT NOT NULL,
    inventario_id INT NOT NULL,
    puede_ver BOOLEAN NOT NULL DEFAULT TRUE,
    puede_crear BOOLEAN NOT NULL DEFAULT FALSE,
    puede_editar BOOLEAN NOT NULL DEFAULT FALSE,
    puede_eliminar BOOLEAN NOT NULL DEFAULT FALSE,
    puede_ingresar BOOLEAN NOT NULL DEFAULT FALSE,
    puede_despachar BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (usuario_id, inventario_id),
    CONSTRAINT fk_permisos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_permisos_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios (id) ON DELETE CASCADE,
    INDEX idx_permisos_inventario (inventario_id)
);

-- ---------------------------------------------------------------------
-- 2) El inventario donde quedan los datos que ya tienes.
--    (Después le cambias el nombre desde la página.)
-- ---------------------------------------------------------------------
INSERT INTO
    inventarios (id, nombre, descripcion)
VALUES (
        1,
        'Inventario 1',
        'Datos de la versión 1'
    );

-- ---------------------------------------------------------------------
-- 3) productos
-- ---------------------------------------------------------------------
-- DEFAULT 1: al crear la columna, TODAS las filas que ya existen quedan
-- con inventario_id = 1 automáticamente.
ALTER TABLE productos
ADD COLUMN inventario_id INT NOT NULL DEFAULT 1 AFTER id;

ALTER TABLE productos
ADD COLUMN uuid_cliente CHAR(36) NULL UNIQUE AFTER imagen;

-- Quitamos el UNIQUE viejo (el nombre no se repetía en TODO el sistema;
-- MySQL lo llamó "nombre") y ponemos el nuevo: no se repite DENTRO del
-- mismo inventario.
ALTER TABLE productos DROP INDEX nombre;

ALTER TABLE productos
ADD CONSTRAINT uq_productos_inventario_nombre UNIQUE (inventario_id, nombre);

ALTER TABLE productos
ADD CONSTRAINT fk_productos_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios (id) ON DELETE RESTRICT;

-- Ya llenamos las filas viejas: quitamos el valor por defecto para que
-- el backend esté OBLIGADO a decir a qué inventario va cada objeto nuevo.
ALTER TABLE productos ALTER COLUMN inventario_id DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 4) movimientos
-- ---------------------------------------------------------------------
ALTER TABLE movimientos
ADD COLUMN inventario_id INT NOT NULL DEFAULT 1 AFTER id;

ALTER TABLE movimientos
ADD COLUMN usuario_id INT NULL AFTER observacion;

ALTER TABLE movimientos
ADD COLUMN usuario_nombre VARCHAR(100) NULL AFTER usuario_id;

-- Los movimientos viejos ya cambiaron el stock: quedan 'aplicado'.
ALTER TABLE movimientos
ADD COLUMN estado ENUM(
    'aplicado',
    'pendiente',
    'cancelado'
) NOT NULL DEFAULT 'aplicado' AFTER usuario_nombre;

ALTER TABLE movimientos
ADD COLUMN registrado_en DATETIME DEFAULT CURRENT_TIMESTAMP AFTER fecha;

ALTER TABLE movimientos
ADD COLUMN uuid_cliente CHAR(36) NULL UNIQUE AFTER registrado_en;

-- Para los movimientos viejos, "registrado" = cuando ocurrieron.
UPDATE movimientos SET registrado_en = fecha WHERE id > 0;

ALTER TABLE movimientos
ADD CONSTRAINT fk_movimientos_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios (id) ON DELETE RESTRICT;

ALTER TABLE movimientos
ADD CONSTRAINT fk_movimientos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL;

ALTER TABLE movimientos
ADD INDEX idx_movimientos_inventario_fecha (inventario_id, fecha);

ALTER TABLE movimientos
ADD INDEX idx_movimientos_inventario_estado (inventario_id, estado);

ALTER TABLE movimientos ALTER COLUMN inventario_id DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 5) Comprobación: todo debe estar en el inventario 1
-- ---------------------------------------------------------------------
SELECT (
        SELECT COUNT(*)
        FROM productos
    ) AS objetos,
    (
        SELECT COUNT(*)
        FROM productos
        WHERE
            inventario_id = 1
    ) AS objetos_en_inventario_1,
    (
        SELECT COUNT(*)
        FROM movimientos
    ) AS movimientos,
    (
        SELECT COUNT(*)
        FROM movimientos
        WHERE
            inventario_id = 1
    ) AS movimientos_en_inventario_1;