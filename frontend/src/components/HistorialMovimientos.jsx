// Muestra la tabla con todas las entradas y salidas registradas.
// VERSIÓN 2: también muestra qué usuario del sistema registró cada
// movimiento ("Registró") y marca los despachos pendientes o cancelados
// (se usarán con la app sin internet).
// Recibe por props:
//  - movimientos: la lista del historial (el más reciente va primero)
function HistorialMovimientos({ movimientos }) {
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