import { useState } from 'react'
import Campo from './Campo.jsx'
import { urlImagen } from '../services/api.js'
import { useErrores } from '../hooks/useErrores.js'
import { entero, obligatorio } from '../utils/validar.js'

// Formulario para editar UN objeto. Se muestra dentro de la fila del objeto.
// Recibe por props:
//  - producto: el objeto que se edita (sus datos actuales llenan los campos)
//  - onGuardar: función de la página que envía los cambios al backend. Es
//    asíncrona y devuelve true si salió bien, { campo: mensaje } si el error
//    es de un campo (nombre repetido) o false si es un error general.
//  - onCancelar: función que cierra el formulario sin guardar nada.
//
// OJO: aquí NO se edita la cantidad. La cantidad solo cambia con
// movimientos (ingresar / despachar), así el historial siempre cuadra.
function FormularioEditar({ producto, onGuardar, onCancelar }) {
  // Los campos empiezan con los valores actuales del objeto.
  // (useState solo usa el valor inicial la primera vez que se dibuja.)
  const [nombre, setNombre] = useState(producto.nombre)
  const [descripcion, setDescripcion] = useState(producto.descripcion || '')
  const [cantidadMinima, setCantidadMinima] = useState(String(producto.cantidad_minima))

  // Imagen nueva (opcional) y su vista previa
  const [archivo, setArchivo] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)

  // true mientras se espera al servidor (desactiva el botón)
  const [guardando, setGuardando] = useState(false)

  // Errores en rojo debajo de cada campo
  const { errores, mostrar, quitar, formulario } = useErrores()

  function cambiarImagen(evento) {
    const elegido = evento.target.files[0]
    if (elegido) {
      setArchivo(elegido)
      setVistaPrevia(URL.createObjectURL(elegido))
    }
  }

  async function enviar(evento) {
    evento.preventDefault()

    const valido = mostrar({
      nombre: obligatorio(nombre, 'Escribe el nombre del objeto.'),
      cantidadMinima: entero(
        cantidadMinima,
        0,
        'La cantidad mínima debe ser un número entero de 0 o más.',
      ),
    })
    if (!valido) return

    // FormData permite mandar texto Y un archivo en la misma petición.
    const datos = new FormData()
    datos.append('nombre', nombre)
    datos.append('descripcion', descripcion)
    datos.append('cantidad_minima', cantidadMinima)
    // Solo se manda la imagen si se eligió una nueva;
    // si no, el backend deja la que ya tenía.
    if (archivo) datos.append('imagen', archivo)

    setGuardando(true)
    const resultado = await onGuardar(producto.id, datos)
    setGuardando(false)
    // Si salió bien, la página cierra este formulario (ya no existirá);
    // si el error es de un campo, se muestra debajo de él.
    if (resultado && resultado !== true) mostrar(resultado)
  }

  // Imagen que se muestra: la nueva si hay, si no la actual
  const imagenMostrada = vistaPrevia || urlImagen(producto.imagen)

  return (
    <form
      className="formulario formulario--columnas formulario--editar"
      onSubmit={enviar}
      ref={formulario}
      noValidate
    >
      <Campo etiqueta="Nombre" error={errores.nombre}>
        <input
          type="text"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            quitar('nombre')
          }}
          maxLength={100}
        />
      </Campo>

      <Campo
        etiqueta="Cantidad mínima"
        error={errores.cantidadMinima}
        ayuda='Con esta cantidad o menos se marca "próximo a agotar". Usa 0 para no tener aviso.'
      >
        <input
          type="number"
          value={cantidadMinima}
          onChange={(e) => {
            setCantidadMinima(e.target.value)
            quitar('cantidadMinima')
          }}
          min="0"
          step="1"
        />
      </Campo>

      <Campo etiqueta="Descripción (opcional)">
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
      </Campo>

      <div className="campo-imagen">
        <Campo etiqueta="Imagen (opcional)" ayuda="Si eliges una imagen nueva, reemplaza a la actual.">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={cambiarImagen}
          />
        </Campo>
        {imagenMostrada && (
          <img className="vista-previa" src={imagenMostrada} alt="Imagen del objeto" />
        )}
      </div>

      <p className="texto-suave campo--completo">
        La cantidad ({producto.cantidad}) no se edita aquí: cambia al ingresar o despachar.
      </p>

      <div className="formulario__botones campo--completo">
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