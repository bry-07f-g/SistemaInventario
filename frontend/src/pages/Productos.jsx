// useState sirve para que React "recuerde" datos que cambian
// y vuelva a dibujar la página cuando cambian.
import { useState } from 'react'
import BarraBusqueda from '../components/BarraBusqueda.jsx'
import NombreResaltado from '../components/NombreResaltado.jsx'
import FormularioEditar from '../components/FormularioEditar.jsx'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'
import Paginador from '../components/Paginador.jsx'
import { usePaginacion } from '../hooks/usePaginacion.js'
import {
  actualizarProducto,
  eliminarProducto,
  urlImagen,
} from '../services/api.js'
import { estadoStock, filtrarPorNombre } from '../utils/inventario.js'
import { errorDeCampo } from '../utils/validar.js'

// Cuántos objetos se ven por página (así la lista no necesita scroll)
const POR_PAGINA = 4

//  - permisos: qué puede hacer el usuario en este inventario. Los botones
//    Editar y Eliminar solo aparecen si tiene ese permiso. (Aunque alguien
//    los "forzara", el backend igual lo rechazaría: la seguridad real está
//    en el servidor; esto es para no mostrar botones que no sirven.)
function Productos({ productos, recargar, permisos }) {

  // Guarda el id del producto cuyo detalle está abierto (null = ninguno).
  const [abiertoId, setAbiertoId] = useState(null)

  // Objeto que se quiere eliminar y está esperando confirmación en el modal
  // (null = el modal está cerrado), y si ya se está borrando en el servidor.
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Mensaje para la persona: { tipo: 'exito' o 'error', texto } o null
  const [mensaje, setMensaje] = useState(null)

  // Lo que hay escrito en la barra de búsqueda. Cada letra que se escribe
  // cambia este valor, y React vuelve a dibujar la lista al instante.
  const [busqueda, setBusqueda] = useState('')

  // Id del producto que se está editando (null = ninguno). Solo uno a la vez.
  const [editandoId, setEditandoId] = useState(null)

  // La lista que realmente se ve: solo los objetos cuyo nombre contiene lo
  // buscado. Si no hay nada escrito, son todos.
    const encontrados = filtrarPorNombre(productos, busqueda)

  // De los encontrados, solo los de la página actual
  const paginacion = usePaginacion(encontrados, POR_PAGINA)
  const visibles = paginacion.visibles

  // Al buscar se vuelve a la página 1 (los resultados empiezan ahí)
  function buscar(texto) {
    setBusqueda(texto)
    paginacion.setPagina(1)
  }

  // "Ver": abre el detalle de un producto, o lo cierra si ya estaba abierto.
  function alternarDetalle(id) {
    setAbiertoId(abiertoId === id ? null : id)
  }

    // "Editar": abre el formulario de ese objeto (o lo cierra si ya estaba abierto)
  function alternarEdicion(producto) {
    setMensaje(null)
    setEditandoId(editandoId === producto.id ? null : producto.id)
  }

  // Se ejecuta al pulsar "Guardar cambios" en el formulario de edición.
  async function guardarEdicion(id, datos) {
    try {
      await actualizarProducto(id, datos)
      // Volvemos a pedir la lista para ver los datos ya guardados
      await recargar()
      setEditandoId(null) // cerramos el formulario
      setMensaje({ tipo: 'exito', texto: 'Cambios guardados.' })
      return true
    } catch (error) {
      // Por ejemplo: "Ya existe un objeto llamado ...": va debajo del
      // campo Nombre. El formulario queda abierto para corregirlo.
      const deCampo = errorDeCampo(error)
      if (deCampo) return deCampo
      setMensaje({ tipo: 'error', texto: error.message })
      return false
    }
  }

// "Eliminar": NO borra todavía; solo abre el modal para pedir confirmación.
function eliminar(producto) {
  setMensaje(null)
  setPorEliminar(producto)
}

// Se ejecuta al pulsar el botón rojo "Eliminar" dentro del modal.
// "async" permite usar "await": esperar a que el servidor responda
// antes de seguir con la siguiente línea.
async function confirmarEliminacion() {
  const producto = porEliminar
  setEliminando(true)
  try {
    await eliminarProducto(producto.id)
    // Volvemos a pedir la lista para ver lo que quedó en la base de datos
    await recargar()
    setMensaje({ tipo: 'exito', texto: `Se eliminó "${producto.nombre}".` })
  } catch (error) {
    setMensaje({ tipo: 'error', texto: error.message })
  } finally {
    // Salga bien o mal, se cierra el modal y se desbloquean los botones
    setEliminando(false)
    setPorEliminar(null)
  }
}

  return (
    <section>
      <h2 className="pagina__titulo">Inventario</h2>

      {/* Mensaje de éxito (verde) o de error (Blood Orange) */}
      {mensaje && (
        <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>
      )}

      {/* La barra de búsqueda solo tiene sentido si hay objetos */}
      {productos.length > 0 && (
        <div className="busqueda">
          <BarraBusqueda valor={busqueda} onCambio={buscar} />
          {/* Cuando se está buscando, decimos cuántos coinciden */}
          {busqueda.trim() !== '' && (
            <small className="campo__ayuda">
              {visibles.length} de {productos.length} objetos
            </small>
          )}
        </div>
      )}

      {/* Tres casos: no hay objetos, ninguno coincide con la búsqueda,
          o hay resultados para mostrar */}
      {productos.length === 0 ? (
        <p>No hay objetos en el inventario.</p>
      ) : visibles.length === 0 ? (
        <p>Ningún objeto coincide con &quot;{busqueda.trim()}&quot;.</p>
      ) : (
        <ul className="lista-productos">
          {/* map recorre la lista y dibuja una fila por cada producto.
              "key" ayuda a React a distinguir una fila de otra. */}
          {visibles.map((producto) => {
            // 'agotado', 'bajo' (próximo a agotar) o 'normal'
            const estado = estadoStock(producto)

            return (
              <li key={producto.id} className="producto">
                <div className="producto__fila">
                  {/* Imagen pequeña, o un recuadro si no tiene imagen */}
                  {producto.imagen ? (
                    <img
                      className="producto__img"
                      src={urlImagen(producto.imagen)}
                      alt={producto.nombre}
                    />
                  ) : (
                    <div className="producto__sin-imagen">Sin imagen</div>
                  )}

                  {/* Nombre, con las letras buscadas resaltadas */}
                  <p className="producto__nombre">
                    <NombreResaltado
                      nombre={producto.nombre}
                      busqueda={busqueda}
                    />
                  </p>

                  {/* Etiqueta de cantidad. La clase cambia según el estado:
                      verde (normal), amarillo (bajo) o rojo (agotado) */}
                  <span className={`producto__cantidad producto__cantidad--${estado}`}>
                    {estado === 'agotado' && 'Agotado'}
                    {estado === 'bajo' &&
                      `Próximo a agotar: ${producto.cantidad}`}
                    {estado === 'normal' && `${producto.cantidad} disponibles`}
                  </span>

                  {/* Opciones */}
                  <div className="producto__acciones">
                    <button
                      className="boton"
                      onClick={() => alternarDetalle(producto.id)}
                    >
                      {abiertoId === producto.id ? 'Ocultar' : 'Ver'}
                    </button>
                                        {permisos.editar && (
                      <button className="boton" onClick={() => alternarEdicion(producto)}>
                        {editandoId === producto.id ? 'Cerrar edición' : 'Editar'}
                      </button>
                    )}

                    {permisos.eliminar && (
                      <button
                        className="boton boton--peligro"
                        onClick={() => eliminar(producto)}
                      >
                        Eliminar
                      </button>
                    )}
                    </div>   {/* cierra producto__acciones */}
                </div>     {/* cierra producto__fila */}

                {/* Formulario de edición: solo en el producto que se edita */}
                {editandoId === producto.id && (
                  <FormularioEditar
                    producto={producto}
                    onGuardar={guardarEdicion}
                    onCancelar={() => setEditandoId(null)}
                  />
                )}

                {/* Detalle: solo aparece si este es el producto abierto */}
                

                {/* Detalle: solo aparece si este es el producto abierto */}
                {abiertoId === producto.id && (
                  <div className="producto__descripcion">
                    <p>{producto.descripcion || 'Sin descripción.'}</p>
                    <p className="texto-suave">
                      {producto.cantidad_minima > 0
                        ? `Se marca "próximo a agotar" cuando queden ${producto.cantidad_minima} o menos.`
                        : 'Sin aviso de "próximo a agotar".'}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Paginador: solo aparece si hay más de una página */}
      <Paginador
        pagina={paginacion.pagina}
        totalPaginas={paginacion.totalPaginas}
        total={paginacion.total}
        desde={paginacion.desde}
        hasta={paginacion.hasta}
        onCambiar={paginacion.setPagina}
      />
            {/* Modal de confirmación: solo existe mientras hay un objeto por eliminar */}
      {porEliminar && (
        <ModalConfirmacion
          titulo={`¿Eliminar "${porEliminar.nombre}"?`}
          textoConfirmar="Eliminar"
          peligro
          procesando={eliminando}
          onConfirmar={confirmarEliminacion}
          onCancelar={() => setPorEliminar(null)}
        >
          {/* Si aún quedan unidades, avisamos que se pierden del inventario */}
          {porEliminar.cantidad > 0 && (
            <p>
              Todavía tiene{' '}
              <strong>
                {porEliminar.cantidad}{' '}
                {porEliminar.cantidad === 1 ? 'unidad' : 'unidades'}
              </strong>{' '}
              en el inventario.
            </p>
          )}
          {/* El historial NO se pierde (así lo decidimos en la base de datos) */}
          <p>Su historial de movimientos se conserva.</p>
          <p>Esta acción no se puede deshacer.</p>
        </ModalConfirmacion>
      )}
    </section>
  )
}

export default Productos