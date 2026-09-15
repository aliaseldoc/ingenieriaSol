import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createStaffMember } from '../../api/staff'
import { describeEmployeeError, isClockPinTaken, setClockPinForUsername } from '../../api/employees'
import { ROLES, ROLE_LABELS } from '../../lib/constants'
import { toISODateString } from '../../lib/dateUtils'
import { normalizeClockPin } from '../../features/timesheet/clockFileParser'
import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import FormSection from '../../components/ui/FormSection'

function emptyForm() {
  return {
    username: '',
    fullName: '',
    role: ROLES.TECNICO,
    password: '',
    phone: '',
    address: '',
    registeredAt: toISODateString(new Date()),
    clockPin: '',
  }
}

export default function StaffNewPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitting(true)
    const clockPin = normalizeClockPin(form.clockPin)
    try {
      // Se valida antes de crear la cuenta: despues ya no se puede deshacer.
      if (clockPin && (await isClockPinTaken(clockPin))) {
        setErrorMessage('Ya existe un empleado con ese N° en el reloj.')
        return
      }
      await createStaffMember(form)
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo crear el usuario.')
      return
    } finally {
      setSubmitting(false)
    }

    // El legajo lo crea la base junto con el perfil; aca solo se le carga el N° del reloj.
    if (clockPin) {
      try {
        await setClockPinForUsername(form.username, clockPin)
      } catch (error) {
        setErrorMessage(
          `La cuenta se creó, pero no se pudo guardar el N° en el reloj (${describeEmployeeError(error, 'error desconocido')}). Cargalo desde el detalle del personal.`
        )
        return
      }
    }
    navigate('/supervisor/personal', { replace: true })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Dar de Alta Personal</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Creá una cuenta nueva para un administrativo, técnico o supervisor.
      </p>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md md:p-xl">
        <form onSubmit={handleSubmit} className="space-y-xl">
          <FormSection title="Datos de la Cuenta">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field
                label="Usuario"
                value={form.username}
                onChange={(value) => setForm((f) => ({ ...f, username: value }))}
                required
              />
              <Field
                label="Nombre Completo"
                value={form.fullName}
                onChange={(value) => setForm((f) => ({ ...f, fullName: value }))}
                required
              />
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
              <Field
                label="Contraseña Temporal"
                type="password"
                value={form.password}
                onChange={(value) => setForm((f) => ({ ...f, password: value }))}
                required
              />
              <Field
                label="Teléfono"
                value={form.phone}
                onChange={(value) => setForm((f) => ({ ...f, phone: value }))}
              />
              <Field
                label="Dirección"
                value={form.address}
                onChange={(value) => setForm((f) => ({ ...f, address: value }))}
              />
              <Field
                label="Fecha de Registro"
                type="date"
                value={form.registeredAt}
                onChange={(value) => setForm((f) => ({ ...f, registeredAt: value }))}
                required
              />
              <Field
                label="N° en el reloj"
                value={form.clockPin}
                onChange={(value) => setForm((f) => ({ ...f, clockPin: value }))}
              />
            </div>
          </FormSection>

          {errorMessage && (
            <p role="alert" className="font-body-sm text-body-sm text-error">{errorMessage}</p>
          )}

          <div className="flex justify-end gap-sm">
            <Button type="button" variant="secondary-outline" onClick={() => navigate('/supervisor/personal')}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear Cuenta'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
