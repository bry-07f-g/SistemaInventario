// NavLink es un enlace que, además, sabe si es la página actual
// (le agrega solo la clase "active" para que podamos resaltarlo).
import { NavLink } from 'react-router-dom'
import SelectorInventario from './SelectorInventario.jsx'

// Header de la versión 2. Recibe por props:
//  - usuario: quién inició sesión (nombre, si es super admin, inventarios)
//  - inventarioId / onCambiarInventario: empresa elegida y cómo cambiarla
//  - puedeMover: si puede ingresar o despachar en la empresa elegida
//  - onSalir: cerrar sesión
function Header({ usuario, inventarioId, onCambiarInventario, puedeMover, onSalir }) {
  return (
    <header className="header">
      {/* Fila de arriba: saludo, quién soy y botón de salir */}
      <div className="header__fila">
        <h1 className="header__saludo">Bienvenido a Forage</h1>
        <div className="header__usuario">
          <span>
            {usuario.nombre}
            {usuario.esSuperAdmin && <span className="insignia">Super administrador</span>}
          </span>
          <button type="button" className="boton" onClick={onSalir}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Fila de abajo: empresa y menú */}
      <div className="header__fila">
        {usuario.inventarios.length > 0 && (
          <SelectorInventario
            inventarios={usuario.inventarios}
            valor={inventarioId}
            onElegir={onCambiarInventario}
          />
        )}

        {inventarioId !== null && (
          <nav className="header__nav">
            {/* Solo se muestra si puede ingresar o despachar aquí */}
            {puedeMover && (
              <NavLink to="/movimientos" className="header__link">
                Ingresar o despachar
              </NavLink>
            )}
            {/* "end" hace que "/" solo se marque en la página principal */}
            <NavLink to="/" end className="header__link">
              Visualizar inventario
            </NavLink>
            <NavLink to="/historial" className="header__link">
              Historial
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  )
}

export default Header