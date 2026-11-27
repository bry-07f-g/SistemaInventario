// Rutas de movimientos (entradas y salidas).
// Todas empiezan con /api/movimientos (así se monta en app.js).
const { Router } = require('express')
const { autenticar, exigirPermiso } = require('../middlewares/auth')
const controlador = require('../controllers/movimientos.controller')

const router = Router()

// Todas las rutas de este archivo exigen haber iniciado sesión
router.use(autenticar)

// El permiso para registrar depende del TIPO de movimiento:
//   entrada -> "ingresar"      salida -> "despachar"
// Preparamos los dos revisores una vez y elegimos según lo que llegó.
const puedeIngresar = exigirPermiso('ingresar')
const puedeDespachar = exigirPermiso('despachar')

function permisoSegunTipo(req, res, next) {
  // Si el tipo no es válido, revisamos "ingresar" y luego el controlador
  // responde con el error 400 que explica el problema.
  const revisor = req.body?.tipo === 'salida' ? puedeDespachar : puedeIngresar
  // "return" es importante: Express 5 espera la promesa y, si falla,
  // manda el error al manejador de errores.
  return revisor(req, res, next)
}

// GET  /api/movimientos  -> historial del inventario (el más reciente primero)
router.get('/', exigirPermiso('ver'), controlador.listar)


// Despachos PENDIENTES (quedan así cuando, al sincronizar la app sin
// internet, no alcanzaba el stock). Confirmar o cancelar es despachar.
router.post('/:id/confirmar', puedeDespachar, controlador.confirmar)
router.post('/:id/cancelar', puedeDespachar, controlador.cancelar)

module.exports = router