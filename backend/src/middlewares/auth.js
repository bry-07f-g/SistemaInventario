// Middlewares de seguridad. Un "middleware" es una función que se ejecuta
// ANTES del controlador y decide si la petición sigue o se detiene.
//
//   autenticar        -> ¿quién eres? (exige haber iniciado sesión)
//   soloSuperAdmin    -> solo deja pasar al super administrador
//   exigirPermiso(x)  -> ¿puedes hacer "x" en ESTE inventario?
const pool = require('../config/database')
const { ErrorHttp } = require('../utils/errores')
const { leerToken } = require('../utils/sesion')
const { leerId } = require('../utils/validar')

// Las seis acciones posibles y la columna de la tabla permisos de cada una
const COLUMNAS_PERMISO = {
  ver: 'puede_ver',
  crear: 'puede_crear',
  editar: 'puede_editar',
  eliminar: 'puede_eliminar',
  ingresar: 'puede_ingresar',
  despachar: 'puede_despachar',
}

// ---------------------------------------------------------------------
// autenticar: lee el token del encabezado "Authorization: Bearer <token>",
// comprueba que sea válido y deja al usuario en req.usuario.
// ---------------------------------------------------------------------
async function autenticar(req, res, next) {
  const encabezado = req.get('Authorization') || ''
  const [tipo, token] = encabezado.split(' ')

  // 401 = "no sé quién eres": falta iniciar sesión (o hay que repetirla)
  if (tipo !== 'Bearer' || !token) {
    throw new ErrorHttp(401, 'Debes iniciar sesión')
  }

  const datos = leerToken(token)
  if (!datos) {
    throw new ErrorHttp(401, 'Tu sesión venció. Inicia sesión de nuevo')
  }

  // Buscamos al usuario en la base EN CADA petición. Así, si el super admin
  // lo desactiva o le cambia la contraseña, el cambio vale de inmediato.
  const [filas] = await pool.query(
    'SELECT id, nombre, email, es_super_admin, activo, version_sesion FROM usuarios WHERE id = ?',
    [Number(datos.sub)],
  )
  const usuario = filas[0]

  if (!usuario || !usuario.activo || usuario.version_sesion !== datos.v) {
    throw new ErrorHttp(401, 'Tu sesión ya no es válida. Inicia sesión de nuevo')
  }

  // MySQL devuelve los BOOLEAN como 0/1: los pasamos a true/false
  req.usuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    esSuperAdmin: Boolean(usuario.es_super_admin),
  }
  next()
}

// ---------------------------------------------------------------------
// soloSuperAdmin: va DESPUÉS de autenticar.
// ---------------------------------------------------------------------
function soloSuperAdmin(req, res, next) {
  // 403 = "sé quién eres, pero no tienes permiso"
  if (!req.usuario?.esSuperAdmin) {
    throw new ErrorHttp(403, 'Solo el super administrador puede hacer esto')
  }
  next()
}

// ---------------------------------------------------------------------
// exigirPermiso('despachar'): va DESPUÉS de autenticar.
// El inventario con el que se trabaja llega en el encabezado
// "X-Inventario-Id" (el frontend lo envía en cada petición).
// Deja el número en req.inventarioId para que el controlador lo use.
//
// Se pueden pedir varias acciones: exigirPermiso('crear', 'ingresar')
// exige TODAS (crear un objeto con cantidad también es un ingreso).
// ---------------------------------------------------------------------
function exigirPermiso(...acciones) {
  // Revisamos al arrancar el servidor que no haya acciones mal escritas
  for (const accion of acciones) {
    if (!COLUMNAS_PERMISO[accion]) throw new Error(`Acción desconocida: ${accion}`)
  }

  return async function revisarPermiso(req, res, next) {
    const valor = req.get('X-Inventario-Id')
    if (!valor) throw new ErrorHttp(400, 'Elige un inventario')
    const inventarioId = leerId(valor)

    // Debe existir el inventario (también para el super admin)
    const [inventarios] = await pool.query('SELECT id FROM inventarios WHERE id = ?', [inventarioId])
    if (inventarios.length === 0) throw new ErrorHttp(404, 'El inventario no existe')

    // El super admin puede todo en todos los inventarios
    if (!req.usuario.esSuperAdmin) {
      const [filas] = await pool.query(
        'SELECT * FROM permisos WHERE usuario_id = ? AND inventario_id = ?',
        [req.usuario.id, inventarioId],
      )
      const permiso = filas[0]

      // Sin fila = no tiene acceso a ese inventario
      if (!permiso) throw new ErrorHttp(403, 'No tienes acceso a este inventario')

      const faltan = acciones.filter((accion) => !permiso[COLUMNAS_PERMISO[accion]])
      if (faltan.length > 0) {
        throw new ErrorHttp(403, `No tienes permiso para: ${faltan.join(', ')}`)
      }
    }

    req.inventarioId = inventarioId
    next()
  }
}

module.exports = { autenticar, soloSuperAdmin, exigirPermiso, COLUMNAS_PERMISO }