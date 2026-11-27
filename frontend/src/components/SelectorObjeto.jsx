import { useId, useRef, useState } from 'react'
import NombreResaltado from './NombreResaltado.jsx'
import { filtrarPorNombre, textoStock } from '../utils/inventario.js'

// Selector de objetos "2 en 1": un solo campo donde la persona puede
//   - ESCRIBIR: la lista se filtra letra por letra, o
//   - ABRIR la lista (clic o flecha) y desplazarse (scroll) para elegir.
// Reemplaza a la barra de búsqueda + el <select> que había por separado.
//
// Recibe por props:
//  - productos: la lista de objetos
//  - valor: id del objeto elegido, como texto ('' = ninguno). Lo guarda el
//    formulario que usa este componente.

//  - onElegir: función que se llama con el id elegido, o con '' cuando la
//    persona empieza a escribir otra vez (así nunca queda elegido un objeto
//    distinto al que se ve en el campo).

//  - bloquearAgotados: si es true, los objetos con 0 unidades se ven pero
//    no se pueden elegir (lo usa el despacho).
//  - error: mensaje en rojo debajo del campo (por ejemplo "Elige un objeto")
//  - ayuda: texto gris debajo del campo (por ejemplo "Disponibles: 5")
function SelectorObjeto({
  productos,
  valor,
  onElegir,
  bloquearAgotados = false,
  etiqueta = 'Objeto',
  error,
  ayuda,
}) {
  // useId crea un identificador único para unir la etiqueta con el campo
  const id = useId()
  const campo = useRef(null)

  // ¿Está desplegada la lista?
  const [abierto, setAbierto] = useState(false)

  // Lo que la persona ESCRIBIÓ. null = no está escribiendo: en ese caso el
  // campo muestra el nombre del objeto elegido (o queda vacío).
  const [escrito, setEscrito] = useState(null)

  // Posición (en la lista visible) de la opción resaltada con el teclado
  const [activo, setActivo] = useState(0)

  // El objeto elegido, si hay uno
  const elegido = productos.find((p) => String(p.id) === valor)

  // Texto que se ve en el campo
  const textoCampo = escrito ?? (elegido ? elegido.nombre : '')

  // Si la persona está escribiendo, se filtra; si solo abrió la lista, se
  // ven todos los objetos para poder desplazarse por ellos.
  const filtrando = escrito !== null && escrito.trim() !== ''
  const visibles = filtrando ? filtrarPorNombre(productos, escrito) : productos

  function puedeElegirse(producto) {
    return !(bloquearAgotados && producto.cantidad === 0)
  }

  function elegir(producto) {
    if (!puedeElegirse(producto)) return
    onElegir(String(producto.id))
    setEscrito(null) // el campo pasa a mostrar el nombre elegido
    setAbierto(false)
  }

  // Cada letra escrita: se guarda, se abre la lista y se desmarca el objeto
  // que estuviera elegido.
  function alEscribir(evento) {
    setEscrito(evento.target.value)
    setAbierto(true)
    setActivo(0)
    if (valor !== '') onElegir('')
  }

  // Al salir del campo se cierra la lista y se descarta lo escrito que no
  // se convirtió en una elección.
  function alSalir() {
    setAbierto(false)
    setEscrito(null)
  }

  // Teclado: flechas para moverse, Enter para elegir, Escape para cerrar
  function alPresionarTecla(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      if (!abierto) setAbierto(true)
      else setActivo(Math.min(activo + 1, visibles.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (abierto) setActivo(Math.max(activo - 1, 0))
    } else if (evento.key === 'Enter' && abierto) {
      // Con la lista abierta, Enter elige (y NO envía el formulario)
      evento.preventDefault()
      if (visibles[activo]) elegir(visibles[activo])
    } else if (evento.key === 'Escape') {
      setAbierto(false)
    }
  }

  return (
    <div className={error ? 'campo campo--error' : 'campo'}>
      <label htmlFor={id}>{etiqueta}</label>

      <div className="combo">
        <input
          ref={campo}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={textoCampo}
          placeholder="Escribe o elige un objeto..."
          onChange={alEscribir}
          onFocus={() => setAbierto(true)}
          onClick={() => setAbierto(true)}
          onBlur={alSalir}
          onKeyDown={alPresionarTecla}
        />

        {/* Flecha: abre o cierra la lista con el mouse */}
        <button
          type="button"
          className="combo__flecha"
          tabIndex={-1}
          aria-label="Mostrar u ocultar la lista de objetos"
          // mouseDown + preventDefault evita que el campo pierda el foco
          onMouseDown={(e) => {
            e.preventDefault()
            if (abierto) setAbierto(false)
            else {
              campo.current?.focus()
              setAbierto(true)
            }
          }}
        >
          ▾
        </button>

        {abierto && (
          <ul className="combo__lista" id={`${id}-lista`} role="listbox">
            {visibles.length === 0 && (
              <li className="combo__vacio">
                Ningún objeto coincide con &quot;{escrito.trim()}&quot;.
              </li>
            )}
            {/* map dibuja una fila por cada objeto que se ve */}
            {visibles.map((p, i) => {
              const permitido = puedeElegirse(p)
              const clases = [
                'combo__opcion',
                i === activo ? 'combo__opcion--activa' : '',
                p.id === elegido?.id ? 'combo__opcion--elegida' : '',
                permitido ? '' : 'combo__opcion--bloqueada',
              ].join(' ')
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={p.id === elegido?.id}
                  aria-disabled={!permitido}
                  className={clases}
                  // Mantiene el foco en el campo al hacer clic en la opción
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(p)}
                  // Si es la opción resaltada con el teclado, se desplaza
                  // la lista hasta dejarla a la vista
                  ref={(el) => {
                    if (el && i === activo) {
                      el.scrollIntoView?.({ block: 'nearest' })
                    }
                  }}
                >
                  <NombreResaltado
                    nombre={p.nombre}
                    busqueda={filtrando ? escrito : ''}
                  />{' '}
                  <span className="combo__stock">({textoStock(p)})</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {ayuda && <small className="campo__ayuda">{ayuda}</small>}
      {error && <small className="campo__error">{error}</small>}
    </div>
  )
}

export default SelectorObjeto