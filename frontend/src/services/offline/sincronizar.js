// La COLA de cambios hechos sin internet y cómo se envían al volver la red.
//
// Cada cambio es un objeto "acción" guardado en el cajón "cola":
//   orden       -> número creciente: se envían en el mismo orden en que se hicieron
//   email       -> quién lo hizo (se envía con SU sesión)
//   tipo        -> 'crearProducto', 'movimiento', 'crearUsuario'...
//   descripcion -> texto para mostrar ("Despachar 3 de Casco")
//   estado      -> 'pendiente' (esperando) o 'error' (el servidor lo rechazó)
//   error       -> { mensaje, codigo } si falló
//   ...         -> datos, ids, uuid, fecha real, versión vista
import { todos, guardar, borrar } from './db.js'
import { actualizarEstado, estadoConexion, suscribir } from './conexion.js'
import { claves, leerCache, guardarCache } from './local.js'
import {
  ejecutarAccion,
  emailSesion,
  token,
  inventarioActual,
  guardarInventario,
  servidor,
} from '../servidor.js'

// ---------- Cola ----------

let ultimoOrden = 0
function siguienteOrden() {
  // Date.now() da milisegundos; el máximo evita repetir si van muy seguidos
  ultimoOrden = Math.max(Date.now(), ultimoOrden + 1)
  return ultimoOrden
}

export async function encolar(accion) {
  const item = { ...accion, orden: siguienteOrden(), estado: 'pendiente', error: null }
  await guardar('cola', item.orden, item)
  await contarCola()
  return item
}

export function listarCola() {
  return todos('cola')
}

export async function descartar(orden) {
  await borrar('cola', orden)
  await contarCola()
}

export async function reintentar(orden) {
  const item = (await listarCola()).find((i) => i.orden === orden)
  if (!item) return
  await guardar('cola', orden, { ...item, estado: 'pendiente', error: null })
  await contarCola()
  sincronizar()
}

// ¿Hay cambios pendientes de ESTE usuario? (mientras haya, se muestran los
// datos locales, que ya los incluyen)
export async function hayPendientes() {
  const email = emailSesion()
  return (await listarCola()).some((i) => i.email === email && i.estado === 'pendiente')
}

// Actualiza los números del indicador
export async function contarCola() {
  const cola = await listarCola()
  actualizarEstado({
    pendientes: cola.filter((i) => i.estado === 'pendiente').length,
    conflictos: cola.filter((i) => i.estado === 'error').length,
  })
}

// ---------- Descargar datos para usar sin internet ----------
//
// Guarda en el equipo los objetos y el historial de TODAS las empresas del
// usuario (y, si es super admin, las empresas y los usuarios). Se llama
// después de iniciar sesión y después de cada sincronización.
let descargando = null
export function descargarTodo() {
  if (!descargando) {
    descargando = (async () => {
      const email = emailSesion()
      if (!email || !token()) return
      const usuario = await servidor.yo()
      await guardarCache(claves.usuario(email), usuario)
      for (const empresa of usuario.inventarios) {
        await guardarCache(claves.productos(empresa.id), await servidor.productos(empresa.id))
        await guardarCache(claves.movimientos(empresa.id), await servidor.movimientos(empresa.id))
      }
      if (usuario.esSuperAdmin) {
        await guardarCache(claves.inventarios, await servidor.inventarios())
        const usuarios = await servidor.usuarios()
        await guardarCache(claves.usuarios, usuarios)
        for (const u of usuarios) {
          await guardarCache(claves.detalleUsuario(u.id), await servidor.usuario(u.id))
        }
      }
    })().finally(() => {
      descargando = null
    })
  }
  return descargando
}

// ---------- Sincronizar ----------

// Cambia los ids temporales (negativos) por los reales. Si un id temporal
// no tiene equivalente es porque la acción que lo creaba falló: esta
// acción tampoco se puede aplicar.
function resolverIds(item, mapa) {
  const real = (id) => {
    if (typeof id !== 'number' || id >= 0) return id
    if (mapa[id] === undefined) {
      const error = new Error(
        'No se pudo aplicar porque depende de otro cambio que tampoco se pudo sincronizar.',
      )
      error.codigo = 'DEPENDE'
      throw error
    }
    return mapa[id]
  }
  const copia = { ...item, datos: { ...item.datos } }
  copia.inventarioId = real(item.inventarioId)
  copia.objetivoId = real(item.objetivoId)
  if (copia.datos.producto_id !== undefined) copia.datos.producto_id = real(copia.datos.producto_id)
  if (Array.isArray(copia.datos.permisos)) {
    copia.datos.permisos = copia.datos.permisos.map((p) => ({ ...p, inventario_id: real(p.inventario_id) }))
  }
  return copia
}

