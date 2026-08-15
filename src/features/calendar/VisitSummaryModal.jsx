import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import StatusChip from '../../components/ui/StatusChip'
import { SERVICE_TYPE, SERVICE_TYPE_LABELS, VISIT_OCCURRENCE_LABELS, VISIT_STATUS, VISIT_STATUS_LABELS } from '../../lib/constants'
import { formatDate } from '../../lib/dateUtils'
import { sendVisitNotificationEmail } from '../../api/notifications'

const STATUS_TONE = {
  [VISIT_STATUS.APROBADA]: 'success',
  [VISIT_STATUS.RECHAZADA]: 'error',
  [VISIT_STATUS.ENVIADA]: 'warning',
  [VISIT_STATUS.REVISION_SOLICITADA]: 'warning',
}

export default function VisitSummaryModal({ routeSheet, onClose, onAssign = null, onEdit = null }) {
  const visits = routeSheet?.visits ?? []
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)
  const [sentCountOverride, setSentCountOverride] = useState(null)
  const [confirmingResend, setConfirmingResend] = useState(false)
  const sentCount = sentCountOverride ?? routeSheet?.notification_sent_count ?? 0

  async function handleSendNotification() {
    setSendingEmail(true)
    setEmailMessage(null)
    try {
      const result = await sendVisitNotificationEmail(routeSheet.id)
      if (result.sentTo.length === 0) {
        setEmailMessage({ error: true, text: 'Ningún cliente de esta hoja de ruta tiene email de contacto cargado.' })
      } else if (result.skipped.length > 0) {
        setEmailMessage({ error: false, text: `Enviado a ${result.sentTo.join(', ')}. Sin email cargado: ${result.skipped.join(', ')}.` })
      } else {
        setEmailMessage({ error: false, text: `Notificación enviada a ${result.sentTo.join(', ')}.` })
      }
      if (result.notificationSentCount != null) setSentCountOverride(result.notificationSentCount)
    } catch (error) {
      setEmailMessage({ error: true, text: error.message || 'No se pudo enviar la notificación.' })
    } finally {
      setSendingEmail(false)
    }
  }

  function handleNotificationClick() {
    if (sentCount > 0) {
      setConfirmingResend(true)
      return
    }
    handleSendNotification()
  }

  function handleConfirmResend() {
    setConfirmingResend(false)
    handleSendNotification()
  }

  const actions = [
    { label: 'Cerrar', variant: 'secondary-outline', onClick: onClose },
    ...(routeSheet?.scheduled_date
      ? [
          {
            label: sendingEmail ? 'Enviando…' : `Enviar Notificación${sentCount > 0 ? ` (${sentCount})` : ''}`,
            variant: 'secondary-outline',
            icon: 'mail',
            disabled: sendingEmail,
            onClick: handleNotificationClick,
          },
        ]
      : []),
    ...(onAssign ? [{ label: 'Asignar Técnico', variant: 'secondary-outline', icon: 'engineering', onClick: () => onAssign(routeSheet) }] : []),
    ...(onEdit ? [{ label: 'Editar', variant: 'primary', icon: 'edit', onClick: () => onEdit(routeSheet) }] : []),
  ]

  return (
    <>
      <Modal
        open={Boolean(routeSheet)}
        title="Resumen de la Hoja de Ruta"
        onClose={onClose}
        size="lg"
        actions={actions}
      >
        {routeSheet && (
          <>
            {emailMessage && (
              <p role="alert" className={`font-body-sm text-body-sm mb-md ${emailMessage.error ? 'text-error' : 'text-tertiary-fixed-dim'}`}>
                {emailMessage.text}
              </p>
            )}
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-md mb-md">
              {routeSheet.descripcion?.trim() && (
                <div className="col-span-2 md:col-span-4">
                  <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Descripción</dt>
                  <dd className="font-body-md text-body-md text-on-surface">{routeSheet.descripcion}</dd>
                </div>
              )}
              <div>
                <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Fecha</dt>
                <dd className="font-body-md text-body-md text-on-surface">
                  {routeSheet.scheduled_date ? formatDate(routeSheet.scheduled_date) : 'Sin asignar'}
                </dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tipo de Servicio</dt>
                <dd className="font-body-md text-body-md text-on-surface">
                  {SERVICE_TYPE_LABELS[routeSheet.service_type] ?? '—'}
                  {routeSheet.service_type === SERVICE_TYPE.PREVENTIVO && routeSheet.visit_occurrence && (
                    <> ({VISIT_OCCURRENCE_LABELS[routeSheet.visit_occurrence]})</>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Vehículo</dt>
                <dd className="font-body-md text-body-md text-on-surface">{routeSheet.vehicles?.plate ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Técnico(s)</dt>
                <dd className="font-body-md text-body-md text-on-surface">
                  {routeSheet.technicians?.length > 0 ? routeSheet.technicians.map((technician) => technician.full_name).join(', ') : '—'}
                </dd>
              </div>
            </dl>

            <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wider mt-md mb-sm px-md py-sm rounded">
              Equipos ({visits.length})
            </h3>
            <ul className="divide-y divide-outline-variant/50">
              {visits.map((visit) => (
                <li key={visit.id} className="py-sm flex items-center justify-between gap-sm">
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">{visit.equipment?.motor}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{visit.equipment?.clients?.name}</p>
                  </div>
                  <StatusChip label={VISIT_STATUS_LABELS[visit.status]} tone={STATUS_TONE[visit.status] ?? 'neutral'} variant="tag" />
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
      <ConfirmModal
        open={confirmingResend}
        title="Reenviar notificación"
        confirmLabel="Enviar de todos modos"
        onConfirm={handleConfirmResend}
        onCancel={() => setConfirmingResend(false)}
      >
        La notificación ya fue enviada {sentCount} {sentCount === 1 ? 'vez' : 'veces'}. ¿Desea volver a enviar?
      </ConfirmModal>
    </>
  )
}
