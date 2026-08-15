import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useVisitsPendingReview, useVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import { approveVisit, rejectVisit, requestVisitRevision } from '../../api/visits'
import { sendVisitResultsEmail } from '../../api/notifications'
import { logVisitEvent } from '../../api/visitEvents'
import { VISIT_STATUS, VISIT_EVENT_RESULTADOS_ENVIADOS } from '../../lib/constants'
import VisitReviewQueue from '../../features/visitReview/VisitReviewQueue'
import VisitDetailPanel from '../../features/visitReview/VisitDetailPanel'
import DeletionRequestsQueue from '../../features/validation/DeletionRequestsQueue'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function ValidationPage() {
  const { profile } = useAuth()
  const { data: visits, loading, reload } = useVisitsPendingReview()
  const [selectedId, setSelectedId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // 'rechazar' | 'revision'
  const [reasonText, setReasonText] = useState('')
  // La visita aprobada sale de la lista de "pendientes" al recargar; se
  // guarda una copia local para poder seguir mostrando su panel (y el boton
  // de enviar resultados) sin navegar a otra pantalla.
  const [approvedVisit, setApprovedVisit] = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)

  const selectedVisit = approvedVisit ?? visits?.find((visit) => visit.id === selectedId) ?? null
  const { data: parameters } = useVisitParameters(selectedId)
  const { data: events, reload: reloadEvents } = useVisitEvents(selectedId)
  const resultsSentCount = (events ?? []).filter((event) => event.event_type === VISIT_EVENT_RESULTADOS_ENVIADOS).length

  function handleSelectVisit(id) {
    setApprovedVisit(null)
    setEmailMessage(null)
    setSelectedId(id)
  }

  function closeModal() {
    setPendingAction(null)
    setReasonText('')
  }

  async function handleApprove() {
    await approveVisit(selectedVisit.id, profile.id, null)
    setApprovedVisit({ ...selectedVisit, status: VISIT_STATUS.APROBADA })
    reload()
  }

  async function handleSendResults() {
    setSendingEmail(true)
    setEmailMessage(null)
    try {
      const result = await sendVisitResultsEmail(selectedVisit.id)
      setEmailMessage({ error: false, text: `Resultados enviados a ${result.sentTo.join(', ')}.` })
      await logVisitEvent(selectedVisit.id, VISIT_EVENT_RESULTADOS_ENVIADOS, profile.id)
      reloadEvents()
    } catch (error) {
      setEmailMessage({ error: true, text: error.message || 'No se pudieron enviar los resultados.' })
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleConfirmReasonAction() {
    if (pendingAction === 'rechazar') {
      await rejectVisit(selectedVisit.id, profile.id, reasonText)
    } else if (pendingAction === 'revision') {
      await requestVisitRevision(selectedVisit.id, profile.id, reasonText)
    }
    closeModal()
    setSelectedId(null)
    reload()
  }

  if (loading) return <Spinner label="Cargando visitas…" />

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Validación de Supervisor</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Revisá cada visita enviada y aprobá, rechazá o solicitá una revisión al técnico.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-4 flex flex-col gap-md">
          <VisitReviewQueue visits={visits ?? []} selectedId={selectedId} onSelect={handleSelectVisit} />
          <DeletionRequestsQueue />
        </div>
        <div className="lg:col-span-8">
          {selectedVisit ? (
            <VisitDetailPanel
              visit={selectedVisit}
              parameters={parameters ?? []}
              events={events ?? []}
              actions={
                <>
                  {emailMessage && (
                    <p role="alert" className={`w-full font-body-sm text-body-sm ${emailMessage.error ? 'text-error' : 'text-tertiary-fixed-dim'}`}>
                      {emailMessage.text}
                    </p>
                  )}
                  {approvedVisit ? (
                    <Button variant="secondary-outline" icon="mail" disabled={sendingEmail} onClick={handleSendResults}>
                      {sendingEmail ? 'Enviando…' : `Enviar Resultados por Mail${resultsSentCount > 0 ? ` (${resultsSentCount})` : ''}`}
                    </Button>
                  ) : (
                    <>
                      <Button variant="destructive-outline" icon="close" onClick={() => setPendingAction('rechazar')}>
                        Rechazar
                      </Button>
                      <Button variant="secondary-outline" icon="edit_note" onClick={() => setPendingAction('revision')}>
                        Solicitar Revisión
                      </Button>
                      <Button variant="primary" icon="check" onClick={handleApprove}>
                        Aprobar
                      </Button>
                    </>
                  )}
                </>
              }
            />
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
              <EmptyState icon="fact_check" title="Seleccioná una visita" description="Elegí una visita de la lista para ver su detalle." />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(pendingAction)}
        title={pendingAction === 'rechazar' ? 'Rechazar visita' : 'Solicitar revisión'}
        onClose={closeModal}
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: closeModal },
          { label: 'Confirmar', variant: 'primary', onClick: handleConfirmReasonAction },
        ]}
      >
        <label htmlFor="reason" className="font-label-sm text-label-sm text-on-surface block mb-xs">
          Motivo
        </label>
        <textarea
          id="reason"
          rows={4}
          value={reasonText}
          onChange={(event) => setReasonText(event.target.value)}
          className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:border-2 transition-all resize-y"
          placeholder="Describí el motivo para el técnico…"
        />
      </Modal>
    </div>
  )
}
