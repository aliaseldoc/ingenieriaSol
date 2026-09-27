import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Field from '../../components/ui/Field'
import StatusChip from '../../components/ui/StatusChip'
import { replicateRouteSheets } from '../../api/routeSheets'
import { addMonths, businessDayOrdinalOfMonth, endOfMonth, nthBusinessDayOfMonth, toISODateString } from '../../lib/dateUtils'
import { getRouteSheetLabel } from '../../lib/visitColor'
import { isActiveClient } from '../../lib/constants'

// Los equipos de clientes inactivos no se replican: ya no se les da servicio.
function replicableVisits(routeSheet) {
  return (routeSheet.visits ?? []).filter((visit) => isActiveClient(visit.equipment?.clients))
}

function countSkippedVisits(routeSheets) {
  return routeSheets
    .filter((routeSheet) => routeSheet.scheduled_date)
    .reduce((total, routeSheet) => total + (routeSheet.visits ?? []).length - replicableVisits(routeSheet).length, 0)
}

function buildRows(routeSheets) {
  return routeSheets
    .filter((routeSheet) => routeSheet.scheduled_date && replicableVisits(routeSheet).length > 0)
    // listRouteSheetsInRange ordena por scheduled_time_start (hora), no por
    // fecha, asi que hojas de dias distintos pueden llegar mezcladas si una
    // tiene un horario mas temprano que otra de un dia anterior. Se reordena
    // por fecha (y hora como desempate) para que la secuencia de fechas
    // replicadas avance de forma prolija, sin alterar el orden cronologico.
    .slice()
    .sort((a, b) => {
      const dateDiff = a.scheduled_date.localeCompare(b.scheduled_date)
      if (dateDiff !== 0) return dateDiff
      return (a.scheduled_time_start ?? '').localeCompare(b.scheduled_time_start ?? '')
    })
    .map((routeSheet) => {
      // El criterio no es "mismo dia del mes, corrido si cae fin de
      // semana": es "mismo N-esimo dia habil del mes". Ej: el 3 de agosto
      // es el 1er dia habil de agosto (1 y 2 son sabado/domingo), asi que
      // replica al 1er dia habil de septiembre, no al "3 de septiembre".
      const source = new Date(`${routeSheet.scheduled_date}T00:00:00`)
      const ordinal = businessDayOrdinalOfMonth(source)
      const targetMonth = addMonths(source, 1)
      const adjusted = nthBusinessDayOfMonth(targetMonth, ordinal)
      const totalBusinessDaysInTargetMonth = businessDayOrdinalOfMonth(endOfMonth(targetMonth))
      const visits = replicableVisits(routeSheet)
      // La etiqueta se arma solo con lo que efectivamente se replica.
      const label = getRouteSheetLabel({ ...routeSheet, visits })

      return {
        routeSheetId: routeSheet.id,
        equipmentIds: visits.map((visit) => visit.equipment_id),
        serviceType: routeSheet.service_type,
        descripcion: routeSheet.descripcion,
        visitOccurrence: routeSheet.visit_occurrence,
        label,
        date: toISODateString(adjusted),
        wasClamped: ordinal > totalBusinessDaysInTargetMonth,
      }
    })
}

export default function ReplicatePlanModal({ open, routeSheets, createdBy, onClose, onReplicated }) {
  const [rows, setRows] = useState([])
  const [replicating, setReplicating] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(buildRows(routeSheets))
    setReplicating(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routeSheets])

  function updateRowDate(routeSheetId, date) {
    setRows((current) => current.map((row) => (row.routeSheetId === routeSheetId ? { ...row, date } : row)))
  }

  async function handleConfirm() {
    setReplicating(true)
    await replicateRouteSheets(rows, createdBy)
    setReplicating(false)
    onReplicated()
  }

  const skippedVisitCount = countSkippedVisits(routeSheets)

  return (
    <Modal
      open={open}
      title="Replicar Planificación al Mes Siguiente"
      onClose={replicating ? () => {} : onClose}
      size="lg"
      actions={[
        { label: 'Cancelar', variant: 'secondary-outline', onClick: onClose, disabled: replicating },
        {
          label: replicating ? 'Creando…' : 'Confirmar Replicación',
          variant: 'primary',
          onClick: handleConfirm,
          disabled: replicating || rows.length === 0,
        },
      ]}
    >
      {skippedVisitCount > 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
          Se omiten {skippedVisitCount} equipo(s) de clientes inactivos.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          No hay hojas de ruta con equipos en este mes para replicar.
        </p>
      ) : (
        <div className="space-y-md">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Se van a crear {rows.length} hoja(s) de ruta nuevas, sin técnico ni vehículo asignado. Revisá y ajustá las
            fechas propuestas antes de confirmar.
          </p>
          <div className="space-y-sm">
            {rows.map((row) => (
              <div
                key={row.routeSheetId}
                className="flex flex-col md:flex-row md:items-center gap-sm border border-outline-variant rounded-lg p-md"
              >
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-on-surface">{row.label}</p>
                  {row.wasClamped && (
                    <StatusChip label="Ajustada: el mes siguiente tiene menos días hábiles" tone="warning" variant="tag" />
                  )}
                </div>
                <Field
                  label="Fecha"
                  type="date"
                  value={row.date}
                  onChange={(value) => updateRowDate(row.routeSheetId, value)}
                  className="md:w-[18rem]"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
