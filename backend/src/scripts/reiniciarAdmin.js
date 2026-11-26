// Script: cambia la contraseña del super administrador por la del .env.
// Uso (desde la carpeta backend):   npm run reiniciar-admin
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true })

const pool = require('../config/database')
const { reiniciarContrasena } = require('../utils/superAdmin')

reiniciarContrasena()
  .then(() => console.log('Listo: la contraseña del super administrador ahora es la del .env'))
  .catch((error) => {
    console.error('No se pudo:', error.message)
    process.exitCode = 1 // termina con error, pero deja cerrar el pool
  })
  .finally(() => pool.end()) // cierra las conexiones para que el script termine