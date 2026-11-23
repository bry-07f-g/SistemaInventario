// NavLink es un enlace que, además, sabe si es la página actual
// (le agrega solo la clase "active" para que podamos resaltarlo).
import { NavLink } from 'react-router-dom'

function Header() {
  return (
    <header className="header">
      {/* Saludo a la izquierda */}
      <h1 className="header__saludo">Bienvenido a Forage</h1>

      {/* Las dos opciones del menú */}
      <nav className="header__nav">
        <NavLink to="/movimientos" className="header__link">
          1. Ingresar o despachar
        </NavLink>
        {/* "end" hace que "/" solo se marque en la página principal */}
        <NavLink to="/" end className="header__link">
          2. Visualizar inventario
        </NavLink>
      </nav>
    </header>
  )
}

export default Header