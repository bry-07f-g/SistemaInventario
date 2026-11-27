import { cloneElement, useId } from 'react'

// Un campo de formulario: etiqueta arriba, el cuadro (input, textarea...)
// y debajo, si hace falta, una ayuda gris y el ERROR en rojo.
// Recibe por props:
//  - etiqueta: el texto de arriba ("Nombre")
//  - error: mensaje de error (o nada si está bien)
//  - ayuda: texto gris opcional debajo del cuadro
//  - completo: si es true, ocupa las dos columnas del formulario
//  - children: el cuadro (un solo elemento: <input>, <textarea>...)
function Campo({ etiqueta, error, ayuda, completo = false, children }) {
  // useId crea un identificador único para unir la etiqueta, el cuadro,
  // la ayuda y el error
  const id = useId()

  const clases = ['campo', completo ? 'campo--completo' : '', error ? 'campo--error' : '']
    .filter(Boolean)
    .join(' ')

  // aria-describedby: los lectores de pantalla leen la ayuda y el error
  // junto con el campo
  const descripcion = [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={clases}>
      <label htmlFor={id}>{etiqueta}</label>
      {/* cloneElement copia el cuadro agregándole el id y aria-invalid
          (sirve para llevar el cursor al primer campo con error) */}
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': descripcion || undefined,
      })}
      {ayuda && (
        <small className="campo__ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </small>
      )}
      {error && (
        <small className="campo__error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  )
}

export default Campo