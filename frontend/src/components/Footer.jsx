function Footer() {
  // Año en que se creó el sistema
  const anioInicial = 2026
  // Año actual, calculado solo para que el pie no quede desactualizado
  const anioActual = new Date().getFullYear()
  // Si ya pasó el primer año, se muestra un rango: "2026–2027"
  const anios =
    anioActual > anioInicial ? `${anioInicial}–${anioActual}` : `${anioInicial}`

  return (
    <footer className="footer">
      {/* Aviso de derechos de autor: © + año + titular + frase de reserva */}
      <p>© {anios} Bryan Franco Gomez. Todos los derechos reservados.</p>
      <p>
        Sistema de Inventario v2.0 · Contacto:{' '}
        <a href="mailto:francobryan524@gmail.com">francobryan524@gmail.com</a>
      </p>
    </footer>
  )
}

export default Footer