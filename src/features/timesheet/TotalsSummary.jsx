import { formatMinutes } from './workTime'

// Totales de la semana del propio empleado, en su pantalla de fichaje.
export default function TotalsSummary({ totals }) {
  const items = [
    { label: 'Normales', value: totals.normalMinutes },
    { label: 'Al 50%', value: totals.extra50Minutes },
    { label: 'Al 100%', value: totals.extra100Minutes },
    { label: 'Total', value: totals.totalMinutes },
  ]
  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-sm mb-md">
      {items.map((item) => (
        <div key={item.label} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-sm text-center">
          <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">{item.label}</dt>
          <dd className="font-headline-md text-headline-md text-on-surface">{formatMinutes(item.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
