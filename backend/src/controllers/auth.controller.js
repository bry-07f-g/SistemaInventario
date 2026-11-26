// Controlador de sesión: iniciar sesión y "¿quién soy?".
const bcrypt = require('bcryptjs')
const pool = require('../config/database')
const { ErrorHttp } = require('../utils/errores')
const { textoObligatorio } = require('../utils/validar')
const { compararContrasena, crearToken } = require('../utils/sesion')

// Hash de una contraseña inventada. Se usa cuando el correo NO existe, para
// gastar el mismo tiempo que con un correo real. Si respondiéramos más
// rápido, un atacante podría descubrir qué correos están registrados
// midiendo cuánto tarda el servidor.
// hashSync se calcula UNA vez, al arrancar el servidor.
const HASH_FALSO = bcrypt.hashSync('contrasena-que-nadie-usa', 10)

// ---------------------------------------------------------------------
// Lista de inventarios que puede usar un usuario, con sus permisos.
// El super admin recibe TODOS los inventarios con todo en true.
// ---------------------------------------------------------------------
async function inventariosDe(usuario) {
  if (usuario.esSuperAdmin) {
    const [filas] = await pool.query('SELECT id, nombre FROM inventarios ORDER BY nombre')
    return filas.map((inv) => ({
      id: inv.id,
      nombre: inv.nombre,
      permisos: { ver: true, crear: true, editar: true, eliminar: true, ingresar: true, despachar: true },
    }))
  }

  // JOIN: une cada fila de permisos con el nombre de su inventario
  const [filas] = await pool.query(
    `SELECT i.id, i.nombre, p.puede_ver, p.puede_crear, p.puede_editar,
            p.puede_eliminar, p.puede_ingresar, p.puede_despachar
       FROM permisos p
       JOIN inventarios i ON i.id = p.inventario_id
      WHERE p.usuario_id = ?
      ORDER BY i.nombre`,
    [usuario.id],
  )
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    permisos: {
      ver: Boolean(f.puede_ver),
      crear: Boolean(f.puede_crear),
      editar: Boolean(f.puede_editar),
      eliminar: Boolean(f.puede_eliminar),
      ingresar: Boolean(f.puede_ingresar),
      despachar: Boolean(f.puede_despachar),
    },
  }))
}

// ---------------------------------------------------------------------
// POST /api/auth/login   { email, password }  ->  { token, usuario }
// ---------------------------------------------------------------------
async function login(req, res) {
  const cuerpo = req.body || {}
  // El correo se guarda y se compara siempre en minúsculas
  const email = textoObligatorio(cuerpo.email, 'correo', 150).toLowerCase()
  const password = textoObligatorio(cuerpo.password, 'contraseña', 200)

  const [filas] = await pool.query(
    'SELECT id, nombre, email, password_hash, es_super_admin, activo, version_sesion FROM usuarios WHERE email = ?',
    [email],
  )
  const fila = filas[0]

  // Siempre comparamos (con el hash real o con el falso) y siempre damos
  // el MISMO mensaje: no decimos si falló el correo o la contraseña.
  const coincide = await compararContrasena(password, fila ? fila.password_hash : HASH_FALSO)
  if (!fila || !coincide) {
    throw new ErrorHttp(401, 'Correo o contraseña incorrectos')
  }
  if (!fila.activo) {
    throw new ErrorHttp(403, 'Tu cuenta está desactivada. Habla con el administrador')
  }

  const usuario = {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    esSuperAdmin: Boolean(fila.es_super_admin),
  }

  res.json({
    token: crearToken(fila),
    usuario: { ...usuario, inventarios: await inventariosDe(usuario) },
  })
}

// ---------------------------------------------------------------------
// GET /api/auth/yo  ->  datos del usuario de la sesión y sus inventarios.
// El frontend lo llama al abrir la página para saber si la sesión sigue
// viva y qué botones mostrar.
// ---------------------------------------------------------------------
async function yo(req, res) {
  res.json({ ...req.usuario, inventarios: await inventariosDe(req.usuario) })
}

module.exports = { login, yo, inventariosDe }