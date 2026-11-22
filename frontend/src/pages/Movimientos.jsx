import { useState } from 'react'
import { productosEjemplo } from '../services/datosEjemplo.js'

// Estado inicial del formulario: todos los campos vacíos.
const formularioVacio = {
  productoId: '', // id del objeto existente que se eligió
  nombre: '',
  descripcion: '',
  cantidad: '',
  entrego: '',
  recibio: '',
  observacion: '',
}

function Movimientos() {
  // Qué pestaña está activa: 'ingresar' o 'despachar'
  const [modo, setModo] = useState('ingresar')

  // Dentro de "ingresar": ¿objeto 'nuevo' o uno 'existente'?
  const [tipoObjeto, setTipoObjeto] = useState('nuevo')

  // Todos los campos de texto del formulario en un solo objeto
  const [formulario, setFormulario] = useState(formularioVacio)

  // Archivo de imagen elegido y su vista previa
  const [imagen, setImagen] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)

  // Mensaje de confirmación que se muestra después de registrar
  const [mensaje, setMensaje] = useState('')

  // Cambiar de pestaña también borra el mensaje anterior
  function cambiarModo(nuevoModo) {
    setModo(nuevoModo)
    setMensaje('')
  }

  // Un solo manejador para todos los campos: usa el atributo "name"
  // del campo para saber cuál valor del objeto actualizar.
  function cambiarCampo(evento) {
    const { name, value } = evento.target
    // "...formulario" copia los valores actuales y [name] cambia solo uno
    setFormulario({ ...formulario, [name]: value })
  }

  // Cuando se elige una imagen, la guardamos y creamos una vista previa
  function cambiarImagen(evento) {
    const archivo = evento.target.files[0]
    if (archivo) {
      setImagen(archivo)
      setVistaPrevia(URL.createObjectURL(archivo))
    }
  }

  // Al enviar el formulario
  function enviar(evento) {
    // Evita que el navegador recargue la página (su comportamiento normal)
    evento.preventDefault()

    // Por ahora solo mostramos los datos en la consola.
    // Cuando exista el backend, aquí se enviarán a la base de datos.
    console.log('Datos a enviar (pendiente backend):', {
      tipo: 'entrada',
      tipoObjeto,
      ...formulario,
      imagen,
    })

    // Armamos el mensaje de confirmación
    let nombreObjeto = formulario.nombre
    if (tipoObjeto === 'existente') {
      const producto = productosEjemplo.find(
        (p) => p.id === Number(formulario.productoId),
      )
      nombreObjeto = producto ? producto.nombre : ''
    }
    setMensaje(
      `Se registró el ingreso de ${formulario.cantidad} unidades de "${nombreObjeto}". (Ejemplo: todavía no se guarda en la base de datos)`,
    )

    // Limpiamos el formulario para el siguiente registro
    setFormulario(formularioVacio)
    setImagen(null)
    setVistaPrevia(null)
    evento.target.reset() // también vacía el campo de archivo
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

      {/* Mensaje de confirmación (solo aparece si hay uno) */}
      {mensaje && <p className="mensaje mensaje--exito">{mensaje}</p>}

      {modo === 'ingresar' ? (
        <form className="formulario" onSubmit={enviar}>
          {/* ¿Objeto nuevo o ya existente? */}
          <fieldset className="formulario__radios">
            <legend>¿Qué vas a ingresar?</legend>
            <label>
              <input
                type="radio"
                name="tipoObjeto"
                value="nuevo"
                checked={tipoObjeto === 'nuevo'}
                onChange={(e) => setTipoObjeto(e.target.value)}
              />{' '}
              Objeto nuevo
            </label>
            <label>
              <input
                type="radio"
                name="tipoObjeto"
                value="existente"
                checked={tipoObjeto === 'existente'}
                onChange={(e) => setTipoObjeto(e.target.value)}
              />{' '}
              Objeto existente
            </label>
          </fieldset>

          {/* Campos que dependen del tipo de objeto */}
          {tipoObjeto === 'nuevo' ? (
            <>
              <label className="campo">
                <span>Nombre</span>
                <input
                  type="text"
                  name="nombre"
                  value={formulario.nombre}
                  onChange={cambiarCampo}
                  maxLength={100}
                  required
                />
              </label>

              <label className="campo">
                <span>Descripción (opcional)</span>
                <textarea
                  name="descripcion"
                  value={formulario.descripcion}
                  onChange={cambiarCampo}
                />
              </label>

              <label className="campo">
                <span>Imagen (opcional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={cambiarImagen}
                />
                {vistaPrevia && (
                  <img
                    className="vista-previa"
                    src={vistaPrevia}
                    alt="Vista previa"
                  />
                )}
              </label>
            </>
          ) : (
            <label className="campo">
              <span>Objeto</span>
              <select
                name="productoId"
                value={formulario.productoId}
                onChange={cambiarCampo}
                required
              >
                <option value="">Selecciona un objeto</option>
                {productosEjemplo.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (hay {p.cantidad})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Campos comunes */}
          <label className="campo">
            <span>
              {tipoObjeto === 'nuevo' ? 'Cantidad inicial' : 'Cantidad a ingresar'}
            </span>
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
            Registrar ingreso
          </button>
        </form>
      ) : (
        <p>Aquí irá el formulario para despachar (siguiente parte).</p>
      )}
    </section>
  )
}

export default Movimientos