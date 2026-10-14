import { useCallback, useEffect, useState } from 'react'
import { listClients } from '../api/clients'

// enabled = false: no consulta (el calendario de solo lectura no crea hojas).
export function useClients(enabled = true) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setClients(await listClients())
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) reload()
  }, [reload, enabled])

  return { clients, loading, error, reload }
}
