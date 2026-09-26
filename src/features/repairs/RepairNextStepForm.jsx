import { useState } from 'react'
import { saveRepairData } from '../../api/repairs'
import { formatDate } from '../../lib/dateUtils'
import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import StatusChip from '../../components/ui/StatusChip'
import RepairSection from './RepairSection'
import { getNextActionDueState } from './repairFormat'

// El pendiente del caso, para no perder el hilo: que falta hacer y para
// cuando. RepairDetailPanel lo monta con key del proximo paso guardado, asi
// despues de guardarlo o cumplirlo arranca con lo que quedo en la base.
export default function RepairNextStepForm({ repair, actorId, onChanged }) {
  const [text, setText] = useState(repair.next_action ?? '')
  const [due, setDue] = useState(repair.next_action_due ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dueState = getNextActionDueState(repair)
  const hasChanges = text.trim() !== (repair.next_action ?? '') || due !== (repair.next_action_due ?? '')

  async function save(changes, summary) {
    setSaving(true)
    setError(null)
    try {
      await saveRepairData(repair.id, changes, summary, actorId)
      await onChanged()
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el próximo paso.')
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextAction = text.trim() || null
    const nextDue = due || null
    if (!nextAction && nextDue) {
      setError('Escribí qué falta hacer antes de ponerle fecha.')
      return
    }
    const summary = nextAction
      ? `Próximo paso: ${nextAction}${nextDue ? ` (para el ${formatDate(nextDue)})` : ''}`
      : 'Próximo paso borrado'
    save({ next_action: nextAction, next_action_due: nextDue }, summary)
  }

  function handleComplete() {
    save({ next_action: null, next_action_due: null }, `Próximo paso cumplido: ${repair.next_action}`)
  }

  return (
    <RepairSection title="Próximo Paso">
      <form onSubmit={handleSubmit} className="space-y-sm">
        {dueState && <StatusChip label={dueState.label} tone={dueState.tone} />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
          <Field label="Qué falta hacer" value={text} onChange={setText} className="md:col-span-2" />
          <Field label="Para el" type="date" value={due} onChange={setDue} />
        </div>
        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-sm">
          {repair.next_action && (
            <Button variant="secondary-outline" icon="task_alt" disabled={saving} onClick={handleComplete}>
              Marcar como Hecho
            </Button>
          )}
          <Button type="submit" variant="primary" icon="save" disabled={saving || !hasChanges}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </RepairSection>
  )
}
