import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVisitDetail, useVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import { sendVisitResultsEmail } from '../../api/notifications'
import { logVisitEvent } from '../../api/visitEvents'
import { VISIT_STATUS, VISIT_EVENT_RESULTADOS_ENVIADOS } from '../../lib/constants'
import VisitDetailPanel from '../../features/visitReview/VisitDetailPanel'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'

export default function VisitDetailPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: visit, loading } = useVisitDetail(visitId)
  const { data: parameters } = useVisitParameters(visitId)
  const { data: events, reload: reloadEvents } = useVisitEvents(visitId)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)

  const resultsSentCount = (events ?? []).filter((event) => event.event_type === VISIT_EVENT_RESULTADOS_ENVIADOS).length

  async function handleSendResults() {
    setSendingEmail(true)
    setEmailMessage(null)
    try {
      const result = await sendVisitResultsEmail(visitId)
      setEmailMessage({ error: false, text: `Resultados enviados a ${result.sentTo.join(', ')}.` })
      await logVisitEvent(visitId, VISIT_EVENT_RESULTADOS_ENVIADOS, profile.id)
      reloadEvents()
    } catch (error) {
      setEmailMessage({ error: true, text: error.message || 'No se pudieron enviar los resultados.' })
    } finally {
      setSendingEmail(false)
    }
  }

  if (loading) return <Spinner label="Cargando visita…" />

  return (
    <div>
      <div className="flex items-center justify-between gap-sm mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Detalle de Visita</h1>
        <Button variant="secondary-outline" icon="arrow_back" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>

      {emailMessage && (
        <p role="alert" className={`font-body-sm text-body-sm mb-md ${emailMessage.error ? 'text-error' : 'text-tertiary-fixed-dim'}`}>
          {emailMessage.text}
        </p>
      )}

      {visit ? (
        <VisitDetailPanel
          visit={visit}
          parameters={parameters ?? []}
          events={events ?? []}
          actions={
            visit.status === VISIT_STATUS.APROBADA ? (
              <Button variant="secondary-outline" icon="mail" disabled={sendingEmail} onClick={handleSendResults}>
                {sendingEmail ? 'Enviando…' : `Enviar Resultados por Mail${resultsSentCount > 0 ? ` (${resultsSentCount})` : ''}`}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
          <EmptyState icon="fact_check" title="Visita no encontrada" description="No se pudo encontrar el detalle de esta visita." />
        </div>
      )}
    </div>
  )
}
