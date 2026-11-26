// ---------------------------------------------------------------------
// Se ejecuta cada vez que arranca el servidor (server.js):
//  - Si el correo del .env NO existe: crea al super admin.
//  - Si YA existe: se asegura de que siga siendo super admin y activo,
//    pero NO toca su contraseña (para eso está reiniciarContrasena).
//  - Solo hay UN super administrador: el del .env. Si antes había otro
//    (porque se cambió SUPERADMIN_EMAIL), ese pasa a ser un usuario normal
//    sin permisos y se cierran sus sesiones. Así se REEMPLAZA al super
//    admin: cambiando las variables y reiniciando el servidor.
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
  } else {
    // Si la contraseña no sirve NO se cambia nada (ni se quita al anterior):
    // nunca debe quedar el sistema sin super administrador.
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

  // Quitar el rol a cualquier OTRO super administrador (el anterior)
  const [resultado] = await pool.query(
    `UPDATE usuarios
        SET es_super_admin = FALSE, version_sesion = version_sesion + 1
      WHERE es_super_admin = TRUE AND email <> ?`,
    [email],
  )
  if (resultado.affectedRows > 0) {
    console.log('El super administrador anterior ahora es un usuario normal (sin permisos).')
  }
}