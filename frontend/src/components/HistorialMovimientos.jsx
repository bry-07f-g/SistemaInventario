// Muestra la tabla con todas las entradas y salidas registradas.
// Recibe por props:
//  - movimientos: la lista del historial (el más reciente va primero)
function HistorialMovimientos({ movimientos }) {
  return (
    <section>
      <h3 className="seccion__titulo">Historial de movimientos</h3>

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
              </tr>
            </thead>
            <tbody>
              {/* Una fila por cada movimiento */}
              {movimientos.map((m) => (
                <tr key={m.id}>
                  {/* toLocaleString da la fecha en formato local (es-CO) */}
                  <td>
                    {m.fecha.toLocaleString('es-CO', {
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
                  </td>
                  <td>{m.producto}</td>
                  <td>{m.cantidad}</td>
                  <td>{m.entrego}</td>
                  <td>{m.recibio}</td>
                  <td>{m.observacion || '—'}</td>
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