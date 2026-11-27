import { useRef, useState } from 'react'

// Manejo de los errores de un formulario (el texto rojo debajo de cada
// campo). Devuelve:
//  - errores: { campo: 'mensaje' } con los errores que se ven ahora
//  - mostrar(nuevos): pone los errores nuevos y lleva el cursor al primer
//    campo con error. Devuelve true si NO hay errores (todo bien).
//  - quitar(campo): borra el error de ese campo (al escribir en él)
//  - formulario: ref para ponerle al <form> (para encontrar el campo)
export function useErrores() {
  const [errores, setErrores] = useState({})
  const formulario = useRef(null)

  function mostrar(nuevos) {
    // Solo se quedan los campos que de verdad tienen mensaje
    const conError = Object.fromEntries(Object.entries(nuevos).filter(([, mensaje]) => mensaje))
    setErrores(conError)
    const hayErrores = Object.keys(conError).length > 0
    if (hayErrores) {
      // Se espera a que React dibuje los errores y se enfoca el primero
      requestAnimationFrame(() => {
        formulario.current?.querySelector('[aria-invalid="true"]')?.focus()
      })
    }
    return !hayErrores
  }

  function quitar(campo) {
    setErrores((actuales) => (actuales[campo] ? { ...actuales, [campo]: null } : actuales))
  }

  return { errores, mostrar, quitar, formulario }
}