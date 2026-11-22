import { useState } from 'react'
import FormularioIngresar from '../components/FormularioIngresar.jsx'
import FormularioDespachar from '../components/FormularioDespachar.jsx'
import HistorialMovimientos from '../components/HistorialMovimientos.jsx'

// Esta página es el "coordinador": decide qué formulario mostrar y
// es la que realmente cambia los datos (cantidades e historial).
// Los formularios solo recogen lo que escribe la persona y se lo entregan
// a las funciones registrarEntrada y registrarSalida.
function Movimientos({
  productos,
  setProductos,
  movimientos,
  setMovimientos,
}) {
  // Pestaña activa: 'ingresar' o 'despachar'
  const [modo, setModo] = useState('ingresar')

  // Mensaje para la persona. Es un objeto: { tipo: 'exito' o 'error', texto }
  // null significa que no hay mensaje que mostrar.
  const [mensaje, setMensaje] = useState(null)

  // Cambiar de pestaña también borra el mensaje anterior
  function cambiarModo(nuevoModo) {
    setModo(nuevoModo)
    setMensaje(null)
  }

  // Agrega un movimiento al historial. Va de primero, así el más reciente
  // queda arriba.
  function agregarMovimiento(datos) {
    const nuevo = { id: Date.now(), fecha: new Date(), ...datos }
    setMovimientos([nuevo, ...movimientos])
  }

  // ENTRADA: suma unidades a un objeto existente o crea uno nuevo.
  // Devuelve true si salió bien y false si hubo un problema.
  function registrarEntrada(datos) {
    const cantidad = Number(datos.cantidad)
    let nombre
    let total

    if (datos.tipoObjeto === 'nuevo') {
      nombre = datos.nombre.trim()

      // El nombre no se puede repetir (igual que en la base de datos)
      const repetido = productos.some(
        (p) => p.nombre.toLowerCase() === nombre.toLowerCase(),
      )
      if (repetido) {
        setMensaje({
          tipo: 'error',
          texto: `Ya existe un objeto llamado "${nombre}". Usa "Objeto existente" para sumarle unidades.`,
        })
        return false
      }

      total = cantidad
      const nuevoProducto = {
        id: Date.now(),
        nombre,
        cantidad,
        descripcion: datos.descripcion,
        imagen: datos.imagen,
      }
      // [...productos, nuevoProducto] = copia de la lista con uno más al final
      setProductos([...productos, nuevoProducto])
    } else {
      const producto = productos.find((p) => p.id === Number(datos.productoId))
      if (!producto) return false

      nombre = producto.nombre
      total = producto.cantidad + cantidad
      // map recorre la lista y cambia solo el producto elegido
      setProductos(
        productos.map((p) =>
          p.id === producto.id ? { ...p, cantidad: total } : p,
        ),
      )
    }

    agregarMovimiento({
      tipo: 'entrada',
      producto: nombre,
      cantidad,
      entrego: datos.entrego,
      recibio: datos.recibio,
      observacion: datos.observacion,
    })
    setMensaje({
      tipo: 'exito',
      texto: `Se ingresaron ${cantidad} unidades de "${nombre}". Ahora hay ${total}.`,
    })
    return true
  }

  // SALIDA: resta unidades, pero nunca más de las que hay.
  function registrarSalida(datos) {
    const cantidad = Number(datos.cantidad)
    const producto = productos.find((p) => p.id === Number(datos.productoId))
    if (!producto) return false

    // Regla principal: no se puede despachar más de lo disponible
    if (cantidad > producto.cantidad) {
      setMensaje({
        tipo: 'error',
        texto: `No hay suficientes productos. De "${producto.nombre}" solo hay ${producto.cantidad} disponibles.`,
      })
      return false
    }

    const quedan = producto.cantidad - cantidad
    setProductos(
      productos.map((p) =>
        p.id === producto.id ? { ...p, cantidad: quedan } : p,
      ),
    )
    agregarMovimiento({
      tipo: 'salida',
      producto: producto.nombre,
      cantidad,
      entrego: datos.entrego,
      recibio: datos.recibio,
      observacion: datos.observacion,
    })
    setMensaje({
      tipo: 'exito',
      texto: `Se despacharon ${cantidad} unidades de "${producto.nombre}". Quedan ${quedan}.`,
    })
    return true
  }

  return (
    <section>
      <h2 className="pagina__titulo">Ingresar o despachar</h2>

      {/* Selector de pestañas: Ingresar / Despachar */}
      <div className="selector">
        <button
          type="button"
          className={
            modo === 'ingresar'
              ? 'selector__opcion selector__opcion--activa'
              : 'selector__opcion'
          }
          onClick={() => cambiarModo('ingresar')}
        >
          Ingresar
        </button>
        <button
          type="button"
          className={
            modo === 'despachar'
              ? 'selector__opcion selector__opcion--activa'
              : 'selector__opcion'
          }
          onClick={() => cambiarModo('despachar')}
        >
          Despachar
        </button>
      </div>

      {/* Mensaje de éxito (verde) o de error (Blood Orange).
          La clase sale del tipo: "mensaje--exito" o "mensaje--error" */}
      {mensaje && (
        <p className={`mensaje mensaje--${mensaje.tipo}`}>{mensaje.texto}</p>
      )}

      {/* Mostramos un formulario u otro, y les pasamos lo que necesitan */}
      {modo === 'ingresar' ? (
        <FormularioIngresar
          productos={productos}
          onRegistrar={registrarEntrada}
        />
      ) : (
        <FormularioDespachar
          productos={productos}
          onRegistrar={registrarSalida}
        />
      )}

      {/* El historial se ve siempre debajo */}
      <HistorialMovimientos movimientos={movimientos} />
    </section>
  )
}

export default Movimientos