import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { estadoConexion, suscribir } from '../services/offline/conexion.js'
import {
  descartar,
  descargarTodo,
  listarCola,
  reintentar,
  sincronizar,
} from '../services/offline/sincronizar.js'

// Ventana con TODOS los cambios hechos sin conexión que todavía no están
// en el servidor: los que esperan enviarse y los que fallaron (conflictos).
// Recibe por props:
//  - resumen: (opcional) lo que pasó en la última sincronización
//  - onCerrar: cierra la ventana
function ModalPendientes({ resumen, onCerrar }) {
  const estado = useSyncExternalStore(suscribir, estadoConexion)
  const [cola, setCola] = useState([])
  const ventana = useRef(null)

  const cargar = useCallback(() => listarCola().then(setCola), [])

  // Se recarga la lista al abrir y cada vez que cambian los contadores
  // (por ejemplo, mientras se sincroniza)
  useEffect(() => {
    cargar()
  }, [cargar, estado.pendientes, estado.conflictos])

  // Foco en la ventana al abrir; Escape cierra
  useEffect(() => {
    ventana.current?.focus()
    function alPresionarTecla(evento) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPresionarTecla)
    return () => document.removeEventListener('keydown', alPresionarTecla)
  }, [onCerrar])

  async function alDescartar(item) {
    await descartar(item.orden)
    cargar()
    // Se descargan de nuevo los datos reales, por si quedaba algo de ese cambio
    if (estadoConexion().enLinea) {
      descargarTodo()
        .then(() => window.dispatchEvent(new CustomEvent('inventario:sincronizado', { detail: null })))
        .catch(() => {})
    }
  }

  async function alReintentar(item) {
    await reintentar(item.orden)
    cargar()
  }

  return (
    <div
      className="modal__fondo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
    >
      <div
        className="modal modal--ancho"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pendientes"
        ref={ventana}
        tabIndex={-1}
      >
        <h2 className="modal__titulo" id="titulo-pendientes">
          Cambios hechos sin conexión
        </h2>

        {/* Resumen de la sincronización que acaba de terminar */}
        {resumen && (
          <div className="pendientes__resumen">
            <p className="mensaje mensaje--exito">
              Se aplicaron {resumen.aplicados} {resumen.aplicados === 1 ? 'cambio' : 'cambios'}.
            </p>
            {resumen.avisos.map((aviso) => (
              <p key={aviso} className="mensaje mensaje--aviso">
                {aviso}
              </p>
            ))}
            {resumen.conflictos.length > 0 && (
              <p className="mensaje mensaje--error">
                {resumen.conflictos.length === 1
                  ? '1 cambio no se pudo aplicar. Revísalo abajo.'
                  : `${resumen.conflictos.length} cambios no se pudieron aplicar. Revísalos abajo.`}
              </p>
            )}
          </div>
        )}

        {cola.length === 0 ? (
          <p className="texto-suave">No hay cambios pendientes: todo está guardado en el servidor.</p>
        ) : (
          <ul className="pendientes__lista">
            {cola.map((item) => (
              <li
                key={item.orden}
                className={`pendientes__item ${item.estado === 'error' ? 'pendientes__item--error' : ''}`}
              >
                <div className="pendientes__fila">
                  <strong>{item.descripcion}</strong>
                  <span
                    className={`etiqueta ${item.estado === 'error' ? 'etiqueta--conflicto' : 'etiqueta--pendiente'}`}
                  >
                    {item.estado === 'error' ? 'Conflicto' : 'Pendiente'}
                  </span>
                </div>
                <p className="texto-suave pendientes__meta">
                  {item.empresa ? `${item.empresa} · ` : ''}
                  {item.usuarioNombre} ·{' '}
                  {new Date(item.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                </p>

                {item.estado === 'error' && (
                  <>
                    <p className="pendientes__error">{item.error?.mensaje}</p>
                    <div className="pendientes__acciones">
                      <button
                        type="button"
                        className="boton"
                        disabled={!estado.enLinea}
                        onClick={() => alReintentar(item)}
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        className="boton boton--peligro"
                        onClick={() => alDescartar(item)}
                      >
                        Descartar
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="modal__botones">
          {estado.enLinea && estado.pendientes > 0 && (
            <button
              type="button"
              className="boton boton--principal"
              disabled={estado.sincronizando}
              onClick={() => sincronizar()}
            >
              {estado.sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
          )}
          <button type="button" className="boton" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        {!estado.enLinea && (
          <p className="campo__ayuda">
            Sin conexión: los cambios se enviarán solos cuando vuelva internet.
          </p>
        )}
      </div>
    </div>
  )
}

export default ModalPendientes