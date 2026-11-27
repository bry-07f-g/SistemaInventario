// Muestra la tabla con todas las entradas y salidas registradas.
// VERSIÓN 2: también muestra qué usuario del sistema registró cada
// movimiento ("Registró") y marca los despachos pendientes o cancelados
// (se usarán con la app sin internet).
// Recibe por props:
//  - movimientos: la lista del historial (el más reciente va primero)
//  - acciones: (opcional) para los despachos PENDIENTES. Si viene, se
//    agrega la columna "Acciones" con "Confirmar envío" y "Cancelar".
//    { deshabilitado, procesandoId, onConfirmar(m), onCancelar(m) }
function HistorialMovimientos({ movimientos, acciones = null }) {
  // La columna solo aparece si hay algún pendiente y se pueden resolver
  const conAcciones = acciones !== null && movimientos.some((m) => m.estado === 'pendiente')

  return (
    <section>
      {/* Si todavía no hay nada, mostramos un mensaje en vez de una tabla vacía */}
      {movimientos.length === 0 ? (
        <p>Aún no hay movimientos registrados.</p>
      ) : (
        // Este contenedor deja deslizar la tabla si no cabe en pantallas pequeñas
        <div className="tabla__contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Objeto</th>
                <th>Cantidad</th>
                <th>Entregó</th>
                <th>Recibió</th>
                <th>Observación</th>
                <th>Registró</th>
                {conAcciones && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {/* Una fila por cada movimiento */}
              {movimientos.map((m) => (
                <tr key={m.id}>
                  {/* toLocaleString da la fecha en formato local (es-CO) */}
                  <td>
                    {new Date(m.fecha).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    {/* Etiqueta verde para entrada, naranja suave para salida */}
                    <span
                      className={
                        m.tipo === 'entrada'
                          ? 'etiqueta etiqueta--entrada'
                          : 'etiqueta etiqueta--salida'
                      }
                    >
                      {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </span>
                    {/* Solo se marca lo que NO es normal ('aplicado') */}
                    {m.estado === 'pendiente' && (
                      <span className="etiqueta etiqueta--pendiente">Pendiente</span>
                    )}
                    {m.estado === 'cancelado' && (
                      <span className="etiqueta etiqueta--cancelado">Cancelado</span>
                    )}
                  </td>
                  <td>
                    {m.producto_nombre}
                    {/* Si el objeto ya se eliminó, producto_id viene vacío (null) */}
                    {m.producto_id === null && (
                      <span className="texto-suave"> (eliminado)</span>
                    )}
                  </td>
                  <td>{m.cantidad}</td>
                  <td>{m.entrego}</td>
                  <td>{m.recibio}</td>
                  <td>{m.observacion || '—'}</td>
                  {/* Los movimientos de la versión 1 no tienen usuario */}
                  <td>{m.usuario_nombre || '—'}</td>
                  {conAcciones && (
                    <td className="historial__celda-acciones">
                      {m.estado === 'pendiente' && (
                        <div className="historial__acciones">
                          <button
                            type="button"
                            className="boton boton--principal"
                            disabled={acciones.deshabilitado}
                            onClick={() => acciones.onConfirmar(m)}
                          >
                            {acciones.procesandoId === m.id ? 'Confirmando...' : 'Confirmar envío'}
                          </button>
                          <button
                            type="button"
                            className="boton boton--peligro"
                            disabled={acciones.deshabilitado}
                            onClick={() => acciones.onCancelar(m)}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default HistorialMovimientos