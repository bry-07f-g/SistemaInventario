import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Productos from './pages/Productos.jsx'
import Movimientos from './pages/Movimientos.jsx'

function App() {
  return (
    <div className="app">
      {/* El header se ve siempre, en todas las páginas */}
      <Header />

      {/* El centro cambia según la dirección (ruta) en la que estés */}
      <main className="contenido">
        <Routes>
          {/* "/" es la página principal: la lista del inventario */}
          <Route path="/" element={<Productos />} />
          {/* "/movimientos" es la página de ingresar o despachar */}
          <Route path="/movimientos" element={<Movimientos />} />
        </Routes>
      </main>

      {/* El footer también se ve siempre */}
      <Footer />
    </div>
  )
}

export default App