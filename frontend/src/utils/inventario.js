// Funciones de ayuda sobre el inventario. Las usan varias pantallas, por eso
// viven aquí y no repetidas en cada una.

// ---------------------------------------------------------------------
// ESTADO DEL STOCK
// ---------------------------------------------------------------------

// Dice en qué estado está un objeto, según cuántas unidades hay:
//   'agotado' -> no queda ninguna (rojo)
//   'bajo'    -> quedan pocas: la cantidad mínima o menos (amarillo,
//                "próximo a agotar")
//   'normal'  -> hay suficientes (verde)
// Si la cantidad mínima es 0, nunca da 'bajo': 0 significa "sin aviso".
export function estadoStock(producto) {
  if (producto.cantidad === 0) return 'agotado'
  if (producto.cantidad <= producto.cantidad_minima) return 'bajo'
  return 'normal'
}

// Texto corto para las listas desplegables, por ejemplo:
//   "hay 12"  |  "hay 3, próximo a agotar"  |  "agotado"
export function textoStock(producto) {
  const estado = estadoStock(producto)
  if (estado === 'agotado') return 'agotado'
  if (estado === 'bajo') return `hay ${producto.cantidad}, próximo a agotar`
  return `hay ${producto.cantidad}`
}

// ---------------------------------------------------------------------
// BÚSQUEDA
// ---------------------------------------------------------------------

// Prepara un texto para compararlo sin que importen las mayúsculas ni las
// tildes: "Lámpara" y "lampara" quedan iguales.
//  - toLowerCase: todo a minúsculas
//  - normalize('NFD'): separa cada letra de su tilde ("á" pasa a "a" + "´")
//  - replace(/\p{M}/gu, ''): borra esas tildes sueltas
export function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

// Devuelve solo los objetos cuyo nombre CONTIENE lo que se escribió, en
// cualquier parte del nombre (no solo al principio).
//  - "ma" encuentra "Marcadores" y también "Resma de papel".
//  - Si no se escribió nada, devuelve todos.
// "filter" va recorriendo la lista y se queda con los que cumplen la
// condición; luego la pantalla los dibuja con ".map".
export function filtrarPorNombre(productos, busqueda) {
  const consulta = normalizar(busqueda.trim())
  if (consulta === '') return productos
  return productos.filter((p) => normalizar(p.nombre).includes(consulta))
}