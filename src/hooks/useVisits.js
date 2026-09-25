import { useCallback, useEffect, useState } from 'react'
import {
  getPreviousVisitParameters,
  getVisitById,
  listAllSubmittedVisits,
  listUnassignedVisits,
  listVisitsForTechnician,
  listVisitsInRange,
  listVisitsPendingReview,
  listVisitsThisMonth,
} from '../api/visits'
import { listEventsForVisit } from '../api/visitEvents'
import { supabase } from '../lib/supabaseClient'
import { isOnline, isNetworkError } from '../offline/network'
import {
  getCachedVisits,
  saveRouteSheetToCache,
  getCachedVisit,
  cacheVisit,
  getCachedVisitParameters,
  saveVisitParametersToCache,
} from '../offline/routeSheetCache'

export function useAsync(loader, deps) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loader()
      setData(result)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

export function useVisitsPendingReview() {
  return useAsync(listVisitsPendingReview, [])
}

export function useAllSubmittedVisits() {
  return useAsync(listAllSubmittedVisits, [])
}

// Offline-aware: intenta la red primero. Si tiene exito, refresca el cache
// "de paso" (ademas del boton explicito "Descargar hoja de ruta"). Si falla
// por falta de conexion, cae al ultimo plan descargado en IndexedDB.
export function useTechnicianVisits(technicianId) {
  return useAsync(async () => {
    if (!technicianId) return []
    if (!isOnline()) return getCachedVisits(technicianId)
    try {
      const visits = await listVisitsForTechnician(technicianId)
      await saveRouteSheetToCache(technicianId, visits)
      return visits
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedVisits(technicianId)
    }
  }, [technicianId])
}

export function useUnassignedVisits() {
  return useAsync(listUnassignedVisits, [])
}

export function useVisitsInRange(startDate, endDate) {
  return useAsync(() => listVisitsInRange(startDate, endDate), [startDate, endDate])
}

export function useVisitsThisMonth() {
  return useAsync(listVisitsThisMonth, [])
}

export function useVisitParameters(visitId) {
  return useAsync(async () => {
    if (!visitId) return []
    if (!isOnline()) return getCachedVisitParameters(visitId)
    try {
      const { data, error } = await supabase.from('visit_parameters').select('*').eq('visit_id', visitId)
      if (error) throw error
      await saveVisitParametersToCache(visitId, data)
      return data
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedVisitParameters(visitId)
    }
  }, [visitId])
}

// Solo lo usan administrativo y supervisor (columna "Ultimo valor registrado"
// del informe), por eso no tiene cache offline como useVisitParameters.
export function usePreviousVisitParameters(visit) {
  return useAsync(() => (visit ? getPreviousVisitParameters(visit) : Promise.resolve([])), [visit?.id])
}

export function useVisitEvents(visitId) {
  return useAsync(() => (visitId ? listEventsForVisit(visitId) : Promise.resolve([])), [visitId])
}

export function useVisitDetail(visitId) {
  return useAsync(async () => {
    if (!visitId) return null
    if (!isOnline()) return getCachedVisit(visitId)
    try {
      const visit = await getVisitById(visitId)
      await cacheVisit(visit)
      return visit
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedVisit(visitId)
    }
  }, [visitId])
}
