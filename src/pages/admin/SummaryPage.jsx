import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useVisitsThisMonth } from '../../hooks/useVisits'
import { getNextAnnualServiceDue, daysBetween, formatDate } from '../../lib/dateUtils'
import { ROLE_HOME_PATH, VISIT_STATUS, VISIT_STATUS_LABELS } from '../../lib/constants'
import KpiCard from '../../components/ui/KpiCard'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import StatusChip from '../../components/ui/StatusChip'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'

const FUTURE_WINDOW_DAYS = 90
const STATUS_TONE = {
  [VISIT_STATUS.APROBADA]: 'success',
  [VISIT_STATUS.ENVIADA]: 'warning',
}

export default function SummaryPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { equipment, loading: equipmentLoading, reload: reloadEquipment } = useEquipment()
  const { data: visitsThisMonth, loading: visitsLoading } = useVisitsThisMonth()
  const [historyEquipment, setHistoryEquipment] = useState(null)

  if (equipmentLoading || visitsLoading) return <Spinner label="Cargando resumen…" />

  const completedVisits = visitsThisMonth.filter((visit) => visit.status === VISIT_STATUS.APROBADA)
  const completionPercentage =
    visitsThisMonth.length > 0 ? Math.round((completedVisits.length / visitsThisMonth.length) * 100) : 0
  const visibleCompletedVisits = visitsThisMonth.filter((visit) =>
    [VISIT_STATUS.APROBADA, VISIT_STATUS.ENVIADA].includes(visit.status)
  )

  const today = new Date()
  const upcomingAnnualServices = equipment
    .map((item) => ({ item, dueDate: getNextAnnualServiceDue(item) }))
    .filter(({ dueDate }) => dueDate && daysBetween(today, dueDate) <= FUTURE_WINDOW_DAYS)
    .sort((a, b) => a.dueDate - b.dueDate)

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Resumen del Mes</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Estado de las visitas del mes y próximos services anuales a {FUTURE_WINDOW_DAYS} días.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-md justify-items-center">
        <KpiCard icon="event" label="Visitas Planificadas" value={visitsThisMonth.length} sublabel="Este mes" tone="primary" />
        <KpiCard
          icon="fact_check"
          label="Visitas Realizadas (Mes)"
          value={`${completionPercentage}%`}
          sublabel={`${completedVisits.length}/${visitsThisMonth.length} visitas`}
          tone="secondary"
        />
        <KpiCard icon="check_circle" label="Aprobadas" value={completedVisits.length} sublabel="Este mes" tone="soft" />
        <KpiCard
          icon="event_upcoming"
          label="Services Anuales Próximos"
          value={upcomingAnnualServices.length}
          sublabel={`Próximos ${FUTURE_WINDOW_DAYS} días`}
          tone="warning"
        />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden mb-md">
        <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md">
          Visitas Realizadas
        </h2>
        {visibleCompletedVisits.length === 0 ? (
          <EmptyState icon="task_alt" title="Sin visitas realizadas este mes" />
        ) : (
          <ul className="divide-y divide-outline-variant/50">
            {visibleCompletedVisits.map((visit, index) => (
              <li key={visit.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${ROLE_HOME_PATH[profile.role]}/visita/${visit.id}`)}
                  className={`w-full flex items-center justify-between gap-sm p-md text-left transition-all hover:brightness-95 ${
                    index % 2 === 0 ? 'bg-secondary-fixed' : 'bg-secondary-fixed-dim'
                  }`}
                >
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">{visit.equipment?.motor}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{visit.equipment?.clients?.name}</p>
                  </div>
                  <div className="flex items-center gap-sm">
                    <StatusChip label={VISIT_STATUS_LABELS[visit.status]} tone={STATUS_TONE[visit.status] ?? 'neutral'} variant="tag" />
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{formatDate(visit.scheduled_date)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md">
          Próximos Services Anuales
        </h2>
        {upcomingAnnualServices.length === 0 ? (
          <EmptyState icon="event_available" title="Sin vencimientos próximos" />
        ) : (
          <ul className="divide-y divide-outline-variant/50">
            {upcomingAnnualServices.map(({ item, dueDate }, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setHistoryEquipment(item)}
                  className={`w-full flex items-center justify-between gap-sm p-md text-left transition-all hover:brightness-95 ${
                    index % 2 === 0 ? 'bg-secondary-fixed' : 'bg-secondary-fixed-dim'
                  }`}
                >
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">{item.motor}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{item.clients?.name}</p>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{formatDate(dueDate)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EquipmentHistoryPanel
        equipment={historyEquipment}
        onClose={() => setHistoryEquipment(null)}
        onUpdated={(updated) => {
          setHistoryEquipment(updated)
          reloadEquipment()
        }}
        onDeleted={reloadEquipment}
      />
    </div>
  )
}
