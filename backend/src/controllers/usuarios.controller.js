// Controlador de usuarios. Solo lo usa el super administrador: la ruta ya
// pasó por autenticar y soloSuperAdmin.
//
// Reglas importantes:
//  - Al super administrador NO se le puede editar, desactivar, cambiar la
//    contraseña ni eliminar desde aquí: sus datos viven en el .env (o en
//    Environment de Render). Así "nadie lo puede bajar, salvo desde código".
//  - Los permisos se envían COMPLETOS: la lista que llega reemplaza a la
//    que había. Un inventario que no aparece = sin acceso.
const pool = require('../config/database')
const { ErrorHttp } = require('../utils/errores')
const { textoObligatorio, leerId, uuidOpcional } = require('../utils/validar')
const { hashearContrasena } = require('../utils/sesion')
const { MINIMO_CONTRASENA } = require('../utils/superAdmin')
const { COLUMNAS_PERMISO } = require('../middlewares/auth')
const { conTransaccion } = require('../utils/transaccion')

// Las seis acciones en orden: ['ver', 'crear', 'editar', ...]
const ACCIONES = Object.keys(COLUMNAS_PERMISO)

// ---------------------------------------------------------------------
// Validaciones propias de usuarios
// ---------------------------------------------------------------------
function leerEmail(valor) {
  const email = textoObligatorio(valor, 'correo', 150).toLowerCase()
  // Revisión sencilla: algo@algo.algo, sin espacios
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErrorHttp(400, 'El correo no es válido')
  }
  return email
}

function leerContrasena(valor) {
  // No usamos trim(): los espacios cuentan como parte de la contraseña
  if (typeof valor !== 'string' || valor.length < MINIMO_CONTRASENA) {
    throw new ErrorHttp(400, `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres`)
  }
  if (valor.length > 200) throw new ErrorHttp(400, 'La contraseña es demasiado larga')
  return valor
}

// Lista de permisos que llega del frontend:
//   [ { inventario_id: 1, ver: true, crear: false, ... }, ... ]
// Devuelve una lista limpia. Reglas:
//  - Si tiene CUALQUIER permiso, "ver" se activa solo (no se puede
//    despachar en un inventario que no se puede ver).
//  - Si no tiene ninguno, ese inventario se descarta (= sin acceso).
function leerPermisos(valor) {
  if (valor === undefined) return []
  if (!Array.isArray(valor)) throw new ErrorHttp(400, 'Los permisos no son válidos')

  const vistos = new Set()
  const lista = []
  for (const item of valor) {
    if (!item || typeof item !== 'object') throw new ErrorHttp(400, 'Los permisos no son válidos')

    const inventarioId = leerId(String(item.inventario_id))
    if (vistos.has(inventarioId)) throw new ErrorHttp(400, 'Un inventario aparece repetido en los permisos')
    vistos.add(inventarioId)

    // item[accion] === true: solo cuenta un true real (no "si" ni 1)
    const permiso = { inventario_id: inventarioId }
    for (const accion of ACCIONES) permiso[accion] = item[accion] === true
    if (ACCIONES.some((accion) => permiso[accion])) {
      permiso.ver = true
      lista.push(permiso)
    }
  }
  return lista
}

