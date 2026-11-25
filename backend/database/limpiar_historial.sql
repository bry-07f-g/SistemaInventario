-- =====================================================================
-- LIMPIAR HISTORIAL  (borra SOLO los movimientos; los objetos quedan)
-- Úsalo cuando quieras empezar el historial desde cero sin perder el
-- inventario. OJO: la cantidad de cada objeto NO cambia, así que el
-- historial nuevo ya no explicará el stock que ya existe.
-- =====================================================================
USE inventario_db;

-- Antes de borrar, mira cuántos movimientos hay:
SELECT COUNT(*) AS movimientos_a_borrar FROM movimientos;

-- Borra todos los movimientos. "WHERE id > 0" es para que Workbench (modo
-- seguro, error 1175) lo permita: el id siempre es mayor que 0.
DELETE FROM movimientos WHERE id > 0;

-- Reinicia el contador: el próximo movimiento tendrá id 1 otra vez.
ALTER TABLE movimientos AUTO_INCREMENT = 1;

-- Comprobación: debe decir 0
SELECT COUNT(*) AS movimientos_que_quedan FROM movimientos;