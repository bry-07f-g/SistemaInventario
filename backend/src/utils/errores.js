// Un error "con código HTTP". Sirve para avisar de un problema cuya culpa es
// de quien envió los datos (400 = datos mal, 404 = no existe, 409 = ya existe).
//
// El mensaje SÍ se le muestra a la persona, así que debe estar escrito
// pensando en ella. Para los errores nuestros (500) nunca se usa esta clase.
class ErrorHttp extends Error {
  constructor(estado, mensaje) {
    super(mensaje) // guarda el mensaje en error.message
    this.name = 'ErrorHttp'
    this.status = estado // el manejador de errores de app.js lo lee de aquí
  }
}

module.exports = { ErrorHttp }