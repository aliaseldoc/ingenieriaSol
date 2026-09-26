import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTechnicianVisits } from '../../hooks/useVisits'
import { SERVICE_TYPE_LABELS, VISIT_STATUS, VISIT_STATUS_LABELS } from '../../lib/constants'
import { formatDateTime } from '../../lib/dateUtils'
import StatusChip from '../../components/ui/StatusChip'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useSupervisorNotes } from '../../features/supervisorNotes/SupervisorNotesContext'

const STATUS_TONE = {
  [VISIT_STATUS.APROBADA]: 'success',
  [VISIT_STATUS.RECHAZADA]: 'error',
  [VISIT_STATUS.ENVIADA]: 'warning',
  [VISIT_STATUS.REVISION_SOLICITADA]: 'warning',
}

export default function HistoryPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data: visits, loading } = useTechnicianVisits(profile?.id)
  const { unreadVisitIds } = useSupervisorNotes()

  const history = useMemo(() => {
    return (visits ?? [])
      .filter((visit) => visit.submitted_at)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
  }, [visits])

  if (loading) return <Spinner label="Cargando tu historial…" />

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Mi Historial</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Detalle de todas tus visitas realizadas.</p>

      {history.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
          <EmptyState icon="history" title="Sin visitas realizadas todavía" />
        </div>
      ) : (
        <div className="space-y-sm">
          {history.map((visit, index) => (
            <button
              key={visit.id}
              type="button"
              onClick={() => navigate(`/tecnico/visita/${visit.id}`)}
              className={`w-full text-left border border-outline-variant rounded-lg p-md hover:border-secondary hover:brightness-95 transition-all flex items-center justify-between gap-sm ${
                index % 2 === 0 ? 'bg-secondary-fixed' : 'bg-secondary-fixed-dim'
              }`}
            >
              <div>
                <p className="font-label-md text-label-md text-on-surface">{visit.equipment?.motor}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {visit.equipment?.clients?.name} · {SERVICE_TYPE_LABELS[visit.service_type] ?? 'Sin tipo'}
                </p>
                {unreadVisitIds.has(visit.id) && (
                  <div className="mt-xs">
                    <StatusChip label="Nota nueva" tone="error" variant="tag" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{formatDateTime(visit.submitted_at)}</span>
                <StatusChip label={VISIT_STATUS_LABELS[visit.status]} tone={STATUS_TONE[visit.status] ?? 'neutral'} variant="tag" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
