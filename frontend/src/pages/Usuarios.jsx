import { useCallback, useEffect, useState } from 'react'
import BarraBusqueda from '../components/BarraBusqueda.jsx'
import FormularioUsuario from '../components/FormularioUsuario.jsx'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'
import NombreResaltado from '../components/NombreResaltado.jsx'
import {
  actualizarUsuario,
  cambiarContrasenaUsuario,
  crearUsuario,
  eliminarUsuario,
  listarInventarios,
  listarUsuarios,
  verUsuario,
} from '../services/api.js'
import { filtrarPorNombre } from '../utils/inventario.js'

// Pantalla "Usuarios" (solo super administrador): la lista de usuarios,
// como la del inventario, para crear, editar, desactivar, cambiar la
// contraseña y eliminar. Esta página pide sus propios datos al backend.
function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [inventarios, setInventarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null) // { tipo, texto }
  const [busqueda, setBusqueda] = useState('')

  // Qué formulario está abierto:
  //   null            -> ninguno
  //   'nuevo'         -> crear usuario (arriba de la lista)
  //   { usuario }     -> editar ese usuario (dentro de su fila)
  const [formulario, setFormulario] = useState(null)

  // Usuario esperando confirmación para eliminar (null = modal cerrado)
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Pide las dos listas (usuarios y empresas) al backend
  const cargar = useCallback(
    () =>
      Promise.all([listarUsuarios(), listarInventarios()])
        .then(([listaUsuarios, listaInventarios]) => {
          setUsuarios(listaUsuarios)
          setInventarios(listaInventarios)
          setError(null)
        })
        .catch((fallo) => setError(fallo.message))
        .finally(() => setCargando(false)),
    [],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = filtrarPorNombre(usuarios, busqueda)
  const activos = usuarios.filter((u) => u.activo).length

  // "Editar": primero pide al backend el usuario CON sus permisos
  async function abrirEdicion(usuario) {
    setMensaje(null)
    if (formulario?.usuario?.id === usuario.id) {
      setFormulario(null) // si ya estaba abierto, lo cierra
      return
    }
    try {
      setFormulario({ usuario: await verUsuario(usuario.id) })
    } catch (fallo) {
      setMensaje({ tipo: 'error', texto: fallo.message })
    }
  }

  // Guardar (crear o editar). Devuelve true si salió bien.
  async function guardar(datos) {
    const editando = formulario !== 'nuevo'
    try {
      if (editando) await actualizarUsuario(formulario.usuario.id, datos)
      else await crearUsuario(datos)
      await cargar()
      setFormulario(null)
      setMensaje({
        tipo: 'exito',
        texto: editando ? 'Cambios guardados.' : `Se creó el usuario "${datos.nombre}".`,
      })
      return true
    } catch (fallo) {
      // Por ejemplo "Ya existe un usuario con el correo ..."
      setMensaje({ tipo: 'error', texto: fallo.message })
      return false
    }
  }

  async function cambiarContrasena(password) {
    try {
      await cambiarContrasenaUsuario(formulario.usuario.id, password)
      setMensaje({
        tipo: 'exito',
        texto: `Se cambió la contraseña de "${formulario.usuario.nombre}". Sus sesiones abiertas se cerraron.`,
      })
      return true
    } catch (fallo) {
      setMensaje({ tipo: 'error', texto: fallo.message })
      return false
    }
  }

  async function confirmarEliminacion() {
    const usuario = porEliminar
    setEliminando(true)
    try {
      await eliminarUsuario(usuario.id)
      await cargar()
      if (formulario?.usuario?.id === usuario.id) setFormulario(null)
      setMensaje({ tipo: 'exito', texto: `Se eliminó a "${usuario.nombre}".` })
    } catch (fallo) {
      setMensaje({ tipo: 'error', texto: fallo.message })
    } finally {
      setEliminando(false)
      setPorEliminar(null)
    }
  }

  if (cargando) return <p>Cargando usuarios...</p>
  if (error) return <p className="mensaje mensaje--error">{error}</p>

  return (
    <section>
      <div className="pagina__encabezado">
        <div>
          <h2 className="pagina__titulo">Usuarios</h2>
          {/* Resumen para tomar decisiones de un vistazo */}
          <p className="texto-suave">
            {usuarios.length} {usuarios.length === 1 ? 'usuario' : 'usuarios'} · {activos}{' '}
            {activos === 1 ? 'activo' : 'activos'}
          </p>
        </div>
        <button
          type="button"
          className="boton boton--principal"
          onClick={() => {
            setMensaje(null)
            setFormulario(formulario === 'nuevo' ? null : 'nuevo')
          }}
        >
          {formulario === 'nuevo' ? 'Cerrar' : 'Nuevo usuario'}
        </button>
      </div>

      {mensaje && <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>}

      {formulario === 'nuevo' && (
        <FormularioUsuario
          usuario={null}
          inventarios={inventarios}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <div className="busqueda">
        <BarraBusqueda valor={busqueda} onCambio={setBusqueda} etiqueta="Buscar usuario" />
      </div>

      {visibles.length === 0 ? (
        <p>Ningún usuario coincide con &quot;{busqueda.trim()}&quot;.</p>
      ) : (
        <ul className="lista-productos">
          {visibles.map((u) => (
            <li key={u.id} className="producto">
              <div className="producto__fila">
                <div className="usuario__datos">
                  <p className="producto__nombre">
                    <NombreResaltado nombre={u.nombre} busqueda={busqueda} />
                  </p>
                  <p className="texto-suave">{u.email}</p>
                </div>

                {/* Etiquetas: rol, estado y a cuántas empresas tiene acceso */}
                <div className="usuario__etiquetas">
                  {u.esSuperAdmin ? (
                    <span className="insignia">Super administrador</span>
                  ) : (
                    <span className={`etiqueta ${u.activo ? 'etiqueta--entrada' : 'etiqueta--cancelado'}`}>
                      {u.activo ? 'Activo' : 'Desactivado'}
                    </span>
                  )}
                  <span className="etiqueta etiqueta--salida">
                    {u.esSuperAdmin
                      ? 'Todas las empresas'
                      : `${u.totalInventarios} ${u.totalInventarios === 1 ? 'empresa' : 'empresas'}`}
                  </span>
                </div>

                <div className="producto__acciones">
                  {/* Al super admin no se le toca desde aquí: sus datos
                      viven en la configuración del servidor (.env) */}
                  {u.esSuperAdmin ? (
                    <small className="texto-suave">Se cambia desde el servidor</small>
                  ) : (
                    <>
                      <button type="button" className="boton" onClick={() => abrirEdicion(u)}>
                        {formulario?.usuario?.id === u.id ? 'Cerrar' : 'Ver / editar'}
                      </button>
                      <button
                        type="button"
                        className="boton boton--peligro"
                        onClick={() => {
                          setMensaje(null)
                          setPorEliminar(u)
                        }}
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Formulario de edición dentro de la fila del usuario */}
              {formulario?.usuario?.id === u.id && (
                <FormularioUsuario
                  // key: si se abre otro usuario, el formulario se crea de nuevo
                  key={u.id}
                  usuario={formulario.usuario}
                  inventarios={inventarios}
                  onGuardar={guardar}
                  onCambiarContrasena={cambiarContrasena}
                  onCancelar={() => setFormulario(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {porEliminar && (
        <ModalConfirmacion
          titulo={`¿Eliminar a "${porEliminar.nombre}"?`}
          textoConfirmar="Eliminar"
          peligro
          procesando={eliminando}
          onConfirmar={confirmarEliminacion}
          onCancelar={() => setPorEliminar(null)}
        >
          <p>Ya no podrá iniciar sesión y se borran sus permisos.</p>
          <p>Su nombre se conserva en el historial de movimientos.</p>
          <p>
            Si solo quieres que deje de entrar por un tiempo, mejor <strong>desactívalo</strong>{' '}
            (Ver / editar → quitar &quot;Cuenta activa&quot;).
          </p>
        </ModalConfirmacion>
      )}
    </section>
  )
}

export default Usuarios