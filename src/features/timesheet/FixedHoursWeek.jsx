import { useCallback, useEffect, useMemo, useState } from 'react'
import { listExtraHoursInRange, saveExtraHours } from '../../api/extraHours'
import { TIMESHEET_RULES } from '../../lib/constants'
import { DAY_STATUS, computeWeekReport } from './computeTimesheet'
import { addDaysToKey, formatMinutes, formatShortDayLabel, toDateKey, toTimeString, zonedToInstant } from './workTime'
import WeekPicker from './WeekPicker'
import TotalsSummary from './TotalsSummary'
import Spinner from '../../components/ui/Spinner'

// De a media hora, hasta 10 h (lo que admite la base, ver 0033).
const EXTRA_OPTIONS = Array.from({ length: 21 }, (_, index) => index * 30)

// Pantalla de fichaje de quien tiene horas fijas (pedido del 24/10/2026): no
// ficha, asi que en vez de los botones ve su semana tal como sale en el reporte
// (el mismo computeWeekReport) y carga las horas de mas de cada dia. Se guardan
// al elegir; solo con conexion.
export default function FixedHoursWeek({ employee, weekStartKey, onChangeWeek, online }) {
  const [extraHours, setExtraHours] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingDay, setSavingDay] = useState(null)
  const [message, setMessage] = useState(null) // { error, text }

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setExtraHours(await listExtraHoursInRange(weekStartKey, addDaysToKey(weekStartKey, 6), employee.id))
    } catch (error) {
      setExtraHours([])
      setMessage({ error: true, text: error?.message || 'No se pudieron cargar tus horas de más.' })
    } finally {
      setLoading(false)
    }
  }, [employee.id, weekStartKey])

  useEffect(() => {
    setMessage(null)
    if (online) reload()
    else setLoading(false)
  }, [online, reload])

  const [row] = useMemo(
    () => computeWeekReport({ employees: [employee], punches: [], weekStartKey, extraHours }),
    [employee, weekStartKey, extraHours]
  )
  const extraByDay = new Map(extraHours.map((item) => [item.work_date, item.minutes]))
  const workdays = row.days.slice(0, 5)
  const todayKey = toDateKey(Date.now())

  const scheduleStart = zonedToInstant(weekStartKey, TIMESHEET_RULES.workdayStartTime)
  const scheduleEnd = scheduleStart + Math.round(employee.fixed_weekly_minutes / 5) * 60 * 1000

  async function handleChangeExtra(dateKey, minutes) {
    setSavingDay(dateKey)
    setMessage(null)
    try {
      await saveExtraHours({ employeeId: employee.id, workDate: dateKey, minutes })
      await reload()
      setMessage({
        error: false,
        text: `Guardado: ${formatShortDayLabel(dateKey)}, ${minutes > 0 ? `${formatMinutes(minutes)} de más` : 'sin horas de más'}.`,
      })
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudieron guardar las horas de más.' })
    } finally {
      setSavingDay(null)
    }
  }

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Fichaje</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Tu horario es de {toTimeString(scheduleStart)} a {toTimeString(scheduleEnd)}, de lunes a viernes. No fichás: si un día
        trabajaste de más, cargá cuántas horas.
      </p>

      <section>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-sm mb-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Mi semana</h2>
          <WeekPicker weekStartKey={weekStartKey} onChange={onChangeWeek} disabled={!online} />
        </div>

        {!online && (
          <p className="font-body-sm text-body-sm text-warning mb-sm">Sin conexión: las horas de más se cargan con señal.</p>
        )}

        {message && (
          <p role="status" className={`font-body-md text-body-md mb-md ${message.error ? 'text-error' : 'text-secondary'}`}>
            {message.text}
          </p>
        )}

        {loading ? (
          <Spinner label="Cargando tu semana…" />
        ) : (
          <>
            <TotalsSummary totals={row.totals} />
            <ul className="space-y-sm">
              {workdays.map((day) => {
                const tramo = day.tramos[0]
                const notYet = day.dateKey > todayKey
                let detail = 'Todavía no empezó'
                if (day.status === DAY_STATUS.EN_CURSO) detail = `Desde las ${tramo.entrada} · En curso`
                else if (tramo) detail = `${tramo.entrada} a ${tramo.salida} · Normales ${formatMinutes(day.normalMinutes)}`
                return (
                  <li
                    key={day.dateKey}
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-wrap items-center justify-between gap-sm"
                  >
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">{formatShortDayLabel(day.dateKey)}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{detail}</p>
                    </div>
                    <label className="flex items-center gap-sm">
                      <span className="font-label-md text-label-md text-on-surface-variant">Horas de más</span>
                      <select
                        value={extraByDay.get(day.dateKey) ?? 0}
                        onChange={(event) => handleChangeExtra(day.dateKey, Number(event.target.value))}
                        disabled={!online || notYet || savingDay !== null}
                        className="bg-surface border border-outline rounded px-md py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-colors disabled:opacity-50"
                      >
                        {EXTRA_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes === 0 ? 'Ninguna' : formatMinutes(minutes)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
