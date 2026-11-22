// Datos de EJEMPLO compartidos por las páginas mientras no hay backend.
// "export" permite que otros archivos los importen y usen.
// Cuando conectemos la base de datos, este archivo se elimina.
export const productosEjemplo = [
  {
    id: 1,
    nombre: 'Silla de oficina',
    cantidad: 12,
    descripcion: 'Silla ergonómica con ruedas y espaldar ajustable.',
    imagen: null, // null = todavía no tiene imagen
  },
  {
    id: 2,
    nombre: 'Resma de papel carta',
    cantidad: 0,
    descripcion: 'Paquete de 500 hojas tamaño carta.',
    imagen: null,
  },
  {
    id: 3,
    nombre: 'Marcadores permanentes',
    cantidad: 45,
    descripcion: 'Caja de marcadores de colores surtidos.',
    imagen: null,
  },
]