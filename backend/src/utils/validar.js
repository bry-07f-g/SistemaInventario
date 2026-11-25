// Funciones para revisar lo que llega de afuera ANTES de tocar la base de datos.
//
// Nunca se debe confiar en los datos que envía el navegador: las revisiones
// del formulario (required, min, maxLength) se pueden saltar fácilmente.
// Por eso el servidor repite todas las comprobaciones.
const { ErrorHttp } = require('./errores')

// Texto que no puede faltar. Devuelve el texto sin espacios sobrantes.
// "etiqueta" es el nombre del campo, para armar el mensaje de error.
function textoObligatorio(valor, etiqueta, maximo) {
  // Si un campo llega repetido, multer lo entrega como lista: no es texto
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorHttp(400, `El campo "${etiqueta}" es obligatorio`)
  }
  const texto = valor.trim()
  if (texto.length > maximo) {
    throw new ErrorHttp(
      400,
      `El campo "${etiqueta}" no puede pasar de ${maximo} caracteres`,
    )
  }
  return texto
}

// Texto que puede faltar. Si falta o está vacío devuelve null,
// que en la base de datos se guarda como "sin valor".
function textoOpcional(valor, etiqueta, maximo) {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string') {
    throw new ErrorHttp(400, `El campo "${etiqueta}" no es válido`)
  }
  const texto = valor.trim()
  if (texto === '') return null
  if (texto.length > maximo) {
    throw new ErrorHttp(
      400,
      `El campo "${etiqueta}" no puede pasar de ${maximo} caracteres`,
    )
  }
  return texto
}

// Número entero entre 1 y "maximo". Acepta "5" (texto, como llega en un
// formulario) y 5 (número, como llega en un JSON).
function enteroPositivo(valor, etiqueta, maximo) {
  let numero
  if (typeof valor === 'number') {
    numero = valor
  } else if (typeof valor === 'string' && /^\d{1,10}$/.test(valor.trim())) {
    // La expresión /^\d{1,10}$/ solo deja pasar dígitos: rechaza "1.5",
    // "-3", "1e3", "abc" y los textos vacíos.
    numero = Number(valor.trim())
  }

  if (!Number.isInteger(numero) || numero < 1 || numero > maximo) {
    throw new ErrorHttp(
      400,
      `El campo "${etiqueta}" debe ser un número entero entre 1 y ${maximo}`,
    )
  }
  return numero
}

// Número entero entre 0 y "maximo" que puede faltar. Sirve para campos como
// la cantidad mínima, donde 0 es un valor válido ("sin aviso").
// Si falta o llega vacío devuelve null: quien lo llama decide qué hacer
// (al crear usa 0; al editar deja el valor que ya tenía).
function enteroNoNegativoOpcional(valor, etiqueta, maximo) {
  if (valor === undefined || valor === null) return null
  if (typeof valor === 'string' && valor.trim() === '') return null

  let numero
  if (typeof valor === 'number') {
    numero = valor
  } else if (typeof valor === 'string' && /^\d{1,10}$/.test(valor.trim())) {
    numero = Number(valor.trim())
  }

  if (!Number.isInteger(numero) || numero < 0 || numero > maximo) {
    throw new ErrorHttp(
      400,
      `El campo "${etiqueta}" debe ser un número entero entre 0 y ${maximo}`,
    )
  }
  return numero
}

// El id que viene en la dirección (/api/productos/7). Siempre llega como
// texto, así que lo revisamos y lo convertimos a número.
function leerId(valor) {
  // Entre 1 y 2147483647, que es el número más grande que cabe en un INT
  if (typeof valor !== 'string' || !/^[1-9]\d{0,9}$/.test(valor) || Number(valor) > 2147483647) {
    throw new ErrorHttp(400, 'El id no es válido')
  }
  return Number(valor)
}

module.exports = {
  textoObligatorio,
  textoOpcional,
  enteroPositivo,
  enteroNoNegativoOpcional,
  leerId,
}