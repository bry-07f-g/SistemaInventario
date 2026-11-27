// Reglas de validación de los formularios. Cada función devuelve el
// MENSAJE de error (texto) si el valor está mal, o null si está bien.
// Así cada formulario arma un objeto { campo: mensaje } y lo muestra en
// rojo debajo de cada campo.

// Campo obligatorio: no puede quedar vacío (ni solo con espacios)
export function obligatorio(valor, mensaje) {
  return String(valor ?? '').trim() === '' ? mensaje : null
}

// Número entero desde "minimo" en adelante
export function entero(valor, minimo, mensaje) {
  const texto = String(valor ?? '').trim()
  if (texto === '') return mensaje
  const numero = Number(texto)
  return Number.isInteger(numero) && numero >= minimo ? null : mensaje
}

// Correo con forma de correo: algo@algo.algo
export function correo(valor) {
  const texto = String(valor ?? '').trim()
  if (texto === '') return 'Escribe el correo.'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)
    ? null
    : 'Escribe un correo válido, por ejemplo nombre@empresa.com.'
}

// Algunos errores del SERVIDOR son de un campo concreto (nombre repetido,
// correo repetido, sin stock). Esta función dice en qué campo mostrarlo.
// Devuelve { campo: mensaje } o null si es un error general.
export function errorDeCampo(error) {
  const campos = {
    NOMBRE_REPETIDO: 'nombre',
    CORREO_REPETIDO: 'email',
    SIN_STOCK: 'cantidad',
  }
  const campo = campos[error?.codigo]
  return campo ? { [campo]: error.message } : null
}