// Controlador de movimientos: registrar entradas/salidas y consultar el historial.
//
// Un movimiento hace DOS cosas que deben ir juntas:
//   1) cambiar la cantidad del producto (suma si es entrada, resta si es salida)
//   2) anotar el movimiento en el historial
// Por eso se hacen dentro de una transacción: o se guardan las dos, o ninguna.
//
// VERSIÓN 2: todo pasa dentro del inventario elegido (req.inventarioId) y
// cada movimiento guarda qué usuario del sistema lo registró (req.usuario).
// Los permisos ya los revisó la ruta: "ingresar" para las entradas y
// "despachar" para las salidas.
const pool = require('../config/database')
const { conTransaccion } = require('../utils/transaccion')
const { ErrorHttp, esUuidRepetido } = require('../utils/errores')
const {
  textoObligatorio,
  textoOpcional,
  enteroPositivo,
  leerId,
  uuidOpcional,
  fechaOpcional,
  booleanoOpcional,
} = require('../utils/validar')

// Mismo tope que en productos: evita números absurdos
const CANTIDAD_MAXIMA = 1000000

// Columnas que se devuelven de cada movimiento (así no repetimos la lista)
//   usuario_nombre -> quién lo registró en el sistema
//   estado         -> 'aplicado' (normal), 'pendiente' o 'cancelado'
//                     (estos dos se usarán con la app sin internet)
const COLUMNAS = `id, producto_id, producto_nombre, tipo, cantidad,
                  entrego, recibio, observacion, usuario_nombre, estado, fecha,
                  uuid_cliente`

// Lee un movimiento y la cantidad ACTUAL de su objeto (para responder)
async function movimientoConProducto(conexion, movimientoId) {
  const [movimientos] = await conexion.execute(
    `SELECT ${COLUMNAS} FROM movimientos WHERE id = ?`,
    [movimientoId],
  )
  const movimiento = movimientos[0]
  let producto = null
  if (movimiento.producto_id !== null) {
    const [productos] = await conexion.execute(
      'SELECT id, nombre, cantidad FROM productos WHERE id = ?',
      [movimiento.producto_id],
    )
    producto = productos[0] ?? null
  }
  return { movimiento, producto }
}

