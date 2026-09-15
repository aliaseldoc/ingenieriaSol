import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEmployeeByProfileId } from '../api/employees'
import { listPunchesInRange } from '../api/timePunches'
import { listHolidaysInRange } from '../api/holidays'
import { computeEmployeeDays, sumDays, weekPunchRange } from '../features/timesheet/computeTimesheet'
import { addDaysToKey, weekDayKeys } from '../features/timesheet/workTime'
import { isNetworkError } from '../offline/network'
import { usePendingPunches } from '../offline/useOfflineSync'
import { cacheMyEmployee, getCachedMyEmployee, cacheMyWeek, getCachedMyWeek } from '../offline/punchQueue'

// Legajo y semana del tecnico logueado, con respaldo offline: sin red se
// usa lo ultimo descargado y se suman los fichajes que siguen en la cola.
export function useMyTimesheet(profileId, weekStartKey) {
  const [employee, setEmployee] = useState(undefined) // undefined = cargando, null = sin legajo
  const [weekData, setWeekData] = useState({ loading: true, punches: [], holidayKeys: [], fromCache: false, cachedAt: null })
  const pendingEntries = usePendingPunches()
  const latestRequest = useRef(0)

  useEffect(() => {
    let isMounted = true
    async function loadEmployee() {
      try {
        const loaded = await getEmployeeByProfileId(profileId)
        await cacheMyEmployee(profileId, loaded)
        if (isMounted) setEmployee(loaded)
      } catch (error) {
        const cached = isNetworkError(error) ? await getCachedMyEmployee(profileId) : null
        if (isMounted) setEmployee(cached)
      }
    }
    if (profileId) loadEmployee()
    return () => {
      isMounted = false
    }
  }, [profileId])

  const employeeId = employee?.id ?? null

  const reloadWeek = useCallback(async () => {
    if (!employeeId) return
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    setWeekData((previous) => ({ ...previous, loading: true }))
    try {
      const [punches, holidays] = await Promise.all([
        listPunchesInRange({ ...weekPunchRange(weekStartKey), employeeId }),
        listHolidaysInRange(addDaysToKey(weekStartKey, -1), addDaysToKey(weekStartKey, 7)),
      ])
      const holidayKeys = holidays.map((holiday) => holiday.date)
      await cacheMyWeek(employeeId, weekStartKey, punches, holidayKeys)
      if (latestRequest.current !== requestId) return
      setWeekData({ loading: false, punches, holidayKeys, fromCache: false, cachedAt: null })
    } catch (error) {
      const cached = isNetworkError(error) ? await getCachedMyWeek(employeeId, weekStartKey) : null
      if (latestRequest.current !== requestId) return
      setWeekData({
        loading: false,
        punches: cached?.punches ?? [],
        holidayKeys: cached?.holidayKeys ?? [],
        fromCache: true,
        cachedAt: cached?.cachedAt ?? null,
      })
    }
  }, [employeeId, weekStartKey])

  useEffect(() => {
    reloadWeek()
  }, [reloadWeek])

  // Los fichajes en cola todavia no estan en el servidor, pero el tecnico
  // tiene que verlos (marcados como "sin sincronizar").
  const pendingPunches = useMemo(
    () =>
      pendingEntries
        .filter((entry) => entry.punch.employee_id === employeeId)
        .map((entry) => ({ ...entry.punch, pending: true, pendingError: entry.lastError })),
    [pendingEntries, employeeId]
  )

  const allPunches = useMemo(() => {
    const serverIds = new Set(weekData.punches.map((punch) => punch.id))
    return [...weekData.punches, ...pendingPunches.filter((punch) => !serverIds.has(punch.id))]
  }, [weekData.punches, pendingPunches])

  const days = useMemo(
    () => computeEmployeeDays({ punches: allPunches, dayKeys: weekDayKeys(weekStartKey), holidayKeys: weekData.holidayKeys }),
    [allPunches, weekStartKey, weekData.holidayKeys]
  )

  return {
    employee,
    loadingEmployee: employee === undefined,
    loadingWeek: weekData.loading,
    fromCache: weekData.fromCache,
    cachedAt: weekData.cachedAt,
    allPunches,
    days,
    totals: sumDays(days),
    reloadWeek,
  }
}
