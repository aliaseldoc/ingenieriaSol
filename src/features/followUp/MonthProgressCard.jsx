import { MONTH_NAMES } from '../../lib/dateUtils'

function percentOf(value, total) {
  return total > 0 ? Math.min(100, (value / total) * 100) : 0
}

function FortnightBar({ title, value, total, caption, tone }) {
  return (
    <div className="flex-1 min-w-[22rem] bg-surface rounded-lg p-sm flex flex-col gap-xs">
      <p className="font-body-sm text-body-sm text-on-surface">
        <b>{title}</b> · {value} de {total} {caption}
      </p>
      <div className="h-[0.6rem] bg-surface-container rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentOf(value, total)}%` }} />
      </div>
    </div>
  )
}

// Visitas del mes contra la meta (ver monthProgress.js). La barra esta a escala:
// el ancho completo es la meta. En el mes en curso suma el pronostico (rayado),
// la marca de "esperado hoy" y la comparacion con el mes anterior; un mes que
// ya termino muestra solo lo que se hizo.
export default function MonthProgressCard({ progress, comparison = null }) {
  const { target, done, percentage, forecast, expected, fortnights, isCurrent } = progress
  const [year, month] = progress.monthKey.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const forecastPercentage = target > 0 && forecast !== null ? Math.round((forecast / target) * 100) : null

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm flex justify-between gap-sm">
        <span>Visitas del mes</span>
        <span>Meta {target}</span>
      </h2>
      <div className="p-md flex flex-col gap-md">
        <div className="flex flex-wrap items-end justify-between gap-sm">
          <p className="font-display-lg text-display-lg text-on-surface leading-none">
            {done}{' '}
            <span className="font-headline-md text-headline-md text-on-surface-variant">
              de {target} · {percentage}%
            </span>
          </p>
          {isCurrent && forecast !== null && (
            <dl className="border-l-4 border-secondary pl-sm">
              <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                Pronóstico al {lastDay}/{String(month).padStart(2, '0')}
              </dt>
              <dd className="font-body-lg text-body-lg font-bold text-on-surface">
                {forecast} · {forecastPercentage}%{' '}
                {forecast < target && (
                  <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">faltarían {target - forecast}</span>
                )}
              </dd>
            </dl>
          )}
          {!isCurrent && (
            <p className="font-label-md text-label-md uppercase text-on-surface-variant">
              Cierre de {MONTH_NAMES[month - 1].toLowerCase()}
            </p>
          )}
        </div>

        <div>
          <div className="relative h-[2.4rem] bg-surface-container rounded" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 bg-secondary rounded-l" style={{ width: `${percentOf(done, target)}%` }} />
            {isCurrent && forecast !== null && forecast > done && (
              <div
                className="absolute inset-y-0 border border-dashed border-secondary border-l-0 bg-[repeating-linear-gradient(135deg,var(--c-secondary-fixed)_0_0.5rem,transparent_0.5rem_1rem)]"
                style={{ left: `${percentOf(done, target)}%`, width: `${percentOf(forecast - done, target)}%` }}
              />
            )}
            {isCurrent && expected !== null && (
              <div className="absolute -inset-y-[0.4rem] w-[0.2rem] bg-on-surface" style={{ left: `${percentOf(expected, target)}%` }} />
            )}
          </div>
          <ul className="mt-sm flex flex-wrap gap-x-lg gap-y-xs font-label-sm text-label-sm text-on-surface-variant">
            <li className="flex items-center gap-xs">
              <span className="w-[1.2rem] h-[1.2rem] rounded-sm bg-secondary" /> Hechas {done}
            </li>
            {isCurrent && forecast !== null && (
              <li className="flex items-center gap-xs">
                <span className="w-[1.2rem] h-[1.2rem] rounded-sm border border-dashed border-secondary bg-[repeating-linear-gradient(135deg,var(--c-secondary-fixed)_0_0.3rem,transparent_0.3rem_0.6rem)]" />{' '}
                Pronóstico {forecast}
              </li>
            )}
            {isCurrent && expected !== null && (
              <li className="flex items-center gap-xs">
                <span className="w-[0.2rem] h-[1.4rem] bg-on-surface" /> Esperado hoy {expected}
              </li>
            )}
            <li className="ml-auto">Meta {target}</li>
          </ul>
        </div>

        {fortnights.total > 0 && (
          <div className="flex flex-wrap gap-sm">
            <FortnightBar title="1ª quincena" value={fortnights.firstDone} total={fortnights.total} caption="equipos visitados" tone="bg-secondary" />
            {/* En el mes en curso importa si esta planificada; cerrado, si se hizo. */}
            <FortnightBar
              title="2ª quincena"
              value={isCurrent ? fortnights.secondPlanned : fortnights.secondDone}
              total={fortnights.total}
              caption={isCurrent ? 'con visita planificada' : 'equipos visitados'}
              tone={isCurrent ? 'bg-warning' : 'bg-secondary'}
            />
          </div>
        )}

        {comparison && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {MONTH_NAMES[Number(comparison.monthKey.slice(5)) - 1]}, a esta altura: <b className="text-on-surface">{comparison.percentage}%</b>{' '}
            ({comparison.done} de {comparison.target})
          </p>
        )}
      </div>
    </section>
  )
}
