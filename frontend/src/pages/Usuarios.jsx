import { useCallback, useEffect, useState } from 'react'
import BarraBusqueda from '../components/BarraBusqueda.jsx'
import FormularioUsuario from '../components/FormularioUsuario.jsx'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'
import NombreResaltado from '../components/NombreResaltado.jsx'
import Paginador from '../components/Paginador.jsx'
import { usePaginacion } from '../hooks/usePaginacion.js'
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
import { errorDeCampo } from '../utils/validar.js'

// Cuántos usuarios se ven por página (así la lista no necesita scroll)
const POR_PAGINA = 5

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
  //   null            -> ninguno (se ve la lista)
  //   'nuevo'         -> crear usuario
  //   { usuario }     -> editar ese usuario
  // Mientras hay un formulario abierto, la lista y el buscador se ocultan.
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

  const encontrados = filtrarPorNombre(usuarios, busqueda)
  const paginacion = usePaginacion(encontrados, POR_PAGINA)

  // Al buscar se vuelve a la página 1
  function buscar(texto) {
    setBusqueda(texto)
    paginacion.setPagina(1)
  }
  const activos = usuarios.filter((u) => u.activo).length

  // "Editar": primero pide al backend el usuario CON sus permisos
  async function abrirEdicion(usuario) {
    setMensaje(null)
    try {
      setFormulario({ usuario: await verUsuario(usuario.id) })
    } catch (fallo) {
      setMensaje({ tipo: 'error', texto: fallo.message })
    }
  }

  // Guardar (crear o editar). Devuelve true si salió bien, { campo: mensaje }
  // si el error es de un campo (correo repetido) o false si es general.
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
      // "Ya existe un usuario con el correo ..." va debajo del campo Correo
      const deCampo = errorDeCampo(fallo)
      if (deCampo) return deCampo
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
            // Con un formulario abierto, el botón lo cierra
            setFormulario(formulario ? null : 'nuevo')
          }}
        >
          {formulario ? 'Cerrar' : 'Nuevo usuario'}
        </button>
      </div>

      {mensaje && <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>}

      {/* Con un formulario abierto solo se ve el formulario: la lista
          vuelve al guardar, cancelar o cerrar */}
      {formulario === 'nuevo' && (
        <FormularioUsuario
          usuario={null}
          inventarios={inventarios}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {formulario?.usuario && (
        <FormularioUsuario
          // key: si se abre otro usuario, el formulario se crea de nuevo
          key={formulario.usuario.id}
          usuario={formulario.usuario}
          inventarios={inventarios}
          onGuardar={guardar}
          onCambiarContrasena={cambiarContrasena}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {!formulario && (
        <>
          <div className="busqueda">
            <BarraBusqueda valor={busqueda} onCambio={buscar} etiqueta="Buscar usuario" />
          </div>

          {encontrados.length === 0 ? (
            <p>Ningún usuario coincide con &quot;{busqueda.trim()}&quot;.</p>
          ) : (
            <ul className="lista-productos">
              {paginacion.visibles.map((u) => (
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
                        <span
                          className={`etiqueta ${u.activo ? 'etiqueta--entrada' : 'etiqueta--cancelado'}`}
                        >
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
                            Ver / editar
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
                </li>
              ))}
            </ul>
          )}

          <Paginador
            pagina={paginacion.pagina}
            totalPaginas={paginacion.totalPaginas}
            total={paginacion.total}
            desde={paginacion.desde}
            hasta={paginacion.hasta}
            onCambiar={paginacion.setPagina}
          />
        </>
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