import { useState, useSyncExternalStore } from 'react'
import HistorialMovimientos from '../components/HistorialMovimientos.jsx'
import ModalConfirmacion from '../components/ModalConfirmacion.jsx'
import { cancelarEnvio, confirmarEnvio } from '../services/api.js'
import { estadoConexion, suscribir } from '../services/offline/conexion.js'

// Página "Historial". Además de mostrar la tabla, aquí se resuelven los
// despachos PENDIENTES: los que se hicieron sin conexión y, al
// sincronizar, ya no tenían stock suficiente.
// Recibe por props (vienen de App):
//  - movimientos: historial del inventario elegido
//  - permisos: lo que el usuario puede hacer en este inventario
//  - recargar: vuelve a pedir objetos e historial al servidor
function Historial({ movimientos, permisos, recargar }) {
  // ¿Hay internet? (el mismo estado que usa el indicador de abajo)
  const { enLinea } = useSyncExternalStore(suscribir, estadoConexion)

  const [mensaje, setMensaje] = useState(null) // { tipo: 'exito' | 'error', texto }
  const [procesandoId, setProcesandoId] = useState(null) // id del envío en proceso
  const [porCancelar, setPorCancelar] = useState(null) // envío a cancelar (abre el modal)

  const puedeDespachar = Boolean(permisos?.despachar)
  const pendientes = movimientos.filter((m) => m.estado === 'pendiente')

  async function confirmar(movimiento) {
    setMensaje(null)
    setProcesandoId(movimiento.id)
    try {
      await confirmarEnvio(movimiento.id)
      setMensaje({
        tipo: 'exito',
        texto: `Envío confirmado: se despacharon ${movimiento.cantidad} de "${movimiento.producto_nombre}".`,
      })
      await recargar()
    } catch (error) {
      // Por ejemplo: "Todavía faltan 3 unidades de ..."
      setMensaje({ tipo: 'error', texto: error.message })
    } finally {
      setProcesandoId(null)
    }
  }

  async function cancelar() {
    const movimiento = porCancelar
    setMensaje(null)
    setProcesandoId(movimiento.id)
    try {
      await cancelarEnvio(movimiento.id)
      setMensaje({
        tipo: 'exito',
        texto: `Envío cancelado: no se despacharon las ${movimiento.cantidad} unidades de "${movimiento.producto_nombre}".`,
      })
      setPorCancelar(null)
      await recargar()
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
      setPorCancelar(null)
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <section>
      <h2 className="pagina__titulo">Historial de movimientos</h2>

      {/* Aviso arriba si hay envíos esperando stock */}
      {pendientes.length > 0 && (
        <p className="mensaje mensaje--aviso">
          {pendientes.length === 1
            ? 'Hay 1 envío pendiente por falta de stock.'
            : `Hay ${pendientes.length} envíos pendientes por falta de stock.`}{' '}
          {puedeDespachar
            ? 'Ingresa las unidades que faltan y luego pulsa "Confirmar envío", o cancélalo si ya no se hará.'
            : 'Una persona con permiso de despachar debe confirmarlo o cancelarlo.'}
        </p>
      )}
      {pendientes.length > 0 && puedeDespachar && !enLinea && (
        <p className="campo__ayuda">Necesitas conexión a internet para confirmar o cancelar envíos.</p>
      )}

      {mensaje && (
        <p className={`mensaje ${mensaje.tipo === 'exito' ? 'mensaje--exito' : 'mensaje--error'}`} role="alert">
          {mensaje.texto}
        </p>
      )}

      <HistorialMovimientos
        movimientos={movimientos}
        // Las acciones solo se muestran a quien puede despachar
        acciones={
          puedeDespachar
            ? {
                deshabilitado: !enLinea || procesandoId !== null,
                procesandoId,
                onConfirmar: confirmar,
                onCancelar: setPorCancelar,
              }
            : null
        }
      />

      {porCancelar && (
        <ModalConfirmacion
          titulo="¿Cancelar este envío?"
          textoConfirmar="Cancelar envío"
          peligro
          procesando={procesandoId !== null}
          onConfirmar={cancelar}
          onCancelar={() => setPorCancelar(null)}
        >
          <p>
            No se despacharán las <strong>{porCancelar.cantidad}</strong> unidades de{' '}
            <strong>{porCancelar.producto_nombre}</strong>.
          </p>
          <p>El envío queda en el historial como &quot;Cancelado&quot; y no se puede deshacer.</p>
        </ModalConfirmacion>
      )}
    </section>
  )
}

export default Historial