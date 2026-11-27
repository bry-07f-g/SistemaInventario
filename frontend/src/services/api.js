// Aquí vive TODA la comunicación de las pantallas con los datos. Las
// páginas llaman a estas funciones y no saben si hay internet o no:
//
//  - CON internet: se habla con el servidor (como antes) y, de paso, se
//    guarda una copia de los datos en el equipo.
//  - SIN internet: se leen los datos guardados, los cambios se aplican en
//    el equipo y quedan en una cola. Al volver la conexión se envían solos
//    (services/offline/sincronizar.js).
//
// La comunicación directa con el servidor está en servidor.js; lo de
// "sin internet" está en la carpeta services/offline.
import {
  API_URL,
  ejecutarAccion,
  emailSesion,
  guardarInventario,
  guardarSesion,
  inventarioActual,
  servidor,
  token,
  cuandoVenzaLaSesion as registrarVencimiento,
} from './servidor.js'
import { estadoConexion } from './offline/conexion.js'
import { claves, leerCache, guardarCache, aplicarLocal } from './offline/local.js'
import { encolar, hayPendientes, descargarTodo, sincronizar } from './offline/sincronizar.js'
import {
  recordarCredenciales,
  comprobarSinConexion,
  olvidarCredenciales,
} from './offline/credenciales.js'

// ---------- Sesión ----------

export function hayToken() {
  return Boolean(token())
}

export function inventarioGuardado() {
  return inventarioActual()
}

export function elegirInventario(id) {
  guardarInventario(id)
}

// Cuando el servidor dice que la sesión ya no sirve: se olvida la sesión
// y también la huella de la contraseña de este equipo (puede que se la
// hayan cambiado), y App vuelve al login.
export function cuandoVenzaLaSesion(funcion) {
  registrarVencimiento((mensaje) => {
    const email = emailSesion()
    if (email) olvidarCredenciales(email)
    guardarSesion(null, null)
    funcion(mensaje)
  })
}

// Inicia sesión. CON internet lo valida el servidor; SIN internet, la
// huella guardada en este equipo (solo si esa persona ya entró antes con
// internet aquí).
export async function iniciarSesion(email, password) {
  const correo = email.trim().toLowerCase()
  try {
    const respuesta = await servidor.login(correo, password)
    guardarSesion(respuesta.token, respuesta.usuario.email)
    await guardarCache(claves.usuario(respuesta.usuario.email), respuesta.usuario)
    await recordarCredenciales(respuesta.usuario.email, password, respuesta.token)
    // En segundo plano: enviar lo pendiente y descargar los datos
    sincronizar()
      .then(() => descargarTodo())
      .catch(() => {})
    return respuesta.usuario
  } catch (error) {
    if (!error.sinConexion) {
      // Cuenta desactivada: también deja de entrar sin internet
      if (error.estado === 403) olvidarCredenciales(correo)
      throw error
    }
    const tokenGuardado = await comprobarSinConexion(correo, password)
    if (!tokenGuardado) throw new Error('Correo o contraseña incorrectos', { cause: error })
    const usuario = await leerCache(claves.usuario(correo))
    if (!usuario) {
      throw new Error('Sin conexión. No hay datos guardados de esta cuenta en este equipo.', {
        cause: error,
      })
    }
    guardarSesion(tokenGuardado, correo)
    return usuario
  }
}

export function cerrarSesion() {
  guardarSesion(null, null)
}

// ---------- Lecturas ----------
//
// Con internet y sin cambios pendientes: se piden al servidor y se guarda
// la copia. Si no hay conexión (o hay cambios sin enviar, que solo están
// en el equipo): se devuelve la copia guardada.
async function leerConRespaldo(clave, pedirAlServidor) {
  if (estadoConexion().enLinea && !(await hayPendientes())) {
    try {
      const datos = await pedirAlServidor()
      await guardarCache(clave, datos)
      return datos
    } catch (error) {
      if (!error.sinConexion) throw error
    }
  }
  const guardado = await leerCache(clave)
  if (guardado === undefined) {
    throw new Error(
      'Sin conexión: estos datos no están guardados en este equipo. Conéctate a internet para descargarlos.',
    )
  }
  return guardado
}

