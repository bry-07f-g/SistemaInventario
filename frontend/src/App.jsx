import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Productos from './pages/Productos.jsx'
import Movimientos from './pages/Movimientos.jsx'
import { productosEjemplo } from './services/datosEjemplo.js'

function App() {
  // Los datos viven AQUÍ, en App, para que las dos páginas vean lo mismo.
  // Si Movimientos cambia la cantidad de un objeto, Productos lo refleja.
  // (A esto se le llama "subir el estado" al componente padre.)
  const [productos, setProductos] = useState(productosEjemplo)

  // Historial de entradas y salidas. Empieza vacío.
  const [movimientos, setMovimientos] = useState([])

  return (
    <div className="app">
      {/* El header se ve siempre, en todas las páginas */}
      <Header />

      {/* El centro cambia según la dirección (ruta) en la que estés */}
      <main className="contenido">
        <Routes>
          {/* "/" es la página principal: la lista del inventario.
              Le pasamos los datos como "props" (como argumentos de una función). */}
          <Route
            path="/"
            element={
              <Productos productos={productos} setProductos={setProductos} />
            }
          />
          {/* "/movimientos" es la página de ingresar o despachar */}
          <Route
            path="/movimientos"
            element={
              <Movimientos
                productos={productos}
                setProductos={setProductos}
                movimientos={movimientos}
                setMovimientos={setMovimientos}
              />
            }
          />
        </Routes>
      </main>

      {/* El footer también se ve siempre */}
      <Footer />
    </div>
  )
}

export default App