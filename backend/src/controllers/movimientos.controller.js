// Controlador de movimientos: registrar entradas/salidas y consultar el historial.
//
// Un movimiento hace DOS cosas que deben ir juntas:
//   1) cambiar la cantidad del producto (suma si es entrada, resta si es salida)
//   2) anotar el movimiento en el historial
// Por eso se hacen dentro de una transacción: o se guardan las dos, o ninguna.
const pool = require('../config/database')
const { conTransaccion } = require('../utils/transaccion')
const { ErrorHttp } = require('../utils/errores')
const { textoObligatorio, textoOpcional, enteroPositivo, leerId } = require('../utils/validar')

// Mismo tope que en productos: evita números absurdos
const CANTIDAD_MAXIMA = 1000000

// Columnas que se devuelven de cada movimiento (así no repetimos la lista)
const COLUMNAS = `id, producto_id, producto_nombre, tipo, cantidad,
                  entrego, recibio, observacion, fecha`

// ---------------------------------------------------------------------
// GET /api/movimientos  ->  historial completo
//
// Incluye los movimientos de objetos que ya fueron eliminados: ahí
// "producto_id" viene vacío (null), pero "producto_nombre" sigue diciendo
// qué era.
// (Si algún día hay miles de movimientos, aquí se agregaría paginación.)
// ---------------------------------------------------------------------
async function listar(req, res) {
  // El más reciente primero. Si dos tienen la misma fecha (el DATETIME solo
  // llega hasta segundos), desempata el id: el más nuevo tiene el id mayor.
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM movimientos ORDER BY fecha DESC, id DESC`,
  )
  res.json(filas)
}

// ---------------------------------------------------------------------
// POST /api/movimientos  ->  registra una entrada o una salida
//
// Cuerpo (JSON):
//   { "tipo": "entrada" | "salida", "producto_id": 3, "cantidad": 5,
//     "entrego": "Ana", "recibio": "Luis", "observacion": "opcional" }
//
// Para crear un objeto NUEVO se usa POST /api/productos, no esta ruta.
// ---------------------------------------------------------------------
async function registrar(req, res) {
  // En Express 5, req.body puede ser undefined si no se envió nada
  const cuerpo = req.body || {}

  // 1) Revisar todo antes de tocar la base de datos
  if (cuerpo.tipo !== 'entrada' && cuerpo.tipo !== 'salida') {
    throw new ErrorHttp(400, 'El campo "tipo" debe ser "entrada" o "salida"')
  }
  const tipo = cuerpo.tipo

  if (cuerpo.producto_id === undefined || cuerpo.producto_id === null) {
    throw new ErrorHttp(400, 'El campo "producto" es obligatorio')
  }
  // leerId espera texto; desde un JSON el id puede llegar como número
  const productoId = leerId(
    typeof cuerpo.producto_id === 'number' ? String(cuerpo.producto_id) : cuerpo.producto_id,
  )

  const cantidad = enteroPositivo(cuerpo.cantidad, 'cantidad', CANTIDAD_MAXIMA)
  const entrego = textoObligatorio(cuerpo.entrego, 'quién entregó', 100)
  const recibio = textoObligatorio(cuerpo.recibio, 'quién recibió', 100)
  const observacion = textoOpcional(cuerpo.observacion, 'observación', 255)

  // 2) Actualizar la cantidad y anotar el movimiento, todo junto
  const resultado = await conTransaccion(async (conexion) => {
    // "FOR UPDATE" bloquea la fila del producto hasta que termine la
    // transacción. Así, si dos personas despachan a la vez, la segunda
    // espera y ve la cantidad ya actualizada. Sin esto, las dos podrían
    // leer "10", sacar 8 cada una, y el stock quedaría en -6.
    const [productos] = await conexion.execute(
      'SELECT id, nombre, cantidad FROM productos WHERE id = ? FOR UPDATE',
      [productoId],
    )
    if (productos.length === 0) throw new ErrorHttp(404, 'El objeto no existe')
    const producto = productos[0]

    // Calcular la cantidad nueva
    let cantidadNueva
    if (tipo === 'entrada') {
      cantidadNueva = producto.cantidad + cantidad
      if (cantidadNueva > CANTIDAD_MAXIMA) {
        throw new ErrorHttp(
          409,
          `El total de "${producto.nombre}" no puede pasar de ${CANTIDAD_MAXIMA} unidades`,
        )
      }
    } else {
      // REGLA PRINCIPAL: no se puede despachar más de lo que hay
      if (cantidad > producto.cantidad) {
        throw new ErrorHttp(
          409,
          `No hay suficientes productos. De "${producto.nombre}" solo hay ${producto.cantidad} disponibles.`,
        )
      }
      cantidadNueva = producto.cantidad - cantidad
    }

    await conexion.execute('UPDATE productos SET cantidad = ? WHERE id = ?', [
      cantidadNueva,
      productoId,
    ])

    // Guardamos también el nombre: si el objeto se elimina después, el
    // historial seguirá diciendo qué era.
    const [insercion] = await conexion.execute(
      `INSERT INTO movimientos
         (producto_id, producto_nombre, tipo, cantidad, entrego, recibio, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productoId, producto.nombre, tipo, cantidad, entrego, recibio, observacion],
    )

    // Leemos el movimiento recién guardado para devolverlo tal cual quedó
    // (con su fecha, que la pone la base de datos)
    const [movimientos] = await conexion.execute(
      `SELECT ${COLUMNAS} FROM movimientos WHERE id = ?`,
      [insercion.insertId],
    )

    return {
      movimiento: movimientos[0],
      producto: { id: producto.id, nombre: producto.nombre, cantidad: cantidadNueva },
    }
  })

  // 201 = "creado". Devolvemos el movimiento y la cantidad actual del
  // producto, para que el frontend actualice la pantalla sin pedir todo otra vez.
  res.status(201).json(resultado)
}

module.exports = { listar, registrar }