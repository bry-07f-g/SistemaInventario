// Controlador de inventarios (empresas). Solo lo usa el super administrador:
// la ruta ya pasó por autenticar y soloSuperAdmin.
const pool = require('../config/database')
const { ErrorHttp } = require('../utils/errores')
const { textoObligatorio, textoOpcional, leerId } = require('../utils/validar')

// ---------------------------------------------------------------------
// GET /api/inventarios  ->  todos los inventarios, con cuántos objetos y
// cuántos usuarios con acceso tiene cada uno.
// ---------------------------------------------------------------------
async function listar(req, res) {
  // Las subconsultas (SELECT COUNT(*) ...) cuentan, para cada inventario,
  // sus filas en otras tablas.
  const [filas] = await pool.query(
    `SELECT i.id, i.nombre, i.descripcion, i.created_at,
            (SELECT COUNT(*) FROM productos p WHERE p.inventario_id = i.id) AS total_objetos,
            (SELECT COUNT(*) FROM permisos  x WHERE x.inventario_id = i.id) AS total_usuarios
       FROM inventarios i
      ORDER BY i.nombre`,
  )
  res.json(filas)
}

// Lee y revisa nombre y descripción (se usa al crear y al editar)
function leerDatos(cuerpo) {
  return {
    nombre: textoObligatorio(cuerpo.nombre, 'nombre', 100),
    descripcion: textoOpcional(cuerpo.descripcion, 'descripción', 1000),
  }
}

// ---------------------------------------------------------------------
// POST /api/inventarios  { nombre, descripcion }
// ---------------------------------------------------------------------
async function crear(req, res) {
  const { nombre, descripcion } = leerDatos(req.body || {})
  try {
    const [resultado] = await pool.execute(
      'INSERT INTO inventarios (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion],
    )
    res.status(201).json({ id: resultado.insertId, nombre, descripcion })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ErrorHttp(409, `Ya existe un inventario llamado "${nombre}"`)
    }
    throw error
  }
}

// ---------------------------------------------------------------------
// PUT /api/inventarios/:id  { nombre, descripcion }
// ---------------------------------------------------------------------
async function actualizar(req, res) {
  const id = leerId(req.params.id)
  const { nombre, descripcion } = leerDatos(req.body || {})
  try {
    const [resultado] = await pool.execute(
      'UPDATE inventarios SET nombre = ?, descripcion = ? WHERE id = ?',
      [nombre, descripcion, id],
    )
    // affectedRows = cuántas filas encontró el WHERE. 0 = no existe.
    if (resultado.affectedRows === 0) throw new ErrorHttp(404, 'El inventario no existe')
    res.json({ id, nombre, descripcion })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ErrorHttp(409, `Ya existe un inventario llamado "${nombre}"`)
    }
    throw error
  }
}

// ---------------------------------------------------------------------
// DELETE /api/inventarios/:id
// Solo se puede borrar un inventario VACÍO: sin objetos y sin historial.
// Así nunca se pierde la información de una empresa por un clic.
// Los permisos de los usuarios sobre él se borran solos (CASCADE).
// ---------------------------------------------------------------------
async function eliminar(req, res) {
  const id = leerId(req.params.id)

  const [filas] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM productos   WHERE inventario_id = ?) AS objetos,
            (SELECT COUNT(*) FROM movimientos WHERE inventario_id = ?) AS movimientos,
            (SELECT COUNT(*) FROM inventarios WHERE id = ?)            AS existe`,
    [id, id, id],
  )
  const { objetos, movimientos, existe } = filas[0]

  if (!existe) throw new ErrorHttp(404, 'El inventario no existe')
  if (objetos > 0 || movimientos > 0) {
    throw new ErrorHttp(
      409,
      `No se puede eliminar: tiene ${objetos} objeto(s) y ${movimientos} movimiento(s) en el historial`,
    )
  }

  await pool.execute('DELETE FROM inventarios WHERE id = ?', [id])
  res.status(204).end()
}

module.exports = { listar, crear, actualizar, eliminar }