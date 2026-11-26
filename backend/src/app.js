// Aquí se arma la aplicación Express: sus "reglas" y sus rutas.
// (Encender el servidor se hace en server.js; aquí solo se configura.)
const express = require('express')
const cors = require('cors')
const pool = require('./config/database')
const { CARPETA_UPLOADS } = require('./utils/archivos')
const { ErrorHttp } = require('./utils/errores')
const authRoutes = require('./routes/auth.routes')
const productosRoutes = require('./routes/productos.routes')
const movimientosRoutes = require('./routes/movimientos.routes')

const app = express()

// CORS: el navegador bloquea por seguridad que una página (el frontend, en
// el puerto 5173) hable con otro servidor (este backend, en el 3000).
// Con esto le decimos que SOLO la dirección del frontend tiene permiso.
app.use(cors({ origin: process.env.FRONTEND_URL }))

// Permite leer el cuerpo de las peticiones cuando viene en formato JSON
app.use(express.json())

// Imágenes: todo lo que haya en la carpeta uploads se puede ver desde el
// navegador en http://localhost:3000/uploads/archivo.jpg
app.use(
  '/uploads',
  express.static(CARPETA_UPLOADS, {
    index: false, // no mostrar listado de la carpeta
    maxAge: '7d', // el navegador guarda la imagen y no la pide cada vez
    // Le dice al navegador que NO adivine el tipo del archivo: si dice que
    // es una imagen, se trata como imagen y nada más.
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
)

// Rutas de sesión: /api/auth/login y /api/auth/yo
app.use('/api/auth', authRoutes)

// Ruta de prueba: sirve para comprobar que el servidor y la base de datos
// responden. Ábrela en el navegador: http://localhost:3000/api/salud
app.get('/api/salud', async (req, res) => {
  try {
    // "SELECT 1" es la consulta más simple que existe: solo comprueba que
    // la base de datos contesta.
    await pool.query('SELECT 1')
    res.json({ ok: true, mensaje: 'Servidor y base de datos funcionando' })
  } catch (error) {
    console.error('Falló la base de datos:', error.message)
    // 503 = "servicio no disponible"
    res
      .status(503)
      .json({ ok: false, mensaje: 'No hay conexión con la base de datos' })
  }
})

// Rutas de productos: todo lo que empiece con /api/productos
app.use('/api/productos', productosRoutes)

// Rutas de movimientos: todo lo que empiece con /api/movimientos
app.use('/api/movimientos', movimientosRoutes)

// Si ninguna ruta anterior respondió, esta atrapa la petición (error 404)
app.use((req, res) => {
  res
    .status(404)
    .json({ mensaje: `La ruta ${req.method} ${req.originalUrl} no existe` })
})

// Manejador de errores: recibe cualquier error que no se haya controlado.
// Express lo reconoce por tener CUATRO parámetros, aunque "next" no se use.
// En Express 5, si una función async falla, el error llega aquí solo.
app.use((error, req, res, next) => {
  // Algunos errores traen su propio código HTTP. Por ejemplo, si alguien
  // envía un JSON mal escrito, el error trae 400 ("petición incorrecta").
  const estado = error.status || error.statusCode || 500

  // 4xx = la culpa es de quien envió los datos, no de nuestro servidor
  if (estado >= 400 && estado < 500) {
    // Los ErrorHttp traen un mensaje escrito para la persona (por ejemplo
    // "Ya existe un objeto llamado..."). Los demás usan uno general.
    const mensaje = error instanceof ErrorHttp ? error.message : 'Petición inválida'
    return res.status(estado).json({ mensaje })
  }

  // Un ErrorHttp con código 5xx (por ejemplo 502 cuando Cloudinary no
  // responde) también trae un mensaje pensado para la persona, y no tiene
  // datos técnicos: se lo mostramos tal cual.
  if (error instanceof ErrorHttp && estado >= 500) {
    return res.status(estado).json({ mensaje: error.message })
  }

  // Cualquier otro error SÍ es nuestro: el detalle técnico se queda en la
  // terminal y al usuario solo se le muestra un mensaje general.
  console.error(error)
  res.status(500).json({ mensaje: 'Error interno del servidor' })
})

module.exports = app