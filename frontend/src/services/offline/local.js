// Copia LOCAL de los datos (en IndexedDB) y cómo se modifica cuando se
// trabaja sin internet.
//
// Cuando se hace algo sin conexión, el cambio se aplica AQUÍ al instante
// (así la pantalla lo muestra de inmediato) y además se guarda en la cola
// para enviarlo después. Se aplican las mismas reglas que el servidor
// (nombre repetido, stock insuficiente...) para que la persona vea el
// error en el momento, igual que con internet.
//
// Las cosas creadas sin internet todavía no tienen id del servidor: se les
// da un id NEGATIVO temporal (-1, -2...). Al sincronizar, el servidor
// devuelve el id real y se anota la equivalencia (mapa de ids).
import { leer, guardar } from './db.js'

// ---------- Nombres de las claves en el cajón "cache" ----------
export const claves = {
  usuario: (email) => `usuario:${email}`,
  productos: (inventarioId) => `inv:${inventarioId}:productos`,
  movimientos: (inventarioId) => `inv:${inventarioId}:movimientos`,
  inventarios: 'admin:inventarios',
  usuarios: 'admin:usuarios',
  detalleUsuario: (id) => `admin:usuario:${id}`,
  mapaIds: 'mapa-ids',
  temporal: 'ultimo-id-temporal',
}

export function leerCache(clave) {
  return leer('cache', clave)
}

export function guardarCache(clave, valor) {
  return guardar('cache', clave, valor)
}

// Lee una lista guardada; si no existe, avisa que no hay datos sin conexión
async function lista(clave) {
  const valor = await leerCache(clave)
  if (!valor) {
    throw new Error(
      'Estos datos no están guardados en este equipo. Conéctate a internet para descargarlos.',
    )
  }
  return valor
}

// Siguiente id temporal: -1, -2, -3...
async function idTemporal() {
  const ultimo = (await leerCache(claves.temporal)) ?? 0
  await guardarCache(claves.temporal, ultimo - 1)
  return ultimo - 1
}

const mismoNombre = (a, b) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

// Error con el mismo formato que los del servidor
function errorLocal(mensaje) {
  const error = new Error(mensaje)
  error.local = true
  return error
}

// Convierte una imagen (archivo) en texto "data:image/..." para poder
// mostrarla en pantalla aunque no se haya subido todavía.
function leerComoTexto(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(lector.result)
    lector.onerror = () => rechazar(lector.error)
    lector.readAsDataURL(archivo)
  })
}

// Movimiento "de mentiras" para el historial local
function movimientoLocal(accion, usuario, producto, tipo, cantidad, datos) {
  return {
    id: accion.idTemporal,
    producto_id: producto.id,
    producto_nombre: producto.nombre,
    tipo,
    cantidad,
    entrego: datos.entrego,
    recibio: datos.recibio,
    observacion: datos.observacion || null,
    usuario_nombre: usuario?.nombre ?? null,
    estado: 'aplicado',
    fecha: accion.fecha,
    sin_sincronizar: true, // marca para mostrar "pendiente de enviar"
  }
}

