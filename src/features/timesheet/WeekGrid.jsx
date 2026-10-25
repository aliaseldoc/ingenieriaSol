import { DAY_STATUS } from './computeTimesheet'
import { DAY_FLAG_DEFINITIONS, getDayFlags, isDayWithoutLunch, rowMatchesFilter } from './punchFlags'
import { formatMinutes, formatShortDayLabel, weekDayKeys } from './workTime'

// Ingreso arriba y egreso abajo: la primera entrada y la ultima salida del
// dia. Si hubo mas de un tramo (pausa fichada, turno de noche) el detalle esta
// en el pop-up del dia.
function DayTimes({ tramos }) {
  if (tramos.length === 0) return <span aria-hidden="true" />
  const entry = tramos.find((tramo) => tramo.entrada)?.entrada ?? null
  const lastTramo = tramos[tramos.length - 1]
  const exit = lastTramo.salida ? `${lastTramo.salida}${lastTramo.salidaDiaSiguiente ? ' +1' : ''}` : null
  return (
    <span className="flex flex-col font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
      <span className="pb-[0.2rem] border-b border-outline-variant/60">
        <span className="sr-only">Ingreso </span>
        {entry ?? '—'}
      </span>
      <span className="pt-[0.2rem]">
        <span className="sr-only">Egreso </span>
        {exit ?? '—'}
      </span>
    </span>
  )
}

function DayHours({ day }) {
  if (day.status === DAY_STATUS.INCOMPLETO) {
    return <span className="font-label-sm text-label-sm text-error uppercase">Incompleto</span>
  }
  if (day.status === DAY_STATUS.EN_CURSO) {
    return <span className="font-label-sm text-label-sm text-secondary uppercase">En curso</span>
  }
  if (day.totalMinutes === 0) {
    return <span className="font-body-sm text-body-sm text-on-surface-variant">—</span>
  }
  const extraMinutes = day.extra50Minutes + day.extra100Minutes
  return (
    <>
      <span className="block font-label-md text-[1.6rem] leading-[2rem] font-bold text-on-surface tabular-nums">
        {formatMinutes(day.totalMinutes)}
      </span>
      {extraMinutes > 0 && (
        <span className="block font-label-sm text-label-sm text-warning whitespace-nowrap">+{formatMinutes(extraMinutes)} ext.</span>
      )}
      {day.paidHolidayMinutes > 0 && <span className="block font-label-sm text-label-sm text-secondary">Feriado pago</span>}
    </>
  )
}

// Arriba el ingreso y el egreso a la izquierda y las horas a la derecha; abajo,
// las marcas del dia (ubicacion, almuerzo, correcciones...).
function DayCellContent({ day }) {
  return (
    <span className="grid grid-cols-[auto_1fr] items-center gap-x-sm">
      <DayTimes tramos={day.tramos} />
      <span className="text-right">
        <DayHours day={day} />
      </span>
    </span>
  )
}

function DayFlagIcons({ flags }) {
  const active = DAY_FLAG_DEFINITIONS.filter((definition) => flags[definition.key])
  if (active.length === 0) return null
  return (
    <span className="flex flex-wrap gap-[0.2rem] mt-xs pt-xs border-t border-outline-variant/40">
      {active.map((definition) => (
        <span
          key={definition.key}
          className="material-symbols-outlined text-[1.6rem] text-warning"
          title={definition.label}
          aria-label={definition.label}
        >
          {definition.icon}
        </span>
      ))}
    </span>
  )
}

