import { useState } from 'react'
import { iniciarSesion } from '../services/api.js'

// Pantalla de inicio de sesión: es lo primero que se ve si no hay sesión.
// Recibe por props:
//  - onEntrar: función de App que recibe al usuario cuando el login sale bien
//  - aviso: mensaje opcional (por ejemplo "Tu sesión venció...")
function Login({ onEntrar, aviso }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault() // que el navegador no recargue la página
    setError(null)
    setEnviando(true)
    try {
      const usuario = await iniciarSesion(email.trim(), password)
      onEntrar(usuario)
    } catch (fallo) {
      // Por ejemplo: "Correo o contraseña incorrectos"
      setError(fallo.message)
      setPassword('') // por seguridad, se vuelve a escribir
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <form className="login__tarjeta formulario" onSubmit={enviar}>
        <img className="login__logo" src="/Forage-logo.png" alt="" />
        <h1 className="login__titulo">Sistema de Inventario</h1>
        <p className="texto-suave">Inicia sesión para continuar</p>

        {/* El aviso (sesión vencida) solo se muestra si no hay otro error */}
        {aviso && !error && <p className="mensaje mensaje--error">{aviso}</p>}
        {error && <p className="mensaje mensaje--error">{error}</p>}

        <label className="campo">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>

        {/* El servidor gratuito "se duerme": el primer ingreso puede tardar */}
        {enviando && (
          <small className="campo__ayuda">
            Si el servidor estaba inactivo, puede tardar hasta un minuto.
          </small>
        )}

        <small className="campo__ayuda">
          ¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.
        </small>
      </form>
    </div>
  )
}

export default Login