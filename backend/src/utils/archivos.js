// Ayudas para guardar y borrar las imágenes de los objetos.
//
// Hay DOS lugares posibles donde viven las imágenes:
//   1) En tu computador: la carpeta backend/uploads (cuando NO hay Cloudinary).
//   2) En la nube, en Cloudinary (cuando existe la variable CLOUDINARY_URL).
//      Se usa al desplegar, porque el disco de los servidores gratuitos se
//      borra cada vez que se reinician.
//
// En la base de datos se guarda siempre un texto:
//   - local:      "uploads/1732200000-a1b2c3.jpg"
//   - Cloudinary: "https://res.cloudinary.com/.../inventario/abc123.jpg"
const fs = require('fs/promises')
const path = require('path')
const { ErrorHttp } = require('./errores')

// __dirname es la carpeta de este archivo (backend/src/utils).
// Con ".." subimos dos niveles hasta llegar a backend/.
const CARPETA_BACKEND = path.join(__dirname, '..', '..')
const CARPETA_UPLOADS = path.join(CARPETA_BACKEND, 'uploads')

// Carpeta (dentro de Cloudinary) donde quedan todas nuestras imágenes
const CARPETA_NUBE = 'inventario'

// ¿Estamos usando Cloudinary? Sí, si en el .env (o en Render) está la
// variable CLOUDINARY_URL.
function usaNube() {
  return Boolean(process.env.CLOUDINARY_URL)
}

// Cargamos la librería de Cloudinary solo cuando hace falta. Ella lee sola
// la variable CLOUDINARY_URL, así que no hay que configurar nada más.
function cloudinary() {
  return require('cloudinary').v2
}

// Deja la imagen guardada y devuelve el texto que va a la base de datos.
//  - Local: multer ya la guardó en uploads, solo armamos la ruta.
//  - Nube: multer la dejó en memoria (archivo.buffer) y la subimos.
async function guardarImagen(archivo) {
  if (!usaNube()) return `uploads/${archivo.filename}`

  try {
    return await new Promise((resolve, reject) => {
      const flujo = cloudinary().uploader.upload_stream(
        { folder: CARPETA_NUBE, resource_type: 'image' },
        (error, resultado) => (error ? reject(error) : resolve(resultado.secure_url)),
      )
      flujo.end(archivo.buffer)
    })
  } catch (error) {
    console.error('No se pudo subir la imagen a Cloudinary:', error.message)
    throw new ErrorHttp(502, 'No se pudo guardar la imagen. Intenta de nuevo.')
  }
}

// Borra un archivo. Si ya no existe, no pasa nada. Si falla por otra razón
// solo lo anotamos: que no se pueda borrar una imagen no debe tumbar la
// petición, el objeto ya se guardó o se eliminó bien.
async function borrarArchivo(rutaAbsoluta) {
  try {
    await fs.unlink(rutaAbsoluta)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('No se pudo borrar el archivo:', error.message)
    }
  }
}

// Borra una imagen de Cloudinary a partir de su dirección. De la dirección
// sacamos el "public_id" (el nombre dentro de Cloudinary):
//   https://res.cloudinary.com/cuenta/image/upload/v123/inventario/abc.jpg
//   -> public_id = "inventario/abc"
async function borrarImagenNube(direccion) {
  if (!usaNube()) return

  let url
  try {
    url = new URL(direccion)
  } catch {
    return
  }
  const coincidencia = url.pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/)

  // Seguridad: solo borramos imágenes de Cloudinary que estén en NUESTRA
  // carpeta, nunca otra cosa.
  if (url.hostname !== 'res.cloudinary.com' || !coincidencia) return
  const publicId = decodeURIComponent(coincidencia[1])
  if (!publicId.startsWith(`${CARPETA_NUBE}/`)) return

  try {
    await cloudinary().uploader.destroy(publicId, { resource_type: 'image' })
  } catch (error) {
    console.error('No se pudo borrar la imagen de Cloudinary:', error.message)
  }
}

// Borra una imagen a partir del texto que se guarda en la base de datos
// (puede ser una ruta local o una dirección de Cloudinary).
async function borrarImagen(valor) {
  if (!valor) return

  // Una dirección web: la imagen vive en Cloudinary
  if (/^https?:\/\//.test(valor)) {
    await borrarImagenNube(valor)
    return
  }

  const ruta = path.resolve(CARPETA_BACKEND, valor)

  // Seguridad: solo borramos archivos que estén DIRECTAMENTE dentro de
  // uploads. Así, una ruta rara como "../.env" nunca borraría nada fuera.
  if (path.dirname(ruta) !== CARPETA_UPLOADS) {
    console.error('Ruta fuera de uploads, no se borra:', valor)
    return
  }
  await borrarArchivo(ruta)
}

// Cuando algo falla después de haber recibido la imagen, hay que tirarla
// para no dejar archivos huérfanos: la copia en disco (si la hay) y la que
// se haya subido a Cloudinary (si ya se subió).
async function descartarSubida(archivo, imagenGuardada) {
  if (archivo?.path) await borrarArchivo(archivo.path)
  if (imagenGuardada) await borrarImagen(imagenGuardada)
}

module.exports = {
  CARPETA_UPLOADS,
  usaNube,
  guardarImagen,
  borrarArchivo,
  borrarImagen,
  descartarSubida,
}