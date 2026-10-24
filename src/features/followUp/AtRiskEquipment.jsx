import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RISK } from './monthProgress'
import { formatDate } from '../../lib/dateUtils'
import EmptyState from '../../components/ui/EmptyState'

const VISIBLE_ROWS = 5

const ERROR_TONE = {
  band: 'bg-error-container text-on-error-container border-error',
  count: 'bg-error text-on-error',
}
const WARNING_TONE = {
  band: 'bg-warning-container text-on-warning-container border-warning',
  count: 'bg-warning text-on-warning',
}

const GROUPS = [
  { kind: RISK.OVERDUE, tone: ERROR_TONE, icon: 'event_busy', title: () => 'Visita que pasó sin hacerse' },
  { kind: RISK.FORTNIGHT_MISSED, tone: WARNING_TONE, icon: 'hourglass_bottom', title: () => 'Primera quincena sin visita' },
  {
    kind: RISK.NOT_PLANNED,
    tone: WARNING_TONE,
    icon: 'edit_calendar',
    title: (rows) => `${rows[0]?.fortnight === 1 ? 'Primera' : 'Segunda'} quincena sin planificar`,
  },
]

function RiskGroup({ group, rows, clientsPath, onPlan }) {
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) return null
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS)

  return (
    <div className="flex flex-col gap-xs">
      <h3 className={`flex items-center gap-sm rounded border-l-4 px-sm py-xs ${group.tone.band}`}>
        <span className="material-symbols-outlined text-[2.2rem]" aria-hidden="true">{group.icon}</span>
        <span className="font-headline-md text-[2rem] leading-[2.4rem]">{group.title(rows)}</span>
        <span className={`ml-auto font-label-md text-label-md rounded-full min-w-[2.8rem] px-xs py-[0.2rem] text-center ${group.tone.count}`}>
          {rows.length}
        </span>
      </h3>
      <ul className="divide-y divide-outline-variant/50">
        {visibleRows.map((row) => (
          <li key={row.item.id} className="flex items-center justify-between gap-sm py-xs">
            <span className="min-w-0 font-body-sm text-body-sm text-on-surface break-words">
              <Link
                to={`${clientsPath}?cliente=${row.item.client_id}`}
                className="hover:text-secondary hover:underline underline-offset-2"
              >
                {row.item.clients?.name} · {row.item.motor}
              </Link>
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
// calendario con el equipo ya elegido; el nombre lleva al detalle del cliente.
export default function AtRiskEquipment({ risk, clientsPath, onPlan }) {
  const total = GROUPS.reduce((sum, group) => sum + risk[group.kind].length, 0)

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm">
        Equipos en riesgo{total > 0 ? ` (${total})` : ''}
      </h2>
      {total === 0 ? (
        <EmptyState icon="task_alt" title="Ningún equipo en riesgo" description="Todos tienen su visita hecha o planificada." />
      ) : (
        <div className="p-md flex flex-col gap-lg">
          {GROUPS.map((group) => (
            <RiskGroup key={group.kind} group={group} rows={risk[group.kind]} clientsPath={clientsPath} onPlan={onPlan} />
          ))}
        </div>
      )}
    </section>
  )
}
