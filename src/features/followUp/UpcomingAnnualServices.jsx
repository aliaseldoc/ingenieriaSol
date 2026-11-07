import { useState } from 'react'
import { ANNUAL_SERVICE_ALERT_WINDOW_DAYS } from '../../lib/constants'
import { daysBetween, formatDate, getNextAnnualServiceDue, isAnnualAlertMuted } from '../../lib/dateUtils'
import StatusChip from '../../components/ui/StatusChip'

const FUTURE_WINDOW_DAYS = 90

// Lo que vence despues de la ventana de alertas y hasta 90 dias, plegado
// debajo de las alertas de service anual (venia de la solapa "Resumen"). Es un
// pronostico, no una bandeja: las alertas silenciadas no se ocultan, se marcan.
export default function UpcomingAnnualServices({ equipment, onSelectEquipment }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const upcoming = equipment
    .map((item) => ({ item, dueDate: getNextAnnualServiceDue(item) }))
    .filter(({ dueDate }) => {
      if (!dueDate) return false
      const days = daysBetween(today, dueDate)
      return days > ANNUAL_SERVICE_ALERT_WINDOW_DAYS && days <= FUTURE_WINDOW_DAYS
    })
    .sort((a, b) => a.dueDate - b.dueDate)

  return (
    <div className="border-t border-outline-variant">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-sm px-md py-sm text-left font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
      >
        <span>Vencen en los próximos {FUTURE_WINDOW_DAYS} días ({upcoming.length})</span>
        <span className="material-symbols-outlined text-[2rem]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <ul className="divide-y divide-outline-variant/50">
          {upcoming.length === 0 && (
            <li className="px-md py-sm font-body-sm text-body-sm text-on-surface-variant">Nada vence en ese plazo.</li>
          )}
          {upcoming.map(({ item, dueDate }) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectEquipment(item)}
                className="w-full flex items-center justify-between gap-sm px-md py-sm text-left hover:bg-surface-container-low transition-colors"
              >
                <span className="min-w-0">
                  <span className="block font-label-md text-label-md text-on-surface">{item.motor}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant">{item.clients?.name}</span>
                </span>
                <span className="shrink-0 flex items-center gap-sm">
                  {isAnnualAlertMuted(item, dueDate) && <StatusChip label="Alerta ignorada" tone="neutral" variant="tag" />}
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{formatDate(dueDate)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
