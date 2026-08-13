import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import StatusChip from '../../components/ui/StatusChip'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import FormSection from '../../components/ui/FormSection'
import Field from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { useEquipmentHistory } from '../../hooks/useEquipment'
import { updateEquipment, deleteEquipment } from '../../api/equipment'
import { requestDeletion } from '../../api/deletionRequests'
import {
  SERVICE_TYPE_LABELS,
  VISIT_STATUS,
  VISIT_STATUS_LABELS,
  CONDITION_STATUS,
  CONDITION_STATUS_LABELS,
  FUEL_TYPE,
  FUEL_TYPE_LABELS,
  ROLE_HOME_PATH,
  ROLES,
} from '../../lib/constants'
import { formatDate, computeNextDueDate } from '../../lib/dateUtils'

const STATUS_TONE = {
  [VISIT_STATUS.APROBADA]: 'success',
  [VISIT_STATUS.RECHAZADA]: 'error',
  [VISIT_STATUS.ENVIADA]: 'warning',
  [VISIT_STATUS.REVISION_SOLICITADA]: 'warning',
}

const CONDITION_TONE = {
  [CONDITION_STATUS.OPTIMO]: 'success',
  [CONDITION_STATUS.ATENCION]: 'warning',
  [CONDITION_STATUS.FUERA_SERVICIO]: 'error',
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
      <p className="font-body-md text-body-md text-on-surface">{value ?? '—'}</p>
    </div>
  )
}

function computeDefaultDueDate(changedAt, storedDueAt, years) {
  if (storedDueAt) return storedDueAt
  if (!changedAt) return ''
  return computeNextDueDate(changedAt, years)
}

function toFormValues(equipment) {
  return {
    motor: equipment.motor ?? '',
    generador: equipment.generador ?? '',
    serial_number: equipment.serial_number ?? '',
    power_kva: equipment.power_kva ?? '',
    fuel_type: equipment.fuel_type ?? FUEL_TYPE.DIESEL,
    fuel_filter_spec: equipment.fuel_filter_spec ?? '',
    oil_filter_spec: equipment.oil_filter_spec ?? '',
    air_filter_spec: equipment.air_filter_spec ?? '',
    coolant_capacity: equipment.coolant_capacity ?? '',
    fuel_capacity: equipment.fuel_capacity ?? '',
    oil_capacity: equipment.oil_capacity ?? '',
    battery_quantity: equipment.battery_quantity ?? '',
    battery_size: equipment.battery_size ?? '',
    fuel_filter_changed_at: equipment.fuel_filter_changed_at ?? '',
    oil_filter_changed_at: equipment.oil_filter_changed_at ?? '',
    air_filter_changed_at: equipment.air_filter_changed_at ?? '',
    battery_changed_at: equipment.battery_changed_at ?? '',
    fuel_filter_next_due_at: computeDefaultDueDate(equipment.fuel_filter_changed_at, equipment.fuel_filter_next_due_at, 1),
    oil_filter_next_due_at: computeDefaultDueDate(equipment.oil_filter_changed_at, equipment.oil_filter_next_due_at, 1),
    air_filter_next_due_at: computeDefaultDueDate(equipment.air_filter_changed_at, equipment.air_filter_next_due_at, 1),
    battery_next_due_at: computeDefaultDueDate(equipment.battery_changed_at, equipment.battery_next_due_at, 2),
    fuel_percentage: equipment.fuel_percentage ?? '',
    hours_of_use: equipment.hours_of_use ?? '',
    condition_status: equipment.condition_status ?? CONDITION_STATUS.OPTIMO,
  }
}

