import { useCallback, useEffect, useState } from 'react'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'
import {
  actualizarInventario,
  crearInventario,
  eliminarInventario,
  listarInventarios,
} from '../services/api.js'

// Formulario pequeño para crear o renombrar una empresa.
//  - inicial: { nombre, descripcion } (vacío al crear)
//  - onGuardar: función asíncrona; devuelve true si salió bien
function FormularioEmpresa({ inicial, textoBoton, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial.nombre)
  const [descripcion, setDescripcion] = useState(inicial.descripcion || '')
  const [guardando, setGuardando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setGuardando(true)
    const ok = await onGuardar({ nombre, descripcion })
    if (!ok) setGuardando(false)
  }

  return (
    <form className="formulario formulario--editar" onSubmit={enviar}>
      <label className="campo">
        <span>Nombre de la empresa</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
      </label>
      <label className="campo">
        <span>Descripción (opcional)</span>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </label>
      <div className="formulario__botones">
        <button type="submit" className="boton boton--principal" disabled={guardando}>
          {guardando ? 'Guardando...' : textoBoton}
        </button>
        <button type="button" className="boton" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// Pantalla "Empresas" (solo super administrador): cada empresa tiene su
// propio inventario.
//  - onCambio: función de App que vuelve a pedir "quién soy", para que el
//    selector de empresas del header se entere de los cambios.
function Empresas({ onCambio }) {
  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  // null = ninguno, 'nueva' = crear, o el id de la empresa que se edita
  const [formulario, setFormulario] = useState(null)

  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(
    () =>
      listarInventarios()
        .then((lista) => {
          setEmpresas(lista)
          setError(null)
        })
        .catch((fallo) => setError(fallo.message))
        .finally(() => setCargando(false)),
    [],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  // Después de cualquier cambio: recargar esta lista y avisar a App
  async function despuesDeCambiar(texto) {
    await cargar()
    await onCambio()
    setFormulario(null)
    setMensaje({ tipo: 'exito', texto })
  }

  async function crear(datos) {
    try {
      await crearInventario(datos)
      await despuesDeCambiar(`Se creó la empresa "${datos.nombre.trim()}". Ahora asigna quién puede usarla en Usuarios.`)
      return true
    } catch (fallo) {
      setMensaje({ tipo: 'error', texto: fallo.message })
      return false
    }
  }

  async function renombrar(id, datos) {
    try {
      await actualizarInventario(id, datos)
      await despuesDeCambiar('Cambios guardados.')
      return true
    } catch (fallo) {
      setMensaje({ tipo: 'error', texto: fallo.message })
      return false
    }
  }

  async function confirmarEliminacion() {
    const empresa = porEliminar
    setEliminando(true)
    try {
      await eliminarInventario(empresa.id)
      await despuesDeCambiar(`Se eliminó la empresa "${empresa.nombre}".`)
    } catch (fallo) {
      // Por ejemplo: "No se puede eliminar: tiene 3 objeto(s)..."
      setMensaje({ tipo: 'error', texto: fallo.message })
    } finally {
      setEliminando(false)
      setPorEliminar(null)
    }
  }

  if (cargando) return <p>Cargando empresas...</p>
  if (error) return <p className="mensaje mensaje--error">{error}</p>

  return (
    <section>
      <div className="pagina__encabezado">
        <div>
          <h2 className="pagina__titulo">Empresas</h2>
          <p className="texto-suave">
            {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'} · cada una tiene su
            propio inventario
          </p>
        </div>
        <button
          type="button"
          className="boton boton--principal"
          onClick={() => {
            setMensaje(null)
            setFormulario(formulario === 'nueva' ? null : 'nueva')
          }}
        >
          {formulario === 'nueva' ? 'Cerrar' : 'Nueva empresa'}
        </button>
      </div>

      {mensaje && <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>}

      {formulario === 'nueva' && (
        <FormularioEmpresa
          inicial={{ nombre: '', descripcion: '' }}
          textoBoton="Crear empresa"
          onGuardar={crear}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {empresas.length === 0 ? (
        <p>Todavía no hay empresas. Crea la primera con &quot;Nueva empresa&quot;.</p>
      ) : (
        <ul className="lista-productos">
          {empresas.map((e) => (
            <li key={e.id} className="producto">
              <div className="producto__fila">
                <div className="usuario__datos">
                  <p className="producto__nombre">{e.nombre}</p>
                  {e.descripcion && <p className="texto-suave">{e.descripcion}</p>}
                </div>
                <div className="usuario__etiquetas">
                  <span className="etiqueta etiqueta--salida">
                    {e.total_objetos} {e.total_objetos === 1 ? 'objeto' : 'objetos'}
                  </span>
                  <span className="etiqueta etiqueta--salida">
                    {e.total_usuarios} {e.total_usuarios === 1 ? 'usuario' : 'usuarios'} con acceso
                  </span>
                </div>
                <div className="producto__acciones">
                  <button
                    type="button"
                    className="boton"
                    onClick={() => {
                      setMensaje(null)
                      setFormulario(formulario === e.id ? null : e.id)
                    }}
                  >
                    {formulario === e.id ? 'Cerrar' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    className="boton boton--peligro"
                    onClick={() => {
                      setMensaje(null)
                      setPorEliminar(e)
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {formulario === e.id && (
                <FormularioEmpresa
                  inicial={e}
                  textoBoton="Guardar cambios"
                  onGuardar={(datos) => renombrar(e.id, datos)}
                  onCancelar={() => setFormulario(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {porEliminar && (
        <ModalConfirmacion
          titulo={`¿Eliminar la empresa "${porEliminar.nombre}"?`}
          textoConfirmar="Eliminar"
          peligro
          procesando={eliminando}
          onConfirmar={confirmarEliminacion}
          onCancelar={() => setPorEliminar(null)}
        >
          {/* El backend solo deja borrar empresas vacías: lo avisamos antes */}
          <p>Solo se puede eliminar una empresa sin objetos y sin historial.</p>
          {porEliminar.total_objetos > 0 && (
            <p>
              Esta empresa todavía tiene <strong>{porEliminar.total_objetos}</strong>{' '}
              {porEliminar.total_objetos === 1 ? 'objeto' : 'objetos'}, así que no se podrá
              eliminar.
            </p>
          )}
          <p>Los usuarios perderán el acceso a ella.</p>
        </ModalConfirmacion>
      )}
    </section>
  )
}

export default Empresas