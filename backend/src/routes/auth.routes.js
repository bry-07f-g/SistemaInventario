// Rutas de sesión. Todas empiezan con /api/auth (así se monta en app.js).
const { Router } = require('express')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { autenticar } = require('../middlewares/auth')
const controlador = require('../controllers/auth.controller')

const router = Router()

// Límite de intentos: como la página es pública, alguien podría probar
// miles de contraseñas. Después de 10 intentos FALLIDOS con el mismo
// correo desde la misma conexión, hay que esperar 15 minutos.
// (Los intentos correctos no cuentan.)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10,
  skipSuccessfulRequests: true,
  // La "llave" es conexión (IP) + correo: así un atacante no bloquea a
  // toda la oficina, solo ese correo desde su propia conexión.
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    return `${ipKeyGenerator(req.ip)}|${email}`
  },
  // Respuesta en el mismo formato que los demás errores (429 = demasiados intentos)
  handler: (req, res) => {
    res.status(429).json({
      mensaje: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.',
    })
  },
})

// POST /api/auth/login  -> inicia sesión (NO pide token: aún no lo tienes)
router.post('/login', limiteLogin, controlador.login)

// GET  /api/auth/yo     -> ¿quién soy y qué inventarios puedo usar?
router.get('/yo', autenticar, controlador.yo)

module.exports = router