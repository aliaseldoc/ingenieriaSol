import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useVisitsPendingReview, useAllSubmittedVisits, useVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import { markVisitReceived } from '../../api/visits'
import { VISIT_STATUS } from '../../lib/constants'
import VisitReviewQueue from '../../features/visitReview/VisitReviewQueue'
import ReceivedVisitsByClient from '../../features/visitReview/ReceivedVisitsByClient'
import VisitDetailPanel from '../../features/visitReview/VisitDetailPanel'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function ReceptionPage() {
  const { profile } = useAuth()
  const { data: visits, loading, reload } = useVisitsPendingReview()
  const { data: receivedVisits, loading: receivedLoading, reload: reloadReceived } = useAllSubmittedVisits()
  const [selectedId, setSelectedId] = useState(null)

  // "Todas" es el historico, no la bandeja de pendientes: sin este filtro,
  // una visita recien enviada (status ENVIADA) aparece duplicada en los dos
  // listados a la vez.
  const historicalVisits = (receivedVisits ?? []).filter((visit) => visit.status !== VISIT_STATUS.ENVIADA)

  const selectedVisit =
    visits?.find((visit) => visit.id === selectedId) ?? receivedVisits?.find((visit) => visit.id === selectedId) ?? null
  const { data: parameters } = useVisitParameters(selectedId)
  const { data: events } = useVisitEvents(selectedId)

  async function handleMarkReceived() {
    await markVisitReceived(selectedId, profile.id, selectedVisit.equipment_id, parameters, selectedVisit.changes_data, {
      isAnnualService: selectedVisit.is_annual_service,
    })
    setSelectedId(null)
    reload()
    reloadReceived()
  }

  if (loading || receivedLoading) return <Spinner label="Cargando visitas…" />

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Recepción de Visitas</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Visitas enviadas por los técnicos, a la espera de acuse de recibo administrativo.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-4 flex flex-col gap-md">
          <VisitReviewQueue visits={visits ?? []} selectedId={selectedId} onSelect={setSelectedId} />
          <ReceivedVisitsByClient visits={historicalVisits} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="lg:col-span-8">
          {selectedVisit ? (
            <VisitDetailPanel
              visit={selectedVisit}
              parameters={parameters ?? []}
              events={events ?? []}
              actions={
                <Button
                  variant="primary"
                  icon="how_to_reg"
                  onClick={handleMarkReceived}
                  disabled={Boolean(selectedVisit.received_at)}
                >
                  {selectedVisit.received_at ? 'Ya Recibida' : 'Marcar como Recibida'}
                </Button>
              }
            />
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
              <EmptyState icon="fact_check" title="Seleccioná una visita" description="Elegí una visita de la lista para ver su detalle." />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
