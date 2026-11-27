-- =====================================================================
-- schema.sql - Estructura de la base de datos (VERSIÓN 2)
-- Para una instalación NUEVA (base vacía). Si ya tienes la versión 1
-- con datos, NO uses este archivo: usa migracion_v2.sql.
--
-- Tablas y cómo se relacionan:
--   usuarios ──< permisos >── inventarios ──< productos ──< movimientos
--   (un usuario tiene permisos en varios inventarios; cada inventario
--    es de una empresa y tiene sus propios productos y movimientos)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS inventario_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE inventario_db;

-- =====================================================================
-- TABLA: usuarios
-- Las personas que inician sesión en el sistema.
-- =====================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,

-- Nombre para mostrar (ej: "Laura Gómez").
nombre VARCHAR(100) NOT NULL,

-- Correo con el que inicia sesión. UNIQUE: no hay dos usuarios con el
-- mismo correo (la collation _ci hace que "A@x.com" y "a@x.com" cuenten
-- como el mismo).
email VARCHAR(150) NOT NULL UNIQUE,

-- NUNCA guardamos la contraseña tal cual: guardamos su "hash" (una
-- huella irreversible hecha con bcrypt). Si alguien roba la base, no
-- puede leer las contraseñas.
password_hash VARCHAR(255) NOT NULL,

-- 1 = super administrador (ve y hace todo, gestiona usuarios e
-- inventarios). Solo se pone en 1 desde el código (script de
-- creación); la página nunca permite cambiarlo.
es_super_admin BOOLEAN NOT NULL DEFAULT FALSE,

-- 0 = cuenta desactivada: no puede iniciar sesión, pero su nombre
-- sigue apareciendo en el historial.
activo BOOLEAN NOT NULL DEFAULT TRUE,

-- Sube en 1 cada vez que el super admin le cambia la contraseña o lo
-- desactiva. Las sesiones abiertas guardan este número; si ya no
-- coincide, la sesión se cierra sola (así se "expulsa" al usuario).
version_sesion INT NOT NULL DEFAULT 0,

-- (Versión 2.1) Identificador que genera la app cuando crea el usuario
-- SIN internet; evita crearlo dos veces al sincronizar.


uuid_cliente    CHAR(36) NULL UNIQUE,

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================================
-- TABLA: inventarios
-- Un inventario por empresa (Empresa 1, Empresa 2...).
-- =====================================================================
CREATE TABLE IF NOT EXISTS inventarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,

-- Nombre de la empresa / inventario. No se repite.

nombre VARCHAR(100) NOT NULL UNIQUE, descripcion TEXT NULL,

-- (Versión 2.1) Igual que en usuarios: creado sin internet.

uuid_cliente  CHAR(36) NULL UNIQUE,

  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================================
-- TABLA: permisos
-- Qué puede hacer cada usuario en cada inventario. Una fila = "el
-- usuario X en el inventario Y puede...". Si no hay fila, ese usuario
-- NO ve ese inventario. El super admin no necesita filas: puede todo.
-- =====================================================================
CREATE TABLE IF NOT EXISTS permisos (
  usuario_id      INT NOT NULL,
  inventario_id   INT NOT NULL,

-- Cada permiso es un sí (1) / no (0):
puede_ver BOOLEAN NOT NULL DEFAULT TRUE, -- ver inventario e historial
puede_crear BOOLEAN NOT NULL DEFAULT FALSE, -- crear objetos nuevos
puede_editar BOOLEAN NOT NULL DEFAULT FALSE, -- editar datos y foto
puede_eliminar BOOLEAN NOT NULL DEFAULT FALSE, -- borrar objetos
puede_ingresar BOOLEAN NOT NULL DEFAULT FALSE, -- sumar unidades
puede_despachar BOOLEAN NOT NULL DEFAULT FALSE, -- entregar unidades

-- Llave primaria COMPUESTA: la pareja (usuario, inventario) no se
-- repite. Un usuario tiene como máximo una fila por inventario.
PRIMARY KEY (usuario_id, inventario_id),

-- ON DELETE CASCADE: si se borra el usuario o el inventario, sus
-- permisos se borran solos (ya no tienen sentido).
CONSTRAINT fk_permisos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
CONSTRAINT fk_permisos_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios (id) ON DELETE CASCADE,

-- Para buscar rápido "¿quién tiene acceso a este inventario?"
INDEX idx_permisos_inventario (inventario_id) );

