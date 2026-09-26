import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listUnreadSupervisorNotes } from '../../api/visitEvents'
import { isOnline, isNetworkError } from '../../offline/network'

const REFRESH_INTERVAL_MS = 60 * 1000

const SupervisorNotesContext = createContext(null)

// Notas del supervisor que el tecnico todavia no leyo (ver 0024). Las comparten
// la campanita del encabezado, las listas de "Mi Plan" y "Mi Historial", y la
// visita, que al abrirse las marca como leidas y pide recargar.
//
// Es una consulta de fondo: se repite al volver a la app, al recuperar la
// conexion y cada minuto mientras la app esta a la vista, sin spinner ni
// remontar la pantalla. Sin conexion (o si la consulta falla) se queda con lo
// ultimo que tenia.
export function SupervisorNotesProvider({ children }) {
  const [unreadNotes, setUnreadNotes] = useState([])

  const reload = useCallback(async () => {
    if (!isOnline()) return
    try {
      setUnreadNotes(await listUnreadSupervisorNotes())
    } catch (error) {
      if (!isNetworkError(error)) console.error('No se pudieron cargar las notas del supervisor', error)
    }
  }, [])

  useEffect(() => {
    reload()

    function reloadIfVisible() {
      if (document.visibilityState === 'visible') reload()
    }
    const intervalId = setInterval(reloadIfVisible, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', reloadIfVisible)
    window.addEventListener('online', reloadIfVisible)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', reloadIfVisible)
      window.removeEventListener('online', reloadIfVisible)
    }
  }, [reload])

  const value = useMemo(
    () => ({ unreadNotes, unreadVisitIds: new Set(unreadNotes.map((note) => note.visit_id)), reload }),
    [unreadNotes, reload]
  )

  return <SupervisorNotesContext.Provider value={value}>{children}</SupervisorNotesContext.Provider>
}

export function useSupervisorNotes() {
  const context = useContext(SupervisorNotesContext)
  if (!context) throw new Error('useSupervisorNotes debe usarse dentro de un SupervisorNotesProvider')
  return context
}
