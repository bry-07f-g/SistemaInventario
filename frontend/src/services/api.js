// Aquí vive TODA la comunicación con el backend. Los demás archivos no usan
// "fetch" directamente: llaman a las funciones de este archivo. Así, si algún
// día cambia la dirección del servidor, solo se toca este lugar.

// Dirección del backend. "import.meta.env.VITE_API_URL" lee una variable de
// entorno de Vite (útil cuando despleguemos y el backend esté en otra
// dirección). Si no existe, usamos la de tu computador.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Función base: hace la petición y deja listo el resultado.
//  - Si todo sale bien, devuelve los datos (ya convertidos de JSON).
//  - Si el servidor responde con un error, lanza un Error con el mensaje
//    que el backend escribió (por ejemplo "No hay suficientes productos...").
//  - Si ni siquiera se pudo conectar, lanza un Error explicándolo.
async function pedir(ruta, opciones) {
  let respuesta
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, opciones)
  } catch {
    // fetch solo falla así cuando no hay conexión con el servidor
    throw new Error(
      'No se pudo conectar con el servidor. Revisa que el backend esté encendido.',
    )
  }

  // 204 = "hecho, sin nada que devolver" (así responde eliminar)
  if (respuesta.status === 204) return null

  // Intentamos leer el JSON; si la respuesta no trae uno, queda en null
  let datos
  try {
    datos = await respuesta.json()
  } catch {
    datos = null
  }

  // respuesta.ok es true para los códigos 200 a 299
  if (!respuesta.ok) {
    throw new Error(datos?.mensaje || 'Ocurrió un error inesperado')
  }
  return datos
}

// Envía datos en formato JSON (lo usamos para los movimientos)
function enviarJson(ruta, metodo, cuerpo) {
  return pedir(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

// ---------- Productos ----------

export function listarProductos() {
  return pedir('/api/productos')
}

// "formulario" es un FormData (permite enviar texto Y un archivo de imagen).
// No ponemos Content-Type a mano: el navegador lo arma solo, con el
// separador que necesita para mezclar texto y archivo.
export function crearProducto(formulario) {
  return pedir('/api/productos', { method: 'POST', body: formulario })
}

// Edita un objeto. Igual que crear, recibe un FormData (texto + imagen
// opcional). Usa PUT porque se reemplazan los datos del objeto "id".
export function actualizarProducto(id, formulario) {
  return pedir(`/api/productos/${id}`, { method: 'PUT', body: formulario })
}

export function eliminarProducto(id) {
  return pedir(`/api/productos/${id}`, { method: 'DELETE' })
}

// ---------- Movimientos ----------

export function listarMovimientos() {
  return pedir('/api/movimientos')
}

export function registrarMovimiento(datos) {
  return enviarJson('/api/movimientos', 'POST', datos)
}

// ---------- Imágenes ----------

// En la base de datos solo se guarda un texto con la ubicación de la imagen:
//  - En tu computador es una ruta ("uploads/123-ab.jpg"): la unimos con la
//    dirección del servidor.
//  - Al desplegar, las imágenes viven en Cloudinary y el texto ya es una
//    dirección completa ("https://res.cloudinary.com/..."): se usa tal cual.
// Si el objeto no tiene imagen, devuelve null.
export function urlImagen(ruta) {
  if (!ruta) return null
  if (/^https?:\/\//.test(ruta)) return ruta
  return `${API_URL}/${ruta}`
}