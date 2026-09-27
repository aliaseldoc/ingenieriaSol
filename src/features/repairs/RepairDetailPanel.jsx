import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useRepairEvents } from '../../hooks/useRepairs'
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_TONE } from '../../lib/constants'
import { formatDate } from '../../lib/dateUtils'
import Button from '../../components/ui/Button'
import StatusChip from '../../components/ui/StatusChip'
import EquipmentSheetButton from '../equipmentInventory/EquipmentSheetButton'
import RepairSection from './RepairSection'
import RepairStatusForm from './RepairStatusForm'
import RepairNextStepForm from './RepairNextStepForm'
import RepairDataForm from './RepairDataForm'
import RepairLog from './RepairLog'
import VisitReportModal from './VisitReportModal'

// onChanged recarga la lista de casos (de ahi sale `repair`) y devuelve la
// promesa, para que cada formulario espere el dato nuevo antes de limpiarse.
export default function RepairDetailPanel({ repair, onChanged }) {
  const { profile } = useAuth()
  const { data: events, reload: reloadEvents } = useRepairEvents(repair.id)
  const [showVisitReport, setShowVisitReport] = useState(false)

  // Cada cambio del caso deja su evento en la bitacora: se recargan los dos.
  async function handleChanged() {
    reloadEvents()
    await onChanged()
  }

  const equipmentName = [repair.equipment?.motor, repair.equipment?.generador].filter(Boolean).join(' ')

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div className="p-md border-b border-outline-variant flex items-center justify-between flex-wrap gap-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">{repair.equipment?.clients?.name ?? 'Sin cliente'}</h2>
          <h3 className="font-body-md text-body-md text-on-surface-variant font-normal">{equipmentName || 'Equipo sin datos'}</h3>
        </div>
        <div className="flex items-center flex-wrap gap-sm">
          <EquipmentSheetButton equipmentId={repair.equipment_id} />
          {repair.visit_id && (
            <Button variant="secondary-outline" icon="description" onClick={() => setShowVisitReport(true)}>
              Ver Informe de Visita
            </Button>
          )}
          <StatusChip label={REPAIR_STATUS_LABELS[repair.status]} tone={REPAIR_STATUS_TONE[repair.status]} />
        </div>
      </div>

      <div className="p-md space-y-md">
        {repair.visits?.fault_description && (
          <div className="border border-error rounded p-md bg-error-container/30">
            <h3 className="font-body-lg text-body-lg text-on-error-container uppercase mb-sm flex items-center gap-xs">
              <span className="material-symbols-outlined text-[1.8rem]">warning</span>
              Falla Reportada por el Técnico
            </h3>
            <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{repair.visits.fault_description}</p>
          </div>
        )}

        <RepairSection title="Trabajo a Realizar">
          <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{repair.description}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-sm">
            Solicitada el {formatDate(repair.created_at)}
            {repair.visits?.scheduled_date && ` · Visita del ${formatDate(repair.visits.scheduled_date)}`}
          </p>
        </RepairSection>

        <RepairStatusForm key={repair.status} repair={repair} actorId={profile.id} onChanged={handleChanged} />
        <RepairNextStepForm
          key={`${repair.next_action ?? ''}|${repair.next_action_due ?? ''}`}
          repair={repair}
          actorId={profile.id}
          onChanged={handleChanged}
        />
        <RepairDataForm repair={repair} actorId={profile.id} onChanged={handleChanged} />
        <RepairLog events={events} repairId={repair.id} actorId={profile.id} onAdded={handleChanged} />
      </div>

      {showVisitReport && <VisitReportModal visitId={repair.visit_id} onClose={() => setShowVisitReport(false)} />}
    </div>
  )
}
