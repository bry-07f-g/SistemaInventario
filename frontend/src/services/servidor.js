// Comunicación DIRECTA con el backend (sin nada de "modo sin conexión").
// api.js usa estas funciones y decide si llamar al servidor o trabajar
// con los datos guardados en el equipo.
//
// Aquí también vive la SESIÓN: token, correo de quien inició sesión y
// empresa elegida. Se guardan en localStorage para no perderlos al
// recargar la página.
import { actualizarEstado } from './offline/conexion.js'

// Dirección del backend (en Vercel apunta a Render; si no existe, la local)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ---------- Sesión guardada en el navegador ----------
const CLAVE_TOKEN = 'inventario_token'
const CLAVE_EMAIL = 'inventario_email'
const CLAVE_INVENTARIO = 'inventario_actual'

function leerGuardado(clave) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardarLocal(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    // Sin localStorage: se usa solo la memoria
  }
}

const sesion = {
  token: leerGuardado(CLAVE_TOKEN),
  email: leerGuardado(CLAVE_EMAIL),
  inventarioId: leerGuardado(CLAVE_INVENTARIO),
}

export function token() {
  return sesion.token
}

export function emailSesion() {
  return sesion.email
}

export function guardarSesion(nuevoToken, email) {
  sesion.token = nuevoToken
  sesion.email = email
  guardarLocal(CLAVE_TOKEN, nuevoToken)
  guardarLocal(CLAVE_EMAIL, email)
}

export function inventarioActual() {
  return sesion.inventarioId ? Number(sesion.inventarioId) : null
}

export function guardarInventario(id) {
  sesion.inventarioId = id === null ? null : String(id)
  guardarLocal(CLAVE_INVENTARIO, sesion.inventarioId)
}

// App registra aquí qué hacer cuando la sesión deja de servir (401)
let alVencerSesion = () => {}
export function cuandoVenzaLaSesion(funcion) {
  alVencerSesion = funcion
}
export function avisarSesionVencida(mensaje) {
  alVencerSesion(mensaje)
}

// ---------- Petición al servidor ----------
//
// Si todo sale bien, devuelve los datos. Si el servidor responde con un
// error, lanza un Error con su mensaje y, además, con:
//   error.estado  -> código HTTP (400, 404, 409...)
//   error.codigo  -> código para el programa ('SIN_STOCK', 'NO_EXISTE'...)
// Si NO hay conexión, lanza un Error con error.sinConexion = true y marca
// la app como "sin conexión".
//
// opciones.inventario: empresa para ESTA petición (si no, la elegida)
export async function pedir(ruta, opciones = {}) {
  const encabezados = { ...opciones.headers }
  if (sesion.token) encabezados.Authorization = `Bearer ${sesion.token}`
  const inventario = opciones.inventario ?? sesion.inventarioId
  if (inventario !== null && inventario !== undefined) {
    encabezados['X-Inventario-Id'] = String(inventario)
  }

  let respuesta
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { ...opciones, headers: encabezados })
  } catch {
    // fetch solo falla así cuando no llega al servidor
    actualizarEstado({ enLinea: false })
    const error = new Error('Sin conexión con el servidor.')
    error.sinConexion = true
    throw error
  }

  // Si respondió, hay conexión (salvo que el sistema diga que se acaba de
  // cortar: puede llegar tarde la respuesta de algo pedido antes del corte)
  if (navigator.onLine !== false) actualizarEstado({ enLinea: true })

  if (respuesta.status === 204) return null

  let datos
  try {
    datos = await respuesta.json()
  } catch {
    datos = null
  }

  // 401 con token = la sesión ya no sirve: se avisa a App (vuelve al login)
  if (respuesta.status === 401 && sesion.token) {
    avisarSesionVencida(datos?.mensaje || 'Tu sesión terminó. Inicia sesión de nuevo.')
  }

  if (!respuesta.ok) {
    const error = new Error(datos?.mensaje || 'Ocurrió un error inesperado')
    error.estado = respuesta.status
    error.codigo = datos?.codigo ?? null
    throw error
  }
  return datos
}

