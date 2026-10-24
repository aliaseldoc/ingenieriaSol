import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Cada cuanto se pregunta si hay una version nueva: el navegador solo lo hace
// al abrir la app, y un celular puede tenerla abierta todo el dia.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000
// Al pasar a segundo plano se espera un poco antes de recargar, asi el
// autoguardado del formulario de visita (1,5 s) llega a guardar lo ultimo.
const BACKGROUND_DELAY_MS = 5000

// injectRegister: false en vite.config.js: este hook es lo unico que registra
// el service worker (sin el, nada de la app queda disponible offline).
// registerType: 'prompt' hace que una version nueva quede esperando, y aca se
// decide cuando se aplica, siempre en un momento en que nadie pierde lo que
// esta cargando (pedido del 24/10/2026; antes habia un boton "Actualizar"):
//   * al abrir la app, si todavia no se toco nada;
//   * cuando la app pasa a segundo plano: se bloquea el celular o se cambia de
//     app o de pestaña.
// Aplicarla recarga la pagina. No muestra nada.
export default function PwaAutoUpdate() {
  const touchedRef = useRef(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {})
      }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  useEffect(() => {
    function markTouched() {
      touchedRef.current = true
    }
    window.addEventListener('pointerdown', markTouched)
    window.addEventListener('keydown', markTouched)
    return () => {
      window.removeEventListener('pointerdown', markTouched)
      window.removeEventListener('keydown', markTouched)
    }
  }, [])

  useEffect(() => {
    if (!needRefresh) return
    if (!touchedRef.current) {
      updateServiceWorker(true)
      return
    }

    let timeoutId = null
    function applyWhenHidden() {
      clearTimeout(timeoutId)
      if (document.visibilityState !== 'hidden') return
      timeoutId = setTimeout(() => {
        if (document.visibilityState === 'hidden') updateServiceWorker(true)
      }, BACKGROUND_DELAY_MS)
    }
    applyWhenHidden()
    document.addEventListener('visibilitychange', applyWhenHidden)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', applyWhenHidden)
    }
  }, [needRefresh, updateServiceWorker])

  return null
}