// ---------------------------------------------------------------------
// Aplica una acción a los datos locales. Prepara la acción (le pone id
// temporal, versión vista...) y devuelve lo mismo que devolvería el
// servidor, para que las páginas no noten la diferencia.
// ---------------------------------------------------------------------
export async function aplicarLocal(accion, usuario) {
  const { tipo, inventarioId, datos } = accion

  if (tipo === 'crearProducto') {
    const productos = await lista(claves.productos(inventarioId))
    if (productos.some((p) => mismoNombre(p.nombre, datos.nombre))) {
      throw errorLocal(`Ya existe un objeto llamado "${datos.nombre.trim()}" en este inventario`)
    }
    accion.idTemporal = await idTemporal()
    accion.descripcion = `Crear "${datos.nombre.trim()}" con ${datos.cantidad} unidades`
    const producto = {
      id: accion.idTemporal,
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion || null,
      cantidad: Number(datos.cantidad),
      cantidad_minima: Number(datos.cantidad_minima || 0),
      imagen: datos.imagen ? await leerComoTexto(datos.imagen) : null,
      version_datos: 0,
      uuid_cliente: accion.uuid,
    }
    const movimientos = await lista(claves.movimientos(inventarioId))
    const idMovimiento = await idTemporal()
    await guardarCache(claves.productos(inventarioId), [...productos, producto])
    await guardarCache(claves.movimientos(inventarioId), [
      movimientoLocal({ ...accion, idTemporal: idMovimiento }, usuario, producto, 'entrada', producto.cantidad, datos),
      ...movimientos,
    ])
    return producto
  }

  if (tipo === 'editarProducto') {
    const productos = await lista(claves.productos(inventarioId))
    const producto = productos.find((p) => p.id === accion.objetivoId)
    if (!producto) throw errorLocal('El objeto no existe')
    if (productos.some((p) => p.id !== producto.id && mismoNombre(p.nombre, datos.nombre))) {
      throw errorLocal(`Ya existe un objeto llamado "${datos.nombre.trim()}" en este inventario`)
    }
    // La versión que VIO esta persona (el servidor la compara al sincronizar)
    accion.version = producto.version_datos
    accion.descripcion = `Editar "${producto.nombre}"`
    const editado = {
      ...producto,
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion || null,
      cantidad_minima:
        datos.cantidad_minima === '' || datos.cantidad_minima === undefined
          ? producto.cantidad_minima
          : Number(datos.cantidad_minima),
      imagen: datos.imagen ? await leerComoTexto(datos.imagen) : producto.imagen,
      // Igual que el servidor: cada edición sube la versión
      version_datos: producto.version_datos + 1,
    }
    await guardarCache(
      claves.productos(inventarioId),
      productos.map((p) => (p.id === producto.id ? editado : p)),
    )
    // El historial muestra el nombre nuevo
    const movimientos = await lista(claves.movimientos(inventarioId))
    await guardarCache(
      claves.movimientos(inventarioId),
      movimientos.map((m) => (m.producto_id === producto.id ? { ...m, producto_nombre: editado.nombre } : m)),
    )
    return editado
  }

  if (tipo === 'eliminarProducto') {
    const productos = await lista(claves.productos(inventarioId))
    const eliminado = productos.find((p) => p.id === accion.objetivoId)
    if (!eliminado) throw errorLocal('El objeto no existe')
    accion.descripcion = `Eliminar "${eliminado.nombre}"`
    await guardarCache(
      claves.productos(inventarioId),
      productos.filter((p) => p.id !== accion.objetivoId),
    )
    // Su historial se conserva, pero ya sin objeto (como en el servidor)
    const movimientos = await lista(claves.movimientos(inventarioId))
    await guardarCache(
      claves.movimientos(inventarioId),
      movimientos.map((m) => (m.producto_id === accion.objetivoId ? { ...m, producto_id: null } : m)),
    )
    return null
  }

  if (tipo === 'movimiento') {
    const productos = await lista(claves.productos(inventarioId))
    const producto = productos.find((p) => p.id === datos.producto_id)
    if (!producto) throw errorLocal('El objeto no existe')
    const cantidad = Number(datos.cantidad)
    if (datos.tipo === 'salida' && cantidad > producto.cantidad) {
      throw errorLocal(
        `No hay suficientes productos. De "${producto.nombre}" solo hay ${producto.cantidad} disponibles.`,
      )
    }
    const actualizado = {
      ...producto,
      cantidad: producto.cantidad + (datos.tipo === 'entrada' ? cantidad : -cantidad),
    }
    accion.idTemporal = await idTemporal()
    accion.descripcion = `${datos.tipo === 'entrada' ? 'Ingresar' : 'Despachar'} ${cantidad} de "${producto.nombre}"`
    await guardarCache(
      claves.productos(inventarioId),
      productos.map((p) => (p.id === producto.id ? actualizado : p)),
    )
    const movimientos = await lista(claves.movimientos(inventarioId))
    const movimiento = movimientoLocal(accion, usuario, producto, datos.tipo, cantidad, datos)
    await guardarCache(claves.movimientos(inventarioId), [movimiento, ...movimientos])
    // Mismo formato que la respuesta del servidor
    return { movimiento, producto: { id: actualizado.id, nombre: actualizado.nombre, cantidad: actualizado.cantidad } }
  }

  // ----- Empresas (solo super administrador) -----
  if (tipo === 'crearInventario') {
    const empresas = await lista(claves.inventarios)
    if (empresas.some((e) => mismoNombre(e.nombre, datos.nombre))) {
      throw errorLocal(`Ya existe un inventario llamado "${datos.nombre.trim()}"`)
    }
    accion.idTemporal = await idTemporal()
    accion.descripcion = `Crear la empresa "${datos.nombre.trim()}"`
    const empresa = {
      id: accion.idTemporal,
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion || null,
      total_objetos: 0,
      total_usuarios: 0,
    }
    await guardarCache(claves.inventarios, [...empresas, empresa])
    await guardarCache(claves.productos(empresa.id), [])
    await guardarCache(claves.movimientos(empresa.id), [])
    await cambiarEmpresasDelUsuario(usuario, (lista) => [
      ...lista,
      { id: empresa.id, nombre: empresa.nombre, permisos: todosLosPermisos() },
    ])
    return empresa
  }

  if (tipo === 'editarInventario') {
    const empresas = await lista(claves.inventarios)
    if (empresas.some((e) => e.id !== accion.objetivoId && mismoNombre(e.nombre, datos.nombre))) {
      throw errorLocal(`Ya existe un inventario llamado "${datos.nombre.trim()}"`)
    }
    const nombre = datos.nombre.trim()
    accion.descripcion = `Editar la empresa "${nombre}"`
    await guardarCache(
      claves.inventarios,
      empresas.map((e) => (e.id === accion.objetivoId ? { ...e, nombre, descripcion: datos.descripcion || null } : e)),
    )
    await cambiarEmpresasDelUsuario(usuario, (lista) =>
      lista.map((e) => (e.id === accion.objetivoId ? { ...e, nombre } : e)),
    )
    return { id: accion.objetivoId, nombre }
  }

  if (tipo === 'eliminarInventario') {
    const productos = (await leerCache(claves.productos(accion.objetivoId))) ?? []
    const movimientos = (await leerCache(claves.movimientos(accion.objetivoId))) ?? []
    if (productos.length > 0 || movimientos.length > 0) {
      throw errorLocal(
        `No se puede eliminar: tiene ${productos.length} objeto(s) y ${movimientos.length} movimiento(s) en el historial`,
      )
    }
    const empresas = await lista(claves.inventarios)
    accion.descripcion = `Eliminar la empresa "${empresas.find((e) => e.id === accion.objetivoId)?.nombre ?? ''}"`
    await guardarCache(claves.inventarios, empresas.filter((e) => e.id !== accion.objetivoId))
    await cambiarEmpresasDelUsuario(usuario, (lista) => lista.filter((e) => e.id !== accion.objetivoId))
    return null
  }

  // ----- Usuarios (solo super administrador) -----
  if (tipo === 'crearUsuario' || tipo === 'editarUsuario') {
    const usuarios = await lista(claves.usuarios)
    const email = datos.email.trim().toLowerCase()
    if (usuarios.some((u) => u.id !== accion.objetivoId && u.email === email)) {
      throw errorLocal(`Ya existe un usuario con el correo ${email}`)
    }
    const empresas = (await leerCache(claves.inventarios)) ?? []
    // Igual que el servidor: cualquier permiso marcado activa "ver"
    const permisos = (datos.permisos ?? []).map((p) => ({
      ...p,
      ver: true,
      inventario_nombre: empresas.find((e) => e.id === p.inventario_id)?.nombre ?? '—',
    }))
    if (tipo === 'crearUsuario') accion.idTemporal = await idTemporal()
    accion.descripcion = `${tipo === 'crearUsuario' ? 'Crear' : 'Editar'} el usuario "${datos.nombre.trim()}"`
    const id = tipo === 'crearUsuario' ? accion.idTemporal : accion.objetivoId
    const anterior = usuarios.find((u) => u.id === id)
    const fila = {
      id,
      nombre: datos.nombre.trim(),
      email,
      esSuperAdmin: false,
      activo: tipo === 'crearUsuario' ? true : datos.activo,
      creado: anterior?.creado ?? accion.fecha,
      totalInventarios: permisos.length,
    }
    await guardarCache(
      claves.usuarios,
      anterior ? usuarios.map((u) => (u.id === id ? fila : u)) : [...usuarios, fila],
    )
    const detalle = { ...fila, permisos }
    await guardarCache(claves.detalleUsuario(id), detalle)
    return detalle
  }

  if (tipo === 'eliminarUsuario') {
    const usuarios = await lista(claves.usuarios)
    accion.descripcion = `Eliminar el usuario "${usuarios.find((u) => u.id === accion.objetivoId)?.nombre ?? ''}"`
    await guardarCache(claves.usuarios, usuarios.filter((u) => u.id !== accion.objetivoId))
    return null
  }

  if (tipo === 'cambiarContrasena') {
    // No hay nada que mostrar: solo queda en la cola
    const detalle = await leerCache(claves.detalleUsuario(accion.objetivoId))
    accion.descripcion = `Asignar contraseña nueva a "${detalle?.nombre ?? 'usuario'}"`
    return null
  }

  throw new Error(`Esta acción no se puede hacer sin conexión: ${tipo}`)
}

function todosLosPermisos() {
  return { ver: true, crear: true, editar: true, eliminar: true, ingresar: true, despachar: true }
}

// Cambia la lista de empresas del usuario guardado (el selector del
// header la lee de ahí)
async function cambiarEmpresasDelUsuario(usuario, cambiar) {
  if (!usuario) return
  const clave = claves.usuario(usuario.email)
  const guardado = (await leerCache(clave)) ?? usuario
  const nuevo = { ...guardado, inventarios: cambiar(guardado.inventarios) }
  nuevo.inventarios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  await guardarCache(clave, nuevo)
}