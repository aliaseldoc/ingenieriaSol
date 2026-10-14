import { SERVICE_TYPE_LABELS } from '../../lib/constants'
import { getRouteSheetColor, getRouteSheetLabel, getRouteSheetSubtitle, VISIT_COLOR_CLASSES } from '../../lib/visitColor'

// `draggable` en false para quien solo mira el calendario (el tecnico) y donde
// no hay adonde soltarla (el detalle del dia tapa la grilla).
export default function TaskCard({ routeSheet, onClick, onDragStart, draggable = true }) {
  const color = getRouteSheetColor(routeSheet)

  return (
    <div
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData('text/plain', routeSheet.id)
              onDragStart?.()
            }
          : undefined
      }
      onClick={() => onClick(routeSheet)}
      className={`w-full min-w-0 border-2 rounded p-sm ${draggable ? 'cursor-grab' : 'cursor-pointer'} hover:border-secondary transition-colors ${VISIT_COLOR_CLASSES[color]}`}
    >
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        {SERVICE_TYPE_LABELS[routeSheet.service_type] ?? 'Sin tipo'}
      </span>

      <div className="flex items-start justify-between mt-xs gap-sm">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-on-surface truncate">
            {getRouteSheetLabel(routeSheet)}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
            {getRouteSheetSubtitle(routeSheet)}
          </p>
        </div>

        <div className="min-w-0 flex flex-col shrink-0">
          {routeSheet.technicians?.length > 0 ? (
            routeSheet.technicians.map((technician) => (
              <span key={technician.id} className="font-label-sm text-label-sm text-on-surface truncate">
                {technician.full_name}
              </span>
            ))
          ) : (
            <span className="font-label-sm text-label-sm text-error">Sin técnico</span>
          )}
        </div>

        {routeSheet.vehicles?.name && (
          <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0 truncate">{routeSheet.vehicles.name}</span>
        )}
      </div>
    </div>
  )
}
