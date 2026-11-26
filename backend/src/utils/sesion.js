// Herramientas de sesión: contraseñas y "tokens".
//
// CONTRASEÑAS: nunca se guardan tal cual. bcrypt las convierte en un "hash"
// (una huella irreversible). Para iniciar sesión no se "descifra" nada: se
// vuelve a calcular la huella de lo que escribió la persona y se compara.
//
// TOKEN (JWT): cuando la persona inicia sesión, el servidor le entrega un
// texto firmado que dice "este es el usuario 5". El navegador lo envía en
// cada petición y el servidor comprueba la firma con JWT_SECRET. Si alguien
// cambia una sola letra del token, la firma ya no coincide y se rechaza.
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// "Costo" de bcrypt: cuántas vueltas da el cálculo (2^10). Más alto = más
// lento para quien intente adivinar contraseñas a la fuerza.
const COSTO_HASH = 10

// Cuánto dura una sesión. Es largo a propósito: la app de escritorio puede
// pasar días sin internet y debe poder sincronizar al volver.
const DURACION_SESION = '60d'

function hashearContrasena(contrasena) {
  return bcrypt.hash(contrasena, COSTO_HASH)
}

function compararContrasena(contrasena, hash) {
  return bcrypt.compare(contrasena, hash)
}

// Dentro del token guardamos solo lo mínimo:
//   sub = id del usuario ("subject", nombre estándar en JWT)
//   v   = su version_sesion. Si el super admin le cambia la contraseña o lo
//         desactiva, ese número sube y los tokens viejos dejan de servir.
function crearToken(usuario) {
  return jwt.sign(
    { sub: String(usuario.id), v: usuario.version_sesion },
    process.env.JWT_SECRET,
    { expiresIn: DURACION_SESION },
  )
}

// Devuelve el contenido del token, o null si es falso, está dañado o venció.
function leerToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

module.exports = { hashearContrasena, compararContrasena, crearToken, leerToken }