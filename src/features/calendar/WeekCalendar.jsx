import { useState } from 'react'
import { addDays, toISODateString } from '../../lib/dateUtils'
import TaskCard from './TaskCard'

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Sin onDropRouteSheet (calendario de solo lectura) las tarjetas no se
// arrastran y los dias no aceptan que se suelte nada.
export default function WeekCalendar({ weekStart, routeSheets, onSelectRouteSheet, onDropRouteSheet = null, onSelectDay }) {
  const [dragOverDate, setDragOverDate] = useState(null)
  const canDrop = Boolean(onDropRouteSheet)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const todayIso = toISODateString(new Date())

  function handleDrop(event, dateStr) {
    event.preventDefault()
    setDragOverDate(null)
    const routeSheetId = event.dataTransfer.getData('text/plain')
    if (routeSheetId) onDropRouteSheet(routeSheetId, dateStr)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.6fr))] lg:grid-rows-[1fr] gap-sm lg:h-full">
      {days.map((day) => {
        const dateStr = toISODateString(day)
        const dayRouteSheets = routeSheets
          .filter((routeSheet) => routeSheet.scheduled_date === dateStr)
          .sort((a, b) => (a.scheduled_time_start ?? '').localeCompare(b.scheduled_time_start ?? ''))

        return (
          <div
            key={dateStr}
            onDragOver={
              canDrop
                ? (event) => {
                    event.preventDefault()
                    setDragOverDate(dateStr)
                  }
                : undefined
            }
            onDragLeave={canDrop ? () => setDragOverDate((current) => (current === dateStr ? null : current)) : undefined}
            onDrop={canDrop ? (event) => handleDrop(event, dateStr) : undefined}
            className={`min-h-[16rem] lg:h-full lg:min-h-0 min-w-0 overflow-hidden border border-outline-variant rounded p-xs flex flex-col gap-xs transition-colors ${
              dragOverDate === dateStr ? 'drop-target' : 'bg-surface-container-lowest'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className={`shrink-0 text-center pb-xs border-b border-outline-variant hover:text-secondary transition-colors ${dateStr === todayIso ? 'text-secondary' : 'text-on-surface-variant'}`}
            >
              <p className="font-label-sm text-label-sm uppercase">{DAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}</p>
              <p className="font-label-md text-label-md">{day.getDate()}</p>
            </button>
            <div className="flex-1 min-w-0 min-h-0 space-y-xs overflow-y-auto overflow-x-hidden scrollbar-hidden">
              {dayRouteSheets.map((routeSheet) => (
                <div key={routeSheet.id} className="relative">
                  {routeSheet.scheduled_time_start && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {routeSheet.scheduled_time_start.slice(0, 5)}
                    </span>
                  )}
                  <TaskCard routeSheet={routeSheet} onClick={onSelectRouteSheet} draggable={canDrop} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
