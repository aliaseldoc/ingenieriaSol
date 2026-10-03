import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTimesheetWeek } from '../../hooks/useTimesheetWeek'
import { listPunchesArrivedAfterClose } from '../../api/timePunches'
import { listTimesheetWeeks } from '../../api/timesheetWeeks'
import { TIMESHEET_WEEK_STATUS } from '../../lib/constants'
import { getPunchFlags, WEEK_FILTER } from '../timesheet/punchFlags'
import { currentWeekStartKey, formatWeekRange, toDateKey, weekStartOfKey } from '../timesheet/workTime'

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

// Tarjeta del Panel de Control, solo para el supervisor: lo que hay que
// revisar del fichaje, con acceso directo a la pantalla para corregirlo.
export default function TimesheetAlerts() {
  const navigate = useNavigate()
  const weekStartKey = useMemo(() => currentWeekStartKey(), [])
  const { rows, loading } = useTimesheetWeek(weekStartKey)
  const [afterClose, setAfterClose] = useState([])

  useEffect(() => {
    loadPunchesAfterLastClose()
      .then(setAfterClose)
      .catch(() => setAfterClose([]))
  }, [])

  const weekPunches = rows.flatMap((row) => row.days.flatMap((day) => day.punches)).filter((punch) => !punch.voided_at)
  const items = [
    {
      key: 'incompletos',
      icon: 'error',
      label: 'Días con fichaje incompleto',
      value: rows.reduce((sum, row) => sum + row.totals.incompleteDays, 0),
      week: weekStartKey,
      filter: WEEK_FILTER.INCOMPLETOS,
    },
    {
      key: 'sin-ubicacion',
      icon: 'location_off',
      label: 'Fichajes sin ubicación',
      value: weekPunches.filter((punch) => getPunchFlags(punch).withoutLocation).length,
      week: weekStartKey,
      filter: WEEK_FILTER.SIN_UBICACION,
    },
    {
      key: 'sin-conexion',
      icon: 'cloud_off',
      label: 'Registrados sin conexión',
      value: weekPunches.filter((punch) => punch.recorded_offline).length,
      week: weekStartKey,
      filter: WEEK_FILTER.SIN_CONEXION,
    },
    {
      key: 'semana-cerrada',
      icon: 'lock_clock',
      label: 'Llegados con la semana cerrada',
      value: afterClose.length,
      week: afterClose[0]?.weekStartKey ?? weekStartKey,
      filter: WEEK_FILTER.SEMANA_CERRADA,
    },
  ]

  return (
    <section className="shrink-0 mb-md bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm">
        Fichajes a revisar · semana del {formatWeekRange(weekStartKey)}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm p-sm">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(`/supervisor/fichajes?tab=semana&semana=${item.week}&filtro=${item.filter}`)}
            className="flex items-center gap-sm p-sm rounded-lg border border-outline-variant text-left hover:border-secondary hover:bg-surface-container-low transition-colors"
          >
            <span className={`material-symbols-outlined text-[2.4rem] ${item.value > 0 ? 'text-warning' : 'text-on-surface-variant'}`}>
              {item.icon}
            </span>
            <span>
              <span className={`block font-headline-md text-headline-md ${item.value > 0 ? 'text-warning' : 'text-on-surface'}`}>
                {loading ? '…' : item.value}
              </span>
              <span className="block font-label-sm text-label-sm text-on-surface-variant">{item.label}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
