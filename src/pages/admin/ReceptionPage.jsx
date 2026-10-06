import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAllSubmittedVisits, useVisitParameters, usePreviousVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import { markVisitReceived } from '../../api/visits'
import VisitReviewQueue from '../../features/visitReview/VisitReviewQueue'
import ReceivedVisitsByClient from '../../features/visitReview/ReceivedVisitsByClient'
import VisitDetailPanel from '../../features/visitReview/VisitDetailPanel'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

// Pendiente de recepcion: el tecnico la envio y nadie la recibio todavia.
// La recepcion es independiente de la validacion del supervisor: cuenta igual
// si ya la aprobo o no. received_at es de la visita, no de quien mira: apenas
// cualquier administrativo la recibe, sale de la bandeja de todos.
function isPendingReception(visit) {
  return !visit.received_at
}

export default function ReceptionPage() {
  const { profile } = useAuth()
  const { data: submittedVisits, loading, reload } = useAllSubmittedVisits()
  const [selectedId, setSelectedId] = useState(null)

  // Las dos listas salen de la misma consulta (las visitas enviadas): una
  // visita nunca aparece en las dos ni se pierde entre ellas. "Pendientes" va
  // de la mas vieja a la mas nueva; "Todas" son las recibidas.
  const pendingVisits = (submittedVisits ?? [])
    .filter(isPendingReception)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
  const historicalVisits = (submittedVisits ?? []).filter((visit) => !isPendingReception(visit))

  const selectedVisit = submittedVisits?.find((visit) => visit.id === selectedId) ?? null
  const { data: parameters } = useVisitParameters(selectedId)
  const { data: previousParameters } = usePreviousVisitParameters(selectedVisit)
  const { data: events } = useVisitEvents(selectedId)

  async function handleMarkReceived() {
    await markVisitReceived(selectedId, profile.id, selectedVisit.equipment_id, parameters, selectedVisit.changes_data, {
      isAnnualService: selectedVisit.is_annual_service,
      checklistData: selectedVisit.checklist_data,
      scheduledDate: selectedVisit.scheduled_date,
    })
    setSelectedId(null)
    reload()
  }

  if (loading) return <Spinner label="Cargando visitas…" />

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Recepción de Visitas</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Visitas enviadas por los técnicos, a la espera de acuse de recibo administrativo.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-4 flex flex-col gap-md">
          <VisitReviewQueue visits={pendingVisits} selectedId={selectedId} onSelect={setSelectedId} />
          <ReceivedVisitsByClient visits={historicalVisits} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="lg:col-span-8">
          {selectedVisit ? (
            <VisitDetailPanel
              visit={selectedVisit}
              parameters={parameters ?? []}
              previousParameters={previousParameters ?? []}
              events={events ?? []}
              showEquipmentSheet
              showNoteReads
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
