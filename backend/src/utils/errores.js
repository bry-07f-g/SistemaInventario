// Un error "con código HTTP". Sirve para avisar de un problema cuya culpa es
// de quien envió los datos (400 = datos mal, 404 = no existe, 409 = ya existe).
//
// El mensaje SÍ se le muestra a la persona, así que debe estar escrito
// pensando en ella. Para los errores nuestros (500) nunca se usa esta clase.
//
// "codigo" (opcional) es una palabra fija para que el PROGRAMA (no la
// persona) sepa qué pasó, por ejemplo 'EDITADO_POR_OTRO'. La app de
// escritorio lo usa al sincronizar para decidir qué mostrar.
class ErrorHttp extends Error {
  constructor(estado, mensaje, codigo = null) {
    super(mensaje) // guarda el mensaje en error.message
    this.name = 'ErrorHttp'
    this.status = estado // el manejador de errores de app.js lo lee de aquí
    this.codigo = codigo
  }
}

// ¿El error es "ese uuid_cliente ya existe"? Pasa si la app envía la
// misma acción dos veces AL MISMO TIEMPO (la segunda choca con la primera).
// MySQL lo dice en el mensaje: "Duplicate entry '...' for key '...uuid_cliente'".
function esUuidRepetido(error) {
  return error.code === 'ER_DUP_ENTRY' && String(error.message).includes('uuid_cliente')
}

module.exports = { ErrorHttp, esUuidRepetido }