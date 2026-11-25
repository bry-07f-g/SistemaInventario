import { useState } from 'react'
import FormularioIngresar from '../components/FormularioIngresar.jsx'
import FormularioDespachar from '../components/FormularioDespachar.jsx'
import HistorialMovimientos from '../components/HistorialMovimientos.jsx'
import { crearProducto, registrarMovimiento } from '../services/api.js'

// Esta página es el "coordinador": decide qué formulario mostrar y le habla
// al backend. Los formularios solo recogen lo que escribe la persona y se lo
// entregan a las funciones registrarEntrada y registrarSalida.
//  - productos: lista actual de objetos (viene del backend)
//  - movimientos: historial (viene del backend)
//  - recargar: vuelve a pedir los datos al backend después de un cambio
function Movimientos({ productos, movimientos, recargar }) {
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

  // ENTRADA: suma unidades a un objeto existente o crea uno nuevo.
  // Devuelve true si salió bien y false si hubo un problema.
  // Es "async" porque hay que esperar la respuesta del servidor.
  async function registrarEntrada(datos) {
    const cantidad = Number(datos.cantidad)

    try {
      let nombre
      let total

      if (datos.tipoObjeto === 'nuevo') {
        nombre = datos.nombre.trim()

        // Aviso rápido para no esperar al servidor. La comprobación que
        // de verdad manda es la del backend (la base de datos).
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

        // FormData permite enviar texto Y un archivo en la misma petición
        // (un JSON no puede llevar archivos).
        const formulario = new FormData()
        formulario.append('nombre', nombre)
        formulario.append('descripcion', datos.descripcion)
        formulario.append('cantidad', cantidad)
        // Vacío = sin aviso (el backend lo guarda como 0)
        formulario.append('cantidad_minima', datos.cantidadMinima)
        formulario.append('entrego', datos.entrego)
        formulario.append('recibio', datos.recibio)
        formulario.append('observacion', datos.observacion)
        // El campo debe llamarse "imagen": así lo espera el backend
        if (datos.archivo) formulario.append('imagen', datos.archivo)

        // El backend crea el objeto Y anota su primer ingreso en el historial
        const creado = await crearProducto(formulario)
        total = creado.cantidad
      } else {
        // Objeto existente: registramos un movimiento de tipo "entrada".
        // La respuesta trae la cantidad nueva del producto.
        const resultado = await registrarMovimiento({
          tipo: 'entrada',
          producto_id: Number(datos.productoId),
          cantidad,
          entrego: datos.entrego,
          recibio: datos.recibio,
          observacion: datos.observacion,
        })
        nombre = resultado.producto.nombre
        total = resultado.producto.cantidad
      }

      // Volvemos a pedir las listas para ver lo que quedó en la base de datos
      await recargar()
      setMensaje({
        tipo: 'exito',
        texto: `Se ingresaron ${cantidad} unidades de "${nombre}". Ahora hay ${total}.`,
      })
      return true
    } catch (error) {
      // Aquí llegan los mensajes del backend (nombre repetido, imagen muy
      // pesada, sin conexión...). Se muestran tal cual, en rojo.
      setMensaje({ tipo: 'error', texto: error.message })
      return false
    }
  }

  // SALIDA: resta unidades, pero nunca más de las que hay.
  // La regla "No hay suficientes productos" la aplica el BACKEND: es la que
  // protege de verdad (por ejemplo, si otra persona despachó hace un momento).
  async function registrarSalida(datos) {
    const cantidad = Number(datos.cantidad)

    try {
      const resultado = await registrarMovimiento({
        tipo: 'salida',
        producto_id: Number(datos.productoId),
        cantidad,
        entrego: datos.entrego,
        recibio: datos.recibio,
        observacion: datos.observacion,
      })

      await recargar()
      setMensaje({
        tipo: 'exito',
        texto: `Se despacharon ${cantidad} unidades de "${resultado.producto.nombre}". Quedan ${resultado.producto.cantidad}.`,
      })
      return true
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
      return false
    }
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