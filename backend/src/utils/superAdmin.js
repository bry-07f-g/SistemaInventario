// El super administrador se crea DESDE EL CÓDIGO, con los datos del .env
// (en Render: con las variables de Environment). La página nunca puede
// crearlo, quitarle el rol ni desactivarlo.
//
//   SUPERADMIN_NOMBRE    nombre para mostrar
//   SUPERADMIN_EMAIL     correo con el que inicia sesión
//   SUPERADMIN_PASSWORD  contraseña inicial (mínimo 8 caracteres)
const pool = require('../config/database')
const { hashearContrasena } = require('./sesion')

const MINIMO_CONTRASENA = 8

function leerVariables() {
  const nombre = (process.env.SUPERADMIN_NOMBRE || 'Super administrador').trim()
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD || ''
  return { nombre, email, password }
}

// ---------------------------------------------------------------------
// Se ejecuta cada vez que arranca el servidor (server.js):
//  - Si el correo del .env NO existe: crea al super admin.
//  - Si YA existe: se asegura de que siga siendo super admin y activo,
//    pero NO toca su contraseña (para eso está reiniciarContrasena).
// ---------------------------------------------------------------------
async function asegurarSuperAdmin() {
  const { nombre, email, password } = leerVariables()

  if (!email) {
    const [filas] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE es_super_admin = TRUE')
    if (filas[0].total === 0) {
      console.warn('AVISO: no hay super administrador. Agrega SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD al .env')
    }
    return
  }

  const [filas] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email])

  if (filas.length > 0) {
    await pool.query(
      'UPDATE usuarios SET es_super_admin = TRUE, activo = TRUE WHERE id = ?',
      [filas[0].id],
    )
    return
  }

  if (password.length < MINIMO_CONTRASENA) {
    console.warn(`AVISO: SUPERADMIN_PASSWORD debe tener al menos ${MINIMO_CONTRASENA} caracteres. No se creó el super administrador.`)
    return
  }

  await pool.query(
    'INSERT INTO usuarios (nombre, email, password_hash, es_super_admin) VALUES (?, ?, ?, TRUE)',
    [nombre, email, await hashearContrasena(password)],
  )
  console.log(`Super administrador creado: ${email}`)
}

// ---------------------------------------------------------------------
// Para cuando el super admin olvida su contraseña: la cambia por la del
// .env y cierra todas sus sesiones abiertas. Se usa con:
//   npm run reiniciar-admin
// ---------------------------------------------------------------------
async function reiniciarContrasena() {
  const { email, password } = leerVariables()
  if (!email || password.length < MINIMO_CONTRASENA) {
    throw new Error(`Revisa SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD (mínimo ${MINIMO_CONTRASENA} caracteres) en el .env`)
  }

  const [resultado] = await pool.query(
    `UPDATE usuarios
        SET password_hash = ?, es_super_admin = TRUE, activo = TRUE,
            version_sesion = version_sesion + 1
      WHERE email = ?`,
    [await hashearContrasena(password), email],
  )
  if (resultado.affectedRows === 0) {
    throw new Error(`No existe un usuario con el correo ${email}. Arranca el servidor para crearlo.`)
  }
}

module.exports = { asegurarSuperAdmin, reiniciarContrasena, MINIMO_CONTRASENA }