import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import StatusChip from '../../components/ui/StatusChip'
import FormSection from '../../components/ui/FormSection'
import Field from '../../components/ui/Field'
import { ROLE_LABELS } from '../../lib/constants'
import { FICHAJE_HABILITADO } from '../../lib/featureFlags'
import { formatDate } from '../../lib/dateUtils'
import { updateProfile } from '../../api/profiles'
import { deleteStaffMember, getStaffDeletionPreview, renameStaffUsername } from '../../api/staff'
import { describeEmployeeError, getEmployeeByProfileId, isClockPinTaken, setClockPinForProfile } from '../../api/employees'
import { normalizeClockPin } from '../timesheet/clockFileParser'

const ROLE_TONE = { administrativo: 'neutral', tecnico: 'success', supervisor: 'warning' }

function DetailField({ label, value }) {
  return (
    <div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
      <p className="font-body-md text-body-md text-on-surface">{value ?? '—'}</p>
    </div>
  )
}

function toFormValues(staff, employee) {
  return {
    username: staff.username ?? '',
    full_name: staff.full_name ?? '',
    role: staff.role,
    phone: staff.phone ?? '',
    address: staff.address ?? '',
    clock_pin: employee?.clock_pin ?? '',
  }
}

// Advertencia antes de eliminar, armada con lo que realmente se pierde o
// cambia (staff_deletion_preview en la base). Las visitas que ya hizo no se
// tocan: siguen mostrando su nombre.
function DeletionWarning({ staff, preview }) {
  const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`
  return (
    <div className="space-y-sm font-body-md text-body-md text-on-surface">
      <p className="text-error font-label-md text-label-md">Esta acción no se puede deshacer.</p>
      <ul className="list-disc pl-lg space-y-xs">
        <li>Se borra la cuenta de {staff.full_name}: no va a poder volver a entrar a la app.</li>
        {preview.fichajes > 0 && (
          <li>Se borran sus {plural(preview.fichajes, 'fichaje', 'fichajes')}: esas horas se pierden. Las semanas ya cerradas conservan su reporte.</li>
        )}
        {preview.visitas_pendientes > 0 && (
          <li>
            Se la quita de {plural(preview.visitas_pendientes, 'visita pendiente', 'visitas pendientes')}.
            {preview.visitas_sin_tecnico > 0 && (
              <strong>
                {' '}
                {preview.visitas_sin_tecnico === 1
                  ? '1 de ellas queda sin técnico asignado: hay que reasignarla.'
                  : `${preview.visitas_sin_tecnico} de ellas quedan sin técnico asignado: hay que reasignarlas.`}
              </strong>
            )}
          </li>
        )}
        {preview.visitas_realizadas > 0 && (
          <li>Las {plural(preview.visitas_realizadas, 'visita que ya realizó queda', 'visitas que ya realizó quedan')} como están, con su nombre.</li>
        )}
      </ul>
    </div>
  )
}

export default function StaffDetailPanel({ staff, onClose, onUpdated, onDeleted }) {
  const { profile: currentProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState('')
  // null mientras no se pidio eliminar; despues { preview, error, deleting }.
  const [deletion, setDeletion] = useState(null)
  // Legajo de fichaje vinculado al perfil (lo crea la base con el perfil).
  const [employee, setEmployee] = useState(null)

  const staffId = staff?.id ?? null

  useEffect(() => {
    let isMounted = true
    setEmployee(null)
    setDeletion(null)
    if (staffId) {
      getEmployeeByProfileId(staffId)
        .then((loaded) => {
          if (isMounted) setEmployee(loaded)
        })
        .catch(() => {})
    }
    return () => {
      isMounted = false
    }
  }, [staffId])

  function startEditing() {
    setForm(toFormValues(staff, employee))
    setFormError('')
    setIsEditing(true)
  }

  function stopEditing() {
    setIsEditing(false)
    setForm(null)
    setFormError('')
  }

  function handleClose() {
    stopEditing()
    setDeletion(null)
    onClose()
  }

  async function startDeleting() {
    setDeletion({ preview: null, error: '', deleting: false })
    try {
      const preview = await getStaffDeletionPreview(staff.id)
      setDeletion((current) => current && { ...current, preview })
    } catch (error) {
      setDeletion((current) => current && { ...current, error: error?.message || 'No se pudo preparar la eliminación.' })
    }
  }

  async function confirmDelete() {
    setDeletion((current) => ({ ...current, deleting: true, error: '' }))
    try {
      await deleteStaffMember(staff.id)
      setDeletion(null)
      onDeleted()
    } catch (error) {
      setDeletion((current) => ({ ...current, deleting: false, error: error?.message || 'No se pudo eliminar.' }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const { username, clock_pin: clockPinInput, ...profileFields } = form
    const clockPin = normalizeClockPin(clockPinInput)

    // El N° del reloj va primero: es lo que mas probablemente falle (repetido)
    // y asi no queda el perfil guardado a medias.
    if (clockPin !== (employee?.clock_pin ?? '')) {
      try {
        if (clockPin && (await isClockPinTaken(clockPin, employee?.id))) {
          setFormError('Ya existe un empleado con ese N° en el reloj.')
          return
        }
        await setClockPinForProfile(staff.id, clockPin)
        setEmployee(await getEmployeeByProfileId(staff.id))
      } catch (error) {
        setFormError(describeEmployeeError(error, 'No se pudo guardar el N° en el reloj.'))
        return
      }
    }

    const normalizedUsername = username.trim().toLowerCase()
    if (normalizedUsername !== staff.username) {
      await renameStaffUsername(staff.id, normalizedUsername)
    }
    const updated = await updateProfile(staff.id, profileFields)
    stopEditing()
    onUpdated({ ...staff, ...updated })
  }

  // Uno no se puede eliminar a si mismo (la base tambien lo impide).
  const isSelf = staff?.id === currentProfile?.id

  let actions
  if (deletion) {
    actions = [
      { label: 'Cancelar', variant: 'secondary-outline', onClick: () => setDeletion(null), disabled: deletion.deleting },
      {
        label: deletion.deleting ? 'Eliminando…' : 'Eliminar definitivamente',
        variant: 'destructive-outline',
        icon: 'delete',
        onClick: confirmDelete,
        disabled: deletion.deleting || !deletion.preview,
      },
    ]
  } else if (isEditing) {
    actions = [
      { label: 'Cancelar', variant: 'secondary-outline', onClick: stopEditing },
      { label: 'Guardar Cambios', variant: 'primary', type: 'submit', form: 'edit-staff-form' },
    ]
  } else {
    actions = [
      { label: 'Cerrar', variant: 'secondary-outline', onClick: handleClose },
      ...(isSelf ? [] : [{ label: 'Eliminar', variant: 'destructive-outline', icon: 'delete', onClick: startDeleting }]),
      { label: 'Editar', variant: 'primary', icon: 'edit', onClick: startEditing },
    ]
  }

  const title = deletion ? `Eliminar a ${staff?.full_name ?? ''}` : `Detalle de ${staff?.full_name ?? ''}`

  return (
    <Modal open={Boolean(staff)} title={title} onClose={deletion?.deleting ? () => {} : handleClose} size="lg-auto" actions={actions}>
      {staff && deletion && (
        <div className="space-y-md">
          {deletion.preview ? <DeletionWarning staff={staff} preview={deletion.preview} /> : !deletion.error && <Spinner label="Revisando qué se borra…" />}
          {deletion.error && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {deletion.error}
            </p>
          )}
        </div>
      )}

      {staff && !deletion && isEditing && (
        <form id="edit-staff-form" onSubmit={handleSubmit} className="space-y-md">
          <FormSection title="Datos de la Persona">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Usuario" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} required />
              <Field label="Nombre Completo" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} required />
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-on-surface block">Rol</label>
                <select
                  value={form.role}
                  onChange={(event) => setForm((f) => ({ ...f, role: event.target.value }))}
                  className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <Field label="Dirección" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
              {FICHAJE_HABILITADO && (
                <Field label="N° en el reloj" value={form.clock_pin} onChange={(v) => setForm((f) => ({ ...f, clock_pin: v }))} />
              )}
            </div>
          </FormSection>
          {formError && (
            <p role="alert" className="font-body-sm text-body-sm text-error">{formError}</p>
          )}
        </form>
      )}

      {staff && !deletion && !isEditing && (
        <section>
          <div className="list-title-bar flex items-center justify-between mb-md px-md py-sm rounded">
            <h3 className="font-label-md text-label-md uppercase tracking-wider">Datos de la Persona</h3>
            <div className="flex items-center gap-sm">
              <StatusChip label={ROLE_LABELS[staff.role]} tone={ROLE_TONE[staff.role]} variant="tag" />
              <StatusChip label={staff.active ? 'Activo' : 'Inactivo'} tone={staff.active ? 'success' : 'error'} variant="dot" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
            <DetailField label="Usuario" value={`@${staff.username}`} />
            <DetailField label="Nombre Completo" value={staff.full_name} />
            <DetailField label="Teléfono" value={staff.phone} />
            <DetailField label="Dirección" value={staff.address} />
            <DetailField label="Fecha de Registro" value={staff.registered_at ? formatDate(staff.registered_at) : null} />
            {FICHAJE_HABILITADO && <DetailField label="N° en el reloj" value={employee?.clock_pin} />}
          </div>
        </section>
      )}
    </Modal>
  )
}
