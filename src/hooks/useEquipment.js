import { useCallback, useEffect, useState } from 'react'
import { listEquipmentWithClients, getEquipmentVisitHistory } from '../api/equipment'

// enabled = false: no consulta (el calendario de solo lectura no crea hojas).
export function useEquipment(enabled = true) {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEquipment(await listEquipmentWithClients())
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) reload()
  }, [reload, enabled])

  return { equipment, loading, error, reload }
}

export function useEquipmentHistory(equipmentId) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!equipmentId) {
      setHistory([])
      return
    }
    let isMounted = true
    setLoading(true)
    getEquipmentVisitHistory(equipmentId)
      .then((data) => {
        if (isMounted) setHistory(data)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [equipmentId])

  return { history, loading }
}
