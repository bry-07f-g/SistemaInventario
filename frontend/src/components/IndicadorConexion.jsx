import { useEffect, useState, useSyncExternalStore } from 'react'
import { estadoConexion, suscribir } from '../services/offline/conexion.js'
import { vigilarConexion } from '../services/offline/sincronizar.js'
import ModalPendientes from './ModalPendientes.jsx'

// Recuadro fijo abajo a la derecha, visible en TODAS las pantallas (también
// en el login). Dice si hay conexión, cuántos cambios esperan enviarse y,
// si hay algo que revisar, muestra el botón "Ver cambios pendientes".
function IndicadorConexion() {
  // useSyncExternalStore: "conecta" el componente al estado de conexión
  // (services/offline/conexion.js). Cada vez que cambia, se vuelve a dibujar.
  const estado = useSyncExternalStore(suscribir, estadoConexion)

  const [abierto, setAbierto] = useState(false)
  // Resumen de la última sincronización (para mostrarlo en el modal)
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    // Empieza a vigilar la conexión (una sola vez para toda la app)
    vigilarConexion()

    // Al terminar una sincronización: si hubo conflictos o avisos, se abre
    // el modal solo para que la persona se entere
    function alSincronizar(evento) {
      const datos = evento.detail
      if (datos && (datos.conflictos.length > 0 || datos.avisos.length > 0)) {
        setResumen(datos)
        setAbierto(true)
      }
    }
    window.addEventListener('inventario:sincronizado', alSincronizar)
    return () => window.removeEventListener('inventario:sincronizado', alSincronizar)
  }, [])

  // Qué mostrar según el estado
  let clase = 'conexion--en-linea'
  let texto = 'En línea'
  if (estado.sincronizando) {
    clase = 'conexion--sincronizando'
    texto = 'Sincronizando...'
  } else if (!estado.enLinea) {
    clase = 'conexion--sin-red'
    texto = 'Sin conexión'
  }

  const mostrarBoton = !estado.enLinea || estado.pendientes > 0 || estado.conflictos > 0

  return (
    <>
      {/* role="status": los lectores de pantalla anuncian los cambios */}
      <div className={`conexion ${clase}`} role="status">
        <p className="conexion__estado">
          <span className="conexion__punto" aria-hidden="true" />
          {texto}
        </p>

        {estado.pendientes > 0 && (
          <p className="conexion__detalle">
            {estado.pendientes} {estado.pendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'}
          </p>
        )}
        {estado.conflictos > 0 && (
          <p className="conexion__detalle conexion__detalle--error">
            {estado.conflictos} {estado.conflictos === 1 ? 'cambio con conflicto' : 'cambios con conflicto'}
          </p>
        )}

        {mostrarBoton && (
          <button
            type="button"
            className="boton conexion__boton"
            onClick={() => {
              setResumen(null)
              setAbierto(true)
            }}
          >
            Ver cambios pendientes
          </button>
        )}
      </div>

      {abierto && <ModalPendientes resumen={resumen} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export default IndicadorConexion