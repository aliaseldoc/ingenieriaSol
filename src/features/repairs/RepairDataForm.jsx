import { useState } from 'react'
import { saveRepairData } from '../../api/repairs'
import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import TextAreaField from '../../components/ui/TextAreaField'
import RepairSection from './RepairSection'
import { REPAIR_DATA_FIELDS, describeRepairChanges, getRepairChanges, toFormValue } from './repairFormat'

const DESCRIPTION_FIELD = REPAIR_DATA_FIELDS.find((field) => field.type === 'textarea')
const INPUT_FIELDS = REPAIR_DATA_FIELDS.filter((field) => field.type !== 'textarea')

export default function RepairDataForm({ repair, actorId, onChanged }) {
  // Solo los campos que se tocaron; el resto muestra siempre lo guardado. Asi
  // una fecha que completo un cambio de estado aparece sola, sin pisar lo que
  // se este editando.
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const changes = getRepairChanges(repair, edits)
  const hasChanges = Object.keys(changes).length > 0

  function valueOf(field) {
    return field.key in edits ? edits[field.key] : toFormValue(repair[field.key])
  }

  function handleChange(key, value) {
    setEdits((current) => ({ ...current, [key]: value }))
    setMessage(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!hasChanges) return
    if ('description' in changes && !changes.description) {
      setMessage({ error: true, text: 'El trabajo a realizar no puede quedar vacío.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await saveRepairData(repair.id, changes, describeRepairChanges(changes), actorId)
      await onChanged()
      setEdits({})
      setMessage({ error: false, text: 'Cambios guardados.' })
    } catch (saveError) {
      setMessage({ error: true, text: saveError.message || 'No se pudieron guardar los cambios.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <RepairSection title="Presupuesto y Seguimiento">
      <form onSubmit={handleSubmit} className="space-y-md">
        <TextAreaField
          label={DESCRIPTION_FIELD.label}
          value={valueOf(DESCRIPTION_FIELD)}
          onChange={(value) => handleChange(DESCRIPTION_FIELD.key, value)}
          rows={3}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {INPUT_FIELDS.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              type={field.type}
              value={valueOf(field)}
              onChange={(value) => handleChange(field.key, value)}
              {...(field.type === 'number' ? { step: '0.01', min: '0' } : {})}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-sm">
          {message && (
            <p role="alert" className={`flex-1 font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-tertiary-fixed-dim'}`}>
              {message.text}
            </p>
          )}
          <Button type="submit" variant="primary" icon="save" disabled={saving || !hasChanges}>
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </RepairSection>
  )
}
