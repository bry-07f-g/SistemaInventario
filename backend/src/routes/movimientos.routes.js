// Rutas de movimientos (entradas y salidas).
// Todas empiezan con /api/movimientos (así se monta en app.js).
const { Router } = require('express')
const controlador = require('../controllers/movimientos.controller')

const router = Router()

// GET  /api/movimientos  -> historial completo (el más reciente primero)
router.get('/', controlador.listar)

// POST /api/movimientos  -> registra una entrada o una salida
router.post('/', controlador.registrar)

module.exports = router