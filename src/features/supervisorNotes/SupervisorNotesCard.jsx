import { formatDateTime } from '../../lib/dateUtils'
import StatusChip from '../../components/ui/StatusChip'

// Notas del supervisor sobre esta visita, destacadas arriba de lo que ve el
// tecnico, de la mas nueva a la mas vieja. Las que no habia leido al abrir la
// visita llevan la etiqueta "Nueva".
export default function SupervisorNotesCard({ notes, newNoteIds }) {
  if (notes.length === 0) return null

  return (
    <section className="border border-secondary rounded-lg bg-secondary-fixed p-md">
      <h2 className="font-body-lg text-body-lg text-on-secondary-fixed uppercase mb-sm flex items-center gap-xs">
        <span className="material-symbols-outlined text-[2rem]">chat</span>
        Notas del Supervisor
      </h2>
      <ul className="space-y-sm">
        {notes.map((note) => (
          <li key={note.id} className="bg-surface-container-lowest border border-outline-variant rounded p-sm">
            <div className="flex items-center justify-between gap-sm mb-xs">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {note.profiles?.full_name ?? 'Supervisor'} · {formatDateTime(note.created_at)}
              </p>
              {newNoteIds.has(note.id) && <StatusChip label="Nueva" tone="error" variant="tag" />}
            </div>
            <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{note.notes}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
