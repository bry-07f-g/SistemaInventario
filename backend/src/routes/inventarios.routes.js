// Rutas de inventarios (empresas). Todas empiezan con /api/inventarios.
// SOLO el super administrador puede usarlas.
//
// (Los demás usuarios ven SUS inventarios en GET /api/auth/yo.)
const { Router } = require('express')
const { autenticar, soloSuperAdmin } = require('../middlewares/auth')
const controlador = require('../controllers/inventarios.controller')

const router = Router()

// Todas las rutas: primero sesión, luego super admin
router.use(autenticar, soloSuperAdmin)

router.get('/', controlador.listar) //          lista con conteos
router.post('/', controlador.crear) //          crea una empresa
router.put('/:id', controlador.actualizar) //   renombra
router.delete('/:id', controlador.eliminar) //  borra (solo si está vacía)

module.exports = router