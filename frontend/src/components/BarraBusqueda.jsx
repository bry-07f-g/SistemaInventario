// Barra de búsqueda reutilizable. La usamos en tres lugares: la lista del
// inventario, el ingreso de un objeto existente y el despacho.
//
// Recibe por props:
//  - valor: lo que hay escrito ahora (lo guarda la pantalla que la usa)
//  - onCambio: función que se llama CADA VEZ que se cambia una letra.
//    Por eso la lista se actualiza en tiempo real.
//  - etiqueta: el título que va arriba de la barra
function BarraBusqueda({ valor, onCambio, etiqueta = 'Buscar objeto' }) {
  // Esta barra casi siempre está dentro de un formulario. Si la persona
  // pulsa Enter, el navegador enviaría el formulario sin querer. Lo evitamos.
  function alPresionarTecla(evento) {
    if (evento.key === 'Enter') evento.preventDefault()
  }

  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        type="search"
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        onKeyDown={alPresionarTecla}
        placeholder="Escribe para buscar por nombre..."
        autoComplete="off"
      />
    </label>
  )
}

export default BarraBusqueda