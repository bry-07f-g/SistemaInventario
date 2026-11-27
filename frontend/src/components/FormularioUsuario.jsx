import { useId, useState } from 'react'
import Campo from './Campo.jsx'
import SelectorEmpresa from './SelectorEmpresa.jsx'
import { useErrores } from '../hooks/useErrores.js'
import { PERMISOS, cambiarPermiso, sinPermisos, tieneAcceso } from '../utils/permisos.js'
import { correo, obligatorio } from '../utils/validar.js'

// Cada empresa a la que el usuario tiene acceso es un "bloque":
//   { clave, empresa: { id, nombre } o null, permisos: { ver, crear, ... } }
// "clave" es un número único para que React distinga los bloques.
let ultimaClave = 0
function bloqueVacio() {
  ultimaClave += 1
  return { clave: ultimaClave, empresa: null, permisos: sinPermisos() }
}

// Formulario para CREAR o EDITAR un usuario, con sus permisos por empresa.
// Recibe por props:
//  - usuario: null para crear; para editar, el usuario con sus permisos
//    (lo que devuelve GET /api/usuarios/:id)
//  - inventarios: todas las empresas [{ id, nombre }, ...]
//  - onGuardar: función asíncrona de la página; recibe los datos y
//    devuelve true si salió bien, { campo: mensaje } si el error es de un
//    campo (correo repetido) o false si es un error general
//  - onCambiarContrasena: (solo al editar) función asíncrona que recibe la
//    contraseña nueva y devuelve true si salió bien
//  - onCancelar: cierra el formulario sin guardar
function FormularioUsuario({ usuario, inventarios, onGuardar, onCambiarContrasena, onCancelar }) {
  const editando = usuario !== null
  const idPermisos = useId()

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [password, setPassword] = useState('') // solo al crear
  const [activo, setActivo] = useState(usuario?.activo ?? true)

  // Al editar: un bloque por cada empresa a la que ya tiene acceso
  const [bloques, setBloques] = useState(() => {
    const iniciales = (usuario?.permisos ?? []).map((p) => {
      const bloque = bloqueVacio()
      const permisos = sinPermisos()
      for (const permiso of PERMISOS) permisos[permiso.clave] = Boolean(p[permiso.clave])
      const empresa = inventarios.find((inv) => inv.id === p.inventario_id) ?? {
        id: p.inventario_id,
        nombre: p.inventario_nombre,
      }
      return { ...bloque, empresa, permisos }
    })
    // Al crear (o si no tiene ninguna), se empieza con un bloque vacío
    return iniciales.length > 0 ? iniciales : [bloqueVacio()]
  })

  // ¿Está desplegada la sección de permisos?
  const [permisosAbiertos, setPermisosAbiertos] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const { errores, mostrar, quitar, formulario } = useErrores()

  // Para cambiar la contraseña (solo al editar)
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false)

  // Cambia UN bloque (por su clave) con la función "cambiar"
  function cambiarBloque(clave, cambiar) {
    setBloques((actuales) => actuales.map((b) => (b.clave === clave ? cambiar(b) : b)))
    quitar(`bloque-${clave}`)
  }

  // Una casilla: aplica las reglas (ver, crear->ingresar...) de utils/permisos.js
  function marcar(clave, permiso, marcado) {
    cambiarBloque(clave, (b) => ({ ...b, permisos: cambiarPermiso(b.permisos, permiso, marcado) }))
  }

  // Casilla "Todo": marca o quita los seis permisos
  function marcarTodo(clave, marcado) {
    const todos = Object.fromEntries(PERMISOS.map((p) => [p.clave, marcado]))
    cambiarBloque(clave, (b) => ({ ...b, permisos: todos }))
  }

  function quitarBloque(clave) {
    setBloques((actuales) => actuales.filter((b) => b.clave !== clave))
    quitar(`bloque-${clave}`)
  }

  // Bloques que de verdad dan acceso (con empresa y al menos un permiso)
  const conAcceso = bloques.filter((b) => b.empresa && tieneAcceso(b.permisos))
  const resumen =
    conAcceso.length === 0
      ? 'Sin acceso a ninguna empresa'
      : `Acceso a ${conAcceso.length} ${conAcceso.length === 1 ? 'empresa' : 'empresas'}`

  // Ya se eligieron todas las empresas: no se puede agregar otro bloque
  const sinMasEmpresas = bloques.length >= inventarios.length

  // Revisa TODOS los campos y devuelve { campo: mensaje }
  function validar() {
    const nuevos = {
      nombre: obligatorio(nombre, 'Escribe el nombre.'),
      email: correo(email),
      password:
        !editando && password.length < 8 ? 'La contraseña debe tener mínimo 8 caracteres.' : null,
    }
    // Empresa elegida pero sin ninguna casilla: no tiene sentido
    for (const b of bloques) {
      if (b.empresa && !tieneAcceso(b.permisos)) {
        nuevos[`bloque-${b.clave}`] = 'Marca al menos un permiso o quita la empresa.'
      }
    }
    return nuevos
  }

  async function enviar(evento) {
    evento.preventDefault()

    const nuevos = validar()
    // Si el error está en los permisos, se despliega la sección para verlo
    if (Object.entries(nuevos).some(([campo, mensaje]) => campo.startsWith('bloque-') && mensaje)) {
      setPermisosAbiertos(true)
    }
    if (!mostrar(nuevos)) return

    // La lista que espera el backend: solo los bloques con acceso
    const lista = conAcceso.map((b) => ({ inventario_id: b.empresa.id, ...b.permisos }))

    const datos = { nombre, email, permisos: lista }
    if (editando) datos.activo = activo
    else datos.password = password

    setGuardando(true)
    const resultado = await onGuardar(datos)
    // Si salió bien, la página cierra este formulario; si no, se queda
    if (resultado !== true) {
      setGuardando(false)
      if (resultado) mostrar(resultado) // por ejemplo, correo repetido
    }
  }

  async function guardarContrasena() {
    setCambiandoContrasena(true)
    const ok = await onCambiarContrasena(nuevaContrasena)
    setCambiandoContrasena(false)
    if (ok) setNuevaContrasena('')
  }

  return (
    <form
      className="formulario formulario--columnas formulario--editar"
      onSubmit={enviar}
      ref={formulario}
      noValidate
    >
      <h3 className="seccion__titulo campo--completo">
        {editando ? `Editar a ${usuario.nombre}` : 'Nuevo usuario'}
      </h3>

      <Campo etiqueta="Nombre" error={errores.nombre}>
        <input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            quitar('nombre')
          }}
          maxLength={100}
        />
      </Campo>

      <Campo etiqueta="Correo (con este inicia sesión)" error={errores.email}>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            quitar('email')
          }}
          maxLength={150}
          autoComplete="off"
        />
      </Campo>

      {/* La contraseña inicial solo se pide al crear. Para cambiarla
          después está la sección de abajo. */}
      {!editando && (
        <Campo
          etiqueta="Contraseña inicial"
          error={errores.password}
          ayuda="Mínimo 8 caracteres. Entrégasela a la persona en privado."
        >
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              quitar('password')
            }}
            autoComplete="new-password"
          />
        </Campo>
      )}

      {editando && (
        <label className="casilla">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span>
            Cuenta activa
            <small className="campo__ayuda">
              Si la desactivas, no podrá iniciar sesión y se cierran sus sesiones abiertas. Su
              nombre se conserva en el historial.
            </small>
          </span>
        </label>
      )}

      {/* ---------- Permisos por empresa (desplegable) ---------- */}
      <section className="permisos campo--completo">
        <button
          type="button"
          className="permisos__cabecera"
          aria-expanded={permisosAbiertos}
          aria-controls={idPermisos}
          onClick={() => setPermisosAbiertos(!permisosAbiertos)}
        >
          <span className="permisos__titulo">Permisos por empresa</span>
          <span className="permisos__resumen">{resumen}</span>
          <span className="permisos__flecha" aria-hidden="true">
            ▾
          </span>
        </button>

        {permisosAbiertos && (
          <div className="permisos__contenido" id={idPermisos}>
            {/* Qué da cada permiso, explicado */}
            <dl className="permisos__leyenda">
              {PERMISOS.map((p) => (
                <div key={p.clave}>
                  <dt>{p.nombre}</dt>
                  <dd>{p.explicacion}</dd>
                </div>
              ))}
            </dl>

            {inventarios.length === 0 ? (
              <p className="texto-suave">Todavía no hay empresas. Créalas en la pantalla Empresas.</p>
            ) : (
              <>
                {bloques.map((b) => {
                  // Empresas que se pueden elegir aquí: todas menos las que
                  // ya están elegidas en OTROS bloques
                  const opciones = inventarios.filter(
                    (inv) => !bloques.some((otro) => otro.clave !== b.clave && otro.empresa?.id === inv.id),
                  )
                  const nombreEmpresa = b.empresa?.nombre ?? 'esta empresa'
                  const todo = PERMISOS.every((p) => b.permisos[p.clave])
                  const error = errores[`bloque-${b.clave}`]
                  return (
                    <div key={b.clave} className={error ? 'permisos__bloque permisos__bloque--error' : 'permisos__bloque'}>
                      <div className="permisos__bloque-cabecera">
                        <SelectorEmpresa
                          opciones={opciones}
                          elegida={b.empresa}
                          onElegir={(empresa) => cambiarBloque(b.clave, (actual) => ({ ...actual, empresa }))}
                        />
                        <button
                          type="button"
                          className="boton boton--peligro"
                          onClick={() => quitarBloque(b.clave)}
                          aria-label={`Quitar ${nombreEmpresa}`}
                        >
                          ✕ Quitar
                        </button>
                      </div>

                      {/* Casillas: se activan al elegir la empresa */}
                      <div className="permisos__casillas">
                        <label className="permisos__casilla permisos__casilla--todo">
                          <input
                            type="checkbox"
                            checked={todo}
                            disabled={!b.empresa}
                            onChange={(e) => marcarTodo(b.clave, e.target.checked)}
                            aria-label={`Todos los permisos en ${nombreEmpresa}`}
                            aria-invalid={error ? true : undefined}
                          />
                          Todo
                        </label>
                        {PERMISOS.map((p) => (
                          // "title" muestra la explicación al pasar el mouse
                          <label key={p.clave} className="permisos__casilla" title={p.explicacion}>
                            <input
                              type="checkbox"
                              checked={b.permisos[p.clave]}
                              disabled={!b.empresa}
                              onChange={(e) => marcar(b.clave, p.clave, e.target.checked)}
                              aria-label={`${p.nombre} en ${nombreEmpresa}`}
                            />
                            {p.nombre}
                          </label>
                        ))}
                      </div>
                      {error && <small className="campo__error">{error}</small>}
                    </div>
                  )
                })}

                <button
                  type="button"
                  className="boton permisos__agregar"
                  disabled={sinMasEmpresas}
                  onClick={() => setBloques([...bloques, bloqueVacio()])}
                >
                  {sinMasEmpresas ? 'Ya agregaste todas las empresas' : '+ Agregar otra empresa'}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <div className="formulario__botones campo--completo">
        <button type="submit" className="boton boton--principal" disabled={guardando}>
          {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
        </button>
        <button type="button" className="boton" onClick={onCancelar}>
          Cancelar
        </button>
      </div>

      {/* ---------- Cambiar contraseña (solo al editar) ---------- */}
      {editando && (
        <div className="contrasena-nueva campo--completo">
          <h4>Asignar una contraseña nueva</h4>
          <p className="campo__ayuda">
            Úsalo si la persona olvidó su contraseña. Sus sesiones abiertas se cerrarán.
          </p>
          <div className="contrasena-nueva__fila">
            <input
              type="password"
              value={nuevaContrasena}
              onChange={(e) => setNuevaContrasena(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              // Enter aquí NO debe enviar el formulario de arriba
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (nuevaContrasena.length >= 8) guardarContrasena()
                }
              }}
              autoComplete="new-password"
              aria-label="Contraseña nueva"
            />
            <button
              type="button"
              className="boton"
              disabled={nuevaContrasena.length < 8 || cambiandoContrasena}
              onClick={guardarContrasena}
            >
              {cambiandoContrasena ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

export default FormularioUsuario