import { useState } from 'react'
import Campo from './Campo.jsx'
import SelectorObjeto from './SelectorObjeto.jsx'
import { useErrores } from '../hooks/useErrores.js'
import { entero, obligatorio } from '../utils/validar.js'

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
//  - onRegistrar: función de la página que guarda el ingreso. Es
//    asíncrona y devuelve: true si salió bien (se limpia el formulario),
//    un objeto { campo: mensaje } si el error es de un campo (por ejemplo
//    nombre repetido) o false si es un error general.
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

  // Errores en rojo debajo de cada campo
  const { errores, mostrar, quitar, formulario: refFormulario } = useErrores()

  const nuevo = tipoObjeto === 'nuevo'

  // Al cambiar entre nuevo/existente, el campo de imagen aparece o
  // desaparece, así que también olvidamos la imagen elegida y los errores.
  function cambiarTipoObjeto(valor) {
    setTipoObjeto(valor)
    setArchivo(null)
    setVistaPrevia(null)
    mostrar({})
  }

  // Un solo manejador para todos los campos: usa el atributo "name"
  // del campo para saber cuál valor del objeto actualizar.
  function cambiarCampo(evento) {
    const { name, value } = evento.target
    // "...formulario" copia los valores actuales y [name] cambia solo uno
    setFormulario({ ...formulario, [name]: value })
    quitar(name) // al escribir, desaparece el error de ese campo
  }

  // Cuando se elige una imagen, la guardamos y creamos una vista previa
  function cambiarImagen(evento) {
    const elegido = evento.target.files[0]
    if (elegido) {
      setArchivo(elegido)
      setVistaPrevia(URL.createObjectURL(elegido))
    }
  }

  // Revisa TODOS los campos y devuelve { campo: mensaje } con los errores
  function validar() {
    return {
      nombre: nuevo ? obligatorio(formulario.nombre, 'Escribe el nombre del objeto.') : null,
      productoId: nuevo ? null : obligatorio(formulario.productoId, 'Elige un objeto de la lista.'),
      cantidad: entero(
        formulario.cantidad,
        1,
        'La cantidad debe ser un número entero mayor que 0.',
      ),
      cantidadMinima:
        nuevo && formulario.cantidadMinima !== ''
          ? entero(formulario.cantidadMinima, 0, 'La cantidad mínima debe ser un número entero de 0 o más.')
          : null,
      entrego: obligatorio(formulario.entrego, 'Escribe quién entregó.'),
      recibio: obligatorio(formulario.recibio, 'Escribe quién recibió.'),
    }
  }

  // Al enviar el formulario. "async" para poder esperar al servidor.
  async function enviar(evento) {
    // Evita que el navegador recargue la página (su comportamiento normal)
    evento.preventDefault()
    const formularioHtml = evento.currentTarget

    // Si algo está mal, se muestran los errores y no se envía nada
    if (!mostrar(validar())) return

    // Le entregamos los datos a la página, que es la que los guarda.
    // "archivo" es la imagen elegida: se envía al backend junto con el resto.
    setEnviando(true)
    const resultado = await onRegistrar({ tipoObjeto, ...formulario, archivo })
    setEnviando(false)

    if (resultado === true) {
      // Salió bien: se limpia todo
      setFormulario(formularioVacio)
      setArchivo(null)
      setVistaPrevia(null)
      formularioHtml.reset() // también vacía el campo de archivo
    } else if (resultado) {
      // Error de un campo (por ejemplo, nombre repetido): debajo del campo
      mostrar(resultado)
    }
  }

  return (
    // noValidate: apaga los globitos del navegador; los errores los
    // mostramos nosotros en rojo debajo de cada campo
    <form className="formulario formulario--columnas" onSubmit={enviar} ref={refFormulario} noValidate>
      {/* ¿Objeto nuevo o ya existente? (solo si puede crear) */}
      {puedeCrear && (
        <fieldset className="formulario__radios campo--completo">
          <legend>¿Qué vas a ingresar?</legend>
          <label className={nuevo ? 'radio radio--elegido' : 'radio'}>
            <input
              type="radio"
              name="tipoObjeto"
              value="nuevo"
              checked={nuevo}
              onChange={(e) => cambiarTipoObjeto(e.target.value)}
            />
            Objeto nuevo
          </label>
          <label className={!nuevo ? 'radio radio--elegido' : 'radio'}>
            <input
              type="radio"
              name="tipoObjeto"
              value="existente"
              checked={!nuevo}
              onChange={(e) => cambiarTipoObjeto(e.target.value)}
            />
            Objeto existente
          </label>
        </fieldset>
      )}

      {/* Fila 1: el objeto y la cantidad */}
      {nuevo ? (
        <Campo etiqueta="Nombre" error={errores.nombre}>
          <input
            type="text"
            name="nombre"
            value={formulario.nombre}
            onChange={cambiarCampo}
            maxLength={100}
          />
        </Campo>
      ) : (
        // Un solo campo: se puede escribir para filtrar o abrir la lista
        <SelectorObjeto
          productos={productos}
          valor={formulario.productoId}
          onElegir={(id) => {
            setFormulario({ ...formulario, productoId: id })
            if (id) quitar('productoId')
          }}
          error={errores.productoId}
        />
      )}

      <Campo etiqueta={nuevo ? 'Cantidad inicial' : 'Cantidad a ingresar'} error={errores.cantidad}>
        <input
          type="number"
          name="cantidad"
          value={formulario.cantidad}
          onChange={cambiarCampo}
          min="1"
          step="1"
        />
      </Campo>

      {/* Solo al crear un objeto nuevo: descripción y cantidad mínima */}
      {nuevo && (
        <>
          <Campo etiqueta="Descripción (opcional)">
            <textarea
              name="descripcion"
              value={formulario.descripcion}
              onChange={cambiarCampo}
              rows={2}
            />
          </Campo>

          <Campo
            etiqueta="Cantidad mínima (opcional)"
            error={errores.cantidadMinima}
            ayuda='Con esta cantidad o menos se marca "próximo a agotar". Vacío = sin aviso.'
          >
            <input
              type="number"
              name="cantidadMinima"
              value={formulario.cantidadMinima}
              onChange={cambiarCampo}
              min="0"
              step="1"
            />
          </Campo>
        </>
      )}

      {/* Quién entregó y quién recibió, lado a lado */}
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

      {/* Con objeto nuevo, la observación comparte fila con la imagen;
          con objeto existente ocupa todo el ancho */}
      <Campo etiqueta="Observación (opcional)" completo={!nuevo}>
        <input
          type="text"
          name="observacion"
          value={formulario.observacion}
          onChange={cambiarCampo}
          maxLength={255}
        />
      </Campo>

      {nuevo && (
        <div className="campo-imagen">
          <Campo etiqueta="Imagen (opcional)">
            {/* Solo los tipos que acepta el backend */}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={cambiarImagen}
            />
          </Campo>
          {vistaPrevia && <img className="vista-previa" src={vistaPrevia} alt="Vista previa" />}
        </div>
      )}

      <div className="formulario__botones campo--completo">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Registrar ingreso'}
        </button>
      </div>
    </form>
  )
}

export default FormularioIngresar