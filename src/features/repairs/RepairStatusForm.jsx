import { useState } from 'react'
import { changeRepairStatus } from '../../api/repairs'
import { REPAIR_STATUS_DATE_FIELD, REPAIR_STATUS_LABELS } from '../../lib/constants'
import Button from '../../components/ui/Button'
import TextAreaField from '../../components/ui/TextAreaField'
import RepairSection from './RepairSection'
import { getRepairFieldLabel } from './repairFormat'

const SELECT_CLASSES =
  'w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all'

// RepairDetailPanel lo monta con key={repair.status}: despues de un cambio de
// estado arranca de cero, con el estado nuevo elegido y sin comentario.
export default function RepairStatusForm({ repair, actorId, onChanged }) {
  const [nextStatus, setNextStatus] = useState(repair.status)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isChanging = nextStatus !== repair.status
  const dateField = REPAIR_STATUS_DATE_FIELD[nextStatus]
  const fillsDate = isChanging && dateField && !repair[dateField]

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isChanging) return
    setSaving(true)
    setError(null)
    try {
      await changeRepairStatus(repair, nextStatus, comment, actorId)
      await onChanged()
    } catch (saveError) {
      setError(saveError.message || 'No se pudo cambiar el estado.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <RepairSection title="Estado">
      <form onSubmit={handleSubmit} className="space-y-sm">
        <div className="space-y-xs">
          <label htmlFor="repair-status" className="font-label-sm text-label-sm text-on-surface block">
            Estado del caso
          </label>
          <select
            id="repair-status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            className={SELECT_CLASSES}
          >
            {Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {isChanging && (
          <TextAreaField
            label="Comentario (opcional)"
            value={comment}
            onChange={setComment}
            rows={2}
            placeholder="Queda en la bitácora junto con el cambio de estado."
          />
        )}
        {fillsDate && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            &quot;{getRepairFieldLabel(dateField)}&quot; se completa con la fecha de hoy.
          </p>
        )}
        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon="sync_alt" disabled={saving || !isChanging}>
            {saving ? 'Guardando…' : 'Cambiar Estado'}
          </Button>
        </div>
      </form>
    </RepairSection>
  )
}
