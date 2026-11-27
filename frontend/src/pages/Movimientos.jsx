import { useState } from 'react'
import FormularioIngresar from '../components/FormularioIngresar.jsx'
import FormularioDespachar from '../components/FormularioDespachar.jsx'
import { crearProducto, registrarMovimiento } from '../services/api.js'
import { errorDeCampo } from '../utils/validar.js'

// Esta página es el "coordinador": decide qué formulario mostrar y le habla
// al backend. Los formularios solo recogen lo que escribe la persona y se lo
// entregan a las funciones registrarEntrada y registrarSalida.
//  - productos: lista actual de objetos (viene del backend)
//  - recargar: vuelve a pedir los datos al backend después de un cambio
//  - permisos: qué puede hacer el usuario en este inventario
//
// VERSIÓN 2: solo aparecen las pestañas que el usuario tiene permitidas,
// y el historial ahora tiene su propia página (botón "Historial").
function Movimientos({ productos, recargar, permisos }) {
  // Pestañas permitidas. App solo abre esta página si hay al menos una.
  const modos = []
  if (permisos.ingresar) modos.push('ingresar')
  if (permisos.despachar) modos.push('despachar')

  // Pestaña activa: empieza en la primera permitida
  const [modo, setModo] = useState(modos[0])

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

    // Borramos el mensaje anterior: así no se ve un "éxito" viejo mientras
    // se guarda el nuevo ingreso.
    setMensaje(null)

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
          return {
            nombre: `Ya existe un objeto llamado "${nombre}". Usa "Objeto existente" para sumarle unidades.`,
          }
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
      // pesada, sin conexión...). Si es de un campo, va debajo de ese campo;
      // si no, arriba en el recuadro rojo.
      const deCampo = errorDeCampo(error)
      if (deCampo) return deCampo
      setMensaje({ tipo: 'error', texto: error.message })
      return false
    }
  }

  // SALIDA: resta unidades, pero nunca más de las que hay.
  // La regla "No hay suficientes productos" la aplica el BACKEND: es la que
  // protege de verdad (por ejemplo, si otra persona despachó hace un momento).
  async function registrarSalida(datos) {

    // Igual que arriba: empezamos sin mensaje viejo en pantalla
    setMensaje(null)

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
      // "No hay suficientes productos..." va debajo de la cantidad
      const deCampo = errorDeCampo(error)
      if (deCampo) return deCampo
      setMensaje({ tipo: 'error', texto: error.message })
      return false
    }
  }

    return (
    <section>
      <h2 className="pagina__titulo">
        {modos.length > 1 ? 'Ingresar o despachar' : modo === 'ingresar' ? 'Ingresar' : 'Despachar'}
      </h2>

      {/* Selector de pestañas: solo si tiene las dos (si solo tiene una,
          no hay nada que elegir) */}
      {modos.length > 1 && (
        <div className="selector">
          {modos.map((opcion) => (
            <button
              key={opcion}
              type="button"
              className={
                modo === opcion
                  ? 'selector__opcion selector__opcion--activa'
                  : 'selector__opcion'
              }
              onClick={() => cambiarModo(opcion)}
            >
              {opcion === 'ingresar' ? 'Ingresar' : 'Despachar'}
            </button>
          ))}
        </div>
      )}

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
          // Crear un objeto nuevo exige crear E ingresar
          puedeCrear={permisos.crear}
        />
      ) : (
        <FormularioDespachar
          productos={productos}
          onRegistrar={registrarSalida}
        />
      )}
    </section>
  )
}

export default Movimientos