// Base de datos DENTRO del navegador (IndexedDB). Aquí se guarda todo lo
// que la app necesita para funcionar sin internet. A diferencia de
// localStorage, IndexedDB guarda objetos completos, listas grandes y hasta
// archivos (las fotos tomadas sin conexión).
//
// Tiene tres "cajones" (object stores):
//   cache         -> copia de los datos del servidor (objetos, historial,
//                    usuarios...) + los cambios hechos sin internet
//   cola          -> acciones hechas sin internet, esperando enviarse
//   credenciales  -> huella de la contraseña de cada usuario que ya entró
//                    con internet en este equipo (para el login sin red)

const NOMBRE = 'inventario-offline'
const VERSION = 1
const CAJONES = ['cache', 'cola', 'credenciales']

let conexion = null // se abre una sola vez y se reutiliza

function abrir() {
  if (!conexion) {
    conexion = new Promise((resolver, rechazar) => {
      const pedido = indexedDB.open(NOMBRE, VERSION)
      // Solo la primera vez (o al subir VERSION): se crean los cajones
      pedido.onupgradeneeded = () => {
        for (const cajon of CAJONES) {
          if (!pedido.result.objectStoreNames.contains(cajon)) {
            pedido.result.createObjectStore(cajon)
          }
        }
      }
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => rechazar(pedido.error)
    })
  }
  return conexion
}

// IndexedDB trabaja con "transacciones" y eventos. Esta función lo
// convierte en una promesa normal, para poder usar await.
async function operar(cajon, modo, accion) {
  const db = await abrir()
  return new Promise((resolver, rechazar) => {
    const transaccion = db.transaction(cajon, modo)
    const pedido = accion(transaccion.objectStore(cajon))
    transaccion.oncomplete = () => resolver(pedido?.result)
    transaccion.onerror = () => rechazar(transaccion.error)
    transaccion.onabort = () => rechazar(transaccion.error)
  })
}

export function leer(cajon, clave) {
  return operar(cajon, 'readonly', (almacen) => almacen.get(clave))
}

export function guardar(cajon, clave, valor) {
  return operar(cajon, 'readwrite', (almacen) => almacen.put(valor, clave))
}

export function borrar(cajon, clave) {
  return operar(cajon, 'readwrite', (almacen) => almacen.delete(clave))
}

// Todos los valores del cajón, ordenados por su clave
export function todos(cajon) {
  return operar(cajon, 'readonly', (almacen) => almacen.getAll())
}