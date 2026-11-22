// Aquí se arma la aplicación Express: sus "reglas" y sus rutas.
// (Encender el servidor se hace en server.js; aquí solo se configura.)
const express = require('express')
const cors = require('cors')
const pool = require('./config/database')

const app = express()

// CORS: el navegador bloquea por seguridad que una página (el frontend, en
// el puerto 5173) hable con otro servidor (este backend, en el 3000).
// Con esto le decimos que SOLO la dirección del frontend tiene permiso.
app.use(cors({ origin: process.env.FRONTEND_URL }))

// Permite leer el cuerpo de las peticiones cuando viene en formato JSON
app.use(express.json())

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

// Aquí irán las rutas de productos y de movimientos (siguientes pasos).

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
    return res.status(estado).json({ mensaje: 'Petición inválida' })
  }

  // Cualquier otro error SÍ es nuestro: el detalle técnico se queda en la
  // terminal y al usuario solo se le muestra un mensaje general.
  console.error(error)
  res.status(500).json({ mensaje: 'Error interno del servidor' })
})

module.exports = app