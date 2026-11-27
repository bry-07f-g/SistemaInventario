import { useId, useRef, useState } from 'react'
import NombreResaltado from './NombreResaltado.jsx'
import { filtrarPorNombre } from '../utils/inventario.js'

// Selector buscador de EMPRESA para el formulario de usuarios. Funciona
// igual que el de objetos: se puede escribir para filtrar o abrir la lista
// con la flecha y elegir.
// Recibe por props:
//  - opciones: las empresas que se pueden elegir [{ id, nombre }, ...]
//    (el formulario ya quitó las que están elegidas en otros bloques)
//  - elegida: la empresa elegida en este bloque ({ id, nombre }) o null
//  - onElegir: función que recibe la empresa elegida, o null si la persona
//    empieza a escribir otra
//  - error: mensaje en rojo debajo del campo
function SelectorEmpresa({ opciones, elegida, onElegir, error }) {
  const id = useId()
  const campo = useRef(null)
  const [abierto, setAbierto] = useState(false)
  // Lo escrito (null = no está escribiendo: se ve el nombre elegido)
  const [escrito, setEscrito] = useState(null)
  const [activo, setActivo] = useState(0)

  const filtrando = escrito !== null && escrito.trim() !== ''
  const visibles = filtrando ? filtrarPorNombre(opciones, escrito) : opciones

  function elegir(empresa) {
    onElegir(empresa)
    setEscrito(null)
    setAbierto(false)
  }

  function alEscribir(evento) {
    setEscrito(evento.target.value)
    setAbierto(true)
    setActivo(0)
    if (elegida) onElegir(null)
  }

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
      <label htmlFor={id}>Empresa</label>
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
          value={escrito ?? elegida?.nombre ?? ''}
          placeholder="Escribe o elige una empresa..."
          onChange={alEscribir}
          onFocus={() => setAbierto(true)}
          onClick={() => setAbierto(true)}
          onBlur={alSalir}
          onKeyDown={alPresionarTecla}
        />
        <button
          type="button"
          className="combo__flecha"
          tabIndex={-1}
          aria-label="Mostrar u ocultar la lista de empresas"
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
                {filtrando
                  ? `Ninguna empresa coincide con "${escrito.trim()}".`
                  : 'No quedan empresas por elegir.'}
              </li>
            )}
            {visibles.map((empresa, i) => (
              <li
                key={empresa.id}
                role="option"
                aria-selected={empresa.id === elegida?.id}
                className={[
                  'combo__opcion',
                  i === activo ? 'combo__opcion--activa' : '',
                  empresa.id === elegida?.id ? 'combo__opcion--elegida' : '',
                ].join(' ')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(empresa)}
              >
                <NombreResaltado nombre={empresa.nombre} busqueda={filtrando ? escrito : ''} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <small className="campo__error">{error}</small>}
    </div>
  )
}

export default SelectorEmpresa