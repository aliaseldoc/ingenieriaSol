import { useState } from 'react'
import EmptyState from '../../components/ui/EmptyState'
import { DAY_STATUS, DAY_TYPE_LABELS } from './computeTimesheet'
import { formatMinutes, formatShortDayLabel } from './workTime'

const STATUS_LABELS = {
  [DAY_STATUS.SIN_FICHAJES]: 'Sin fichajes',
  [DAY_STATUS.OK]: 'Completo',
  [DAY_STATUS.INCOMPLETO]: 'Incompleto',
  [DAY_STATUS.EN_CURSO]: 'En curso',
}

function dayStatusLabel(day) {
  if (day.paidHolidayMinutes > 0 && day.status === DAY_STATUS.SIN_FICHAJES) return 'Feriado pago'
  if (day.paidHolidayMinutes > 0 && day.status === DAY_STATUS.OK) return 'Feriado pago + trabajado'
  return STATUS_LABELS[day.status]
}

const HEADER_CLASS ='font-label-md text-label-md text-on-surface-variant uppercase py-sm px-sm'
const CELL_CLASS = 'font-body-md text-body-md text-on-surface py-sm px-sm'

function DayDetail({ days }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-outline-variant">
          <th className={HEADER_CLASS}>Día</th>
          <th className={HEADER_CLASS}>Tipo</th>
          <th className={HEADER_CLASS}>Estado</th>
          <th className={HEADER_CLASS}>Normales</th>
          <th className={HEADER_CLASS}>Al 50%</th>
          <th className={HEADER_CLASS}>Al 100%</th>
          <th className={HEADER_CLASS}>Total</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.dateKey} className="border-b border-outline-variant/50">
            <td className={CELL_CLASS}>{formatShortDayLabel(day.dateKey)}</td>
            <td className={CELL_CLASS}>{DAY_TYPE_LABELS[day.dayType]}</td>
            <td className={`${CELL_CLASS} ${day.status === DAY_STATUS.INCOMPLETO ? 'text-error' : ''}`}>{dayStatusLabel(day)}</td>
            <td className={CELL_CLASS}>{formatMinutes(day.normalMinutes)}</td>
            <td className={CELL_CLASS}>{formatMinutes(day.extra50Minutes)}</td>
            <td className={CELL_CLASS}>{formatMinutes(day.extra100Minutes)}</td>
            <td className={CELL_CLASS}>{formatMinutes(day.totalMinutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Recibe filas calculadas en vivo o las de la foto guardada al cerrar:
// ambas tienen la misma forma (ver toWeekSnapshot en computeTimesheet.js).
export default function WeeklyReportTable({ rows }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function toggle(employeeId) {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
        <EmptyState icon="table_view" title="Sin datos" description="No hay personal con fichajes en esta semana." />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto scrollbar-styled bg-surface-container-lowest border border-outline-variant rounded-lg">
      <table className="w-full min-w-[72rem] text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant">
            <th className={HEADER_CLASS}>Legajo</th>
            <th className={HEADER_CLASS}>Empleado</th>
            <th className={HEADER_CLASS}>Normales</th>
            <th className={HEADER_CLASS}>Al 50%</th>
            <th className={HEADER_CLASS}>Al 100%</th>
            <th className={HEADER_CLASS}>Total</th>
            <th className={HEADER_CLASS}>Incompletos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedIds.has(row.employeeId)
            return [
              <tr key={row.employeeId} className="border-b border-outline-variant/50">
                <td className={CELL_CLASS}>{row.clockPin ?? '—'}</td>
                <td className={CELL_CLASS}>
                  <button
                    type="button"
                    onClick={() => toggle(row.employeeId)}
                    aria-expanded={expanded}
                    className="flex items-center gap-xs text-left hover:text-secondary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[2rem]">{expanded ? 'expand_more' : 'chevron_right'}</span>
                    {row.fullName}
                  </button>
                </td>
                <td className={CELL_CLASS}>{formatMinutes(row.totals.normalMinutes)}</td>
                <td className={CELL_CLASS}>{formatMinutes(row.totals.extra50Minutes)}</td>
                <td className={CELL_CLASS}>{formatMinutes(row.totals.extra100Minutes)}</td>
                <td className={`${CELL_CLASS} font-label-md`}>{formatMinutes(row.totals.totalMinutes)}</td>
                <td className={`${CELL_CLASS} ${row.totals.incompleteDays > 0 ? 'text-error' : ''}`}>{row.totals.incompleteDays}</td>
              </tr>,
              expanded && (
                <tr key={`${row.employeeId}-detalle`} className="border-b border-outline-variant/50 bg-surface-container-low/50">
                  <td colSpan={7} className="px-md py-sm">
                    <DayDetail days={row.days} />
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
