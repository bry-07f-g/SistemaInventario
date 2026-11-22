// Punto de entrada del backend: lee el .env, revisa que todo esté bien,
// comprueba la conexión a MySQL y enciende el servidor.
const path = require('path')

// 1) Cargar el archivo .env. IMPORTANTE: debe ser lo primero, porque los
//    demás archivos leen estas variables apenas se cargan.
//    "path" busca el .env junto a src/, sin importar desde qué carpeta
//    ejecutes el comando.
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true, // evita el mensaje de ayuda que dotenv imprime por defecto
})

// 2) Revisar que no falte ninguna variable obligatoria
const obligatorias = [
  'FRONTEND_URL',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
]
const faltantes = obligatorias.filter((nombre) => process.env[nombre] === undefined)

if (faltantes.length > 0) {
  console.error('Faltan variables en backend/.env:', faltantes.join(', '))
  console.error('Copia .env.example como .env y completa los valores.')
  process.exit(1) // cierra el programa; 1 = terminó con error
}

// 3) Solo ahora cargamos la app, porque ya existen las variables
const app = require('./app')
const pool = require('./config/database')

const PORT = Number(process.env.PORT) || 3000

// Explicaciones en español para los errores de conexión más comunes
const ayudas = {
  ECONNREFUSED:
    'MySQL no responde. Revisa que el servicio esté encendido y que DB_HOST y DB_PORT sean correctos (si usas "localhost" y falla, prueba con 127.0.0.1).',
  ENOTFOUND: 'No se encontró el servidor. Revisa DB_HOST en backend/.env.',
  ETIMEDOUT: 'MySQL tardó demasiado en responder. Revisa DB_HOST y DB_PORT.',
  ER_ACCESS_DENIED_ERROR:
    'Usuario o contraseña incorrectos. Revisa DB_USER y DB_PASSWORD en backend/.env.',
  ER_BAD_DB_ERROR: `La base de datos "${process.env.DB_NAME}" no existe. Ejecuta backend/database/schema.sql en Workbench.`,
}

async function iniciar() {
  // 4) Probar la conexión ANTES de abrir el servidor, para fallar rápido
  //    y con un mensaje claro en vez de descubrirlo en la primera petición.
  try {
    const conexion = await pool.getConnection()
    conexion.release() // la devolvemos al pool, solo era una prueba
    console.log(`Conectado a MySQL (base de datos "${process.env.DB_NAME}")`)
  } catch (error) {
    console.error('No se pudo conectar a MySQL:', error.code || error.message)
    console.error(ayudas[error.code] || 'Revisa los datos de conexión en backend/.env')
    process.exit(1)
  }

  // 5) Encender el servidor.
  //    No usamos el callback de app.listen porque en Express 5 también se
  //    ejecuta cuando hay un error. Escuchamos cada evento por separado:
  //    "listening" = ya está funcionando, "error" = algo falló.
  const servidor = app.listen(PORT)

  servidor.on('listening', () => {
    console.log(`Servidor listo en http://localhost:${PORT}`)
  })

  // Si el puerto ya lo usa otro programa, lo explicamos claro
  servidor.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} ya está en uso. Cambia PORT en backend/.env.`)
    } else {
      console.error('Error al encender el servidor:', error.message)
    }
    process.exit(1)
  })
}

iniciar()