// Rutas de sesión. Todas empiezan con /api/auth (así se monta en app.js).
const { Router } = require('express')
const { autenticar } = require('../middlewares/auth')
const controlador = require('../controllers/auth.controller')

const router = Router()

// POST /api/auth/login  -> inicia sesión (NO pide token: aún no lo tienes)
router.post('/login', controlador.login)

// GET  /api/auth/yo     -> ¿quién soy y qué inventarios puedo usar?
router.get('/yo', autenticar, controlador.yo)

module.exports = router