import { useCallback, useEffect, useState } from 'react'
import Campo from '../components/Campo.jsx'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'
import Paginador from '../components/Paginador.jsx'
import { useErrores } from '../hooks/useErrores.js'
import { usePaginacion } from '../hooks/usePaginacion.js'
import {
  actualizarInventario,
  crearInventario,
  eliminarInventario,
  listarInventarios,
} from '../services/api.js'
import { errorDeCampo, obligatorio } from '../utils/validar.js'

// Cuántas empresas se ven por página (así la lista no necesita scroll)
const POR_PAGINA = 6

// Formulario pequeño para crear o renombrar una empresa.
//  - titulo: "Nueva empresa" o "Editar ..."
//  - inicial: { nombre, descripcion } (vacío al crear)
//  - onGuardar: función asíncrona; devuelve true si salió bien,
//    { campo: mensaje } si el error es de un campo (nombre repetido) o false
function FormularioEmpresa({ titulo, inicial, textoBoton, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial.nombre)
  const [descripcion, setDescripcion] = useState(inicial.descripcion || '')
  const [guardando, setGuardando] = useState(false)
  const { errores, mostrar, quitar, formulario } = useErrores()

  async function enviar(evento) {
    evento.preventDefault()
    if (!mostrar({ nombre: obligatorio(nombre, 'Escribe el nombre de la empresa.') })) return
    setGuardando(true)
    const resultado = await onGuardar({ nombre, descripcion })
    if (resultado !== true) {
      setGuardando(false)
      if (resultado) mostrar(resultado)
    }
  }

  return (
    <form
      className="formulario formulario--columnas formulario--editar"
      onSubmit={enviar}
      ref={formulario}
      noValidate
    >
      <h3 className="seccion__titulo campo--completo">{titulo}</h3>
      <Campo etiqueta="Nombre de la empresa" error={errores.nombre}>
        <input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            quitar('nombre')
          }}
          maxLength={100}
        />
      </Campo>
      <Campo etiqueta="Descripción (opcional)">
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
      </Campo>
      <div className="formulario__botones campo--completo">
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

  // null = ninguno (se ve la lista), 'nueva' = crear, o el id de la
  // empresa que se edita. Con un formulario abierto, la lista se oculta.
  const [formulario, setFormulario] = useState(null)

  const paginacion = usePaginacion(empresas, POR_PAGINA)

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
      await despuesDeCambiar(
        `Se creó la empresa "${datos.nombre.trim()}". Ahora asigna quién puede usarla en Usuarios.`,
      )
      return true
    } catch (fallo) {
      // "Ya existe un inventario llamado ..." va debajo del campo Nombre
      const deCampo = errorDeCampo(fallo)
      if (deCampo) return deCampo
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
      // "Ya existe un inventario llamado ..." va debajo del campo Nombre
      const deCampo = errorDeCampo(fallo)
      if (deCampo) return deCampo
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

  // La empresa que se está editando (si hay una)
  const editada = empresas.find((e) => e.id === formulario)

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
            // Con un formulario abierto, el botón lo cierra
            setFormulario(formulario ? null : 'nueva')
          }}
        >
          {formulario ? 'Cerrar' : 'Nueva empresa'}
        </button>
      </div>

      {mensaje && <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>}

      {formulario === 'nueva' && (
        <FormularioEmpresa
          titulo="Nueva empresa"
          inicial={{ nombre: '', descripcion: '' }}
          textoBoton="Crear empresa"
          onGuardar={crear}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {/* Editar: el formulario ocupa el lugar de la lista */}
      {editada && (
        <FormularioEmpresa
          key={editada.id}
          titulo={`Editar ${editada.nombre}`}
          inicial={editada}
          textoBoton="Guardar cambios"
          onGuardar={(datos) => renombrar(editada.id, datos)}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {!formulario && empresas.length === 0 && (
        <p>Todavía no hay empresas. Crea la primera con &quot;Nueva empresa&quot;.</p>
      )}

      {!formulario && empresas.length > 0 && (
        <>
          <ul className="lista-productos">
            {paginacion.visibles.map((e) => (
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
                      {e.total_usuarios} {e.total_usuarios === 1 ? 'usuario' : 'usuarios'} con
                      acceso
                    </span>
                  </div>
                  <div className="producto__acciones">
                    <button
                      type="button"
                      className="boton"
                      onClick={() => {
                        setMensaje(null)
                        setFormulario(e.id)
                      }}
                    >
                      Editar
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
              </li>
            ))}
          </ul>

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