import { SERVICE_TYPE_LABELS } from '../../lib/constants'
import { formatDate } from '../../lib/dateUtils'
import Button from '../../components/ui/Button'

function ReadOnlyField({ label, value }) {
  return (
    <div className="space-y-xs">
      <label className="font-label-md text-[1.6rem] text-on-surface-variant uppercase">{label}</label>
      <p className="w-full border-b border-outline-variant pb-xs font-body-lg text-body-lg text-on-surface">{value ?? '—'}</p>
    </div>
  )
}

export default function VisitMetadataCard({ visit, serviceType, onChangeServiceType, onShowEquipmentDetail, loadingEquipmentDetail }) {
  const ordenReparacion = visit.routeSheetId ? `ORD-${visit.routeSheetId.slice(0, 8).toUpperCase()}` : '—'

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md md:p-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <ReadOnlyField label="Empresa / Cliente" value={visit.equipment?.clients?.name} />
        <ReadOnlyField label="Fecha" value={visit.scheduled_date ? formatDate(visit.scheduled_date) : 'Sin asignar'} />
        <ReadOnlyField label="Orden de Reparación N°" value={ordenReparacion} />
        <ReadOnlyField label="Equipo / Motor" value={visit.equipment?.motor} />
        <ReadOnlyField label="Generador" value={visit.equipment?.generador} />
        <ReadOnlyField label="N° de Serie" value={visit.equipment?.serial_number} />
        <div className="space-y-xs md:col-span-2">
          <label className="font-label-md text-label-md text-on-surface-variant uppercase">Tipo de Servicio</label>
          <select
            required
            value={serviceType}
            onChange={(event) => onChangeServiceType(event.target.value)}
            className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-lg text-body-lg text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
          >
            {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            variant="secondary-outline"
            icon="precision_manufacturing"
            onClick={onShowEquipmentDetail}
            disabled={loadingEquipmentDetail}
            fullWidth
          >
            {loadingEquipmentDetail ? 'Cargando…' : 'Ver Ficha Técnica'}
          </Button>
        </div>
      </div>
    </section>
  )
}
