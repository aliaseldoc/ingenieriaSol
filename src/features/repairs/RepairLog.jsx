import { useState } from 'react'
import { addRepairNote } from '../../api/repairs'
import { formatDateTime } from '../../lib/dateUtils'
import Button from '../../components/ui/Button'
import TextAreaField from '../../components/ui/TextAreaField'
import Timeline from '../../components/ui/Timeline'
import RepairSection from './RepairSection'
import { describeRepairEvent } from './repairFormat'

// Bitacora del caso: todo lo que paso (apertura, cambios de estado, datos que
// se cargaron y anotaciones), con quien y cuando. Debajo se agregan
// anotaciones libres.
export default function RepairLog({ events, repairId, actorId, onAdded }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const timelineEvents = (events ?? []).map((event) => ({
    id: event.id,
    label: describeRepairEvent(event),
    actor: event.profiles?.full_name ?? 'Sistema',
    timestamp: formatDateTime(event.created_at),
    notes: event.notes,
  }))

  async function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addRepairNote(repairId, text, actorId)
      setText('')
      await onAdded()
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la anotación.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <RepairSection title="Bitácora">
      {events ? (
        <Timeline events={timelineEvents} />
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Cargando bitácora…</p>
      )}
      <form onSubmit={handleSubmit} className="mt-md pt-md border-t border-outline-variant space-y-sm">
        <TextAreaField
          label="Nueva anotación"
          value={text}
          onChange={setText}
          rows={3}
          placeholder="Ej.: llamé a compras del hospital, piden el presupuesto con IVA discriminado."
        />
        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="secondary-outline" icon="edit_note" disabled={saving || !text.trim()}>
            {saving ? 'Guardando…' : 'Agregar Anotación'}
          </Button>
        </div>
      </form>
    </RepairSection>
  )
}