// Borra los permisos del usuario y guarda los nuevos (dentro de una transacción)
async function guardarPermisos(conexion, usuarioId, permisos) {
  await conexion.execute('DELETE FROM permisos WHERE usuario_id = ?', [usuarioId])
  for (const p of permisos) {
    await conexion.execute(
      `INSERT INTO permisos
         (usuario_id, inventario_id, puede_ver, puede_crear, puede_editar,
          puede_eliminar, puede_ingresar, puede_despachar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, p.inventario_id, p.ver, p.crear, p.editar, p.eliminar, p.ingresar, p.despachar],
    )
  }
}

// Trae al usuario o lanza 404. Si "bloquearSuper" es true, también impide
// tocar al super administrador.
async function buscarUsuario(id, bloquearSuper) {
  const [filas] = await pool.execute(
    'SELECT id, nombre, email, es_super_admin, activo, created_at FROM usuarios WHERE id = ?',
    [id],
  )
  if (filas.length === 0) throw new ErrorHttp(404, 'El usuario no existe', 'NO_EXISTE')
  if (bloquearSuper && filas[0].es_super_admin) {
    throw new ErrorHttp(403, 'El super administrador solo se cambia desde la configuración del servidor (.env)')
  }
  return filas[0]
}

// Convierte una fila de MySQL (0/1) al formato del frontend (true/false)
function formatoUsuario(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    esSuperAdmin: Boolean(fila.es_super_admin),
    activo: Boolean(fila.activo),
    creado: fila.created_at,
  }
}

// Permisos de un usuario, con el nombre de cada inventario
async function permisosDe(usuarioId) {
  const [filas] = await pool.execute(
    `SELECT p.*, i.nombre AS inventario_nombre
       FROM permisos p JOIN inventarios i ON i.id = p.inventario_id
      WHERE p.usuario_id = ?
      ORDER BY i.nombre`,
    [usuarioId],
  )
  return filas.map((f) => {
    const permiso = { inventario_id: f.inventario_id, inventario_nombre: f.inventario_nombre }
    for (const accion of ACCIONES) permiso[accion] = Boolean(f[COLUMNAS_PERMISO[accion]])
    return permiso
  })
}

// Traduce el error de "correo repetido" a un mensaje claro
function revisarDuplicado(error, email) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw new ErrorHttp(409, `Ya existe un usuario con el correo ${email}`, 'CORREO_REPETIDO')
  }
  // Si un inventario de la lista no existe, la llave foránea falla
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    throw new ErrorHttp(400, 'Uno de los inventarios elegidos no existe')
  }
  throw error
}

// ---------------------------------------------------------------------
// GET /api/usuarios  ->  todos los usuarios, con cuántos inventarios ve cada uno
// ---------------------------------------------------------------------
async function listar(req, res) {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombre, u.email, u.es_super_admin, u.activo, u.created_at,
            (SELECT COUNT(*) FROM permisos p WHERE p.usuario_id = u.id) AS total_inventarios
       FROM usuarios u
      ORDER BY u.es_super_admin DESC, u.nombre`,
  )
  res.json(filas.map((f) => ({ ...formatoUsuario(f), totalInventarios: f.total_inventarios })))
}

// ---------------------------------------------------------------------
// GET /api/usuarios/:id  ->  un usuario con sus permisos
// ---------------------------------------------------------------------
async function ver(req, res) {
  const usuario = await buscarUsuario(leerId(req.params.id), false)
  res.json({ ...formatoUsuario(usuario), permisos: await permisosDe(usuario.id) })
}

// POST /api/usuarios  { nombre, email, password, permisos: [...], uuid_cliente? }
// uuid_cliente solo llega desde la app sin internet: si ese usuario ya se
// había sincronizado, se devuelve el existente en vez de crearlo otra vez.
// ---------------------------------------------------------------------
async function usuarioPorUuid(uuid) {
  const [filas] = await pool.execute('SELECT id FROM usuarios WHERE uuid_cliente = ?', [uuid])
  if (filas.length === 0) return null
  const usuario = await buscarUsuario(filas[0].id, false)
  return { ...formatoUsuario(usuario), permisos: await permisosDe(usuario.id), repetido: true }
}

async function crear(req, res) {
  const cuerpo = req.body || {}
  const uuid = uuidOpcional(cuerpo.uuid_cliente)
  if (uuid) {
    const existente = await usuarioPorUuid(uuid)
    if (existente) return res.status(200).json(existente)
  }
  const nombre = textoObligatorio(cuerpo.nombre, 'nombre', 100)
  const email = leerEmail(cuerpo.email)
  const password = leerContrasena(cuerpo.password)
  const permisos = leerPermisos(cuerpo.permisos)
  const hash = await hashearContrasena(password)

  try {
    // Usuario y permisos van juntos: o se guarda todo o nada
    const id = await conTransaccion(async (conexion) => {
      // es_super_admin no se envía: siempre queda en FALSE (su valor por defecto)
      const [resultado] = await conexion.execute(
        'INSERT INTO usuarios (nombre, email, password_hash, uuid_cliente) VALUES (?, ?, ?, ?)',
        [nombre, email, hash, uuid],
      )
      await guardarPermisos(conexion, resultado.insertId, permisos)
      return resultado.insertId
    })
    const usuario = await buscarUsuario(id, false)
    res.status(201).json({ ...formatoUsuario(usuario), permisos: await permisosDe(id) })
  } catch (error) {
        // Llegó dos veces a la vez: si el uuid ya quedó guardado, devolvemos ese
    if (uuid && error.code === 'ER_DUP_ENTRY') {
      const existente = await usuarioPorUuid(uuid)
      if (existente) return res.status(200).json(existente)
    }
  }
}

// ---------------------------------------------------------------------
// PUT /api/usuarios/:id  { nombre, email, activo, permisos: [...] }
// La contraseña NO se cambia aquí (tiene su propia ruta).
// ---------------------------------------------------------------------
async function actualizar(req, res) {
  const id = leerId(req.params.id)
  const anterior = await buscarUsuario(id, true)

  const cuerpo = req.body || {}
  const nombre = textoObligatorio(cuerpo.nombre, 'nombre', 100)
  const email = leerEmail(cuerpo.email)
  if (typeof cuerpo.activo !== 'boolean') {
    throw new ErrorHttp(400, 'El campo "activo" debe ser verdadero o falso')
  }
  const activo = cuerpo.activo
  const permisos = leerPermisos(cuerpo.permisos)

  // Si se desactiva (o cambia el correo), sus sesiones abiertas se cierran
  const cerrarSesiones = (!activo && anterior.activo) || email !== anterior.email

  try {
    await conTransaccion(async (conexion) => {
      await conexion.execute(
        `UPDATE usuarios
            SET nombre = ?, email = ?, activo = ?,
                version_sesion = version_sesion + ?
          WHERE id = ?`,
        [nombre, email, activo, cerrarSesiones ? 1 : 0, id],
      )
      await guardarPermisos(conexion, id, permisos)
    })
    // Su nombre también se ve en el historial: lo actualizamos ahí
    if (nombre !== anterior.nombre) {
      await pool.execute('UPDATE movimientos SET usuario_nombre = ? WHERE usuario_id = ?', [nombre, id])
    }
    const usuario = await buscarUsuario(id, false)
    res.json({ ...formatoUsuario(usuario), permisos: await permisosDe(id) })
  } catch (error) {
    revisarDuplicado(error, email)
  }
}

// ---------------------------------------------------------------------
// PUT /api/usuarios/:id/password  { password }
// El super admin le pone una contraseña nueva a un usuario (por ejemplo,
// porque la olvidó). Sus sesiones abiertas se cierran.
// ---------------------------------------------------------------------
async function cambiarContrasena(req, res) {
  const id = leerId(req.params.id)
  await buscarUsuario(id, true)
  const password = leerContrasena((req.body || {}).password)

  await pool.execute(
    'UPDATE usuarios SET password_hash = ?, version_sesion = version_sesion + 1 WHERE id = ?',
    [await hashearContrasena(password), id],
  )
  res.status(204).end()
}

// ---------------------------------------------------------------------
// DELETE /api/usuarios/:id
// Sus permisos se borran solos (CASCADE). En el historial, sus movimientos
// quedan con usuario_id = NULL pero conservan su nombre.
// Consejo: si solo quieres que no entre más, mejor DESACTÍVALO.
// ---------------------------------------------------------------------
async function eliminar(req, res) {
  const id = leerId(req.params.id)
  await buscarUsuario(id, true)
  await pool.execute('DELETE FROM usuarios WHERE id = ?', [id])
  res.status(204).end()
}

module.exports = { listar, ver, crear, actualizar, cambiarContrasena, eliminar }
