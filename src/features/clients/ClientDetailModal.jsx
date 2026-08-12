import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { deleteClient } from '../../api/clients'
import { requestDeletion } from '../../api/deletionRequests'
import { ROLES } from '../../lib/constants'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'

function DetailField({ label, value }) {
  return (
    <div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
      <p className="font-body-md text-body-md text-on-surface">{value || '—'}</p>
    </div>
  )
}

export default function ClientDetailModal({ client, onClose, onEdit, onDeleted }) {
  const { profile } = useAuth()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requestStatus, setRequestStatus] = useState('idle') // 'idle' | 'sending' | 'sent'
  const isSupervisor = profile?.role === ROLES.SUPERVISOR
  const isAdministrativo = profile?.role === ROLES.ADMINISTRATIVO

  useEffect(() => {
    if (client) setRequestStatus('idle')
  }, [client])

  function handleClose() {
    setErrorMessage('')
    onClose()
  }

  async function handleRequestDeletion() {
    setRequestStatus('sending')
    setErrorMessage('')
    try {
      await requestDeletion({ entityType: 'cliente', entityId: client.id, entityName: client.name, requestedBy: profile.id })
      setRequestStatus('sent')
    } catch (error) {
      setRequestStatus('idle')
      setErrorMessage(error.message || 'No se pudo enviar la solicitud.')
    }
  }

  async function handleDelete() {
    setErrorMessage('')
    try {
      await deleteClient(client.id)
      setConfirmingDelete(false)
      onDeleted()
    } catch (error) {
      setErrorMessage(
        error.message?.includes('foreign key')
          ? 'No se puede eliminar: el cliente todavía tiene equipos asociados.'
          : error.message || 'No se pudo eliminar el cliente.'
      )
    }
  }

  const actions = [
    { label: 'Cerrar', variant: 'secondary-outline', onClick: handleClose },
    ...(isSupervisor
      ? [
          { label: 'Eliminar', variant: 'destructive-outline', icon: 'delete', onClick: () => setConfirmingDelete(true) },
          { label: 'Modificar', variant: 'primary', icon: 'edit', onClick: () => onEdit(client) },
        ]
      : []),
    ...(isAdministrativo && requestStatus !== 'sent'
      ? [
          {
            label: requestStatus === 'sending' ? 'Enviando…' : 'Solicitar Eliminación',
            variant: 'destructive-outline',
            icon: 'delete',
            onClick: handleRequestDeletion,
            disabled: requestStatus === 'sending',
          },
        ]
      : []),
  ]

  return (
    <>
      <Modal open={Boolean(client)} title="Detalle del Cliente" onClose={handleClose} size="lg" actions={actions}>
        {client && (
          <div className="space-y-md">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              <DetailField label="CUIT" value={client.tax_id} />
              <DetailField label="Contacto" value={client.contact_name} />
              <DetailField label="Teléfono" value={client.contact_phone} />
              <DetailField label="Email" value={client.contact_email} />
              <DetailField label="Dirección" value={client.address} />
              <DetailField label="Ciudad" value={client.city} />
              {client.notes && (
                <div className="col-span-2 md:col-span-4">
                  <DetailField label="Notas" value={client.notes} />
                </div>
              )}
            </div>
            {requestStatus === 'sent' && (
              <p className="font-body-sm text-body-sm text-tertiary-fixed-dim">
                Solicitud enviada, a la espera de aprobación del supervisor.
              </p>
            )}
            {errorMessage && !confirmingDelete && (
              <p role="alert" className="font-body-sm text-body-sm text-error">
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmingDelete}
        title={`Eliminar ${client?.name ?? ''}`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => {
          setConfirmingDelete(false)
          setErrorMessage('')
        }}
        onConfirm={handleDelete}
      >
        ¿Seguro que querés eliminar este cliente? Esta acción no se puede deshacer.
        {errorMessage && <span role="alert" className="block text-error mt-sm">{errorMessage}</span>}
      </ConfirmModal>
    </>
  )
}
