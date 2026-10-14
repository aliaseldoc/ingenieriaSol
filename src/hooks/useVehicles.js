import { useCallback, useEffect, useState } from 'react'
import { listVehicles, listAllVehicles } from '../api/vehicles'

// enabled = false: no consulta (el calendario de solo lectura no asigna).
export function useVehicles(enabled = true) {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) return undefined
    let isMounted = true
    listVehicles()
      .then((data) => {
        if (isMounted) setVehicles(data)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [enabled])

  return { vehicles, loading }
}

export function useAllVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setVehicles(await listAllVehicles())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { vehicles, loading, reload }
}