-- =====================================================================
-- TABLA: productos
-- Igual que en la versión 1, pero ahora cada objeto pertenece a un
-- inventario.
-- =====================================================================
CREATE TABLE IF NOT EXISTS productos (
  id               INT AUTO_INCREMENT PRIMARY KEY,

-- A qué inventario (empresa) pertenece este objeto.
inventario_id INT NOT NULL,

-- Ya NO es UNIQUE por sí solo: dos empresas pueden tener una "Silla".
-- Lo que no se repite es el nombre DENTRO del mismo inventario
-- (ver uq_productos_inventario_nombre abajo).
nombre VARCHAR(100) NOT NULL,
descripcion TEXT NULL,
cantidad INT NOT NULL DEFAULT 0,
cantidad_minima INT NOT NULL DEFAULT 0,
imagen VARCHAR(255) NULL,

-- (Versión 2.1) Sube en 1 cada vez que se EDITA el objeto. Sirve para
-- notar si alguien editó sin internet un objeto que otra persona
-- cambió mientras tanto.
version_datos INT NOT NULL DEFAULT 0,

-- Identificador que genera la app de escritorio cuando crea el objeto
-- SIN internet. Al sincronizar, sirve para saber "este es el mismo
-- objeto que creé offline" y no crearlo dos veces. NULL si se creó
-- en línea.
uuid_cliente CHAR(36) NULL UNIQUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT chk_productos_cantidad CHECK (cantidad >= 0),
CONSTRAINT chk_productos_cantidad_minima CHECK (cantidad_minima >= 0),

-- El nombre no se repite dentro del mismo inventario.
CONSTRAINT uq_productos_inventario_nombre UNIQUE (inventario_id, nombre),

-- ON DELETE RESTRICT: NO se puede borrar un inventario que todavía
-- tiene objetos. Protege contra borrar una empresa entera por error.
CONSTRAINT fk_productos_inventario FOREIGN KEY (inventario_id)
    REFERENCES inventarios (id) ON DELETE RESTRICT
);

-- =====================================================================
-- TABLA: movimientos
-- Historial de entradas y salidas, ahora con inventario, usuario que lo
-- registró y estado (para los conflictos de la app sin internet).
-- =====================================================================
CREATE TABLE IF NOT EXISTS movimientos (
  id               INT AUTO_INCREMENT PRIMARY KEY,

-- A qué inventario pertenece (así el historial se filtra por empresa
-- aunque el objeto ya se haya eliminado).
inventario_id INT NOT NULL,
producto_id INT NULL,
producto_nombre VARCHAR(100) NOT NULL,
tipo ENUM('entrada', 'salida') NOT NULL,
cantidad INT NOT NULL,
entrego VARCHAR(100) NOT NULL,
recibio VARCHAR(100) NOT NULL,
observacion VARCHAR(255) NULL,

-- Usuario del sistema que registró el movimiento. Si ese usuario se
-- borra, queda NULL, pero su nombre sigue en usuario_nombre (misma
-- idea que producto_nombre).
usuario_id INT NULL, usuario_nombre VARCHAR(100) NULL,

-- Estado del movimiento:
--   'aplicado'  -> ya cambió el stock (lo normal).
--   'pendiente' -> despacho hecho sin internet que, al sincronizar,
--                  no tenía stock suficiente. NO ha restado nada; el
--                  usuario lo confirma cuando haya stock.
--   'cancelado' -> el usuario decidió no hacer ese envío pendiente.
estado ENUM(
    'aplicado',
    'pendiente',
    'cancelado'
) NOT NULL DEFAULT 'aplicado',

-- Cuándo pasó en la vida real (si fue offline, la hora del equipo en
-- ese momento; si fue en línea, ahora).
fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

-- Cuándo llegó al servidor (igual a "fecha" si fue en línea; más
-- tarde si se sincronizó después).
registrado_en DATETIME DEFAULT CURRENT_TIMESTAMP,

-- Igual que en productos: evita registrar dos veces el mismo
-- movimiento si la sincronización se repite.


uuid_cliente     CHAR(36) NULL UNIQUE,

  CONSTRAINT chk_movimientos_cantidad CHECK (cantidad > 0),

  CONSTRAINT fk_movimientos_producto FOREIGN KEY (producto_id)
    REFERENCES productos (id) ON DELETE SET NULL,
  CONSTRAINT fk_movimientos_inventario FOREIGN KEY (inventario_id)
    REFERENCES inventarios (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movimientos_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL,

  INDEX idx_movimientos_producto (producto_id),
  INDEX idx_movimientos_fecha (fecha),
  -- Para listar rápido "el historial de la empresa X, por fecha"
  -- y "los pendientes de la empresa X".
  INDEX idx_movimientos_inventario_fecha (inventario_id, fecha),
  INDEX idx_movimientos_inventario_estado (inventario_id, estado)
);