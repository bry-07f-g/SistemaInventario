// Rutas de usuarios. Todas empiezan con /api/usuarios.
// SOLO el super administrador puede usarlas.
const { Router } = require('express')
const { autenticar, soloSuperAdmin } = require('../middlewares/auth')
const controlador = require('../controllers/usuarios.controller')

const router = Router()

// Todas las rutas: primero sesión, luego super admin
router.use(autenticar, soloSuperAdmin)

router.get('/', controlador.listar) //                      lista de usuarios
router.get('/:id', controlador.ver) //                      un usuario y sus permisos
router.post('/', controlador.crear) //                      crea usuario + permisos
router.put('/:id', controlador.actualizar) //               edita datos, activo y permisos
router.put('/:id/password', controlador.cambiarContrasena) // contraseña nueva
router.delete('/:id', controlador.eliminar) //              elimina

module.exports = router