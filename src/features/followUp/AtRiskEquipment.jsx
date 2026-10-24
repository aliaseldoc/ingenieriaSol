import { useState } from 'react'
import { RISK } from './monthProgress'
import { formatDate } from '../../lib/dateUtils'
import EmptyState from '../../components/ui/EmptyState'

const VISIBLE_ROWS = 5

const GROUPS = [
  { kind: RISK.OVERDUE, tone: 'bg-error-container text-on-error-container', title: () => 'Visita que pasó sin hacerse' },
  { kind: RISK.FORTNIGHT_MISSED, tone: 'bg-warning-container text-on-warning-container', title: () => 'Primera quincena sin visita' },
  {
    kind: RISK.NOT_PLANNED,
    tone: 'bg-warning-container text-on-warning-container',
    title: (rows) => `${rows[0]?.fortnight === 1 ? 'Primera' : 'Segunda'} quincena sin planificar`,
  },
]

function RiskGroup({ group, rows, onPlan }) {
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) return null
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS)

  return (
    <div className="flex flex-col gap-xs">
      <p className="flex items-center gap-sm font-label-md text-label-md text-on-surface">
        <span className={`font-label-sm text-label-sm rounded px-xs ${group.tone}`}>{rows.length}</span>
        {group.title(rows)}
      </p>
      <ul className="divide-y divide-outline-variant/50 border-t border-outline-variant/50">
        {visibleRows.map((row) => (
          <li key={row.item.id} className="flex items-center justify-between gap-sm py-xs">
            <span className="min-w-0 font-body-sm text-body-sm text-on-surface break-words">
              {row.item.clients?.name} · {row.item.motor}
              {row.visit && <span className="text-on-surface-variant"> · era el {formatDate(row.visit.scheduled_date)}</span>}
              {row.item.monthly_visits === 1 && <span className="text-on-surface-variant"> · 1 visita por mes</span>}
            </span>
            <button
              type="button"
              onClick={() => onPlan(row)}
              className="shrink-0 font-label-sm text-label-sm uppercase tracking-wide text-secondary border border-secondary rounded px-sm py-xs hover:bg-secondary-fixed transition-colors"
            >
              Planificar
            </button>
          </li>
        ))}
      </ul>
      {rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-start font-label-sm text-label-sm text-secondary hover:underline"
        >
          {expanded ? 'Ver menos' : `Ver los ${rows.length}`}
        </button>
      )}
    </div>
  )
}

// Los equipos que no van a llegar a su meta del mes, en tres listas de la mas
// urgente a la menos urgente (ver monthProgress.js). "Planificar" lleva al
// calendario con el equipo ya elegido.
export default function AtRiskEquipment({ risk, onPlan }) {
  const total = GROUPS.reduce((sum, group) => sum + risk[group.kind].length, 0)

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm">
        Equipos en riesgo{total > 0 ? ` (${total})` : ''}
      </h2>
      {total === 0 ? (
        <EmptyState icon="task_alt" title="Ningún equipo en riesgo" description="Todos tienen su visita hecha o planificada." />
      ) : (
        <div className="p-md flex flex-col gap-md">
          {GROUPS.map((group) => (
            <RiskGroup key={group.kind} group={group} rows={risk[group.kind]} onPlan={onPlan} />
          ))}
        </div>
      )}
    </section>
  )
}
