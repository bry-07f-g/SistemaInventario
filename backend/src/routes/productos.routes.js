// Rutas de productos: une cada dirección + método con su función.
// Todas empiezan con /api/productos (así se monta en app.js).
const { Router } = require('express')
const { subirImagen } = require('../middlewares/upload')
const controlador = require('../controllers/productos.controller')

const router = Router()

// GET    /api/productos      -> lista todos los objetos
router.get('/', controlador.listar)

// POST   /api/productos      -> crea un objeto (con imagen opcional)
// "subirImagen" se ejecuta primero: guarda la imagen y luego pasa al controlador
router.post('/', subirImagen, controlador.crear)

// PUT    /api/productos/:id  -> edita un objeto (":id" es el número del objeto)
router.put('/:id', subirImagen, controlador.actualizar)

// DELETE /api/productos/:id  -> elimina un objeto
router.delete('/:id', controlador.eliminar)

module.exports = router