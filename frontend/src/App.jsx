import { useCallback, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Productos from './pages/Productos.jsx'
import Movimientos from './pages/Movimientos.jsx'
import { listarProductos, listarMovimientos } from './services/api.js'

function App() {
  // Los datos viven AQUÍ, en App, para que las dos páginas vean lo mismo.
  // Ahora vienen del backend (la base de datos), ya no son datos de ejemplo.
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])

  // "cargando" es true hasta que llega la primera respuesta del servidor.
  // "error" guarda el mensaje si la carga falló (null = sin error).
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  // Pide al backend las dos listas y las guarda en el estado.
  // Las páginas la llaman después de cada cambio (ingresar, despachar,
  // eliminar) para mostrar lo que REALMENTE quedó en la base de datos.
  // Nunca lanza error: si algo falla, lo guarda en "error".
  // useCallback hace que la función sea siempre la misma entre dibujos,
  // para que useEffect no la ejecute una y otra vez.
  //
  // Está escrita con .then / .catch / .finally (otra forma de esperar a que
  // llegue una respuesta) porque React exige que los datos se guarden dentro
  // de esas funciones y no directamente al abrir la página.
  const cargarDatos = useCallback(
    () =>
      // Promise.all hace las dos peticiones a la vez, no una tras otra
      Promise.all([listarProductos(), listarMovimientos()])
        .then(([listaProductos, listaMovimientos]) => {
          // Esto corre cuando LAS DOS respuestas ya llegaron bien
          setProductos(listaProductos)
          setMovimientos(listaMovimientos)
          setError(null)
        })
        .catch((fallo) => {
          // Esto corre si alguna falló (sin conexión, error del servidor...)
          setError(fallo.message)
        })
        .finally(() => {
          // finally corre siempre, haya salido bien o mal
          setCargando(false)
        }),
    [],
  )

  // useEffect con [cargarDatos] se ejecuta una vez, cuando la página se
  // abre por primera vez. Es el momento de pedir los datos.
  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Botón "Reintentar" de la pantalla de error
  function reintentar() {
    setCargando(true)
    cargarDatos()
  }

  // Qué se muestra en el centro de la página
  let contenido
  if (cargando) {
    contenido = <p>Cargando inventario...</p>
  } else if (error) {
    contenido = (
      <section>
        <p className="mensaje mensaje--error">{error}</p>
        <button type="button" className="boton" onClick={reintentar}>
          Reintentar
        </button>
      </section>
    )
  } else {
    contenido = (
      <Routes>
        {/* "/" es la página principal: la lista del inventario.
            Le pasamos los datos como "props" (como argumentos de una función). */}
        <Route
          path="/"
          element={<Productos productos={productos} recargar={cargarDatos} />}
        />
        {/* "/movimientos" es la página de ingresar o despachar */}
        <Route
          path="/movimientos"
          element={
            <Movimientos
              productos={productos}
              movimientos={movimientos}
              recargar={cargarDatos}
            />
          }
        />
      </Routes>
    )
  }

  return (
    <div className="app">
      {/* El header se ve siempre, en todas las páginas */}
      <Header />

      {/* El centro cambia según la dirección (ruta) en la que estés */}
      <main className="contenido">{contenido}</main>

      {/* El footer también se ve siempre */}
      <Footer />
    </div>
  )
}

export default App