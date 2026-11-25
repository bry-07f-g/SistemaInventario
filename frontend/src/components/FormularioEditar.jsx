import { useState } from 'react'
import { urlImagen } from '../services/api.js'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'

// Formulario para editar UN objeto. Se muestra dentro de la fila del objeto.
// Recibe por props:
//  - producto: el objeto que se edita (sus datos actuales llenan los campos)
//  - onGuardar: función de la página que envía los cambios al backend.
//    Es asíncrona y devuelve true si salió bien.
//  - onCancelar: función que cierra el formulario sin guardar nada.
//
// OJO: aquí NO se edita la cantidad. La cantidad solo cambia con
// movimientos (ingresar / despachar), así el historial siempre cuadra.
function FormularioEditar({ producto, onGuardar, onCancelar }) {
  // Los campos empiezan con los valores actuales del objeto.
  // (useState solo usa el valor inicial la primera vez que se dibuja.)
  const [nombre, setNombre] = useState(producto.nombre)
  const [descripcion, setDescripcion] = useState(producto.descripcion || '')
  const [cantidadMinima, setCantidadMinima] = useState(
    String(producto.cantidad_minima),
  )

  // Imagen nueva (opcional) y su vista previa
  const [archivo, setArchivo] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)

  // true mientras se espera al servidor (desactiva el botón)
  const [guardando, setGuardando] = useState(false)

  function cambiarImagen(evento) {
    const elegido = evento.target.files[0]
    if (elegido) {
      setArchivo(elegido)
      setVistaPrevia(URL.createObjectURL(elegido))
    }
  }

  async function enviar(evento) {
    evento.preventDefault()

    // FormData permite mandar texto Y un archivo en la misma petición.
    const datos = new FormData()
    datos.append('nombre', nombre)
    datos.append('descripcion', descripcion)
    datos.append('cantidad_minima', cantidadMinima)
    // Solo se manda la imagen si se eligió una nueva;
    // si no, el backend deja la que ya tenía.
    if (archivo) datos.append('imagen', archivo)

    setGuardando(true)
    await onGuardar(producto.id, datos)
    setGuardando(false)
    // Si salió bien, la página cierra este formulario (ya no existirá);
    // si falló, queda abierto para corregir.
  }

  // Imagen que se muestra: la nueva si hay, si no la actual
  const imagenMostrada = vistaPrevia || urlImagen(producto.imagen)

  return (
    <form className="formulario formulario--editar" onSubmit={enviar}>
      <label className="campo">
        <span>Nombre</span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={100}
          required
        />
      </label>

      <label className="campo">
        <span>Descripción (opcional)</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </label>

      <label className="campo">
        <span>Cantidad mínima</span>
        <input
          type="number"
          value={cantidadMinima}
          onChange={(e) => setCantidadMinima(e.target.value)}
          min="0"
          step="1"
          required
        />
        <small className="campo__ayuda">
          Con esta cantidad o menos se marca &quot;próximo a agotar&quot;. Usa 0
          para no tener aviso.
        </small>
      </label>

      <label className="campo">
        <span>Imagen (opcional)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={cambiarImagen}
        />
        {imagenMostrada && (
          <img
            className="vista-previa"
            src={imagenMostrada}
            alt="Imagen del objeto"
          />
        )}
        <small className="campo__ayuda">
          Si eliges una imagen nueva, reemplaza a la actual.
        </small>
      </label>

      <p className="texto-suave">
        La cantidad ({producto.cantidad}) no se edita aquí: cambia al ingresar
        o despachar.
      </p>

      <div className="formulario__botones">
        <button className="boton boton--principal" type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button className="boton" type="button" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default FormularioEditar