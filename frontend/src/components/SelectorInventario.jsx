import { useId, useRef, useState } from 'react'
import NombreResaltado from './NombreResaltado.jsx'
import { filtrarPorNombre } from '../utils/inventario.js'

// Selector de inventario (empresa) para el header. Funciona igual que el
// selector de objetos: se puede ESCRIBIR para filtrar en tiempo real, o
// abrir la lista y desplazarse. Al elegir, cambia de empresa de inmediato.
//
// Recibe por props:
//  - inventarios: lista [{ id, nombre }, ...]
//  - valor: id del inventario elegido (número)
//  - onElegir: función que recibe el id elegido
function SelectorInventario({ inventarios, valor, onElegir }) {
  const id = useId()
  const campo = useRef(null)
  const [abierto, setAbierto] = useState(false)
  // Lo escrito (null = no está escribiendo: se ve el nombre elegido)
  const [escrito, setEscrito] = useState(null)
  const [activo, setActivo] = useState(0)

  const elegido = inventarios.find((inv) => inv.id === valor)

  // Con UNA sola empresa no hay nada que elegir: solo se muestra el nombre
  if (inventarios.length === 1) {
    return (
      <p className="selector-inventario__unico">
        Inventario: <strong>{elegido?.nombre}</strong>
      </p>
    )
  }

  const filtrando = escrito !== null && escrito.trim() !== ''
  const visibles = filtrando ? filtrarPorNombre(inventarios, escrito) : inventarios

  function elegir(inventario) {
    onElegir(inventario.id)
    setEscrito(null)
    setAbierto(false)
    campo.current?.blur() // quita el foco: ya se eligió
  }

  function alEscribir(evento) {
    setEscrito(evento.target.value)
    setAbierto(true)
    setActivo(0)
  }

  // Al salir sin elegir, vuelve a verse la empresa actual
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
      evento.preventDefault()
      if (visibles[activo]) elegir(visibles[activo])
    } else if (evento.key === 'Escape') {
      setAbierto(false)
      setEscrito(null)
    }
  }

  return (
    <div className="selector-inventario">
      <label htmlFor={id} className="selector-inventario__etiqueta">
        Inventario
      </label>
      <div className="combo">
        <input
          ref={campo}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          autoComplete="off"
          // Mientras escribe se ve lo escrito; si no, la empresa elegida
          value={escrito ?? elegido?.nombre ?? ''}
          placeholder="Busca una empresa..."
          onChange={alEscribir}
          // Al entrar al campo se selecciona el texto: así se puede
          // escribir encima directamente
          onFocus={(e) => {
            e.target.select()
            setAbierto(true)
          }}
          onBlur={alSalir}
          onKeyDown={alPresionarTecla}
        />
        <button
          type="button"
          className="combo__flecha"
          tabIndex={-1}
          aria-label="Mostrar u ocultar la lista de inventarios"
          onMouseDown={(e) => {
            e.preventDefault()
            if (abierto) setAbierto(false)
            else campo.current?.focus()
          }}
        >
          ▾
        </button>

        {abierto && (
          <ul className="combo__lista" id={`${id}-lista`} role="listbox">
            {visibles.length === 0 && (
              <li className="combo__vacio">
                Ninguna empresa coincide con &quot;{escrito.trim()}&quot;.
              </li>
            )}
            {visibles.map((inv, i) => (
              <li
                key={inv.id}
                role="option"
                aria-selected={inv.id === valor}
                className={[
                  'combo__opcion',
                  i === activo ? 'combo__opcion--activa' : '',
                  inv.id === valor ? 'combo__opcion--elegida' : '',
                ].join(' ')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(inv)}
              >
                <NombreResaltado nombre={inv.nombre} busqueda={filtrando ? escrito : ''} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default SelectorInventario