function enviarJson(ruta, metodo, cuerpo, inventario) {
  return pedir(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    inventario,
  })
}

// Convierte un objeto { campo: valor } en FormData (para enviar con foto)
function aFormulario(campos) {
  const formulario = new FormData()
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor === undefined || valor === null) continue
    if (campo === 'imagen') formulario.append('imagen', valor, valor.name || 'foto.jpg')
    else formulario.append(campo, valor)
  }
  return formulario
}

// ---------------------------------------------------------------------
// Ejecuta en el servidor UNA acción (hecha en línea o guardada en la cola).
// accion = { tipo, inventarioId, objetivoId, datos, uuid, fecha, version }
// sincronizando = true cuando viene de la cola: entonces se envían también
// la fecha real, la versión vista del objeto y "permitir_pendiente".
// ---------------------------------------------------------------------
export function ejecutarAccion(accion, sincronizando = false) {
  const { tipo, inventarioId, objetivoId, datos, uuid } = accion
  const extra = sincronizando ? { fecha: accion.fecha } : {}

  switch (tipo) {
    case 'crearProducto':
      return pedir('/api/productos', {
        method: 'POST',
        body: aFormulario({ ...datos, uuid_cliente: uuid, ...extra }),
        inventario: inventarioId,
      })
    case 'editarProducto':
      return pedir(`/api/productos/${objetivoId}`, {
        method: 'PUT',
        body: aFormulario({
          ...datos,
          version_datos: sincronizando ? accion.version : undefined,
        }),
        inventario: inventarioId,
      })
    case 'eliminarProducto':
      return pedir(`/api/productos/${objetivoId}`, { method: 'DELETE', inventario: inventarioId })
    case 'movimiento':
      return enviarJson(
        '/api/movimientos',
        'POST',
        { ...datos, uuid_cliente: uuid, ...extra, permitir_pendiente: sincronizando },
        inventarioId,
      )
    case 'confirmarPendiente':
      return pedir(`/api/movimientos/${objetivoId}/confirmar`, { method: 'POST', inventario: inventarioId })
    case 'cancelarPendiente':
      return pedir(`/api/movimientos/${objetivoId}/cancelar`, { method: 'POST', inventario: inventarioId })
    case 'crearInventario':
      return enviarJson('/api/inventarios', 'POST', { ...datos, uuid_cliente: uuid })
    case 'editarInventario':
      return enviarJson(`/api/inventarios/${objetivoId}`, 'PUT', datos)
    case 'eliminarInventario':
      return pedir(`/api/inventarios/${objetivoId}`, { method: 'DELETE' })
    case 'crearUsuario':
      return enviarJson('/api/usuarios', 'POST', { ...datos, uuid_cliente: uuid })
    case 'editarUsuario':
      return enviarJson(`/api/usuarios/${objetivoId}`, 'PUT', datos)
    case 'cambiarContrasena':
      return enviarJson(`/api/usuarios/${objetivoId}/password`, 'PUT', datos)
    case 'eliminarUsuario':
      return pedir(`/api/usuarios/${objetivoId}`, { method: 'DELETE' })
    default:
      throw new Error(`Acción desconocida: ${tipo}`)
  }
}

// Lecturas directas al servidor
export const servidor = {
  login: (email, password) => enviarJson('/api/auth/login', 'POST', { email, password }),
  yo: () => pedir('/api/auth/yo'),
  productos: (inventario) => pedir('/api/productos', { inventario }),
  movimientos: (inventario) => pedir('/api/movimientos', { inventario }),
  inventarios: () => pedir('/api/inventarios'),
  usuarios: () => pedir('/api/usuarios'),
  usuario: (id) => pedir(`/api/usuarios/${id}`),
  salud: () => pedir('/api/salud'),
}