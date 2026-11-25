import { normalizar } from '../utils/inventario.js'

// Escribe el nombre de un objeto y pinta (resalta) las letras que coinciden
// con lo que la persona está buscando, justo donde están.
// Ejemplo: nombre "Marcadores" y búsqueda "ca" -> Mar[ca]dores
//
// Recibe por props:
//  - nombre: el nombre del objeto
//  - busqueda: lo que está escrito en la barra de búsqueda
function NombreResaltado({ nombre, busqueda }) {
  const consulta = normalizar(busqueda.trim())
  const comparable = normalizar(nombre)

  // Sin búsqueda, el nombre va tal cual. (La segunda condición es una
  // salvaguarda: si al normalizar cambió el largo del texto, las posiciones
  // ya no coincidirían, así que mejor no resaltar.)
  if (consulta === '' || comparable.length !== nombre.length) {
    return <>{nombre}</>
  }

  // Partimos el nombre en pedazos: unos que coinciden y otros que no.
  // "indexOf" dice en qué posición empieza la coincidencia (-1 = no hay).
  const pedazos = []
  let desde = 0
  let posicion = comparable.indexOf(consulta)
  while (posicion !== -1) {
    if (posicion > desde) {
      pedazos.push({ texto: nombre.slice(desde, posicion), coincide: false })
    }
    pedazos.push({
      texto: nombre.slice(posicion, posicion + consulta.length),
      coincide: true,
    })
    desde = posicion + consulta.length
    posicion = comparable.indexOf(consulta, desde)
  }
  if (desde < nombre.length) {
    pedazos.push({ texto: nombre.slice(desde), coincide: false })
  }

  // Dibujamos cada pedazo con ".map": los que coinciden van en <mark>
  return (
    <>
      {pedazos.map((pedazo, i) =>
        pedazo.coincide ? (
          <mark key={i} className="resaltado">
            {pedazo.texto}
          </mark>
        ) : (
          <span key={i}>{pedazo.texto}</span>
        ),
      )}
    </>
  )
}

export default NombreResaltado