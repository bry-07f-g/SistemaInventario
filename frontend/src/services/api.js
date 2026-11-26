// Aquí vive TODA la comunicación con el backend. Los demás archivos no usan
// "fetch" directamente: llaman a las funciones de este archivo. Así, si algún
// día cambia la dirección del servidor, solo se toca este lugar.
//
// VERSIÓN 2: además, este archivo recuerda la SESIÓN:
//   - el token (la "manilla" que el backend entrega al iniciar sesión)
//   - el inventario (empresa) con el que se está trabajando
// y los envía solos en cada petición, en los encabezados:
//   Authorization: Bearer <token>
//   X-Inventario-Id: <id>

// Dirección del backend. "import.meta.env.VITE_API_URL" lee una variable de
// entorno de Vite (en Vercel apunta a Render). Si no existe, usamos la de
// tu computador.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ---------- Sesión guardada en el navegador ----------
//
// localStorage guarda textos en el navegador y NO se borran al cerrar la
// pestaña: así no hay que iniciar sesión cada vez que se abre la página.
// Se usa con try/catch porque algunos navegadores (modo privado estricto)
// lo bloquean; en ese caso la sesión dura solo mientras la pestaña esté
// abierta.
const CLAVE_TOKEN = 'inventario_token'
const CLAVE_INVENTARIO = 'inventario_actual'

function leerGuardado(clave) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    // Sin localStorage: no pasa nada, se usa solo la memoria
  }
}

// Copias en memoria (más rápidas que leer localStorage cada vez)
let token = leerGuardado(CLAVE_TOKEN)
let inventarioId = leerGuardado(CLAVE_INVENTARIO)

export function hayToken() {
  return Boolean(token)
}

export function guardarToken(nuevo) {
  token = nuevo
  guardar(CLAVE_TOKEN, nuevo)
}

export function inventarioGuardado() {
  return inventarioId ? Number(inventarioId) : null
}

export function elegirInventario(id) {
  inventarioId = id === null ? null : String(id)
  guardar(CLAVE_INVENTARIO, inventarioId)
}

// App registra aquí qué hacer cuando la sesión deja de servir (por
// ejemplo, el administrador desactivó al usuario): volver al login.
let alVencerSesion = () => {}
export function cuandoVenzaLaSesion(funcion) {
  alVencerSesion = funcion
}

// ---------- Función base ----------
//
// Hace la petición y deja listo el resultado.
//  - Si todo sale bien, devuelve los datos (ya convertidos de JSON).
//  - Si el servidor responde con un error, lanza un Error con el mensaje
//    que el backend escribió (por ejemplo "No hay suficientes productos...").
//  - Si ni siquiera se pudo conectar, lanza un Error explicándolo.
async function pedir(ruta, opciones = {}) {
  // Encabezados que van en TODAS las peticiones (si existen)
  const encabezados = { ...opciones.headers }
  if (token) encabezados.Authorization = `Bearer ${token}`
  if (inventarioId) encabezados['X-Inventario-Id'] = inventarioId

  let respuesta
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { ...opciones, headers: encabezados })
  } catch {
    // fetch solo falla así cuando no hay conexión con el servidor
    throw new Error(
      'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.',
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

  // 401 con un token puesto = la sesión ya no sirve (venció, cambiaron la
  // contraseña, desactivaron la cuenta...). Se borra y se vuelve al login.
  if (respuesta.status === 401 && token) {
    guardarToken(null)
    alVencerSesion(datos?.mensaje || 'Tu sesión terminó. Inicia sesión de nuevo.')
  }

  // respuesta.ok es true para los códigos 200 a 299
  if (!respuesta.ok) {
    throw new Error(datos?.mensaje || 'Ocurrió un error inesperado')
  }
  return datos
}

// Envía datos en formato JSON
function enviarJson(ruta, metodo, cuerpo) {
  return pedir(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

// ---------- Sesión ----------

// Devuelve { token, usuario }. El token se guarda aquí mismo.
export async function iniciarSesion(email, password) {
  const respuesta = await enviarJson('/api/auth/login', 'POST', { email, password })
  guardarToken(respuesta.token)
  return respuesta.usuario
}

// ¿Quién soy y qué inventarios puedo usar? (se llama al abrir la página)
export function obtenerUsuarioActual() {
  return pedir('/api/auth/yo')
}

export function cerrarSesion() {
  guardarToken(null)
}

// ---------- Productos (del inventario elegido) ----------

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

// ---------- Movimientos (del inventario elegido) ----------

export function listarMovimientos() {
  return pedir('/api/movimientos')
}

export function registrarMovimiento(datos) {
  return enviarJson('/api/movimientos', 'POST', datos)
}

// ---------- Solo super administrador: empresas ----------

export function listarInventarios() {
  return pedir('/api/inventarios')
}

export function crearInventario(datos) {
  return enviarJson('/api/inventarios', 'POST', datos)
}

export function actualizarInventario(id, datos) {
  return enviarJson(`/api/inventarios/${id}`, 'PUT', datos)
}

export function eliminarInventario(id) {
  return pedir(`/api/inventarios/${id}`, { method: 'DELETE' })
}

// ---------- Solo super administrador: usuarios ----------

export function listarUsuarios() {
  return pedir('/api/usuarios')
}

export function verUsuario(id) {
  return pedir(`/api/usuarios/${id}`)
}

export function crearUsuario(datos) {
  return enviarJson('/api/usuarios', 'POST', datos)
}

export function actualizarUsuario(id, datos) {
  return enviarJson(`/api/usuarios/${id}`, 'PUT', datos)
}

export function cambiarContrasenaUsuario(id, password) {
  return enviarJson(`/api/usuarios/${id}/password`, 'PUT', { password })
}

export function eliminarUsuario(id) {
  return pedir(`/api/usuarios/${id}`, { method: 'DELETE' })
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