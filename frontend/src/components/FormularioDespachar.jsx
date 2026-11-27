import { useState } from 'react'
import Campo from './Campo.jsx'
import SelectorObjeto from './SelectorObjeto.jsx'
import { useErrores } from '../hooks/useErrores.js'
import { entero, obligatorio } from '../utils/validar.js'

// Estado inicial del formulario: todos los campos vacíos.
const formularioVacio = {
  productoId: '',
  cantidad: '',
  entrego: '',
  recibio: '',
  observacion: '',
}

// Recibe por props:
//  - productos: la lista actual de objetos
//  - onRegistrar: función de la página que registra la salida. Es
//    asíncrona y devuelve: true si salió bien, un objeto { campo: mensaje }
//    si el error es de un campo (por ejemplo, no alcanzan las unidades) o
//    false si es un error general.
function FormularioDespachar({ productos, onRegistrar }) {
  const [formulario, setFormulario] = useState(formularioVacio)

  // true mientras esperamos la respuesta del servidor. Sirve para desactivar
  // el botón y que un doble clic no registre la salida dos veces.
  const [enviando, setEnviando] = useState(false)

  // Errores en rojo debajo de cada campo
  const { errores, mostrar, quitar, formulario: refFormulario } = useErrores()

  // El objeto elegido en la lista (undefined si todavía no se eligió ninguno).
  // find busca el primer producto cuyo id coincide.
  const productoElegido = productos.find((p) => p.id === Number(formulario.productoId))

  // Un solo manejador para todos los campos (usa el "name" de cada uno)
  function cambiarCampo(evento) {
    const { name, value } = evento.target
    setFormulario({ ...formulario, [name]: value })
    quitar(name)
  }

  // Revisa TODOS los campos y devuelve { campo: mensaje } con los errores
  function validar() {
    let cantidad = entero(formulario.cantidad, 1, 'La cantidad debe ser un número entero mayor que 0.')
    // Aviso rápido: si ya se ve que no alcanzan, no hace falta ir al servidor
    if (!cantidad && productoElegido && Number(formulario.cantidad) > productoElegido.cantidad) {
      cantidad = `Solo hay ${productoElegido.cantidad} disponibles de "${productoElegido.nombre}".`
    }
    return {
      productoId: obligatorio(formulario.productoId, 'Elige un objeto de la lista.'),
      cantidad,
      entrego: obligatorio(formulario.entrego, 'Escribe quién entregó.'),
      recibio: obligatorio(formulario.recibio, 'Escribe quién recibió.'),
    }
  }

  async function enviar(evento) {
    // Evita que el navegador recargue la página
    evento.preventDefault()
    if (!mostrar(validar())) return

    // El backend comprueba que alcancen las unidades y guarda la salida.
    // Si algo falla, el formulario se queda como está para corregirlo.
    setEnviando(true)
    const resultado = await onRegistrar(formulario)
    setEnviando(false)
    if (resultado === true) setFormulario(formularioVacio)
    else if (resultado) mostrar(resultado)
  }

  // Si no hay ningún objeto registrado, no tiene sentido mostrar el formulario
  if (productos.length === 0) {
    return <p>No hay objetos para despachar. Primero ingresa alguno.</p>
  }

  return (
    <form className="formulario formulario--columnas" onSubmit={enviar} ref={refFormulario} noValidate>
      {/* Un solo campo: se puede escribir para filtrar o abrir la lista y
      desplazarse. Los objetos agotados se ven pero no se pueden elegir. */}
      <SelectorObjeto
        productos={productos}
        valor={formulario.productoId}
        onElegir={(id) => {
          setFormulario({ ...formulario, productoId: id })
          if (id) quitar('productoId')
        }}
        bloquearAgotados
        error={errores.productoId}
        // Ayuda: cuántas unidades hay del objeto elegido
        ayuda={productoElegido ? `Disponibles: ${productoElegido.cantidad}` : null}
      />

      <Campo etiqueta="Cantidad a despachar" error={errores.cantidad}>
        <input
          type="number"
          name="cantidad"
          value={formulario.cantidad}
          onChange={cambiarCampo}
          min="1"
          step="1"
        />
      </Campo>

      <Campo etiqueta="Quién entregó" error={errores.entrego}>
        <input
          type="text"
          name="entrego"
          value={formulario.entrego}
          onChange={cambiarCampo}
          maxLength={100}
        />
      </Campo>

      <Campo etiqueta="Quién recibió" error={errores.recibio}>
        <input
          type="text"
          name="recibio"
          value={formulario.recibio}
          onChange={cambiarCampo}
          maxLength={100}
        />
      </Campo>

      <Campo etiqueta="Observación (opcional)" completo>
        <input
          type="text"
          name="observacion"
          value={formulario.observacion}
          onChange={cambiarCampo}
          maxLength={255}
        />
      </Campo>

      <div className="formulario__botones campo--completo">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Registrar salida'}
        </button>
      </div>
    </form>
  )
}

export default FormularioDespachar