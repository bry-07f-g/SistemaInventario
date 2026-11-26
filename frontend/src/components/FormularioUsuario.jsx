import { useState } from 'react'
import { PERMISOS, cambiarPermiso, sinPermisos, tieneAcceso } from '../utils/permisos.js'

// Formulario para CREAR o EDITAR un usuario, con sus permisos por empresa.
// Recibe por props:
//  - usuario: null para crear; para editar, el usuario con sus permisos
//    (lo que devuelve GET /api/usuarios/:id)
//  - inventarios: todas las empresas [{ id, nombre }, ...]
//  - onGuardar: función asíncrona de la página; recibe los datos y
//    devuelve true si salió bien
//  - onCambiarContrasena: (solo al editar) función asíncrona que recibe la
//    contraseña nueva y devuelve true si salió bien
//  - onCancelar: cierra el formulario sin guardar
function FormularioUsuario({ usuario, inventarios, onGuardar, onCambiarContrasena, onCancelar }) {
  const editando = usuario !== null

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [password, setPassword] = useState('') // solo al crear
  const [activo, setActivo] = useState(usuario?.activo ?? true)

  // Permisos por empresa, como un objeto: { 3: { ver: true, ... }, 5: {...} }
  // Se arma una vez, a partir de los permisos que ya tiene el usuario.
  const [permisos, setPermisos] = useState(() => {
    const inicial = {}
    for (const inv of inventarios) inicial[inv.id] = sinPermisos()
    for (const p of usuario?.permisos ?? []) {
      const { inventario_id: id, ...resto } = p
      if (inicial[id]) {
        for (const permiso of PERMISOS) inicial[id][permiso.clave] = resto[permiso.clave]
      }
    }
    return inicial
  })

  const [guardando, setGuardando] = useState(false)

  // Para cambiar la contraseña (solo al editar)
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false)

  // Una casilla: aplica las reglas (ver, crear->ingresar...) de utils/permisos.js
  function marcar(inventarioId, clave, marcado) {
    setPermisos({ ...permisos, [inventarioId]: cambiarPermiso(permisos[inventarioId], clave, marcado) })
  }

  // Casilla "Todo" de una fila: marca o quita los seis permisos
  function marcarTodo(inventarioId, marcado) {
    const fila = Object.fromEntries(PERMISOS.map((p) => [p.clave, marcado]))
    setPermisos({ ...permisos, [inventarioId]: fila })
  }

  async function enviar(evento) {
    evento.preventDefault()

    // De { id: {...} } pasamos a la lista que espera el backend, solo con
    // las empresas donde tiene algún permiso.
    const lista = Object.entries(permisos)
      .filter(([, p]) => tieneAcceso(p))
      .map(([id, p]) => ({ inventario_id: Number(id), ...p }))

    const datos = { nombre, email, permisos: lista }
    if (editando) datos.activo = activo
    else datos.password = password

    setGuardando(true)
    const ok = await onGuardar(datos)
    // Si salió bien, la página cierra este formulario; si no, se queda
    if (!ok) setGuardando(false)
  }

  async function guardarContrasena() {
    setCambiandoContrasena(true)
    const ok = await onCambiarContrasena(nuevaContrasena)
    setCambiandoContrasena(false)
    if (ok) setNuevaContrasena('')
  }

  return (
    <form className="formulario formulario--editar formulario--ancho" onSubmit={enviar}>
      <h3 className="seccion__titulo">{editando ? `Editar a ${usuario.nombre}` : 'Nuevo usuario'}</h3>

      <label className="campo">
        <span>Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
      </label>

      <label className="campo">
        <span>Correo (con este inicia sesión)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={150}
          autoComplete="off"
          required
        />
      </label>

      {/* La contraseña inicial solo se pide al crear. Para cambiarla
          después está la sección de abajo. */}
      {!editando && (
        <label className="campo">
          <span>Contraseña inicial</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
          <small className="campo__ayuda">
            Mínimo 8 caracteres. Entrégasela a la persona en privado.
          </small>
        </label>
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

      {/* ---------- Permisos por empresa ---------- */}
      <fieldset className="permisos">
        <legend>Permisos por empresa</legend>

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
          <div className="tabla__contenedor">
            <table className="tabla tabla--permisos">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Todo</th>
                  {PERMISOS.map((p) => (
                    <th key={p.clave}>{p.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventarios.map((inv) => {
                  const fila = permisos[inv.id]
                  const todo = PERMISOS.every((p) => fila[p.clave])
                  return (
                    <tr key={inv.id}>
                      <td>{inv.nombre}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={todo}
                          onChange={(e) => marcarTodo(inv.id, e.target.checked)}
                          aria-label={`Todos los permisos en ${inv.nombre}`}
                        />
                      </td>
                      {PERMISOS.map((p) => (
                        <td key={p.clave}>
                          <input
                            type="checkbox"
                            checked={fila[p.clave]}
                            onChange={(e) => marcar(inv.id, p.clave, e.target.checked)}
                            // "title" muestra la explicación al pasar el mouse
                            title={p.explicacion}
                            aria-label={`${p.nombre} en ${inv.nombre}`}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <small className="campo__ayuda">
          Una empresa sin ninguna casilla marcada = el usuario no tiene acceso a ella.
        </small>
      </fieldset>

      <div className="formulario__botones">
        <button type="submit" className="boton boton--principal" disabled={guardando}>
          {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
        </button>
        <button type="button" className="boton" onClick={onCancelar}>
          Cancelar
        </button>
      </div>

      {/* ---------- Cambiar contraseña (solo al editar) ---------- */}
      {editando && (
        <div className="contrasena-nueva">
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