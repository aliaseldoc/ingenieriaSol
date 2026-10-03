import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listEmployees } from '../api/employees'
import { listPunchesInRange } from '../api/timePunches'
import { listHolidaysInRange } from '../api/holidays'
import { getTimesheetWeek } from '../api/timesheetWeeks'
import { getTimesheetSettings } from '../api/timesheetSettings'
import { computeWeekReport, weekPunchRange } from '../features/timesheet/computeTimesheet'
import { addDaysToKey, toDateKey, weekDayKeys } from '../features/timesheet/workTime'
import { ROLES, TIMESHEET_WEEK_STATUS } from '../lib/constants'

// Personal que ficha: con N° en el reloj, o tecnico (ficha por la app). Un
// administrativo o supervisor que no usa el reloj no aparece en el reporte
// (si no, sumaria el feriado pago como unica hora).
function clocksIn(employee) {
  return Boolean(employee.clock_pin) || employee.profiles?.role === ROLES.TECNICO
}

// Todo lo que el supervisor necesita para una semana: legajos, fichajes,
// feriados, estado de cierre y ubicacion de la fabrica, mas el reporte
// calculado. En el reporte entra el personal activo que ficha y cualquiera
// (incluso inactivo) que tenga fichajes esa semana.
export function useTimesheetWeek(weekStartKey) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  // Si se cambia de semana rapido, solo vale la ultima respuesta.
  const latestRequest = useRef(0)

  const reload = useCallback(async () => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    setState((previous) => ({ ...previous, loading: true, error: null }))
    try {
      const [employees, punches, holidays, week, settings] = await Promise.all([
        listEmployees(),
        listPunchesInRange(weekPunchRange(weekStartKey)),
        listHolidaysInRange(addDaysToKey(weekStartKey, -1), addDaysToKey(weekStartKey, 7)),
        getTimesheetWeek(weekStartKey),
        getTimesheetSettings(),
      ])
      if (latestRequest.current !== requestId) return
      setState({ loading: false, error: null, data: { employees, punches, holidays, week, settings } })
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
    const { employees, punches, holidays } = state.data
    const dayKeys = new Set(weekDayKeys(weekStartKey))
    const employeesWithPunches = new Set(
      punches
        .filter((punch) => !punch.voided_at && dayKeys.has(toDateKey(new Date(punch.punched_at).getTime())))
        .map((punch) => punch.employee_id)
    )
    const visibleEmployees = employees.filter(
      (employee) => (employee.active && clocksIn(employee)) || employeesWithPunches.has(employee.id)
    )
    return computeWeekReport({
      employees: visibleEmployees,
      punches,
      weekStartKey,
      holidayKeys: holidays.map((holiday) => holiday.date),
    })
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