// ---------------------------------------------------------------------
// GET /api/movimientos  ->  historial del inventario elegido
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
    `SELECT ${COLUMNAS} FROM movimientos
      WHERE inventario_id = ?
      ORDER BY fecha DESC, id DESC`,
    [req.inventarioId],
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
// Campos que SOLO envía la app sin internet al sincronizar:
//   "uuid_cliente": identificador del movimiento (evita registrarlo dos veces)
//   "fecha": cuándo pasó en realidad
//   "permitir_pendiente": true -> si es una salida y NO alcanza el stock,
//      en vez de rechazarla se guarda como 'pendiente' (sin restar nada)
//      para que el usuario la confirme cuando haya stock suficiente.
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
  const uuid = uuidOpcional(cuerpo.uuid_cliente)
  const fecha = fechaOpcional(cuerpo.fecha)
  const permitirPendiente = booleanoOpcional(cuerpo.permitir_pendiente)

  // ¿Ya se había sincronizado este movimiento? Entonces no se repite:
  // se devuelve el que ya existe (con la cantidad actual del objeto).
  if (uuid) {
    const [existentes] = await pool.execute(
      'SELECT id, inventario_id FROM movimientos WHERE uuid_cliente = ?',
      [uuid],
    )
    if (existentes.length > 0) {
      if (existentes[0].inventario_id !== req.inventarioId) {
        throw new ErrorHttp(409, 'Ese identificador ya se usó en otro inventario')
      }
      const datos = await movimientoConProducto(pool, existentes[0].id)
      return res.status(200).json({ ...datos, repetido: true })
    }
  }

  // 2) Actualizar la cantidad y anotar el movimiento, todo junto
  const resultado = await conTransaccion(async (conexion) => {
    // "FOR UPDATE" bloquea la fila del producto hasta que termine la
    // transacción. Así, si dos personas despachan a la vez, la segunda
    // espera y ve la cantidad ya actualizada. Sin esto, las dos podrían
    // leer "10", sacar 8 cada una, y el stock quedaría en -6.
    // "AND inventario_id = ?": solo objetos del inventario elegido.
    const [productos] = await conexion.execute(
      'SELECT id, nombre, cantidad FROM productos WHERE id = ? AND inventario_id = ? FOR UPDATE',
      [productoId, req.inventarioId],
    )
    if (productos.length === 0) throw new ErrorHttp(404, 'El objeto no existe', 'NO_EXISTE')
    const producto = productos[0]

    // Calcular la cantidad nueva
    let cantidadNueva
    let estado = 'aplicado'
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
        if (!permitirPendiente) {
          throw new ErrorHttp(
            409,
            `No hay suficientes productos. De "${producto.nombre}" solo hay ${producto.cantidad} disponibles.`,
            'SIN_STOCK',
          )
        }
        // Sincronización: se guarda como PENDIENTE y el stock no cambia
        estado = 'pendiente'
        cantidadNueva = producto.cantidad
      } else {
        cantidadNueva = producto.cantidad - cantidad
      }
    }

    if (estado === 'aplicado') {
      await conexion.execute('UPDATE productos SET cantidad = ? WHERE id = ?', [
        cantidadNueva,
        productoId,
      ])
    }

    // Guardamos también el nombre del objeto y del usuario: si alguno se
    // elimina después, el historial seguirá diciendo quién y qué fue.
    const [insercion] = await conexion.execute(
      `INSERT INTO movimientos
         (inventario_id, producto_id, producto_nombre, tipo, cantidad,
          entrego, recibio, observacion, usuario_id, usuario_nombre,
          estado, uuid_cliente, fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [
        req.inventarioId, productoId, producto.nombre, tipo, cantidad,
        entrego, recibio, observacion, req.usuario.id, req.usuario.nombre,
        estado, uuid, fecha,
      ],
    )

    // Leemos el movimiento recién guardado para devolverlo tal cual quedó
    // (con su fecha, que la pone la base de datos)
    const resultado = await movimientoConProducto(conexion, insercion.insertId)

    // Si quedó pendiente, decimos cuántas unidades faltan
    if (estado === 'pendiente') resultado.faltan = cantidad - producto.cantidad
    return resultado
  }).catch(async (error) => {
    // El mismo movimiento llegó dos veces a la vez: la transacción de este
    // se deshizo sola; devolvemos el que sí quedó guardado.
    if (!esUuidRepetido(error)) throw error
    const [existentes] = await pool.execute('SELECT id FROM movimientos WHERE uuid_cliente = ?', [uuid])
    return { ...(await movimientoConProducto(pool, existentes[0].id)), repetido: true }
  })

  // 201 = "creado" (o 200 si ya existía). Devolvemos el movimiento y la cantidad actual del
  // producto, para que el frontend actualice la pantalla sin pedir todo otra vez.
  res.status(resultado.repetido ? 200 : 201).json(resultado)
}

// ---------------------------------------------------------------------
// Busca un despacho PENDIENTE del inventario elegido, bloqueándolo
// (FOR UPDATE) para que nadie lo confirme dos veces al mismo tiempo.
// ---------------------------------------------------------------------
async function buscarPendiente(conexion, id, inventarioId) {
  const [filas] = await conexion.execute(
    `SELECT id, producto_id, producto_nombre, cantidad, estado
       FROM movimientos WHERE id = ? AND inventario_id = ? FOR UPDATE`,
    [id, inventarioId],
  )
  if (filas.length === 0) throw new ErrorHttp(404, 'El movimiento no existe', 'NO_EXISTE')
  if (filas[0].estado !== 'pendiente') {
    throw new ErrorHttp(409, 'Ese envío ya no está pendiente', 'NO_PENDIENTE')
  }
  return filas[0]
}

// ---------------------------------------------------------------------
// POST /api/movimientos/:id/confirmar
// Confirma un despacho pendiente: ahora SÍ resta las unidades. Solo se
// puede si ya hay stock suficiente.
// ---------------------------------------------------------------------
async function confirmar(req, res) {
  const id = leerId(req.params.id)

  const resultado = await conTransaccion(async (conexion) => {
    const pendiente = await buscarPendiente(conexion, id, req.inventarioId)

    if (pendiente.producto_id === null) {
      throw new ErrorHttp(
        409,
        `El objeto "${pendiente.producto_nombre}" fue eliminado. Cancela este envío.`,
        'NO_EXISTE',
      )
    }

    const [productos] = await conexion.execute(
      'SELECT id, nombre, cantidad FROM productos WHERE id = ? FOR UPDATE',
      [pendiente.producto_id],
    )
    const producto = productos[0]
    if (pendiente.cantidad > producto.cantidad) {
      const faltan = pendiente.cantidad - producto.cantidad
      throw new ErrorHttp(
        409,
        `Todavía faltan ${faltan} unidades de "${producto.nombre}" (hay ${producto.cantidad}). Ingresa más stock y vuelve a confirmar.`,
        'SIN_STOCK',
      )
    }

    await conexion.execute('UPDATE productos SET cantidad = cantidad - ? WHERE id = ?', [
      pendiente.cantidad,
      producto.id,
    ])
    // registrado_en = cuándo se aplicó de verdad
    await conexion.execute(
      "UPDATE movimientos SET estado = 'aplicado', registrado_en = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    )
    return movimientoConProducto(conexion, id)
  })

  res.json(resultado)
}

// ---------------------------------------------------------------------
// POST /api/movimientos/:id/cancelar
// Decide NO hacer un despacho pendiente. Queda en el historial como
// 'cancelado' (no se borra, para que se sepa qué pasó).
// ---------------------------------------------------------------------
async function cancelar(req, res) {
  const id = leerId(req.params.id)

  const resultado = await conTransaccion(async (conexion) => {
    await buscarPendiente(conexion, id, req.inventarioId)
    await conexion.execute("UPDATE movimientos SET estado = 'cancelado' WHERE id = ?", [id])
    return movimientoConProducto(conexion, id)
  })

  res.json(resultado)
}

module.exports = { listar, registrar, confirmar, cancelar }