import { useCallback, useEffect, useState } from 'react'
import { isOnline } from './network'
import { getPendingWrites, flushPendingWrites, syncQueueEvents } from './syncQueue'
import { getPendingPunches, flushPendingPunches } from './punchQueue'

// Relee una cola completa al montar y cada vez que se emite 'change' (se
// encolo algo, se saco algo, o termino un flush). Visitas y fichajes
// comparten el mismo canal de eventos.
function useQueueEntries(loadEntries) {
  const [entries, setEntries] = useState([])

  const reload = useCallback(() => {
    loadEntries().then(setEntries)
  }, [loadEntries])

  useEffect(() => {
    reload()
    syncQueueEvents.addEventListener('change', reload)
    return () => syncQueueEvents.removeEventListener('change', reload)
  }, [reload])

  return entries
}

function usePendingWriteEntries() {
  return useQueueEntries(getPendingWrites)
}

// Fichajes hechos sin conexion que todavia no llegaron al servidor.
export function usePendingPunches() {
  return useQueueEntries(getPendingPunches)
}

export function useConnectivityStatus() {
  const [online, setOnline] = useState(isOnline())

  useEffect(() => {
    function handleOnline() {
      setOnline(true)
    }
    function handleOffline() {
      setOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}

export function usePendingSyncCount() {
  return usePendingWriteEntries().length + usePendingPunches().length
}

// Set<visitId> con escritura pendiente, para marcar tarjetas individuales
// (ej. tag "Sin sincronizar" en Mi Plan Mensual).
export function usePendingVisitIds() {
  const entries = usePendingWriteEntries()
  return new Set(entries.map((entry) => entry.visitId))
}

export function useSyncController() {
  const online = useConnectivityStatus()
  const entries = usePendingWriteEntries()
  const punchEntries = usePendingPunches()
  const [syncing, setSyncing] = useState(false)

  const syncNow = useCallback(async () => {
    if (!isOnline() || syncing) return null
    setSyncing(true)
    try {
      const result = await flushPendingWrites()
      await flushPendingPunches()
      return result
    } finally {
      setSyncing(false)
    }
  }, [syncing])

  // Al recuperar conexion, sincroniza sola sin que el tecnico tenga que
  // acordarse de tocar "Sincronizar ahora" (tambien corre al montar si ya
  // arranca online, para vaciar lo que haya quedado pendiente de una sesion
  // anterior).
  useEffect(() => {
    if (online) syncNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const conflicts = entries.filter((entry) => entry.lastError === 'conflict')

  return { online, pendingCount: entries.length + punchEntries.length, syncing, syncNow, conflicts }
}
