// Los seis permisos que se pueden dar en cada inventario, con la
// explicación que se le muestra al super administrador al asignarlos.
// Están en un solo lugar para que la lista y el formulario digan lo mismo.
export const PERMISOS = [
  {
    clave: 'ver',
    nombre: 'Ver',
    explicacion:
      'Ver el inventario y el historial de esta empresa. Sin este permiso el usuario no ve la empresa. Se marca solo al dar cualquier otro permiso.',
  },
  {
    clave: 'crear',
    nombre: 'Crear',
    explicacion:
      'Registrar objetos nuevos con su cantidad inicial. Como eso también es un ingreso, al marcarlo se marca "Ingresar".',
  },
  {
    clave: 'editar',
    nombre: 'Editar',
    explicacion: 'Cambiar nombre, descripción, foto y cantidad mínima de los objetos. No cambia la cantidad.',
  },
  {
    clave: 'eliminar',
    nombre: 'Eliminar',
    explicacion: 'Borrar objetos del inventario. Su historial de movimientos se conserva.',
  },
  {
    clave: 'ingresar',
    nombre: 'Ingresar',
    explicacion: 'Sumar unidades a objetos que ya existen (entradas).',
  },
  {
    clave: 'despachar',
    nombre: 'Despachar',
    explicacion: 'Entregar unidades: se restan del stock y quedan en el historial (salidas).',
  },
]

// Permisos vacíos: { ver: false, crear: false, ... }
export function sinPermisos() {
  return Object.fromEntries(PERMISOS.map((p) => [p.clave, false]))
}

// Aplica las reglas al marcar o desmarcar UNA casilla y devuelve los
// permisos nuevos (no cambia el objeto original):
//  - Cualquier permiso marcado -> "ver" también.
//  - Quitar "ver" -> se quitan todos (sin ver, no hay acceso).
//  - Marcar "crear" -> también "ingresar" (crear registra un ingreso).
//  - Quitar "ingresar" -> también se quita "crear".
export function cambiarPermiso(actuales, clave, marcado) {
  const nuevos = { ...actuales, [clave]: marcado }

  if (clave === 'ver' && !marcado) return sinPermisos()
  if (marcado) nuevos.ver = true
  if (clave === 'crear' && marcado) nuevos.ingresar = true
  if (clave === 'ingresar' && !marcado) nuevos.crear = false

  return nuevos
}

// ¿Tiene al menos un permiso? (si no, no tiene acceso a esa empresa)
export function tieneAcceso(permisos) {
  return PERMISOS.some((p) => permisos[p.clave])
}