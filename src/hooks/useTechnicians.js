import { useEffect, useState } from 'react'
import { listTechnicians } from '../api/profiles'

// enabled = false: no consulta (el calendario de solo lectura no asigna).
export function useTechnicians(enabled = true) {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) return undefined
    let isMounted = true
    listTechnicians()
      .then((data) => {
        if (isMounted) setTechnicians(data)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [enabled])

  return { technicians, loading }
}
