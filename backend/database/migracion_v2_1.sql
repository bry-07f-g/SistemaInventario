-- =====================================================================
-- migracion_v2_1.sql - Ajustes para la app SIN INTERNET (versión 2.1)
--
-- Se ejecuta DESPUÉS de migracion_v2.sql, una sola vez.
-- (Si creas la base desde cero con schema.sql, NO hace falta: ya los trae.)
--
--  * inventarios.uuid_cliente y usuarios.uuid_cliente: igual que en
--    productos y movimientos, el identificador que genera la app cuando
--    crea una empresa o un usuario sin internet. Evita crearlos dos veces
--    si la sincronización se repite.
--  * productos.version_datos: sube en 1 cada vez que se EDITA un objeto.
--    Si alguien edita sin internet un objeto que otra persona editó
--    mientras tanto, al sincronizar se nota (las versiones no coinciden)
--    y se le avisa en vez de pisar el cambio del otro.
-- =====================================================================

USE inventario_db;

ALTER TABLE inventarios
ADD COLUMN uuid_cliente CHAR(36) NULL UNIQUE AFTER descripcion;

ALTER TABLE usuarios
ADD COLUMN uuid_cliente CHAR(36) NULL UNIQUE AFTER version_sesion;

ALTER TABLE productos
ADD COLUMN version_datos INT NOT NULL DEFAULT 0 AFTER imagen;