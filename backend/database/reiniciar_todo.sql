-- =====================================================================
-- REINICIAR TODO  (borra movimientos Y objetos: la base queda vacía)
-- Úsalo antes de entregar el sistema, para quitar todos los datos de
-- prueba. NO se puede deshacer.
-- Después, borra también a mano los archivos de la carpeta
-- backend/uploads (las imágenes de los objetos), dejando el .gitkeep.
-- =====================================================================
USE inventario_db;

SELECT (
        SELECT COUNT(*)
        FROM productos
    ) AS objetos_a_borrar,
    (
        SELECT COUNT(*)
        FROM movimientos
    ) AS movimientos_a_borrar;

-- Primero los movimientos y luego los objetos (los movimientos dependen
-- de los objetos). "WHERE id > 0" por el modo seguro de Workbench.
DELETE FROM movimientos WHERE id > 0;

DELETE FROM productos WHERE id > 0;

-- Reinicia los contadores de id en 1
ALTER TABLE movimientos AUTO_INCREMENT = 1;

ALTER TABLE productos AUTO_INCREMENT = 1;

-- Comprobación: ambos deben decir 0
SELECT (
        SELECT COUNT(*)
        FROM productos
    ) AS objetos_que_quedan,
    (
        SELECT COUNT(*)
        FROM movimientos
    ) AS movimientos_que_quedan;