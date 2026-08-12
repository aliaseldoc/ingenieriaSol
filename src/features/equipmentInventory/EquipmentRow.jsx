import StatusChip from '../../components/ui/StatusChip'
import { CONDITION_STATUS, CONDITION_STATUS_LABELS } from '../../lib/constants'
import { formatDate } from '../../lib/dateUtils'

const CONDITION_TONE = {
  [CONDITION_STATUS.OPTIMO]: 'success',
  [CONDITION_STATUS.ATENCION]: 'warning',
  [CONDITION_STATUS.FUERA_SERVICIO]: 'error',
}

export default function EquipmentRow({ equipment, onOpenHistory, index = 0 }) {
  const zebraClass = index % 2 === 0 ? 'bg-secondary-fixed' : 'bg-secondary-fixed-dim'
  const conditionChip = (
    <StatusChip
      label={CONDITION_STATUS_LABELS[equipment.condition_status]}
      tone={CONDITION_TONE[equipment.condition_status]}
      variant="dot"
    />
  )

  return (
    <button
      type="button"
      onClick={() => onOpenHistory(equipment)}
      className={`w-full text-left py-sm pl-xl pr-sm hover:brightness-95 transition-all border-t border-outline-variant/50 ${zebraClass}`}
    >
      {/* md+: fila de grilla, alineada al header de columnas de EquipmentPage.jsx */}
      <div className="hidden md:grid md:grid-cols-12 md:gap-sm md:items-center">
        <span className="col-span-4 font-label-md text-label-md text-on-surface">{equipment.motor}</span>
        <span className="col-span-2 font-body-sm text-body-sm text-on-surface-variant">
          {equipment.fuel_percentage != null ? `${equipment.fuel_percentage}%` : '—'}
        </span>
        <span className="col-span-2 font-body-sm text-body-sm text-on-surface-variant">
          {equipment.hours_of_use != null ? `${equipment.hours_of_use} h` : '—'}
        </span>
        <span className="col-span-2 font-body-sm text-body-sm text-on-surface-variant">{formatDate(equipment.last_service_date)}</span>
        <span className="col-span-2">{conditionChip}</span>
      </div>

      {/* Por debajo de md, sin columnas: mini-card apilada. */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-sm">
          <span className="font-label-md text-label-md text-on-surface">{equipment.motor}</span>
          {conditionChip}
        </div>
        <dl className="grid grid-cols-3 gap-x-sm mt-xs">
          <div>
            <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">% Comb.</dt>
            <dd className="font-body-sm text-body-sm text-on-surface-variant">
              {equipment.fuel_percentage != null ? `${equipment.fuel_percentage}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Horas</dt>
            <dd className="font-body-sm text-body-sm text-on-surface-variant">
              {equipment.hours_of_use != null ? `${equipment.hours_of_use} h` : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Últ. Service</dt>
            <dd className="font-body-sm text-body-sm text-on-surface-variant">{formatDate(equipment.last_service_date)}</dd>
          </div>
        </dl>
      </div>
    </button>
  )
}
