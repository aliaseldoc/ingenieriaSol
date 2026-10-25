import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listEmployees } from '../api/employees'
import { listPunchesInRange } from '../api/timePunches'
import { listHolidaysInRange } from '../api/holidays'
import { listLunchOverridesInRange } from '../api/lunchOverrides'
import { listLunchChecksInRange } from '../api/lunchChecks'
import { listExtraHoursInRange } from '../api/extraHours'
import { getTimesheetWeek } from '../api/timesheetWeeks'
import { getTimesheetSettings } from '../api/timesheetSettings'
import { weekPunchRange } from '../features/timesheet/computeTimesheet'
import { buildWeekReport } from '../features/timesheet/reportEmployees'
import { addDaysToKey } from '../features/timesheet/workTime'
import { TIMESHEET_WEEK_STATUS } from '../lib/constants'

// Todo lo que el supervisor necesita para una semana: legajos, fichajes,
// feriados, almuerzos marcados (por el supervisor y por cada empleado), horas de mas, estado de cierre y ubicacion de la fabrica,
// mas el reporte
// calculado. Quien entra en el reporte lo decide reportEmployees.js, el mismo
// que usa el cierre automatico de los lunes.
export function useTimesheetWeek(weekStartKey) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  // Si se cambia de semana rapido, solo vale la ultima respuesta.
  const latestRequest = useRef(0)

  const reload = useCallback(async () => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    setState((previous) => ({ ...previous, loading: true, error: null }))
    try {
      const [employees, punches, holidays, lunchOverrides, lunchChecks, extraHours, week, settings] = await Promise.all([
        listEmployees(),
        listPunchesInRange(weekPunchRange(weekStartKey)),
        listHolidaysInRange(addDaysToKey(weekStartKey, -1), addDaysToKey(weekStartKey, 7)),
        listLunchOverridesInRange(weekStartKey, addDaysToKey(weekStartKey, 6)),
        listLunchChecksInRange(weekStartKey, addDaysToKey(weekStartKey, 6)),
        listExtraHoursInRange(weekStartKey, addDaysToKey(weekStartKey, 6)),
        getTimesheetWeek(weekStartKey),
        getTimesheetSettings(),
      ])
      if (latestRequest.current !== requestId) return
      setState({ loading: false, error: null, data: { employees, punches, holidays, lunchOverrides, lunchChecks, extraHours, week, settings } })
    } catch (error) {
      if (latestRequest.current !== requestId) return
      setState({ loading: false, error, data: null })
    }
  }, [weekStartKey])

  useEffect(() => {
    reload()
  }, [reload])

  const rows = useMemo(() => {
    if (!state.data) return []
    const { employees, punches, holidays, lunchOverrides, lunchChecks, extraHours } = state.data
    return buildWeekReport({ employees, punches, holidays, lunchOverrides, lunchChecks, extraHours, weekStartKey })
  }, [state.data, weekStartKey])

  const week = state.data?.week ?? null

  return {
    loading: state.loading,
    error: state.error,
    rows,
    week,
    isClosed: week?.status === TIMESHEET_WEEK_STATUS.CERRADA,
    holidays: state.data?.holidays ?? [],
    settings: state.data?.settings ?? null,
    hasData: Boolean(state.data),
    reload,
  }
}
