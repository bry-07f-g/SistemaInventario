import { useState } from 'react'
import { eliminarProducto, urlImagen } from '../services/api.js'

// Esta página ya NO tiene su propia lista: la recibe de App por "props".
//  - productos: la lista actual de objetos (viene del backend)
//  - recargar: función que vuelve a pedir los datos al backend
function Productos({ productos, recargar }) {

  // Guarda el id del producto cuyo detalle está abierto (null = ninguno).
  const [abiertoId, setAbiertoId] = useState(null)

  // Mensaje para la persona: { tipo: 'exito' o 'error', texto } o null
  const [mensaje, setMensaje] = useState(null)

  // "Ver": abre el detalle de un producto, o lo cierra si ya estaba abierto.
  function alternarDetalle(id) {
    setAbiertoId(abiertoId === id ? null : id)
  }

  // "Editar": todavía no hace nada. Lo conectaremos más adelante.
  function editar(producto) {
    console.log('Editar (pendiente):', producto.nombre)
  }

    // "Eliminar": pide confirmación y borra el producto en el backend.
  // "async" permite usar "await": esperar a que el servidor responda
  // antes de seguir con la siguiente línea.
  async function eliminar(producto) {
    // Si aún quedan unidades, avisamos que se pierden del inventario.
    // El historial NO se pierde (así lo decidimos en la base de datos).
    const aviso =
      producto.cantidad > 0
        ? ` Todavía tiene ${producto.cantidad} unidades en el inventario.`
        : ''
    const confirmado = window.confirm(
      `¿Eliminar "${producto.nombre}"?${aviso} Su historial de movimientos se conserva.`,
    )
    if (!confirmado) return

    try {
      await eliminarProducto(producto.id)
      // Volvemos a pedir la lista para ver lo que quedó en la base de datos
      await recargar()
      setMensaje({ tipo: 'exito', texto: `Se eliminó "${producto.nombre}".` })
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    }
  }

  return (
    <section>
      <h2 className="pagina__titulo">Inventario</h2>
    
      {/* Mensaje de éxito (verde) o de error (Blood Orange) */}
      {mensaje && (
        <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>
      )}

      {/* Si no hay productos, mostramos un mensaje en vez de una lista vacía */}
      {productos.length === 0 ? (
        <p>No hay objetos en el inventario.</p>
      ) : (
        <ul className="lista-productos">
          {/* map recorre la lista y dibuja una fila por cada producto.
              "key" ayuda a React a distinguir una fila de otra. */}
          {productos.map((producto) => (
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

                {/* Nombre */}
                <p className="producto__nombre">{producto.nombre}</p>

                {/* Cantidad: verde si hay, rojo si está agotado (0) */}
                <span
                  className={
                    producto.cantidad > 0
                      ? 'producto__cantidad'
                      : 'producto__cantidad producto__cantidad--agotado'
                  }
                >
                  {producto.cantidad > 0
                    ? `${producto.cantidad} disponibles`
                    : 'Agotado'}
                </span>

                {/* Opciones */}
                <div className="producto__acciones">
                  <button
                    className="boton"
                    onClick={() => alternarDetalle(producto.id)}
                  >
                    {abiertoId === producto.id ? 'Ocultar' : 'Ver'}
                  </button>
                  <button className="boton" onClick={() => editar(producto)}>
                    Editar
                  </button>
                  <button
                    className="boton boton--peligro"
                    onClick={() => eliminar(producto)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Detalle: solo aparece si este es el producto abierto */}
              {abiertoId === producto.id && (
                <p className="producto__descripcion">
                  {producto.descripcion || 'Sin descripción.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Productos