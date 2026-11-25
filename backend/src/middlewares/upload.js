// Recibe la imagen que envía el formulario y la guarda en backend/uploads.
// Usa "multer", la librería que lee formularios con archivos
// (formato multipart/form-data).
const crypto = require('crypto')
const fs = require('fs')
const multer = require('multer')
const { CARPETA_UPLOADS, usaNube } = require('../utils/archivos')
const { ErrorHttp } = require('../utils/errores')


// Si la carpeta uploads no existe (por ejemplo, en otro computador), la crea
fs.mkdirSync(CARPETA_UPLOADS, { recursive: true })

// Solo estos tipos de imagen, y la extensión la ponemos NOSOTROS según el
// tipo. Nunca usamos el nombre que trae el archivo original, porque podría
// traer trucos (como "../../algo") o letras raras.
// SVG no está permitido a propósito: puede contener código.
const EXTENSIONES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB

// Dónde y con qué nombre se guarda cada archivo.
//  - Con Cloudinary: la imagen se queda un momento en la memoria y de ahí
//    se sube a la nube (no se escribe nada en el disco del servidor).
//  - Sin Cloudinary: se guarda en la carpeta uploads, con nombre único.
const almacenamientoLocal = multer.diskStorage({
  destination: (req, archivo, siguiente) => siguiente(null, CARPETA_UPLOADS),
  filename: (req, archivo, siguiente) => {
    // Fecha + letras al azar = nombre único, así dos imágenes nunca se pisan
    const aleatorio = crypto.randomBytes(6).toString('hex')
    siguiente(null, `${Date.now()}-${aleatorio}${EXTENSIONES[archivo.mimetype]}`)
  },
})

const multerImagen = multer({
  storage: usaNube() ? multer.memoryStorage() : almacenamientoLocal,
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 10 },
  // Se ejecuta antes de guardar: aquí rechazamos lo que no sea imagen
  fileFilter: (req, archivo, siguiente) => {
    if (!EXTENSIONES[archivo.mimetype]) {
      return siguiente(
        new ErrorHttp(400, 'Solo se permiten imágenes JPG, PNG, WEBP o GIF'),
      )
    }
    siguiente(null, true)
  },
}).single('imagen') // el archivo debe venir en un campo llamado "imagen"

// Middleware: un paso intermedio que se ejecuta ANTES del controlador.
// Envolvemos a multer para convertir sus errores en mensajes claros.
function subirImagen(req, res, siguiente) {
  multerImagen(req, res, (error) => {
    if (!error) return siguiente() // todo bien, pasamos al controlador

    if (error instanceof multer.MulterError) {
      const mensajes = {
        LIMIT_FILE_SIZE: 'La imagen supera el máximo de 5 MB',
        LIMIT_UNEXPECTED_FILE: 'El archivo debe enviarse en el campo "imagen"',
        LIMIT_FILE_COUNT: 'Solo se puede enviar una imagen',
      }
      return siguiente(
        new ErrorHttp(400, mensajes[error.code] || 'No se pudo procesar la imagen'),
      )
    }
    siguiente(error) // errores nuestros (ErrorHttp) u otros: siguen su camino
  })
}

module.exports = { subirImagen }