// ¿Quién soy y qué empresas puedo usar?
export async function obtenerUsuarioActual() {
  if (estadoConexion().enLinea && !(await hayPendientes())) {
    try {
      const usuario = await servidor.yo()
      // Sesiones de antes de la app sin internet no guardaban el correo
      if (!emailSesion()) guardarSesion(token(), usuario.email)
      await guardarCache(claves.usuario(usuario.email), usuario)
      return usuario
    } catch (error) {
      if (!error.sinConexion) throw error
    }
  }
  const usuario = emailSesion() ? await leerCache(claves.usuario(emailSesion())) : undefined
  if (!usuario) throw new Error('Sin conexión y sin datos guardados. Conéctate a internet.')
  return usuario
}

export function listarProductos() {
  const id = inventarioActual()
  return leerConRespaldo(claves.productos(id), () => servidor.productos(id))
}

export function listarMovimientos() {
  const id = inventarioActual()
  return leerConRespaldo(claves.movimientos(id), () => servidor.movimientos(id))
}

export function listarInventarios() {
  return leerConRespaldo(claves.inventarios, () => servidor.inventarios())
}

export function listarUsuarios() {
  return leerConRespaldo(claves.usuarios, () => servidor.usuarios())
}

export function verUsuario(id) {
  return leerConRespaldo(claves.detalleUsuario(id), () => servidor.usuario(id))
}

// ---------- Cambios ----------
//
// Con internet (y sin nada pendiente) se envían directo al servidor.
// Sin internet: se aplican en el equipo y se guardan en la cola.
async function escribir(accion) {
  const completa = {
    ...accion,
    uuid: crypto.randomUUID(), // identificador único de esta acción
    fecha: new Date().toISOString(), // cuándo pasó en realidad
    email: emailSesion(), // quién la hizo
  }

  if (estadoConexion().enLinea && !(await hayPendientes())) {
    try {
      return await ejecutarAccion(completa, false)
    } catch (error) {
      if (!error.sinConexion) throw error
      // Se cortó justo ahora: seguimos abajo, sin conexión
    }
  }

  const usuario = await leerCache(claves.usuario(completa.email))
  completa.empresa = usuario?.inventarios.find((e) => e.id === completa.inventarioId)?.nombre ?? null
  completa.usuarioNombre = usuario?.nombre ?? completa.email
  // Aplica el cambio en el equipo (y revisa las mismas reglas que el servidor)
  const resultado = await aplicarLocal(completa, usuario)
  await encolar(completa)
  sincronizar() // por si la conexión ya volvió
  return resultado
}

// Los formularios con foto llegan como FormData; para guardarlos en la
// cola se pasan a un objeto normal { campo: valor } (la foto va como archivo)
function aObjeto(formulario) {
  return Object.fromEntries(formulario.entries())
}

export function crearProducto(formulario) {
  return escribir({ tipo: 'crearProducto', inventarioId: inventarioActual(), datos: aObjeto(formulario) })
}

export function actualizarProducto(id, formulario) {
  return escribir({
    tipo: 'editarProducto',
    inventarioId: inventarioActual(),
    objetivoId: id,
    datos: aObjeto(formulario),
  })
}

export function eliminarProducto(id) {
  return escribir({ tipo: 'eliminarProducto', inventarioId: inventarioActual(), objetivoId: id, datos: {} })
}

export function registrarMovimiento(datos) {
  return escribir({ tipo: 'movimiento', inventarioId: inventarioActual(), datos })
}

export function crearInventario(datos) {
  return escribir({ tipo: 'crearInventario', datos })
}

export function actualizarInventario(id, datos) {
  return escribir({ tipo: 'editarInventario', objetivoId: id, datos })
}

export function eliminarInventario(id) {
  return escribir({ tipo: 'eliminarInventario', objetivoId: id, datos: {} })
}

export function crearUsuario(datos) {
  return escribir({ tipo: 'crearUsuario', datos })
}

export function actualizarUsuario(id, datos) {
  return escribir({ tipo: 'editarUsuario', objetivoId: id, datos })
}

export function cambiarContrasenaUsuario(id, password) {
  return escribir({ tipo: 'cambiarContrasena', objetivoId: id, datos: { password } })
}

export function eliminarUsuario(id) {
  return escribir({ tipo: 'eliminarUsuario', objetivoId: id, datos: {} })
}

// ---------- Imágenes ----------
//
// - En tu computador: ruta "uploads/123-ab.jpg" -> se une con el servidor.
// - Publicado: dirección completa de Cloudinary -> tal cual.
// - Foto tomada sin internet: texto "data:image/..." -> tal cual.
export function urlImagen(ruta) {
  if (!ruta) return null
  if (/^(https?:|data:)/.test(ruta)) return ruta
  return `${API_URL}/${ruta}`
}