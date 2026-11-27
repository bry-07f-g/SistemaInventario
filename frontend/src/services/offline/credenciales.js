// Login SIN internet.
//
// Cuando alguien inicia sesión CON internet, guardamos en este equipo una
// "huella" de su contraseña (nunca la contraseña). La huella se calcula con
// PBKDF2: una función lenta a propósito (100.000 vueltas) que, junto a una
// "sal" al azar, hace muy difícil adivinar la contraseña aunque alguien
// copie la base de datos del navegador.
//
// Sin internet, se calcula la huella de lo que escribe la persona y se
// compara con la guardada. Si coinciden, entra con los datos guardados.
import { leer, guardar, borrar } from './db.js'

const VUELTAS = 100000

// Convierten bytes <-> texto (base64) para poder guardarlos
function aTexto(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}
function aBytes(texto) {
  return Uint8Array.from(atob(texto), (letra) => letra.charCodeAt(0))
}

// Calcula la huella con la API criptográfica del navegador (Web Crypto)
async function huella(password, sal) {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sal, iterations: VUELTAS, hash: 'SHA-256' },
    clave,
    256,
  )
  return aTexto(bits)
}

// Después de un login CON internet: guarda huella + token de ese correo
export async function recordarCredenciales(email, password, token) {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  await guardar('credenciales', email, {
    email,
    sal: aTexto(sal),
    huella: await huella(password, sal),
    token,
  })
}

// Login SIN internet. Devuelve el token guardado si la contraseña
// coincide, o null si no coincide. Lanza un error si ese correo nunca
// entró con internet en este equipo.
export async function comprobarSinConexion(email, password) {
  const guardadas = await leer('credenciales', email)
  if (!guardadas) {
    throw new Error(
      'Sin conexión. La primera vez que entras en este equipo necesitas internet.',
    )
  }
  const calculada = await huella(password, aBytes(guardadas.sal))
  return calculada === guardadas.huella ? guardadas.token : null
}

// Cuando el servidor dice que la sesión ya no sirve (le cambiaron la
// contraseña, lo desactivaron...), se borra: así la contraseña vieja deja
// de abrir la app sin internet en este equipo.
export function olvidarCredenciales(email) {
  return borrar('credenciales', email)
}