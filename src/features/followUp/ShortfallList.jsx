import { useState } from 'react'
import EmptyState from '../../components/ui/EmptyState'

const VISIBLE_ROWS = 10

// Para un mes que ya termino: los equipos que no llegaron a su meta y cuantas
// visitas les faltaron (shortfall de monthProgress.js).
export default function ShortfallList({ shortfall }) {
  const [expanded, setExpanded] = useState(false)
  const visibleRows = expanded ? shortfall : shortfall.slice(0, VISIBLE_ROWS)

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm">
        Quedaron sin su visita{shortfall.length > 0 ? ` (${shortfall.length})` : ''}
      </h2>
      {shortfall.length === 0 ? (
        <EmptyState icon="task_alt" title="Todos los equipos tuvieron sus visitas" />
      ) : (
        <div className="p-md flex flex-col gap-xs">
          <ul className="divide-y divide-outline-variant/50">
            {visibleRows.map(({ item, missing }) => (
              <li key={item.id} className="flex items-center justify-between gap-sm py-xs">
                <span className="min-w-0 font-body-sm text-body-sm text-on-surface break-words">
                  {item.clients?.name} · {item.motor}
                </span>
                <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                  {missing === 1 ? 'faltó 1 visita' : `faltaron ${missing}`}
                </span>
              </li>
            ))}
          </ul>
          {shortfall.length > VISIBLE_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="self-start font-label-sm text-label-sm text-secondary hover:underline"
            >
              {expanded ? 'Ver menos' : `Ver los ${shortfall.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
