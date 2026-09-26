import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVisitsPendingReview, useVisitParameters, usePreviousVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import { approveVisit } from '../../api/visits'
import { requestVisitRepair } from '../../api/repairs'
import { sendVisitResultsEmail } from '../../api/notifications'
import { logVisitEvent, sendSupervisorNote } from '../../api/visitEvents'
import { VISIT_STATUS, VISIT_EVENT_RESULTADOS_ENVIADOS } from '../../lib/constants'
import VisitReviewQueue from '../../features/visitReview/VisitReviewQueue'
import VisitDetailPanel from '../../features/visitReview/VisitDetailPanel'
import SupervisorNoteForm from '../../features/visitReview/SupervisorNoteForm'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import TextAreaField from '../../components/ui/TextAreaField'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function ValidationPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data: visits, loading, reload } = useVisitsPendingReview()
  const [selectedId, setSelectedId] = useState(null)
  // La visita validada sale de la lista de "pendientes" al recargar; se
  // guarda una copia local para poder seguir mostrando su panel (el boton de
  // enviar resultados y las notas al tecnico) sin navegar a otra pantalla.
  const [approvedVisit, setApprovedVisit] = useState(null)
  // Caso que abrio "Reparacion Solicitada" sobre la visita que se esta viendo.
  const [openedRepairId, setOpenedRepairId] = useState(null)
  const [repairModalOpen, setRepairModalOpen] = useState(false)
  const [repairDescription, setRepairDescription] = useState('')
  const [requestingRepair, setRequestingRepair] = useState(false)
  const [repairError, setRepairError] = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)

  const selectedVisit = approvedVisit ?? visits?.find((visit) => visit.id === selectedId) ?? null
  const { data: parameters } = useVisitParameters(selectedId)
  const { data: previousParameters } = usePreviousVisitParameters(selectedVisit)
  const { data: events, reload: reloadEvents } = useVisitEvents(selectedId)
  const resultsSentCount = (events ?? []).filter((event) => event.event_type === VISIT_EVENT_RESULTADOS_ENVIADOS).length

  function handleSelectVisit(id) {
    setApprovedVisit(null)
    setOpenedRepairId(null)
    setEmailMessage(null)
    setSelectedId(id)
  }

  async function handleApprove() {
    await approveVisit(selectedVisit.id, profile.id, null)
    setApprovedVisit({ ...selectedVisit, status: VISIT_STATUS.APROBADA })
    reload()
  }

  // El punto de partida del trabajo a realizar es la falla que describio el
  // tecnico, si la reporto.
  function openRepairModal() {
    setRepairDescription(selectedVisit.fault_description ?? '')
    setRepairError(null)
    setRepairModalOpen(true)
  }

  function closeRepairModal() {
    setRepairModalOpen(false)
  }

  async function handleRequestRepair() {
    setRequestingRepair(true)
    setRepairError(null)
    try {
      const repairId = await requestVisitRepair(selectedVisit.id, repairDescription)
      setOpenedRepairId(repairId)
      setApprovedVisit({ ...selectedVisit, status: VISIT_STATUS.APROBADA })
      setRepairModalOpen(false)
      reload()
      reloadEvents()
    } catch (error) {
      setRepairError(error.message || 'No se pudo solicitar la reparación.')
    } finally {
      setRequestingRepair(false)
    }
  }

  async function handleSendNote(text) {
    await sendSupervisorNote(selectedVisit.id, profile.id, text)
    reloadEvents()
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

  if (loading) return <Spinner label="Cargando visitas…" />

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Validación de Supervisor</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Revisá cada visita enviada: aprobala o, si el equipo necesita una reparación, abrí el caso en Reparaciones.
        Para indicarle algo al técnico, dejale una nota debajo del historial.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-4 flex flex-col gap-md">
          <VisitReviewQueue visits={visits ?? []} selectedId={selectedId} onSelect={handleSelectVisit} />
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
              historyFooter={<SupervisorNoteForm key={selectedVisit.id} onSend={handleSendNote} />}
              actions={
                <>
                  {openedRepairId && (
                    <div className="w-full flex flex-wrap items-center justify-between gap-sm">
                      <p role="status" className="font-body-sm text-body-sm text-tertiary-fixed-dim">
                        La visita quedó aprobada y se abrió la reparación.
                      </p>
                      <Button
                        variant="secondary-outline"
                        icon="build"
                        onClick={() => navigate(`/supervisor/reparaciones?reparacion=${openedRepairId}`)}
                      >
                        Ver Reparación
                      </Button>
                    </div>
                  )}
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
                      <Button variant="secondary-outline" icon="build" onClick={openRepairModal}>
                        Reparación Solicitada
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
        open={repairModalOpen}
        title="Solicitar reparación"
        onClose={requestingRepair ? () => {} : closeRepairModal}
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: closeRepairModal, disabled: requestingRepair },
          {
            label: requestingRepair ? 'Guardando…' : 'Confirmar',
            variant: 'primary',
            onClick: handleRequestRepair,
            disabled: requestingRepair || !repairDescription.trim(),
          },
        ]}
      >
        <p className="font-body-md text-body-md text-on-surface-variant mb-md">
          La visita queda aprobada y se abre un caso en Reparaciones para seguir el presupuesto con el cliente.
        </p>
        <TextAreaField
          label="Trabajo a realizar"
          value={repairDescription}
          onChange={setRepairDescription}
          rows={4}
          placeholder="Describí la reparación que hace falta…"
        />
        {repairError && (
          <p role="alert" className="font-body-sm text-body-sm text-error mt-sm">
            {repairError}
          </p>
        )}
      </Modal>
    </div>
  )
}