// El encabezado de cada dia lleva el check "Feriado": se marca para todo el
// personal a la vez y el calculo de horas se actualiza al recargar. Si la
// columna es angosta, el check con su leyenda pasa abajo del dia.
function DayHeader({ dateKey, isHoliday, disabled, onToggleHoliday }) {
  const dayLabel = formatShortDayLabel(dateKey)
  return (
    <th className={`font-label-sm text-label-sm text-on-surface-variant uppercase p-sm border-l border-outline-variant/50 ${isHoliday ? 'bg-secondary-fixed/60' : ''}`}>
      <span className="flex flex-wrap items-center gap-x-sm gap-y-xs">
        <span className="whitespace-nowrap">{dayLabel}</span>
        <label
          className={`inline-flex items-center gap-xs normal-case whitespace-nowrap ${isHoliday ? 'text-secondary' : ''} ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={isHoliday}
            disabled={disabled}
            onChange={(event) => onToggleHoliday(dateKey, event.target.checked)}
            aria-label={`Marcar ${dayLabel} como feriado`}
            className="w-[1.6rem] h-[1.6rem] accent-secondary"
          />
          Feriado
        </label>
      </span>
    </th>
  )
}

export default function WeekGrid({ weekStartKey, rows, settings, filter, holidayKeys, holidaysLocked, savingHolidayKey, onToggleHoliday, onSelectDay }) {
  const dayKeys = weekDayKeys(weekStartKey)
  const visibleRows = rows.filter((row) => rowMatchesFilter(row, filter, settings))

  return (
    <div>
      <div className="overflow-x-auto scrollbar-styled bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full min-w-[100rem] text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="sticky left-0 z-10 bg-surface-container-lowest font-label-md text-label-md text-on-surface-variant uppercase p-sm">
                Empleado
              </th>
              {dayKeys.map((dateKey) => (
                <DayHeader
                  key={dateKey}
                  dateKey={dateKey}
                  isHoliday={holidayKeys.has(dateKey)}
                  disabled={holidaysLocked || savingHolidayKey !== null}
                  onToggleHoliday={onToggleHoliday}
                />
              ))}
              <th className="font-label-md text-label-md text-on-surface-variant uppercase p-sm border-l border-outline-variant">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={dayKeys.length + 2} className="p-lg text-center font-body-md text-body-md text-on-surface-variant">
                  No hay personal que coincida con el filtro elegido en esta semana.
                </td>
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr key={row.employeeId} className="border-b border-outline-variant/50">
                <th scope="row" className="sticky left-0 z-10 bg-surface-container-lowest p-sm font-normal">
                  <span className="block font-label-md text-label-md text-on-surface">{row.fullName}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant">
                    {row.clockPin ? `N° ${row.clockPin}` : 'Sin N° de reloj'}
                  </span>
                </th>
                {row.days.map((day) => (
                  <td key={day.dateKey} className="p-0 align-top border-l border-outline-variant/50">
                    <button
                      type="button"
                      onClick={() => onSelectDay(row.employeeId, day.dateKey)}
                      className={`w-full min-h-[6.4rem] px-sm py-xs text-left transition-colors hover:bg-surface-container-low ${
                        day.status === DAY_STATUS.INCOMPLETO ? 'bg-error-container/40' : ''
                      }`}
                      aria-label={`Ver fichajes de ${row.fullName} del ${formatShortDayLabel(day.dateKey)}`}
                    >
                      <DayCellContent day={day} />
                      <DayFlagIcons flags={{ ...getDayFlags(day.punches, settings), withoutLunch: isDayWithoutLunch(day) }} />
                    </button>
                  </td>
                ))}
                <td className="p-sm align-top border-l border-outline-variant font-label-md text-label-md text-on-surface">
                  {formatMinutes(row.totals.totalMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-md mt-sm font-body-sm text-body-sm text-on-surface-variant">
        <li className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-[1.6rem] text-secondary" aria-hidden="true">
            info
          </span>
          Extras: lo que pasa de 44 h en la semana va al 50% (aparece el día en que se superan); la noche (20 a 05), el sábado desde
          las 13, el domingo y el feriado trabajado, al 100%
        </li>
        <li className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-[1.6rem] text-secondary" aria-hidden="true">
            check_box
          </span>
          Check "Feriado": de lunes a viernes paga la jornada de ese día (9 h, el viernes 8 h); lo trabajado ese día va aparte, al 100%
        </li>
        {DAY_FLAG_DEFINITIONS.map((definition) => (
          <li key={definition.key} className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[1.6rem] text-warning" aria-hidden="true">
              {definition.icon}
            </span>
            {definition.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
