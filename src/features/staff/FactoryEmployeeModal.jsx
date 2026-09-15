import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Field from '../../components/ui/Field'
import FormSection from '../../components/ui/FormSection'
import { createEmployee, describeEmployeeError, updateEmployee } from '../../api/employees'
import { normalizeClockPin } from '../timesheet/clockFileParser'

const FORM_ID = 'factory-employee-form'

function toFormValues(employee) {
  return {
    fullName: employee?.full_name ?? '',
    dni: employee?.dni ?? '',
    clockPin: employee?.clock_pin ?? '',
    phone: employee?.phone ?? '',
  }
}

// Alta y edicion de un empleado de fabrica: legajo sin usuario en la app,
// existe solo para el reloj y el reporte de horas (ver FICHAJE.md).
// Se monta al abrirse, asi el formulario arranca con los datos del empleado.
export default function FactoryEmployeeModal({ employee = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => toFormValues(employee))
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    const values = { ...form, fullName: form.fullName.trim(), clockPin: normalizeClockPin(form.clockPin) }
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          full_name: values.fullName,
          dni: values.dni.trim() || null,
          clock_pin: values.clockPin || null,
          phone: values.phone.trim() || null,
        })
      } else {
        await createEmployee(values)
      }
      await onSaved()
    } catch (error) {
      setErrorMessage(describeEmployeeError(error, 'No se pudo guardar el empleado.'))
      setSaving(false)
    }
  }

  function setField(field) {
    return (value) => setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <Modal
      open
      title={employee ? `Editar ${employee.full_name}` : 'Nuevo Empleado de Fábrica'}
      onClose={saving ? () => {} : onClose}
      actions={[
        { label: 'Cancelar', variant: 'secondary-outline', onClick: onClose, disabled: saving },
        { label: saving ? 'Guardando…' : 'Guardar Empleado', variant: 'primary', type: 'submit', form: FORM_ID, disabled: saving },
      ]}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-md">
        <FormSection title="Datos del Empleado">
          <div className="space-y-md">
            <Field label="Nombre Completo" value={form.fullName} onChange={setField('fullName')} required />
            <Field label="DNI" value={form.dni} onChange={setField('dni')} />
            <Field label="N° en el reloj" value={form.clockPin} onChange={setField('clockPin')} />
            <Field label="Teléfono" value={form.phone} onChange={setField('phone')} />
          </div>
        </FormSection>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          El N° en el reloj es el número de usuario con el que el empleado quedó registrado en el lector de huellas.
        </p>
        {errorMessage && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {errorMessage}
          </p>
        )}
      </form>
    </Modal>
  )
}
