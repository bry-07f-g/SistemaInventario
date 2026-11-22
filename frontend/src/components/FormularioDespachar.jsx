import { useState } from 'react'

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
//    Devuelve true si salió bien y false si, por ejemplo, no alcanzan las unidades.
function FormularioDespachar({ productos, onRegistrar }) {
  const [formulario, setFormulario] = useState(formularioVacio)

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

  function enviar(evento) {
    // Evita que el navegador recargue la página
    evento.preventDefault()

    // La página comprueba que alcancen las unidades y guarda la salida.
    // Si algo falla, el formulario se queda como está para corregirlo.
    const registrado = onRegistrar(formulario)
    if (registrado) {
      setFormulario(formularioVacio)
    }
  }

  // Si no hay ningún objeto registrado, no tiene sentido mostrar el formulario
  if (productos.length === 0) {
    return <p>No hay objetos para despachar. Primero ingresa alguno.</p>
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <label className="campo">
        <span>Objeto</span>
        <select
          name="productoId"
          value={formulario.productoId}
          onChange={cambiarCampo}
          required
        >
          <option value="">Selecciona un objeto</option>
          {productos.map((p) => (
            // "disabled" no deja elegir los que están agotados
            <option key={p.id} value={p.id} disabled={p.cantidad === 0}>
              {p.nombre} ({p.cantidad === 0 ? 'agotado' : `hay ${p.cantidad}`})
            </option>
          ))}
        </select>
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

      <button type="submit" className="boton boton--principal">
        Registrar salida
      </button>
    </form>
  )
}

export default FormularioDespachar