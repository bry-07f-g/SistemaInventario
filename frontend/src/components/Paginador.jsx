// Paginador que va debajo de una lista:
//   Mostrando 1–5 de 23     ‹ Anterior  1  2  3  …  5  Siguiente ›
// Recibe lo que devuelve usePaginacion (pagina, totalPaginas, total,
// desde, hasta) y onCambiar(numero) para ir a otra página.
// Si todo cabe en una página, no se muestra.
function Paginador({ pagina, totalPaginas, total, desde, hasta, onCambiar }) {
  if (totalPaginas <= 1) return null

  // Números a mostrar: la primera, la última y las vecinas de la actual.
  // Donde se saltan números va "…".
  const numeros = []
  for (let n = 1; n <= totalPaginas; n += 1) {
    if (n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1) {
      numeros.push(n)
    } else if (numeros[numeros.length - 1] !== '…') {
      numeros.push('…')
    }
  }

  return (
    <nav className="paginador" aria-label="Páginas">
      <p className="paginador__resumen">
        Mostrando {desde}–{hasta} de {total}
      </p>
      <div className="paginador__botones">
        <button
          type="button"
          className="boton paginador__boton"
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina === 1}
        >
          ‹ Anterior
        </button>
        {numeros.map((n, i) =>
          n === '…' ? (
            <span key={`salto-${i}`} className="paginador__salto">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`boton paginador__boton ${n === pagina ? 'paginador__boton--actual' : ''}`}
              onClick={() => onCambiar(n)}
              // aria-current: los lectores de pantalla dicen "página actual"
              aria-current={n === pagina ? 'page' : undefined}
              aria-label={`Página ${n}`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="boton paginador__boton"
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina === totalPaginas}
        >
          Siguiente ›
        </button>
      </div>
    </nav>
  )
}

export default Paginador