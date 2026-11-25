import { useEffect, useRef } from 'react'

// Ventana emergente (modal) para pedir confirmación antes de una acción
// delicada, por ejemplo eliminar. Reemplaza a window.confirm, que es la
// ventanita fea del navegador y no se puede personalizar.
//
// Recibe por props:
//  - titulo: el título de la ventana
//  - children: el contenido (el texto explicando qué va a pasar)
//  - textoConfirmar: lo que dice el botón de confirmar (ej. "Eliminar")
//  - peligro: si es true, el botón de confirmar se pinta rojo
//  - procesando: true mientras se espera al servidor (bloquea los botones)
//  - onConfirmar: función que se llama al pulsar el botón de confirmar
//  - onCancelar: función que se llama al cancelar (botón, Escape o clic fuera)
//
// Quien lo usa decide CUÁNDO se muestra: lo dibuja solo cuando hace falta
// (por ejemplo {porEliminar && <ModalConfirmacion ... />}).
function ModalConfirmacion({
  titulo,
  children,
  textoConfirmar = 'Confirmar',
  peligro = false,
  procesando = false,
  onConfirmar,
  onCancelar,
}) {
  // Referencias a elementos de la pantalla (para poder darles el foco)
  const ventana = useRef(null)
  const botonCancelar = useRef(null)
  const botonConfirmar = useRef(null)

  // Al abrirse: el foco va al botón "Cancelar" (la opción más segura, así un
  // Enter distraído no borra nada). Al cerrarse: el foco vuelve al botón que
  // abrió el modal.
  useEffect(() => {
    const anterior = document.activeElement
    botonCancelar.current?.focus()
    return () => anterior?.focus?.()
  }, [])

  // Escape cierra el modal (salvo mientras se está guardando)
  useEffect(() => {
    function alPresionarTecla(evento) {
      if (evento.key === 'Escape' && !procesando) onCancelar()
    }
    document.addEventListener('keydown', alPresionarTecla)
    // La función que devolvemos "limpia": quita el oyente al cerrar el modal
    return () => document.removeEventListener('keydown', alPresionarTecla)
  }, [procesando, onCancelar])

  // Mantiene la tecla Tab dentro de la ventana: al llegar al último botón
  // vuelve al primero, y no se puede "salir" hacia la página de atrás.
  function atraparTab(evento) {
    if (evento.key !== 'Tab') return
    const primero = botonCancelar.current
    const ultimo = botonConfirmar.current
    const activo = document.activeElement
    if (activo === ventana.current) {
      // Si se hizo clic en un texto de la ventana, el foco queda en la
      // ventana misma: Tab va al primer botón y Shift+Tab al último.
      evento.preventDefault()
      ;(evento.shiftKey ? ultimo : primero).focus()
    } else if (evento.shiftKey && activo === primero) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault()
      primero.focus()
    }
  }

  return (
    // Fondo oscuro que tapa la página. Un clic aquí cancela.
    <div
      className="modal__fondo"
      onMouseDown={(evento) => {
        // Solo si el clic fue en el fondo mismo y no dentro de la ventana
        if (evento.target === evento.currentTarget && !procesando) onCancelar()
      }}
    >
      <div
        ref={ventana}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onKeyDown={atraparTab}
      >
        <h3 id="modal-titulo" className="modal__titulo">
          {titulo}
        </h3>
        <div className="modal__contenido">{children}</div>

        <div className="modal__botones">
          <button
            ref={botonCancelar}
            type="button"
            className="boton"
            onClick={onCancelar}
            disabled={procesando}
          >
            Cancelar
          </button>
          <button
            ref={botonConfirmar}
            type="button"
            className={peligro ? 'boton boton--peligro-solido' : 'boton boton--principal'}
            onClick={onConfirmar}
            disabled={procesando}
          >
            {procesando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalConfirmacion