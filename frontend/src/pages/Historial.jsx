import HistorialMovimientos from '../components/HistorialMovimientos.jsx'

// Página "Historial": ahora tiene su propio botón en el menú, en vez de
// verse debajo de los formularios de ingresar y despachar.
//  - movimientos: historial del inventario elegido (viene de App)
function Historial({ movimientos }) {
  return (
    <section>
      <h2 className="pagina__titulo">Historial de movimientos</h2>
      <HistorialMovimientos movimientos={movimientos} />
    </section>
  )
}

export default Historial