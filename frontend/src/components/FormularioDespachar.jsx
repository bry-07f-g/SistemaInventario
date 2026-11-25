import { useState } from 'react'
import BarraBusqueda from './BarraBusqueda.jsx'
import { filtrarPorNombre, textoStock } from '../utils/inventario.js'

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
//  - onRegistrar: función de la página que registra la salida.
//    Es asíncrona: devuelve (más tarde) true si salió bien y false si, por
//    ejemplo, no alcanzan las unidades.
function FormularioDespachar({ productos, onRegistrar }) {
  const [formulario, setFormulario] = useState(formularioVacio)

  // Lo que hay escrito en la barra de búsqueda
  const [busqueda, setBusqueda] = useState('')

  // Los objetos que se ofrecen en la lista: solo los que contienen lo buscado
  const visibles = filtrarPorNombre(productos, busqueda)

  // true mientras esperamos la respuesta del servidor. Sirve para desactivar
  // el botón y que un doble clic no registre la salida dos veces.
  const [enviando, setEnviando] = useState(false)

  // El objeto elegido en la lista (undefined si todavía no se eligió ninguno).
  // find busca el primer producto cuyo id coincide.
  const productoElegido = productos.find(
    (p) => p.id === Number(formulario.productoId),
  )

  // Un solo manejador para todos los campos (usa el "name" de cada uno)
  function cambiarCampo(evento) {
    const { name, value } = evento.target
    setFormulario({ ...formulario, [name]: value })
  }

  // Cada letra nueva en la búsqueda actualiza la lista al instante.
  // Si el objeto que estaba elegido ya no coincide con lo buscado, se
  // desmarca para no despachar algo que la persona ya no está viendo.
  function cambiarBusqueda(texto) {
    setBusqueda(texto)
    const sigueVisible = filtrarPorNombre(productos, texto).some(
      (p) => String(p.id) === formulario.productoId,
    )
    if (!sigueVisible) {
      setFormulario({ ...formulario, productoId: '' })
    }
  }

  async function enviar(evento) {
    // Evita que el navegador recargue la página
    evento.preventDefault()

    // El backend comprueba que alcancen las unidades y guarda la salida.
    // Si algo falla, el formulario se queda como está para corregirlo.
    setEnviando(true)
    const registrado = await onRegistrar(formulario)
    setEnviando(false)
    if (registrado) {
      setFormulario(formularioVacio)
      setBusqueda('')
    }
  }

  // Si no hay ningún objeto registrado, no tiene sentido mostrar el formulario
  if (productos.length === 0) {
    return <p>No hay objetos para despachar. Primero ingresa alguno.</p>
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {/* Barra de búsqueda: filtra la lista de abajo letra por letra */}
      <BarraBusqueda valor={busqueda} onCambio={cambiarBusqueda} />

      <label className="campo">
        <span>Objeto</span>
        <select
          name="productoId"
          value={formulario.productoId}
          onChange={cambiarCampo}
          required
        >
          <option value="">Selecciona un objeto</option>
          {/* map dibuja una opción por cada objeto que coincide */}
          {visibles.map((p) => (
            // "disabled" no deja elegir los que están agotados
            <option key={p.id} value={p.id} disabled={p.cantidad === 0}>
              {p.nombre} ({textoStock(p)})
            </option>
          ))}
        </select>
        {busqueda.trim() !== '' && (
          <small className="campo__ayuda">
            {visibles.length === 0
              ? 'Ningún objeto coincide con la búsqueda.'
              : `${visibles.length} de ${productos.length} objetos`}
          </small>
        )}
        {/* Ayuda: muestra cuántas unidades hay del objeto elegido */}
        {productoElegido && (
          <small className="campo__ayuda">
            Disponibles: {productoElegido.cantidad}
          </small>
        )}
      </label>

      <label className="campo">
        <span>Cantidad a despachar</span>
        <input
          type="number"
          name="cantidad"
          value={formulario.cantidad}
          onChange={cambiarCampo}
          min="1"
          step="1"
          required
        />
      </label>

      <label className="campo">
        <span>Quién entregó</span>
        <input
          type="text"
          name="entrego"
          value={formulario.entrego}
          onChange={cambiarCampo}
          maxLength={100}
          required
        />
      </label>

      <label className="campo">
        <span>Quién recibió</span>
        <input
          type="text"
          name="recibio"
          value={formulario.recibio}
          onChange={cambiarCampo}
          maxLength={100}
          required
        />
      </label>

      <label className="campo">
        <span>Observación (opcional)</span>
        <input
          type="text"
          name="observacion"
          value={formulario.observacion}
          onChange={cambiarCampo}
          maxLength={255}
        />
      </label>

      <button
        type="submit"
        className="boton boton--principal"
        disabled={enviando}
      >
        {enviando ? 'Guardando...' : 'Registrar salida'}
      </button>
    </form>
  )
}

export default FormularioDespachar