// Rutas de productos: une cada dirección + método con su función.
// Todas empiezan con /api/productos (así se monta en app.js).
//
// Cada ruta pasa por varios "filtros" EN ORDEN, de izquierda a derecha:
//   1) autenticar      -> ¿inició sesión?
//   2) exigirPermiso   -> ¿puede hacer esto en el inventario elegido?
//   3) subirImagen     -> recibe la foto (solo si pasó los dos anteriores,
//                         así nadie sin permiso puede subir archivos)
//   4) el controlador  -> hace el trabajo
const { Router } = require('express')
const { subirImagen } = require('../middlewares/upload')
const { autenticar, exigirPermiso } = require('../middlewares/auth')
const controlador = require('../controllers/productos.controller')

const router = Router()

// Todas las rutas de este archivo exigen haber iniciado sesión
router.use(autenticar)

// GET    /api/productos      -> lista los objetos del inventario
router.get('/', exigirPermiso('ver'), controlador.listar)

// POST   /api/productos      -> crea un objeto (con imagen opcional).
// Exige crear E ingresar: el objeto nace con su primer ingreso.
router.post('/', exigirPermiso('crear', 'ingresar'), subirImagen, controlador.crear)

// PUT    /api/productos/:id  -> edita un objeto (":id" es el número del objeto)
router.put('/:id', exigirPermiso('editar'), subirImagen, controlador.actualizar)

// DELETE /api/productos/:id  -> elimina un objeto
router.delete('/:id', exigirPermiso('eliminar'), controlador.eliminar)

module.exports = router