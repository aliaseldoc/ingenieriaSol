import { useVisitDetail, useVisitParameters, usePreviousVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import VisitDetailPanel from '../visitReview/VisitDetailPanel'

// El informe completo de la visita que abrio el caso, el mismo que se revisa
// en Validacion. Se monta solo al abrirse, para no pedir la visita de cada
// caso que se mira.
export default function VisitReportModal({ visitId, onClose }) {
  const { data: visit, loading } = useVisitDetail(visitId)
  const { data: parameters } = useVisitParameters(visitId)
  const { data: previousParameters } = usePreviousVisitParameters(visit)
  const { data: events } = useVisitEvents(visitId)

  return (
    <Modal open title="Informe de Visita" onClose={onClose} size="lg">
      {loading ? (
        <Spinner label="Cargando visita…" />
      ) : visit ? (
        <VisitDetailPanel
          visit={visit}
          parameters={parameters ?? []}
          previousParameters={previousParameters ?? []}
          events={events ?? []}
          showNoteReads
        />
      ) : (
        <EmptyState icon="search_off" title="Visita no encontrada" description="No se pudo cargar el informe de esta visita." />
      )}
    </Modal>
  )
}
