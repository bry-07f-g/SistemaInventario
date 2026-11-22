// useState sirve para que React "recuerde" datos que cambian
// y vuelva a dibujar la página cuando cambian.
import { useState } from 'react'

// Datos de EJEMPLO. Más adelante los reemplazaremos por los reales
// que vengan de la base de datos a través del backend.
import { useState } from 'react'
import { productosEjemplo } from '../services/datosEjemplo.js'

function Productos() {
  // Lista de productos que se muestra. Empieza con los de ejemplo.
  const [productos, setProductos] = useState(productosEjemplo)

  // Guarda el id del producto cuyo detalle está abierto (null = ninguno).
  const [abiertoId, setAbiertoId] = useState(null)

  // "Ver": abre el detalle de un producto, o lo cierra si ya estaba abierto.
  function alternarDetalle(id) {
    setAbiertoId(abiertoId === id ? null : id)
  }

  // "Editar": todavía no hace nada. Lo conectaremos más adelante.
  function editar(producto) {
    console.log('Editar (pendiente):', producto.nombre)
  }

  // "Eliminar": pide confirmación y quita el producto de la lista.
  function eliminar(producto) {
    const confirmado = window.confirm(`¿Eliminar "${producto.nombre}"?`)
    if (confirmado) {
      // filter crea una lista nueva SIN el producto eliminado
      setProductos(productos.filter((p) => p.id !== producto.id))
    }
  }

  return (
    <section>
      <h2 className="pagina__titulo">Inventario</h2>

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
                    src={producto.imagen}
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
                <p className="producto__descripcion">{producto.descripcion}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Productos