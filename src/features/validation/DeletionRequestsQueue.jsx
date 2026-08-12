import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDeletionRequests } from '../../hooks/useDeletionRequests'
import { resolveDeletionRequest } from '../../api/deletionRequests'
import { formatDateTime } from '../../lib/dateUtils'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const ENTITY_TYPE_LABELS = { cliente: 'Cliente', equipo: 'Equipo' }

export default function DeletionRequestsQueue() {
  const { profile } = useAuth()
  const { data: requests, loading, reload } = useDeletionRequests()
  const [expanded, setExpanded] = useState(true)
  const [confirmingApprove, setConfirmingApprove] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reasonText, setReasonText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleApprove() {
    setErrorMessage('')
    try {
      await resolveDeletionRequest(confirmingApprove, { status: 'aprobada', reviewedBy: profile.id, reviewNotes: null })
      setConfirmingApprove(null)
      reload()
    } catch (error) {
      setErrorMessage(
        error.message?.includes('foreign key')
          ? 'No se puede eliminar: todavía tiene registros asociados.'
          : error.message || 'No se pudo aprobar la solicitud.'
      )
    }
  }

  async function handleReject() {
    await resolveDeletionRequest(rejecting, { status: 'rechazada', reviewedBy: profile.id, reviewNotes: reasonText })
    setRejecting(null)
    setReasonText('')
    reload()
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="list-title-bar relative w-full p-md text-center hover:brightness-110 transition-all"
      >
        <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-[2rem]">
          {expanded ? 'expand_more' : 'chevron_right'}
        </span>
        <p className="font-label-sm text-label-sm uppercase opacity-80">Solicitudes de Eliminación</p>
        <p className="font-display-lg text-display-lg leading-none">{requests?.length ?? 0}</p>
      </button>
      {expanded && (
        <div className="overflow-y-auto max-h-[40rem]">
          {loading && <Spinner label="Cargando solicitudes…" />}
          {!loading && (requests?.length ?? 0) === 0 && (
            <EmptyState icon="delete_sweep" title="No hay solicitudes pendientes" />
          )}
          {!loading && requests?.length > 0 && (
            <ul className="divide-y divide-outline-variant/50">
              {requests.map((request, index) => (
                <li key={request.id} className={index % 2 === 0 ? 'bg-secondary-fixed' : 'bg-secondary-fixed-dim'}>
                  <div className="p-md">
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      {ENTITY_TYPE_LABELS[request.entity_type]}
                    </p>
                    <p className="font-label-md text-label-md text-on-surface">{request.entity_name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
                      Pedido por {request.requested_by_profile?.full_name ?? 'Alguien'} · {formatDateTime(request.requested_at)}
                    </p>
                    <div className="flex gap-sm mt-sm">
                      <Button variant="destructive-outline" icon="close" onClick={() => setRejecting(request)}>
                        Rechazar
                      </Button>
                      <Button variant="primary" icon="check" onClick={() => setConfirmingApprove(request)}>
                        Aprobar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmingApprove)}
        title={`Eliminar ${confirmingApprove?.entity_name ?? ''}`}
        confirmLabel="Aprobar y Eliminar"
        danger
        onCancel={() => {
          setConfirmingApprove(null)
          setErrorMessage('')
        }}
        onConfirm={handleApprove}
      >
        ¿Aprobar esta solicitud? El {ENTITY_TYPE_LABELS[confirmingApprove?.entity_type]?.toLowerCase()} se eliminará de forma
        permanente.
        {errorMessage && <span role="alert" className="block text-error mt-sm">{errorMessage}</span>}
      </ConfirmModal>

      <Modal
        open={Boolean(rejecting)}
        title="Rechazar solicitud"
        onClose={() => {
          setRejecting(null)
          setReasonText('')
        }}
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: () => { setRejecting(null); setReasonText('') } },
          { label: 'Confirmar', variant: 'primary', onClick: handleReject },
        ]}
      >
        <label htmlFor="reject-reason" className="font-label-sm text-label-sm text-on-surface block mb-xs">
          Motivo (opcional)
        </label>
        <textarea
          id="reject-reason"
          rows={4}
          value={reasonText}
          onChange={(event) => setReasonText(event.target.value)}
          className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:border-2 transition-all resize-y"
          placeholder="Describí por qué se rechaza la solicitud…"
        />
      </Modal>
    </div>
  )
}
