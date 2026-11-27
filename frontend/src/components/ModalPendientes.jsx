import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { estadoConexion, suscribir } from '../services/offline/conexion.js'
import {
  corregir,
  descartar,
  descargarTodo,
  listarCola,
  reintentar,
  sincronizar,
} from '../services/offline/sincronizar.js'

// Qué datos se pueden corregir en cada tipo de cambio:
// [campo, etiqueta, tipo de input]
const CAMPOS = {
  crearProducto: [
    ['nombre', 'Nombre', 'text'],
    ['cantidad', 'Cantidad', 'number'],
  ],
  editarProducto: [['nombre', 'Nombre', 'text']],
  movimiento: [['cantidad', 'Cantidad', 'number']],
  crearInventario: [['nombre', 'Nombre', 'text']],
  editarInventario: [['nombre', 'Nombre', 'text']],
  crearUsuario: [
    ['nombre', 'Nombre', 'text'],
    ['email', 'Correo', 'email'],
  ],
  editarUsuario: [
    ['nombre', 'Nombre', 'text'],
    ['email', 'Correo', 'email'],
  ],
}

// Explicación de cada conflicto, según el código que mandó el servidor
function explicar(item) {
  switch (item.error?.codigo) {
    case 'NOMBRE_REPETIDO':
      return 'Mientras estabas sin conexión alguien usó ese nombre. Corrígelo y se enviará de nuevo.'
    case 'CORREO_REPETIDO':
      return 'Ese correo ya lo tiene otro usuario. Corrígelo y se enviará de nuevo.'
    case 'EDITADO_POR_OTRO':
      return 'Otra persona editó este objeto mientras estabas sin conexión. Si guardas tus cambios, reemplazarán los suyos.'
    case 'NO_EXISTE':
      return 'Lo que este cambio usaba ya no existe en el servidor (alguien lo eliminó). Solo puedes descartarlo.'
    case 'DEPENDE':
      return 'Depende de otro cambio que falló. Corrige ese primero y este se enviará solo.'
    default:
      return null
  }
}

// ¿Tiene sentido corregir este conflicto?
function sePuedeCorregir(item) {
  return Boolean(CAMPOS[item.tipo]) && !['NO_EXISTE', 'DEPENDE'].includes(item.error?.codigo)
}

// Formulario pequeño para corregir un cambio que falló.
//  - item: el cambio de la cola
//  - onGuardar(cambios): guarda la corrección y lo reintenta
//  - onCerrar: cierra el formulario sin cambiar nada
function FormularioCorreccion({ item, onGuardar, onCerrar }) {
  const campos = CAMPOS[item.tipo]
  // Empieza con los valores que tenía el cambio
  const [valores, setValores] = useState(() =>
    Object.fromEntries(campos.map(([campo]) => [campo, String(item.datos[campo] ?? '')])),
  )
  const [error, setError] = useState(null)

  function alEnviar(evento) {
    evento.preventDefault()
    const cambios = {}
    for (const [campo, etiqueta, tipo] of campos) {
      const valor = valores[campo].trim()
      if (!valor) return setError(`Escribe ${etiqueta.toLowerCase()}.`)
      if (tipo === 'number') {
        const numero = Number(valor)
        const minimo = item.tipo === 'movimiento' ? 1 : 0
        if (!Number.isInteger(numero) || numero < minimo) {
          return setError(`La cantidad debe ser un número entero de ${minimo} o más.`)
        }
        cambios[campo] = numero
      } else {
        cambios[campo] = valor
      }
    }
    onGuardar(cambios)
  }

  return (
    <form className="correccion" onSubmit={alEnviar} noValidate>
      {campos.map(([campo, etiqueta, tipo]) => (
        <div className="campo" key={campo}>
          <label htmlFor={`corregir-${item.orden}-${campo}`}>{etiqueta}</label>
          <input
            id={`corregir-${item.orden}-${campo}`}
            type={tipo}
            min={tipo === 'number' ? 0 : undefined}
            value={valores[campo]}
            onChange={(evento) => setValores({ ...valores, [campo]: evento.target.value })}
          />
        </div>
      ))}
      {error && <p className="mensaje mensaje--error">{error}</p>}
      <div className="pendientes__acciones">
        <button type="submit" className="boton boton--principal">
          Guardar y reintentar
        </button>
        <button type="button" className="boton" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// Ventana con TODOS los cambios hechos sin conexión que todavía no están
// en el servidor: los que esperan enviarse y los que fallaron (conflictos).
// Recibe por props:
//  - resumen: (opcional) lo que pasó en la última sincronización
//  - onCerrar: cierra la ventana
function ModalPendientes({ resumen, onCerrar }) {
  const estado = useSyncExternalStore(suscribir, estadoConexion)
  const [cola, setCola] = useState([])
  const [corrigiendo, setCorrigiendo] = useState(null) // orden del cambio que se corrige
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
    // Editado por otro: reintentar = guardar MIS cambios encima
    if (item.error?.codigo === 'EDITADO_POR_OTRO') await corregir(item.orden, {})
    else await reintentar(item.orden)
    cargar()
  }

  async function alCorregir(item, cambios) {
    await corregir(item.orden, cambios)
    setCorrigiendo(null)
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
              {resumen.aplicados === 1
                ? 'Se aplicó 1 cambio.'
                : `Se aplicaron ${resumen.aplicados} cambios.`}
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
                    {explicar(item) && <p className="campo__ayuda">{explicar(item)}</p>}

                    {corrigiendo === item.orden ? (
                      <FormularioCorreccion
                        item={item}
                        onGuardar={(cambios) => alCorregir(item, cambios)}
                        onCerrar={() => setCorrigiendo(null)}
                      />
                    ) : (
                      <div className="pendientes__acciones">
                        {sePuedeCorregir(item) && (
                          <button
                            type="button"
                            className="boton boton--principal"
                            onClick={() => setCorrigiendo(item.orden)}
                          >
                            Corregir y reintentar
                          </button>
                        )}
                        {item.error?.codigo !== 'NO_EXISTE' && (
                          <button
                            type="button"
                            className="boton"
                            disabled={!estado.enLinea}
                            onClick={() => alReintentar(item)}
                          >
                            {item.error?.codigo === 'EDITADO_POR_OTRO'
                              ? 'Guardar mis cambios encima'
                              : 'Reintentar'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="boton boton--peligro"
                          onClick={() => alDescartar(item)}
                        >
                          Descartar
                        </button>
                      </div>
                    )}
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