let enCurso = null

// Envía, en orden, los cambios pendientes del usuario de la sesión.
// Al terminar, avisa a la app con el evento "inventario:sincronizado"
// y un resumen: cuántos se aplicaron, cuáles fallaron y los avisos
// (por ejemplo, despachos que quedaron pendientes por falta de stock).
export function sincronizar() {
  if (!enCurso) {
    enCurso = ejecutarSincronizacion().finally(() => {
      enCurso = null
    })
  }
  return enCurso
}

async function ejecutarSincronizacion() {
  const email = emailSesion()
  if (!email || !token() || !estadoConexion().enLinea) return null

  const items = (await listarCola()).filter((i) => i.email === email && i.estado === 'pendiente')
  if (items.length === 0) return null

  actualizarEstado({ sincronizando: true })
  const mapa = (await leerCache(claves.mapaIds)) ?? {}
  const resumen = { aplicados: 0, conflictos: [], avisos: [] }
  let cortado = false

  for (const item of items) {
    try {
      const respuesta = await ejecutarAccion(resolverIds(item, mapa), true)

      // Anotamos el id real de lo que se creó sin internet
      if (item.idTemporal !== undefined && respuesta?.id !== undefined) {
        mapa[item.idTemporal] = respuesta.id
      }
      // Despacho que quedó PENDIENTE por falta de stock
      if (respuesta?.movimiento?.estado === 'pendiente') {
        resumen.avisos.push(
          `Por conflicto de datos faltan ${respuesta.faltan} unidades de "${respuesta.movimiento.producto_nombre}" para el envío de ${respuesta.movimiento.cantidad}. Confirma el envío desde el Historial cuando haya stock suficiente.`,
        )
      }
      await borrar('cola', item.orden)
      resumen.aplicados += 1
    } catch (error) {
      // Se cortó la red o la sesión ya no sirve: se para y se reintenta luego
      if (error.sinConexion || error.estado === 401) {
        cortado = true
        break
      }
      // Eliminar algo que otra persona ya eliminó: el resultado es el mismo
      if (error.codigo === 'NO_EXISTE' && item.tipo.startsWith('eliminar')) {
        await borrar('cola', item.orden)
        resumen.aplicados += 1
        continue
      }
      // Cualquier otro rechazo es un CONFLICTO: queda guardado para revisarlo
      const conError = { ...item, estado: 'error', error: { mensaje: error.message, codigo: error.codigo ?? null } }
      await guardar('cola', item.orden, conError)
      resumen.conflictos.push(conError)
    }
  }

  await guardarCache(claves.mapaIds, mapa)

  // Si la empresa elegida se había creado sin internet, ahora usa su id real
  const elegida = inventarioActual()
  if (elegida !== null && elegida < 0 && mapa[elegida] !== undefined) guardarInventario(mapa[elegida])

  // Con todo enviado, se descarga de nuevo el estado REAL del servidor
  if (!cortado) {
    try {
      await descargarTodo()
    } catch {
      // si falla, se intentará en la próxima sincronización
    }
  }

  actualizarEstado({ sincronizando: false })
  await contarCola()
  window.dispatchEvent(new CustomEvent('inventario:sincronizado', { detail: resumen }))
  return resumen
}

// ---------- Vigilar la conexión ----------
//
// Sin conexión, cada 15 segundos se prueba si el servidor responde.
// Cuando vuelve, se sincroniza solo.
let vigilando = false
export function vigilarConexion() {
  if (vigilando) return
  vigilando = true

  window.addEventListener('online', () => probarConexion())
  window.addEventListener('offline', () => actualizarEstado({ enLinea: false }))

  setInterval(() => {
    if (!estadoConexion().enLinea) probarConexion()
  }, 15000)

  // Cuando se pasa de "sin conexión" a "en línea" (por cualquier
  // petición que vuelva a responder), se sincroniza
  let antes = estadoConexion().enLinea
  suscribir((estado) => {
    if (!antes && estado.enLinea) sincronizar()
    antes = estado.enLinea
  })

  contarCola()
}

export async function probarConexion() {
  try {
    await servidor.salud()
    sincronizar()
  } catch {
    // sigue sin conexión
  }
}