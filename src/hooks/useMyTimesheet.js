import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEmployeeByProfileId } from '../api/employees'
import { listPunchesInRange } from '../api/timePunches'
import { listHolidaysInRange } from '../api/holidays'
import { listLunchOverridesInRange } from '../api/lunchOverrides'
import { listLunchChecksInRange, saveLunchCheck } from '../api/lunchChecks'
import { listLeaveDaysInRange, removeLeaveDay, saveLeaveDay } from '../api/leaveDays'
import { computeEmployeeDays, leaveKindsByDay, lunchOverridesByDay, sumDays, weekPunchRange } from '../features/timesheet/computeTimesheet'
import { addDaysToKey, weekDayKeys } from '../features/timesheet/workTime'
import { isNetworkError } from '../offline/network'
import { usePendingPunches } from '../offline/useOfflineSync'
import { cacheMyEmployee, getCachedMyEmployee, cacheMyWeek, getCachedMyWeek } from '../offline/punchQueue'

// Legajo y semana del tecnico logueado, con respaldo offline: sin red se
// usa lo ultimo descargado y se suman los fichajes que siguen en la cola.
export function useMyTimesheet(profileId, weekStartKey) {
  const [employee, setEmployee] = useState(undefined) // undefined = cargando, null = sin legajo
  const [weekData, setWeekData] = useState({
    loading: true,
    punches: [],
    holidayKeys: [],
    lunchOverrides: [],
    lunchChecks: [],
    leaveDays: [],
    fromCache: false,
    cachedAt: null,
  })
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
      const [punches, holidays, lunchOverrides, lunchChecks, leaveDays] = await Promise.all([
        listPunchesInRange({ ...weekPunchRange(weekStartKey), employeeId }),
        listHolidaysInRange(addDaysToKey(weekStartKey, -1), addDaysToKey(weekStartKey, 7)),
        listLunchOverridesInRange(weekStartKey, addDaysToKey(weekStartKey, 6), employeeId),
        listLunchChecksInRange(weekStartKey, addDaysToKey(weekStartKey, 6), employeeId),
        listLeaveDaysInRange(weekStartKey, addDaysToKey(weekStartKey, 6), employeeId),
      ])
      const holidayKeys = holidays.map((holiday) => holiday.date)
      await cacheMyWeek(employeeId, weekStartKey, punches, holidayKeys, lunchOverrides, lunchChecks, leaveDays)
      if (latestRequest.current !== requestId) return
      setWeekData({ loading: false, punches, holidayKeys, lunchOverrides, lunchChecks, leaveDays, fromCache: false, cachedAt: null })
    } catch (error) {
      const cached = isNetworkError(error) ? await getCachedMyWeek(employeeId, weekStartKey) : null
      if (latestRequest.current !== requestId) return
      setWeekData({
        loading: false,
        punches: cached?.punches ?? [],
        holidayKeys: cached?.holidayKeys ?? [],
        lunchOverrides: cached?.lunchOverrides ?? [],
        lunchChecks: cached?.lunchChecks ?? [],
        leaveDays: cached?.leaveDays ?? [],
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
    () =>
      computeEmployeeDays({
        punches: allPunches,
        dayKeys: weekDayKeys(weekStartKey),
        holidayKeys: weekData.holidayKeys,
        lunchOverrides: lunchOverridesByDay(weekData.lunchOverrides),
        lunchChecks: lunchOverridesByDay(weekData.lunchChecks),
        leaveDays: leaveKindsByDay(weekData.leaveDays),
      }),
    [allPunches, weekStartKey, weekData.holidayKeys, weekData.lunchOverrides, weekData.lunchChecks, weekData.leaveDays]
  )

  // Guarda el check de almuerzo del dia y lo suma a la semana en pantalla sin
  // recargarla: las horas de hoy se recalculan con el. Sin conexion tira el
  // error de red, y la pantalla lo reintenta al volver la senal.
  const saveLunch = useCallback(
    async (workDate, lunchTaken) => {
      await saveLunchCheck({ employeeId, workDate, lunchTaken })
      setWeekData((previous) => ({
        ...previous,
        lunchChecks: [
          ...previous.lunchChecks.filter((row) => row.work_date !== workDate),
          { employee_id: employeeId, work_date: workDate, lunch_taken: lunchTaken },
        ],
      }))
    },
    [employeeId]
  )

  // Dia de estudio o medico de hoy (kind: 'estudio' | 'medico', o null para
  // quitarlo). Necesita conexion: sin red tira el error y la pantalla lo avisa.
  const saveLeave = useCallback(
    async (workDate, kind) => {
      if (kind) await saveLeaveDay({ employeeId, workDate, kind })
      else await removeLeaveDay({ employeeId, workDate })
      setWeekData((previous) => ({
        ...previous,
        leaveDays: [
          ...previous.leaveDays.filter((row) => row.work_date !== workDate),
          ...(kind ? [{ employee_id: employeeId, work_date: workDate, kind, marked_by_supervisor: false }] : []),
        ],
      }))
    },
    [employeeId]
  )

  // Las filas tal cual: la pantalla mira si el de hoy lo marco el supervisor,
  // que el empleado no puede cambiar.
  const leaveRows = weekData.leaveDays

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
    saveLunch,
    leaveRows,
    saveLeave,
  }
}
