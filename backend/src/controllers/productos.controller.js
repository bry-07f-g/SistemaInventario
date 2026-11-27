// Controlador de productos: aquí está la lógica de cada operación.
// Las rutas (routes/productos.routes.js) deciden QUÉ función se ejecuta
// según la dirección y el método (GET, POST...); aquí se hace el trabajo.
//
// VERSIÓN 2: cada objeto pertenece a un inventario (empresa). Antes de
// llegar aquí, los middlewares de auth.js ya comprobaron que la persona
// inició sesión y que tiene el permiso necesario en ese inventario, y
// dejaron listos:
//   req.usuario       -> quién hace la acción
//   req.inventarioId  -> en qué inventario
// Por eso TODAS las consultas llevan "AND inventario_id = ?": así nadie
// puede tocar un objeto de otra empresa cambiando el número en la dirección.
//
// Como usamos Express 5, no hace falta try/catch en todas partes para pasar
// los errores: si una función async lanza un error, llega solo al manejador
// de errores de app.js.
const { guardarImagen, borrarImagen, descartarSubida } = require('../utils/archivos')
const pool = require('../config/database')
const { conTransaccion } = require('../utils/transaccion')
const { ErrorHttp } = require('../utils/errores')
const {
  textoObligatorio,
  textoOpcional,
  enteroPositivo,
  enteroNoNegativoOpcional,
  leerId,
  uuidOpcional,
  fechaOpcional,
} = require('../utils/validar')

// Tope para la cantidad: evita números absurdos y que al sumar se desborde
const CANTIDAD_MAXIMA = 1000000

// Columnas que se devuelven de cada objeto (así no repetimos la lista)
// version_datos: sube con cada edición (lo usa la app sin internet)
const COLUMNAS = 'id, nombre, descripcion, cantidad, cantidad_minima, imagen, version_datos, uuid_cliente'

