import { toISODateString } from '../../lib/dateUtils'
import { getRouteSheetColor, getRouteSheetLabel, VISIT_COLOR_CLASSES } from '../../lib/visitColor'

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// En el celular el nombre entero no entra y los dias se pisan.
const DAY_SHORT_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MAX_VISIBLE_ROUTE_SHEETS = 3

export default function MonthCalendar({ monthAnchor, weeks, routeSheets, onSelectDay }) {
  const todayIso = toISODateString(new Date())
  const weekCount = weeks.length

  const routeSheetsByDate = new Map()
  for (const routeSheet of routeSheets) {
    if (!routeSheet.scheduled_date) continue
    if (!routeSheetsByDate.has(routeSheet.scheduled_date)) routeSheetsByDate.set(routeSheet.scheduled_date, [])
    routeSheetsByDate.get(routeSheet.scheduled_date).push(routeSheet)
  }

  return (
    <div className="min-h-full flex flex-col border border-outline-variant rounded-lg overflow-hidden">
      <div className="shrink-0 grid grid-cols-[repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.6fr))] bg-surface-container">
        {DAY_LABELS.map((label, index) => (
          <div key={label} className="py-xs text-center font-label-sm text-label-sm text-on-surface-variant uppercase">
            <span className="hidden md:inline">{label}</span>
            <span className="md:hidden" aria-hidden="true">
              {DAY_SHORT_LABELS[index]}
            </span>
            <span className="sr-only md:hidden">{label}</span>
          </div>
        ))}
      </div>
      <div
        className="flex-1 grid grid-cols-[repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.6fr))] gap-px bg-outline-variant"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(11.2rem, 1fr))` }}
      >
        {weeks.flat().map((day) => {
          const dateStr = toISODateString(day)
          const dayRouteSheets = routeSheetsByDate.get(dateStr) ?? []
          const isCurrentMonth = day.getMonth() === monthAnchor.getMonth()
          const isToday = dateStr === todayIso

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`h-full min-w-0 p-xs text-left flex flex-col gap-xs transition-colors hover:bg-surface-container-low ${
                isCurrentMonth ? 'bg-surface-container-lowest' : 'bg-surface-container-low/50'
              }`}
            >
              <span
                className={`shrink-0 font-label-sm text-label-sm w-xl h-xl flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-secondary text-on-secondary'
                    : isCurrentMonth
                      ? 'text-on-surface'
                      : 'text-on-surface-variant/50'
                }`}
              >
                {day.getDate()}
              </span>

              {dayRouteSheets.length > 0 && (
                <div className="min-w-0 flex flex-col gap-[0.2rem]">
                  {dayRouteSheets.slice(0, MAX_VISIBLE_ROUTE_SHEETS).map((routeSheet) => {
                    const label = getRouteSheetLabel(routeSheet)
                    return (
                      <span
                        key={routeSheet.id}
                        className={`block w-full min-w-0 truncate rounded px-xs py-[0.1rem] font-label-sm text-label-sm text-on-surface border ${VISIT_COLOR_CLASSES[getRouteSheetColor(routeSheet)]}`}
                      >
                        {label}
                      </span>
                    )
                  })}
                  {dayRouteSheets.length > MAX_VISIBLE_ROUTE_SHEETS && (
                    <span className="px-xs font-label-sm text-label-sm text-on-surface-variant">
                      +{dayRouteSheets.length - MAX_VISIBLE_ROUTE_SHEETS} más
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