export default function EquipmentHistoryPanel({ equipment, onClose, onUpdated, onDeleted }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { history, loading } = useEquipmentHistory(equipment?.id)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requestStatus, setRequestStatus] = useState('idle') // 'idle' | 'sending' | 'sent'
  const isSupervisor = profile?.role === ROLES.SUPERVISOR
  const isAdministrativo = profile?.role === ROLES.ADMINISTRATIVO
  const isTecnico = profile?.role === ROLES.TECNICO

  async function handleRequestDeletion() {
    setRequestStatus('sending')
    setErrorMessage('')
    try {
      await requestDeletion({ entityType: 'equipo', entityId: equipment.id, entityName: equipment.motor, requestedBy: profile.id })
      setRequestStatus('sent')
    } catch (error) {
      setRequestStatus('idle')
      setErrorMessage(error.message || 'No se pudo enviar la solicitud.')
    }
  }

  function startEditing() {
    setForm(toFormValues(equipment))
    setIsEditing(true)
  }

  function stopEditing() {
    setIsEditing(false)
    setForm(null)
  }

  function handleClose() {
    stopEditing()
    setErrorMessage('')
    setRequestStatus('idle')
    onClose()
  }

  function handleChangeTrackingDate(dateKey, dueKey, yearsAhead) {
    return (value) => {
      setForm((f) => ({
        ...f,
        [dateKey]: value,
        [dueKey]: f[dueKey] || (value ? computeNextDueDate(value, yearsAhead) : f[dueKey]),
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const updated = await updateEquipment(equipment.id, {
      ...form,
      power_kva: form.power_kva !== '' ? Number(form.power_kva) : null,
      fuel_capacity: form.fuel_capacity !== '' ? Number(form.fuel_capacity) : null,
      fuel_percentage: form.fuel_percentage !== '' ? Number(form.fuel_percentage) : null,
      hours_of_use: form.hours_of_use !== '' ? Number(form.hours_of_use) : null,
      fuel_filter_changed_at: form.fuel_filter_changed_at || null,
      oil_filter_changed_at: form.oil_filter_changed_at || null,
      air_filter_changed_at: form.air_filter_changed_at || null,
      battery_changed_at: form.battery_changed_at || null,
      fuel_filter_next_due_at: form.fuel_filter_next_due_at || null,
      oil_filter_next_due_at: form.oil_filter_next_due_at || null,
      air_filter_next_due_at: form.air_filter_next_due_at || null,
      battery_next_due_at: form.battery_next_due_at || null,
    })
    stopEditing()
    onUpdated({ ...equipment, ...updated })
  }

  async function handleDelete() {
    setErrorMessage('')
    try {
      await deleteEquipment(equipment.id)
      setConfirmingDelete(false)
      handleClose()
      onDeleted()
    } catch (error) {
      setErrorMessage(
        error.message?.includes('foreign key')
          ? 'No se puede eliminar: el equipo todavía tiene visitas asociadas.'
          : error.message || 'No se pudo eliminar el equipo.'
      )
    }
  }

  const actions = isEditing
    ? [
        { label: 'Cancelar', variant: 'secondary-outline', onClick: stopEditing },
        { label: 'Guardar Cambios', variant: 'primary', type: 'submit', form: 'edit-equipment-form' },
      ]
    : [
        { label: 'Cerrar', variant: 'secondary-outline', onClick: handleClose },
        ...(isSupervisor
          ? [{ label: 'Eliminar', variant: 'destructive-outline', icon: 'delete', onClick: () => setConfirmingDelete(true) }]
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
        ...(!isTecnico ? [{ label: 'Editar', variant: 'primary', icon: 'edit', onClick: startEditing }] : []),
      ]

  return (
    <>
    <Modal open={Boolean(equipment)} title={`Detalle de ${equipment?.motor ?? ''}`} onClose={handleClose} size="lg" actions={actions}>
      {equipment && isEditing && (
        <form id="edit-equipment-form" onSubmit={handleSubmit} className="space-y-md mb-lg">
          <FormSection title="Datos Principales">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Motor" value={form.motor} onChange={(v) => setForm((f) => ({ ...f, motor: v }))} />
              <Field label="N° de Serie" value={form.serial_number} onChange={(v) => setForm((f) => ({ ...f, serial_number: v }))} />
              <Field label="Generador" value={form.generador} onChange={(v) => setForm((f) => ({ ...f, generador: v }))} />
              <Field label="Potencia (kVA)" type="number" value={form.power_kva} onChange={(v) => setForm((f) => ({ ...f, power_kva: v }))} />
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-on-surface block">Combustible</label>
                <select
                  value={form.fuel_type}
                  onChange={(event) => setForm((f) => ({ ...f, fuel_type: event.target.value }))}
                  className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
                >
                  {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Datos Secundarios">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Filtro de Combustible" value={form.fuel_filter_spec} onChange={(v) => setForm((f) => ({ ...f, fuel_filter_spec: v }))} />
              <Field label="Filtro de Aceite" value={form.oil_filter_spec} onChange={(v) => setForm((f) => ({ ...f, oil_filter_spec: v }))} />
              <Field label="Filtro de Aire" value={form.air_filter_spec} onChange={(v) => setForm((f) => ({ ...f, air_filter_spec: v }))} />
              <Field label="Cantidad de Agua" value={form.coolant_capacity} onChange={(v) => setForm((f) => ({ ...f, coolant_capacity: v }))} />
              <Field label="Tamaño de Tanque (Litros)" type="number" value={form.fuel_capacity} onChange={(v) => setForm((f) => ({ ...f, fuel_capacity: v }))} />
              <Field label="Cantidad de Aceite" value={form.oil_capacity} onChange={(v) => setForm((f) => ({ ...f, oil_capacity: v }))} />
              <Field label="Cantidad de Baterías" value={form.battery_quantity} onChange={(v) => setForm((f) => ({ ...f, battery_quantity: v }))} />
              <Field label="Medida de Batería" value={form.battery_size} onChange={(v) => setForm((f) => ({ ...f, battery_size: v }))} />
            </div>
          </FormSection>

          <FormSection title="Seguimiento">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Cambio Filtro de Combustible" type="date" value={form.fuel_filter_changed_at} onChange={handleChangeTrackingDate('fuel_filter_changed_at', 'fuel_filter_next_due_at', 1)} />
              <Field label="Cambio Filtro de Aceite" type="date" value={form.oil_filter_changed_at} onChange={handleChangeTrackingDate('oil_filter_changed_at', 'oil_filter_next_due_at', 1)} />
              <Field label="Cambio Filtro de Aire" type="date" value={form.air_filter_changed_at} onChange={handleChangeTrackingDate('air_filter_changed_at', 'air_filter_next_due_at', 1)} />
              <Field label="Fecha de Batería" type="date" value={form.battery_changed_at} onChange={handleChangeTrackingDate('battery_changed_at', 'battery_next_due_at', 2)} />
              <Field label="Porcentaje de Combustible" type="number" value={form.fuel_percentage} onChange={(v) => setForm((f) => ({ ...f, fuel_percentage: v }))} />
              <Field label="Horas de Uso" type="number" value={form.hours_of_use} onChange={(v) => setForm((f) => ({ ...f, hours_of_use: v }))} />
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-on-surface block">Condición</label>
                <select
                  value={form.condition_status}
                  onChange={(event) => setForm((f) => ({ ...f, condition_status: event.target.value }))}
                  className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
                >
                  {Object.entries(CONDITION_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Próximo Service">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Próx. Cambio Filtro de Combustible" type="date" value={form.fuel_filter_next_due_at} onChange={(v) => setForm((f) => ({ ...f, fuel_filter_next_due_at: v }))} />
              <Field label="Próx. Cambio Filtro de Aceite" type="date" value={form.oil_filter_next_due_at} onChange={(v) => setForm((f) => ({ ...f, oil_filter_next_due_at: v }))} />
              <Field label="Próx. Cambio Filtro de Aire" type="date" value={form.air_filter_next_due_at} onChange={(v) => setForm((f) => ({ ...f, air_filter_next_due_at: v }))} />
              <Field label="Próx. Cambio de Batería" type="date" value={form.battery_next_due_at} onChange={(v) => setForm((f) => ({ ...f, battery_next_due_at: v }))} />
            </div>
          </FormSection>
        </form>
      )}

      {equipment && !isEditing && (
        <section className="mb-lg">
          <div className="list-title-bar flex items-center justify-between mb-md px-md py-sm rounded">
            <h3 className="font-label-md text-label-md uppercase tracking-wider">Ficha Técnica</h3>
            <StatusChip
              label={CONDITION_STATUS_LABELS[equipment.condition_status]}
              tone={CONDITION_TONE[equipment.condition_status]}
              variant="dot"
            />
          </div>
          {requestStatus === 'sent' && (
            <p className="font-body-sm text-body-sm text-tertiary-fixed-dim mb-md">
              Solicitud enviada, a la espera de aprobación del supervisor.
            </p>
          )}
          {errorMessage && !confirmingDelete && (
            <p role="alert" className="font-body-sm text-body-sm text-error mb-md">
              {errorMessage}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
            <DetailField label="Cliente" value={equipment.clients?.name} />
            <DetailField label="Motor" value={equipment.motor} />
            <DetailField label="Generador" value={equipment.generador} />
            <DetailField label="N° de Serie" value={equipment.serial_number} />
            <DetailField label="Potencia" value={equipment.power_kva ? `${equipment.power_kva} kVA` : null} />
            <DetailField label="Combustible" value={FUEL_TYPE_LABELS[equipment.fuel_type]} />
            <DetailField label="Filtro de Combustible" value={equipment.fuel_filter_spec} />
            <DetailField label="Filtro de Aceite" value={equipment.oil_filter_spec} />
            <DetailField label="Filtro de Aire" value={equipment.air_filter_spec} />
            <DetailField label="Cantidad de Agua" value={equipment.coolant_capacity} />
            <DetailField label="Tamaño de Tanque" value={equipment.fuel_capacity != null ? `${equipment.fuel_capacity} L` : null} />
            <DetailField label="Cantidad de Aceite" value={equipment.oil_capacity} />
            <DetailField label="Cantidad de Baterías" value={equipment.battery_quantity} />
            <DetailField label="Medida de Batería" value={equipment.battery_size} />
            <DetailField label="Cambio Filtro de Combustible" value={equipment.fuel_filter_changed_at ? formatDate(equipment.fuel_filter_changed_at) : null} />
            <DetailField label="Cambio Filtro de Aceite" value={equipment.oil_filter_changed_at ? formatDate(equipment.oil_filter_changed_at) : null} />
            <DetailField label="Cambio Filtro de Aire" value={equipment.air_filter_changed_at ? formatDate(equipment.air_filter_changed_at) : null} />
            <DetailField label="Fecha de Batería" value={equipment.battery_changed_at ? formatDate(equipment.battery_changed_at) : null} />
            <DetailField label="Porcentaje de Combustible" value={equipment.fuel_percentage != null ? `${equipment.fuel_percentage}%` : null} />
            <DetailField label="Horas de Uso" value={equipment.hours_of_use != null ? `${equipment.hours_of_use} h` : null} />
            <DetailField label="Último Service" value={equipment.last_service_date ? formatDate(equipment.last_service_date) : null} />
          </div>
          {equipment.notes && (
            <div className="mt-md">
              <DetailField label="Notas" value={equipment.notes} />
            </div>
          )}

          <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wider mt-lg mb-md px-md py-sm rounded">Próximo Service</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
            <DetailField label="Próx. Cambio Filtro de Combustible" value={equipment.fuel_filter_next_due_at ? formatDate(equipment.fuel_filter_next_due_at) : null} />
            <DetailField label="Próx. Cambio Filtro de Aceite" value={equipment.oil_filter_next_due_at ? formatDate(equipment.oil_filter_next_due_at) : null} />
            <DetailField label="Próx. Cambio Filtro de Aire" value={equipment.air_filter_next_due_at ? formatDate(equipment.air_filter_next_due_at) : null} />
            <DetailField label="Próx. Cambio de Batería" value={equipment.battery_next_due_at ? formatDate(equipment.battery_next_due_at) : null} />
          </div>
        </section>
      )}

      <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wider mt-md mb-sm px-md py-sm rounded">
        Historial de Visitas
      </h3>
      {loading && <Spinner label="Cargando historial…" />}
      {!loading && history.length === 0 && (
        <EmptyState icon="history" title="Sin visitas registradas" description="Este equipo todavía no tiene visitas en su historial." />
      )}
      {!loading && history.length > 0 && (
        <ul className="divide-y divide-outline-variant/50 max-h-[32rem] overflow-y-auto">
          {history.map((visit) => (
            <li key={visit.id}>
              <button
                type="button"
                onClick={() => {
                  handleClose()
                  navigate(`${ROLE_HOME_PATH[profile.role]}/visita/${visit.id}`)
                }}
                className="w-full py-sm flex items-center justify-between gap-sm text-left hover:bg-surface-container-low transition-colors"
              >
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{formatDate(visit.scheduled_date)}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {SERVICE_TYPE_LABELS[visit.service_type] ?? 'Sin tipo'} ·{' '}
                    {visit.technicians?.length > 0 ? visit.technicians.map((t) => t.full_name).join(', ') : 'Sin asignar'}
                  </p>
                </div>
                <StatusChip label={VISIT_STATUS_LABELS[visit.status]} tone={STATUS_TONE[visit.status] ?? 'neutral'} variant="tag" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>

      <ConfirmModal
        open={confirmingDelete}
        title={`Eliminar ${equipment?.motor ?? ''}`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => {
          setConfirmingDelete(false)
          setErrorMessage('')
        }}
        onConfirm={handleDelete}
      >
        ¿Seguro que querés eliminar este equipo? Esta acción no se puede deshacer.
        {errorMessage && <span role="alert" className="block text-error mt-sm">{errorMessage}</span>}
      </ConfirmModal>
    </>
  )
}