// ---------------------------------------------------------------------
// GET /api/productos  ->  lista los objetos del inventario elegido
// ---------------------------------------------------------------------
async function listar(req, res) {
  // La "imagen" es la ruta guardada (ej: "uploads/123-ab.jpg"), la
  // dirección de Cloudinary, o null.
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM productos WHERE inventario_id = ? ORDER BY nombre`,
    [req.inventarioId],
  )
  res.json(filas)
}

// ---------------------------------------------------------------------
// POST /api/productos  ->  crea un objeto NUEVO en el inventario elegido
//
// Además de crear el objeto, anota su primer ingreso en el historial
// (quién entregó, quién recibió y qué usuario lo registró). Las dos cosas
// van en una transacción. Por eso la ruta exige los permisos crear E
// ingresar.
// ---------------------------------------------------------------------
async function crear(req, res) {
  // Si se envió imagen, multer ya la recibió ANTES de llegar aquí.
  // Si algo falla más abajo, hay que borrarla para no dejar archivos huérfanos.
  const archivo = req.file
  let imagen = null // lo que se guarda en la base: ruta local o dirección de Cloudinary
  let guardado = false // pasa a true cuando la base de datos ya confirmó
  let nombre
  let uuid = null

  try {
    // En Express 5, req.body puede ser undefined si no se envió nada
    const cuerpo = req.body || {}

    // 1) Revisar todo antes de tocar la base de datos
    nombre = textoObligatorio(cuerpo.nombre, 'nombre', 100)
    const descripcion = textoOpcional(cuerpo.descripcion, 'descripción', 1000)
    const cantidad = enteroPositivo(cuerpo.cantidad, 'cantidad', CANTIDAD_MAXIMA)
    // Cantidad mínima: cuando hay esta cantidad o menos, el objeto se marca
    // "próximo a agotar". Es opcional; si no se envía, queda en 0 (sin aviso).
    const cantidadMinima =
      enteroNoNegativoOpcional(cuerpo.cantidad_minima, 'cantidad mínima', CANTIDAD_MAXIMA) ?? 0
    const entrego = textoObligatorio(cuerpo.entrego, 'quién entregó', 100)
    const recibio = textoObligatorio(cuerpo.recibio, 'quién recibió', 100)
    const observacion = textoOpcional(cuerpo.observacion, 'observación', 255)

    // Solo llegan desde la app sin internet al sincronizar:
    //   uuid_cliente -> identificador que la app le dio al objeto
    //   fecha        -> cuándo se creó en realidad
    uuid = uuidOpcional(cuerpo.uuid_cliente)
    const fecha = fechaOpcional(cuerpo.fecha)

    // ¿Ya se había sincronizado este objeto? (pasa si se perdió la
    // respuesta y la app lo vuelve a enviar). Entonces NO se crea otra
    // vez: se devuelve el que ya existe.
    if (uuid) {
      const [existentes] = await pool.execute(
        `SELECT inventario_id, ${COLUMNAS} FROM productos WHERE uuid_cliente = ?`,
        [uuid],
      )
      if (existentes.length > 0) {
        const { inventario_id: inventarioDelObjeto, ...existente } = existentes[0]
        if (inventarioDelObjeto !== req.inventarioId) {
          throw new ErrorHttp(409, 'Ese identificador ya se usó en otro inventario')
        }
        await descartarSubida(archivo, null) // la foto repetida sobra
        guardado = true // (para que el catch no intente borrar nada más)
        return res.status(200).json({ ...existente, repetido: true })
      }
    }

    // Con todo validado, dejamos la imagen guardada (si se envió una)
    if (archivo) imagen = await guardarImagen(archivo)

    // 2) Guardar el objeto y su primer ingreso, juntos
    const id = await conTransaccion(async (conexion) => {
      // Los "?" se reemplazan por los valores de la lista, de forma segura.
      // NUNCA se pegan los datos directamente en el texto de la consulta:
      // eso permitiría un ataque llamado "inyección SQL".
      const [resultado] = await conexion.execute(
        `INSERT INTO productos
           (inventario_id, nombre, descripcion, cantidad, cantidad_minima, imagen, uuid_cliente)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.inventarioId, nombre, descripcion, cantidad, cantidadMinima, imagen, uuid],
      )

      // COALESCE(?, CURRENT_TIMESTAMP): la fecha real si llegó; si no, ahora
      await conexion.execute(
        `INSERT INTO movimientos
           (inventario_id, producto_id, producto_nombre, tipo, cantidad,
            entrego, recibio, observacion, usuario_id, usuario_nombre, fecha)
         VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          req.inventarioId, resultado.insertId, nombre, cantidad,
          entrego, recibio, observacion, req.usuario.id, req.usuario.nombre, fecha,
        ],
      )

      return resultado.insertId
    })
    guardado = true

    // 201 = "creado"
    res.status(201).json({
      id, nombre, descripcion, cantidad, cantidad_minima: cantidadMinima, imagen,
      version_datos: 0, uuid_cliente: uuid,
    })
  } catch (error) {
    // Si no se guardó nada, la imagen subida sobra: la borramos
    if (!guardado) await descartarSubida(archivo, imagen)

    // La misma creación llegó dos veces a la vez: la segunda choca con la
    // primera (por el uuid o por el nombre). Si el uuid ya quedó guardado,
    // devolvemos ese objeto en vez de un error.
    if (uuid && error.code === 'ER_DUP_ENTRY') {
      const [existentes] = await pool.execute(
        `SELECT ${COLUMNAS} FROM productos WHERE uuid_cliente = ?`,
        [uuid],
      )
      if (existentes.length > 0) return res.status(200).json({ ...existentes[0], repetido: true })
    }

    // El nombre no se repite DENTRO del mismo inventario: si ya existe,
    // MySQL avisa con este código. 409 = "conflicto".
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ErrorHttp(409, `Ya existe un objeto llamado "${nombre}" en este inventario`, 'NOMBRE_REPETIDO')
    }
    throw error
  }
}

// ---------------------------------------------------------------------
// PUT /api/productos/:id  ->  cambia nombre, descripción, imagen y cantidad mínima
//
// La CANTIDAD no se cambia aquí a propósito: solo cambia con entradas y
// salidas (movimientos), para que el historial siempre cuadre.
// ---------------------------------------------------------------------
async function actualizar(req, res) {
  const archivo = req.file // imagen nueva, si se envió
  let imagenSubida = null
  let guardado = false
  let nombre

  try {
    const id = leerId(req.params.id)
    const cuerpo = req.body || {}

    nombre = textoObligatorio(cuerpo.nombre, 'nombre', 100)
    const descripcion = textoOpcional(cuerpo.descripcion, 'descripción', 1000)
    // Si no se envía la cantidad mínima, se queda la que ya tenía (null aquí)
    const cantidadMinima = enteroNoNegativoOpcional(
      cuerpo.cantidad_minima,
      'cantidad mínima',
      CANTIDAD_MAXIMA,
    )
    // La app sin internet envía la versión que VIO del objeto. Si alguien
    // lo editó mientras tanto, la versión ya subió y lo avisamos (409) en
    // vez de pisar ese cambio. En línea no se envía (null = no revisar).
    const versionVista = enteroNoNegativoOpcional(cuerpo.version_datos, 'versión', 2147483647)

    // Con todo validado, guardamos la imagen nueva (si se envió una)
    if (archivo) imagenSubida = await guardarImagen(archivo)

    const imagenAnterior = await conTransaccion(async (conexion) => {
      // "FOR UPDATE" bloquea la fila mientras dura la transacción, para que
      // nadie más la cambie al mismo tiempo.
      // "AND inventario_id = ?": un objeto de OTRA empresa se trata como si
      // no existiera.
      const [filas] = await conexion.execute(
        'SELECT imagen, nombre, version_datos FROM productos WHERE id = ? AND inventario_id = ? FOR UPDATE',
        [id, req.inventarioId],
      )
      if (filas.length === 0) throw new ErrorHttp(404, 'El objeto no existe', 'NO_EXISTE')

      if (versionVista !== null && versionVista !== filas[0].version_datos) {
        throw new ErrorHttp(
          409,
          `Mientras estabas sin conexión, otra persona editó "${filas[0].nombre}". Revisa sus datos actuales y vuelve a aplicar tu cambio.`,
          'EDITADO_POR_OTRO',
        )
      }

      // Si se envió imagen nueva la usamos; si no, se queda la que tenía
      const imagenNueva = archivo ? imagenSubida : filas[0].imagen

      await conexion.execute(
        // COALESCE(?, cantidad_minima) significa: "usa el valor nuevo; y si el
        // nuevo está vacío (null), deja el que ya estaba"
        `UPDATE productos
            SET nombre = ?, descripcion = ?, imagen = ?,
                cantidad_minima = COALESCE(?, cantidad_minima),
                version_datos = version_datos + 1
          WHERE id = ?`,
        [nombre, descripcion, imagenNueva, cantidadMinima, id],
      )

      // El historial muestra el nombre del objeto: si cambió, lo actualizamos
      // también ahí para que todo se vea con el nombre nuevo.
      await conexion.execute(
        'UPDATE movimientos SET producto_nombre = ? WHERE producto_id = ?',
        [nombre, id],
      )

      return filas[0].imagen
    })
    guardado = true

    // Ya se guardó la imagen nueva: la anterior sobra
    if (archivo) await borrarImagen(imagenAnterior)

    const [filas] = await pool.execute(`SELECT ${COLUMNAS} FROM productos WHERE id = ?`, [id])
    if (filas.length === 0) throw new ErrorHttp(404, 'El objeto no existe')
    res.json(filas[0])
  } catch (error) {
    if (!guardado) await descartarSubida(archivo, imagenSubida)

    if (error.code === 'ER_DUP_ENTRY') {
      throw new ErrorHttp(409, `Ya existe un objeto llamado "${nombre}" en este inventario`, 'NOMBRE_REPETIDO')
    }
    throw error
  }
}

// ---------------------------------------------------------------------
// DELETE /api/productos/:id  ->  elimina un objeto
//
// Su historial se CONSERVA: en la base de datos, la llave foránea está en
// "ON DELETE SET NULL", y cada movimiento ya guarda el nombre del objeto
// y el inventario al que pertenecía.
// ---------------------------------------------------------------------
async function eliminar(req, res) {
  const id = leerId(req.params.id)

  const [filas] = await pool.execute(
    'SELECT imagen FROM productos WHERE id = ? AND inventario_id = ?',
    [id, req.inventarioId],
  )
  if (filas.length === 0) throw new ErrorHttp(404, 'El objeto no existe', 'NO_EXISTE')

  await pool.execute('DELETE FROM productos WHERE id = ? AND inventario_id = ?', [
    id,
    req.inventarioId,
  ])

  // Con el objeto ya borrado, su imagen también sobra
  await borrarImagen(filas[0].imagen)

  // 204 = "hecho, y no hay nada que devolver"
  res.status(204).end()
}

module.exports = { listar, crear, actualizar, eliminar }