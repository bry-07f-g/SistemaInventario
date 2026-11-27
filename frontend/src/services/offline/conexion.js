// Estado de la conexión, compartido por toda la app.
//   enLinea        -> ¿hay comunicación con el servidor?
//   sincronizando  -> ¿se están enviando los cambios guardados?
//   pendientes     -> cuántos cambios esperan enviarse
//   conflictos     -> cuántos cambios fallaron al enviarse
//
// Los componentes (el indicador de abajo a la derecha) se "suscriben":
// cada vez que algo cambia, se les avisa para que se vuelvan a dibujar.

let estado = {
  enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
  sincronizando: false,
  pendientes: 0,
  conflictos: 0,
}

const oyentes = new Set()

export function estadoConexion() {
  return estado
}

// Devuelve una función para dejar de escuchar (React la usa al desmontar)
export function suscribir(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export function actualizarEstado(cambios) {
  // Se crea un objeto NUEVO: React solo redibuja si la referencia cambia
  estado = { ...estado, ...cambios }
  oyentes.forEach((oyente) => oyente(estado))
}