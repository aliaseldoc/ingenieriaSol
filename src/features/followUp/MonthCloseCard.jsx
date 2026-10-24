import Button from '../../components/ui/Button'
import { MONTH_NAMES } from '../../lib/dateUtils'

// Los primeros dias habiles del mes: como cerro el anterior, con acceso a su
// detalle (el mismo Seguimiento, en ese mes).
export default function MonthCloseCard({ progress, onShow }) {
  const monthName = MONTH_NAMES[Number(progress.monthKey.slice(5)) - 1].toLowerCase()
  const shortfallCount = progress.shortfall.length

  return (
    <section className="flex flex-wrap items-center justify-between gap-sm bg-secondary-fixed border border-secondary/40 rounded-lg px-md py-sm">
      <p className="font-body-md text-body-md text-on-secondary-fixed">
        <b>Cierre de {monthName}:</b> {progress.done} de {progress.target} ({progress.percentage}%)
        {shortfallCount > 0 &&
          ` · ${shortfallCount} ${shortfallCount === 1 ? 'equipo quedó' : 'equipos quedaron'} sin su visita`}
      </p>
      <Button variant="secondary-outline" icon="arrow_forward" onClick={onShow}>
        Ver cierre
      </Button>
    </section>
  )
}
