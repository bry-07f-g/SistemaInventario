import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Login from './pages/Login.jsx'
import Productos from './pages/Productos.jsx'
import Movimientos from './pages/Movimientos.jsx'
import Historial from './pages/Historial.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Empresas from './pages/Empresas.jsx'
import {
  cerrarSesion,
  cuandoVenzaLaSesion,
  elegirInventario,
  hayToken,
  inventarioGuardado,
  listarMovimientos,
  listarProductos,
  obtenerUsuarioActual,
} from './services/api.js'

// VERSIÓN 2: App es el "cerebro" de la página. Decide:
//  1) ¿Hay sesión?  No -> pantalla de login.  Sí -> el sistema.
//  2) ¿Qué inventario (empresa) se está viendo?
//  3) ¿Qué puede hacer el usuario en ese inventario? (sus permisos)
// y guarda los datos (objetos e historial) del inventario elegido.
function App() {
  // Usuario con sesión iniciada (null = nadie). Trae su lista de
  // inventarios, cada uno con sus permisos.
  const [usuario, setUsuario] = useState(null)

  // true mientras se comprueba, al abrir la página, si la sesión guardada
  // sigue sirviendo. Si no hay nada guardado, no hay nada que comprobar.
  const [revisandoSesion, setRevisandoSesion] = useState(hayToken())

  // Mensaje para mostrar en el login (por ejemplo "Tu sesión venció")
  const [avisoSesion, setAvisoSesion] = useState(null)

  // Inventario elegido (su id) o null si el usuario no tiene ninguno
  const [inventarioId, setInventarioId] = useState(null)

  // Datos del inventario elegido
  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Cuenta las cargas pedidas. Si la persona cambia de empresa rápido,
  // puede llegar tarde la respuesta de la empresa anterior: con este
  // número sabemos que ya no sirve y la ignoramos.
  const ultimaCarga = useRef(0)

  // ---------------------------------------------------------------
  // Entrar: se llama después del login o al recuperar la sesión guardada.
  // Elige el inventario: el que se usó la última vez (si todavía tiene
  // acceso) o, si no, el primero de su lista.
  // ---------------------------------------------------------------
  const entrar = useCallback((datosUsuario) => {
    const ids = datosUsuario.inventarios.map((inv) => inv.id)
    const guardado = inventarioGuardado()
    const id = ids.includes(guardado) ? guardado : (ids[0] ?? null)

    elegirInventario(id) // api.js lo enviará en cada petición
    setUsuario(datosUsuario)
    setAvisoSesion(null)
    setError(null)
    setInventarioId(id)
    setCargando(id !== null)
  }, [])

  // Salir: borra la sesión y vuelve al login (con un aviso opcional)
  const salir = useCallback((aviso = null) => {
    cerrarSesion()
    setUsuario(null)
    setInventarioId(null)
    setProductos([])
    setMovimientos([])
    setError(null)
    setAvisoSesion(aviso)
  }, [])

  // Si el backend dice que la sesión ya no sirve (401), api.js llama a esto
  useEffect(() => {
    cuandoVenzaLaSesion((mensaje) => salir(mensaje))
  }, [salir])

  // Al abrir la página: si hay una sesión guardada, preguntamos al backend
  // "¿quién soy?". Si responde, entramos directo, sin pedir contraseña.
  useEffect(() => {
    if (!hayToken()) return
    obtenerUsuarioActual()
      .then(entrar)
      .catch((fallo) => {
        // Si el token ya no servía, api.js lo borró y avisó (se verá el
        // login). Si fue otra cosa (sin conexión), mostramos el error.
        if (hayToken()) setError(fallo.message)
      })
      .finally(() => setRevisandoSesion(false))
  }, [entrar])

  // ---------------------------------------------------------------
  // Pide al backend los objetos y el historial del inventario elegido.
  // Las páginas la llaman después de cada cambio para ver lo que
  // REALMENTE quedó en la base de datos. Nunca lanza error: si algo
  // falla, lo guarda en "error".
  // ---------------------------------------------------------------
  const cargarDatos = useCallback(() => {
    ultimaCarga.current += 1
    const estaCarga = ultimaCarga.current

    return Promise.all([listarProductos(), listarMovimientos()])
      .then(([listaProductos, listaMovimientos]) => {
        if (estaCarga !== ultimaCarga.current) return // llegó tarde: se ignora
        setProductos(listaProductos)
        setMovimientos(listaMovimientos)
        setError(null)
      })
      .catch((fallo) => {
        if (estaCarga !== ultimaCarga.current) return
        setError(fallo.message)
      })
      .finally(() => {
        if (estaCarga === ultimaCarga.current) setCargando(false)
      })
  }, [])

    // Cuando termina una sincronización (la app sin internet envió sus
  // cambios), se vuelve a pedir todo para ver el estado real del servidor
  useEffect(() => {
    function alSincronizar() {
      if (!hayToken()) return
      obtenerUsuarioActual()
        .then((datos) => {
          entrar(datos)
          return cargarDatos()
        })
        .catch(() => {})
    }
    window.addEventListener('inventario:sincronizado', alSincronizar)
    return () => window.removeEventListener('inventario:sincronizado', alSincronizar)
  }, [entrar, cargarDatos])
  
  // Cada vez que cambia el inventario elegido, se cargan sus datos
  useEffect(() => {
    if (inventarioId === null) return
    cargarDatos()
  }, [inventarioId, cargarDatos])

  // El selector de empresas del header llama a esto
  function cambiarInventario(id) {
    if (id === inventarioId) return
    elegirInventario(id)
    setProductos([])
    setMovimientos([])
    setError(null)
    setCargando(true)
    setInventarioId(id)
  }

    // Vuelve a preguntar "quién soy" SIN cambiar de pantalla. Lo usa la
  // pantalla Empresas: si se crea, renombra o borra una empresa, el
  // selector del header debe enterarse. Si la empresa que se estaba viendo
  // ya no existe, pasa a la primera de la lista.
  async function refrescarUsuario() {
    const datos = await obtenerUsuarioActual()
    setUsuario(datos)
    const ids = datos.inventarios.map((inv) => inv.id)
    if (!ids.includes(inventarioId)) {
      const nuevo = ids[0] ?? null
      elegirInventario(nuevo)
      setProductos([])
      setMovimientos([])
      setCargando(nuevo !== null)
      setInventarioId(nuevo)
    }
  }

  // "Reintentar": vuelve a preguntar quién soy (por si cambiaron mis
  // permisos o mis empresas) y recarga los datos.
  function reintentar() {
    setError(null)
    setCargando(true)
    obtenerUsuarioActual()
      .then((datos) => {
        entrar(datos)
        return cargarDatos()
      })
      .catch((fallo) => {
        setError(fallo.message)
        setCargando(false)
      })
  }

  // ---------------- Lo que se dibuja ----------------

  // 1) Todavía revisando la sesión guardada
  if (revisandoSesion) {
    return (
      <div className="pantalla-centrada">
        <p>Cargando...</p>
      </div>
    )
  }

  // 2) Sin sesión: si hubo un error de conexión al revisar la sesión
  //    guardada, lo mostramos; si no, el formulario de login.
  if (!usuario) {
    if (error) {
      return (
        <div className="pantalla-centrada">
          <p className="mensaje mensaje--error">{error}</p>
          <button type="button" className="boton" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      )
    }
    return <Login onEntrar={entrar} aviso={avisoSesion} />
  }

  // 3) Con sesión. Permisos del usuario en el inventario elegido:
  //    { ver, crear, editar, eliminar, ingresar, despachar } (true/false)
  const inventario = usuario.inventarios.find((inv) => inv.id === inventarioId)
  const permisos = inventario?.permisos
  const puedeMover = Boolean(permisos?.ingresar || permisos?.despachar)

    // Contenido del inventario elegido (inventario, movimientos, historial)
  let contenidoInventario
  if (!inventario) {
    contenidoInventario = (
      <p className="mensaje mensaje--error">
        {usuario.esSuperAdmin
          ? 'Todavía no hay empresas. Crea la primera en la pantalla "Empresas".'
          : 'No tienes inventarios asignados. Habla con el administrador.'}
      </p>
    )
  } else if (cargando) {
    contenidoInventario = <p>Cargando inventario...</p>
  } else if (error) {
    contenidoInventario = (
      <section>
        <p className="mensaje mensaje--error">{error}</p>
        <button type="button" className="boton" onClick={reintentar}>
          Reintentar
        </button>
      </section>
    )
  } else {
    // key={inventarioId}: al cambiar de empresa, cada página se "reinicia"
    // (se cierran formularios abiertos, búsquedas, etc.)
    contenidoInventario = (
      <Routes>
        <Route
          path="/"
          element={
            <Productos
              key={inventarioId}
              productos={productos}
              recargar={cargarDatos}
              permisos={permisos}
            />
          }
        />
        <Route
          path="/movimientos"
          element={
            // Sin permiso de ingresar ni despachar, esta página no existe:
            // Navigate lo devuelve al inventario.
            puedeMover ? (
              <Movimientos
                key={inventarioId}
                productos={productos}
                recargar={cargarDatos}
                permisos={permisos}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/historial"
          element={<Historial key={inventarioId} movimientos={movimientos} />}
        />
        {/* Cualquier otra dirección vuelve al inventario */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // Las pantallas del super admin NO dependen de la empresa elegida (por
  // ejemplo, si todavía no hay empresas, debe poder entrar a crearlas).
  // Por eso van en un primer nivel de rutas; todo lo demás ("*") es el
  // contenido del inventario de arriba.
  const soloAdmin = (pagina) => (usuario.esSuperAdmin ? pagina : <Navigate to="/" replace />)
  const contenido = (
    <Routes>
      <Route path="/usuarios" element={soloAdmin(<Usuarios />)} />
      <Route path="/empresas" element={soloAdmin(<Empresas onCambio={refrescarUsuario} />)} />
      <Route path="*" element={contenidoInventario} />
    </Routes>
  )

  return (
    <div className="app">
      <Header
        usuario={usuario}
        inventarioId={inventarioId}
        onCambiarInventario={cambiarInventario}
        puedeMover={puedeMover}
        onSalir={() => salir()}
      />

      <main className="contenido">{contenido}</main>

      <Footer />
    </div>
  )
}
export default App