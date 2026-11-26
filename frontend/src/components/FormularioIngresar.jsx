import { useState } from 'react'
import SelectorObjeto from './SelectorObjeto.jsx'

// Estado inicial del formulario: todos los campos vacíos.
const formularioVacio = {
  productoId: '', // id del objeto existente que se eligió
  nombre: '',
  descripcion: '',
  cantidad: '',
  cantidadMinima: '', // cantidad a partir de la cual se marca "próximo a agotar"
  entrego: '',
  recibio: '',
  observacion: '',
}

// Recibe por props:
//  - productos: la lista actual (para elegir un objeto que ya existe)
//  - onRegistrar: función de la página que guarda el ingreso.
//    Es asíncrona: devuelve (más tarde) true si salió bien y entonces
//    limpiamos el formulario.
//  - puedeCrear: si el usuario tiene permiso de CREAR objetos. Si no, solo
//    puede sumar unidades a objetos que ya existen.
function FormularioIngresar({ productos, onRegistrar, puedeCrear = true }) {
  // ¿Objeto 'nuevo' o uno 'existente'? Sin permiso de crear, solo existente.
  const [tipoObjeto, setTipoObjeto] = useState(puedeCrear ? 'nuevo' : 'existente')

  // Todos los campos de texto en un solo objeto
  const [formulario, setFormulario] = useState(formularioVacio)

  // Archivo de imagen elegido y su vista previa
  const [archivo, setArchivo] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)

  // true mientras esperamos la respuesta del servidor. Sirve para desactivar
  // el botón y que un doble clic no registre el ingreso dos veces.
  const [enviando, setEnviando] = useState(false)

  // Al cambiar entre nuevo/existente, el campo de imagen aparece o
  // desaparece, así que también olvidamos la imagen elegida.
  function cambiarTipoObjeto(valor) {
    setTipoObjeto(valor)
    setArchivo(null)
    setVistaPrevia(null)
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
    const elegido = evento.target.files[0]
    if (elegido) {
      setArchivo(elegido)
      setVistaPrevia(URL.createObjectURL(elegido))
    }
  }

  // Al enviar el formulario. "async" para poder esperar al servidor.
  async function enviar(evento) {
    // Evita que el navegador recargue la página (su comportamiento normal)
    evento.preventDefault()
    const formularioHtml = evento.currentTarget

    // Le entregamos los datos a la página, que es la que los guarda.
    // "archivo" es la imagen elegida: se envía al backend junto con el resto.
    // "await" espera la respuesta del servidor antes de seguir.
    setEnviando(true)
    const registrado = await onRegistrar({
      tipoObjeto,
      ...formulario,
      archivo,
    })
    setEnviando(false)

    // Solo limpiamos si se registró bien
    if (registrado) {
      setFormulario(formularioVacio)
      setArchivo(null)
      setVistaPrevia(null)
      formularioHtml.reset() // también vacía el campo de archivo
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {/* ¿Objeto nuevo o ya existente? (solo si puede crear) */}
      {puedeCrear && (
      <fieldset className="formulario__radios">
        <legend>¿Qué vas a ingresar?</legend>
        <label>
          <input
            type="radio"
            name="tipoObjeto"
            value="nuevo"
            checked={tipoObjeto === 'nuevo'}
            onChange={(e) => cambiarTipoObjeto(e.target.value)}
          />{' '}
          Objeto nuevo
        </label>
        <label>
          <input
            type="radio"
            name="tipoObjeto"
            value="existente"
            checked={tipoObjeto === 'existente'}
            onChange={(e) => cambiarTipoObjeto(e.target.value)}
          />{' '}
          Objeto existente
        </label>
      </fieldset>
      )}

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
            {/* Solo los tipos que acepta el backend; así el selector de archivos
                ya filtra y no deja elegir otros */}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
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
        <>
          {/* Un solo campo: se puede escribir para filtrar o abrir la lista
          y desplazarse para elegir */}
          <SelectorObjeto
            productos={productos}
            valor={formulario.productoId}
            onElegir={(id) => setFormulario({ ...formulario, productoId: id })}
          />
        </>
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

      {/* Solo al crear un objeto nuevo: cuándo avisar que se está acabando */}
      {tipoObjeto === 'nuevo' && (
        <label className="campo">
          <span>Cantidad mínima (opcional)</span>
          <input
            type="number"
            name="cantidadMinima"
            value={formulario.cantidadMinima}
            onChange={cambiarCampo}
            min="0"
            step="1"
          />
          <small className="campo__ayuda">
            Cuando queden esta cantidad o menos, el objeto se marcará como
            &quot;próximo a agotar&quot;. Déjalo vacío si no quieres aviso.
          </small>
        </label>
      )}

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
        {enviando ? 'Guardando...' : 'Registrar ingreso'}
      </button>
    </form>
  )
}

export default FormularioIngresar