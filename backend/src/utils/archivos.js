// Ayudas para las imágenes guardadas en la carpeta backend/uploads
const fs = require('fs/promises')
const path = require('path')

// __dirname es la carpeta de este archivo (backend/src/utils).
// Con ".." subimos dos niveles hasta llegar a backend/.
const CARPETA_BACKEND = path.join(__dirname, '..', '..')
const CARPETA_UPLOADS = path.join(CARPETA_BACKEND, 'uploads')

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

// Borra una imagen a partir de la ruta que se guarda en la base de datos
// (por ejemplo "uploads/1732200000-a1b2c3.jpg").
async function borrarImagen(rutaRelativa) {
  if (!rutaRelativa) return

  const ruta = path.resolve(CARPETA_BACKEND, rutaRelativa)

  // Seguridad: solo borramos archivos que estén DIRECTAMENTE dentro de
  // uploads. Así, una ruta rara como "../.env" nunca borraría nada fuera.
  if (path.dirname(ruta) !== CARPETA_UPLOADS) {
    console.error('Ruta fuera de uploads, no se borra:', rutaRelativa)
    return
  }
  await borrarArchivo(ruta)
}

module.exports = { CARPETA_UPLOADS, borrarArchivo, borrarImagen }