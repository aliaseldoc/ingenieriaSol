import { useEffect, useMemo, useState } from 'react'
import { useTimesheetWeek } from './useTimesheetWeek'
import { listPunchesArrivedAfterClose } from '../api/timePunches'
import { listTimesheetWeeks } from '../api/timesheetWeeks'
import { TIMESHEET_WEEK_STATUS } from '../lib/constants'
import { getPunchFlags } from '../features/timesheet/punchFlags'
import { currentWeekStartKey, toDateKey, weekStartOfKey } from '../features/timesheet/workTime'

const AFTER_CLOSE_LOOKBACK_DAYS = 60

// Fichajes de la app que llegaron despues del ultimo cierre de su semana.
// Si el supervisor reabre y vuelve a cerrar, el cierre nuevo los "absorbe"
// y dejan de contarse.
async function loadPunchesAfterLastClose() {
  const since = new Date(Date.now() - AFTER_CLOSE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const punches = (await listPunchesArrivedAfterClose(since)).map((punch) => ({
    ...punch,
    weekStartKey: weekStartOfKey(toDateKey(new Date(punch.punched_at).getTime())),
  }))
  const weeks = await listTimesheetWeeks([...new Set(punches.map((punch) => punch.weekStartKey))])
  const closedAtByWeek = new Map(
    weeks.filter((week) => week.status === TIMESHEET_WEEK_STATUS.CERRADA).map((week) => [week.week_start, new Date(week.closed_at).getTime()])
  )
  return punches.filter((punch) => {
    const closedAt = closedAtByWeek.get(punch.weekStartKey)
    return closedAt != null && new Date(punch.received_at).getTime() > closedAt
  })
}

// "Fichajes a revisar" de Seguimiento, solo para el supervisor: la suma de los
// dias con fichaje incompleto, los fichajes sin ubicacion y sin conexion de la
// semana, y los que llegaron con su semana ya cerrada. count es null mientras
// carga (o con enabled = false, que no consulta nada).
export function useTimesheetReviewCount(enabled) {
  const weekStartKey = useMemo(() => currentWeekStartKey(), [])
  const { rows, loading } = useTimesheetWeek(weekStartKey, { enabled })
  const [afterClose, setAfterClose] = useState(null)

  useEffect(() => {
    if (!enabled) return
    loadPunchesAfterLastClose()
      .then(setAfterClose)
      .catch(() => setAfterClose([]))
  }, [enabled])

  if (!enabled || loading || afterClose === null) return { count: null, weekStartKey }

  const weekPunches = rows.flatMap((row) => row.days.flatMap((day) => day.punches)).filter((punch) => !punch.voided_at)
  const count =
    rows.reduce((sum, row) => sum + row.totals.incompleteDays, 0) +
    weekPunches.filter((punch) => getPunchFlags(punch).withoutLocation).length +
    weekPunches.filter((punch) => punch.recorded_offline).length +
    afterClose.length
  return { count, weekStartKey }
}
