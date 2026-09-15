import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import StatusChip from '../../components/ui/StatusChip'
import { LOCATION_ERROR_LABELS, PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../../lib/constants'
import { addManualPunch, correctPunchTime, voidPunch } from '../../api/timePunches'
import { DAY_STATUS, DAY_TYPE_LABELS, PUNCH_ISSUE_LABELS } from './computeTimesheet'
import { getPunchFlags } from './punchFlags'
import { formatDistance, mapsUrl } from './geo'
import { formatMinutes, formatShortDayLabel, toTimeString, zonedToInstant } from './workTime'
import PunchCorrectionForm, { CORRECTION_MODE } from './PunchCorrectionForm'

const FORM_ID = 'punch-correction-form'

const TITLE_BY_MODE = {
  [CORRECTION_MODE.AGREGAR]: 'Agregar fichaje',
  [CORRECTION_MODE.CORREGIR]: 'Corregir hora',
  [CORRECTION_MODE.ANULAR]: 'Anular fichaje',
}

function HoursSummary({ day }) {
  const items = [
    { label: 'Trabajadas', value: day.workedMinutes },
    { label: 'Almuerzo descontado', value: day.lunchDiscountMinutes },
    { label: 'Normales', value: day.normalMinutes },
    { label: 'Al 50%', value: day.extra50Minutes },
    { label: 'Al 100%', value: day.extra100Minutes },
  ]
  return (
    <div className="space-y-xs">
      <dl className="grid grid-cols-2 md:grid-cols-5 gap-sm">
        {items.map((item) => (
          <div key={item.label} className="border border-outline-variant rounded-lg p-sm">
            <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">{item.label}</dt>
            <dd className="font-headline-md text-headline-md text-on-surface">{formatMinutes(item.value)}</dd>
          </div>
        ))}
      </dl>
      {day.paidHolidayMinutes > 0 && (
        <p className="font-body-sm text-body-sm text-secondary">
          Feriado pago: las horas normales incluyen {formatMinutes(day.paidHolidayMinutes)} por el feriado, se trabaje o no. Lo
          trabajado ese día se paga aparte, al 100%.
        </p>
      )}
    </div>
  )
}

function PunchItem({ punch, settings, canEdit, onCorrect, onVoid }) {
  const flags = getPunchFlags(punch, settings)
  const voided = Boolean(punch.voided_at)

  return (
    <li className="py-sm flex flex-col md:flex-row md:items-start md:justify-between gap-sm">
      <div className="space-y-xs">
        <p className={`font-label-md text-label-md text-on-surface ${voided || punch.ignored ? 'line-through text-on-surface-variant' : ''}`}>
          {toTimeString(new Date(punch.punched_at).getTime())} · {PUNCH_TYPE_LABELS[punch.resolvedType] ?? 'Sin tipo'}
          {!punch.punch_type && punch.resolvedType && <span className="font-body-sm text-body-sm text-on-surface-variant"> (inferido)</span>}
        </p>
        <div className="flex flex-wrap gap-xs">
          <StatusChip label={PUNCH_SOURCE_LABELS[punch.source]} tone="neutral" variant="tag" />
          {voided && <StatusChip label="Anulado" tone="error" variant="tag" />}
          {punch.ignored && <StatusChip label="Repetido (no cuenta)" tone="neutral" variant="tag" />}
          {flags.withoutLocation && <StatusChip label="Sin ubicación" tone="warning" variant="tag" />}
          {flags.offline && <StatusChip label="Registrado sin conexión" tone="warning" variant="tag" />}
          {flags.afterClose && <StatusChip label="Llegó con la semana cerrada" tone="warning" variant="tag" />}
          {flags.outOfRange && <StatusChip label={`Fichado fuera de rango · ${formatDistance(flags.range.distanceMeters)}`} tone="error" variant="tag" />}
        </div>
        {punch.latitude != null && punch.longitude != null && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <a href={mapsUrl(punch.latitude, punch.longitude)} target="_blank" rel="noopener noreferrer" className="text-secondary underline">
              Ver en mapa
            </a>
            {punch.accuracy_m != null && ` · precisión ±${Math.round(punch.accuracy_m)} m`}
          </p>
        )}
        {flags.withoutLocation && punch.location_error && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">{LOCATION_ERROR_LABELS[punch.location_error]}</p>
        )}
        {punch.reason && <p className="font-body-sm text-body-sm text-on-surface-variant">Motivo: {punch.reason}</p>}
        {voided && <p className="font-body-sm text-body-sm text-error">Anulado: {punch.void_reason}</p>}
      </div>

      {canEdit && !voided && (
        <div className="flex gap-sm shrink-0">
          <Button variant="secondary-outline" icon="schedule" onClick={() => onCorrect(punch)} disabled={!punch.resolvedType}>
            Corregir hora
          </Button>
          <Button variant="destructive-outline" icon="block" onClick={() => onVoid(punch)}>
            Anular
          </Button>
        </div>
      )}
    </li>
  )
}

// Detalle de un empleado en un dia: fichajes, horas y correcciones. La
// correccion se muestra dentro del mismo modal (no uno encima de otro).
export default function DayPunchesModal({ row, day, settings, weekClosed, actorId, onClose, onChanged }) {
  const [correction, setCorrection] = useState(null) // { mode, punch }
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function handleClose() {
    setCorrection(null)
    setErrorMessage('')
    onClose()
  }

  function startCorrection(mode, punch = null) {
    setErrorMessage('')
    setCorrection({ mode, punch })
  }

  async function handleSubmit({ punchType, time, reason }) {
    setSaving(true)
    setErrorMessage('')
    try {
      const punchedAt = time ? new Date(zonedToInstant(day.dateKey, time)).toISOString() : null
      if (correction.mode === CORRECTION_MODE.AGREGAR) {
        await addManualPunch({ employeeId: row.employeeId, punchType, punchedAt, reason, actorId })
      } else if (correction.mode === CORRECTION_MODE.CORREGIR) {
        await correctPunchTime({ punch: correction.punch, punchType, punchedAt, reason, actorId })
      } else {
        await voidPunch({ punchId: correction.punch.id, reason, actorId })
      }
      await onChanged()
      setCorrection(null)
    } catch (error) {
      setErrorMessage(error?.code === '23505' ? 'Ya existe un fichaje manual a esa hora.' : error?.message || 'No se pudo guardar la corrección.')
    } finally {
      setSaving(false)
    }
  }

  const open = Boolean(row && day)
  const canEdit = !weekClosed

  const actions = correction
    ? [
        { label: 'Volver', variant: 'secondary-outline', onClick: () => setCorrection(null), disabled: saving },
        { label: saving ? 'Guardando…' : 'Guardar', variant: 'primary', type: 'submit', form: FORM_ID, disabled: saving },
      ]
    : [{ label: 'Cerrar', variant: 'secondary-outline', onClick: handleClose }]

  const title = open ? `${row.fullName} · ${formatShortDayLabel(day.dateKey)}` : ''

  return (
    <Modal open={open} title={correction ? `${TITLE_BY_MODE[correction.mode]} · ${title}` : title} onClose={saving ? () => {} : handleClose} size="lg-auto" actions={actions}>
      {open && correction && (
        <div className="space-y-md">
          <PunchCorrectionForm
            key={`${correction.mode}-${correction.punch?.id ?? 'nuevo'}`}
            mode={correction.mode}
            punch={correction.punch}
            formId={FORM_ID}
            onSubmit={handleSubmit}
          />
          {errorMessage && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {open && !correction && (
        <div className="space-y-lg">
          <div className="flex flex-wrap items-center gap-sm">
            <StatusChip label={DAY_TYPE_LABELS[day.dayType]} tone="neutral" variant="tag" />
            {day.status === DAY_STATUS.INCOMPLETO && <StatusChip label="Fichaje incompleto" tone="error" variant="tag" />}
            {day.status === DAY_STATUS.EN_CURSO && <StatusChip label="Jornada en curso" tone="warning" variant="tag" />}
            {weekClosed && <StatusChip label="Semana cerrada" tone="neutral" variant="tag" />}
          </div>

          {day.issues.length > 0 && (
            <div role="alert" className="border border-error rounded-lg p-sm bg-error-container/40">
              <p className="font-label-md text-label-md text-on-error-container">Este día no suma horas hasta que se corrija:</p>
              <ul className="list-disc pl-lg font-body-sm text-body-sm text-on-error-container">
                {day.issues.map((issue) => (
                  <li key={`${issue.kind}-${issue.punchId}`}>
                    {PUNCH_ISSUE_LABELS[issue.kind]} ({toTimeString(issue.instant)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <HoursSummary day={day} />

          <section>
            <div className="list-title-bar flex items-center justify-between gap-sm mb-sm px-md py-sm rounded">
              <h3 className="font-label-md text-label-md uppercase tracking-wider">Fichajes</h3>
              {canEdit && (
                <Button variant="secondary-outline" icon="add" className="bg-surface-container-lowest" onClick={() => startCorrection(CORRECTION_MODE.AGREGAR)}>
                  Agregar fichaje
                </Button>
              )}
            </div>
            {day.punches.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Sin fichajes este día.</p>
            ) : (
              <ul className="divide-y divide-outline-variant/50">
                {day.punches.map((punch) => (
                  <PunchItem
                    key={punch.id}
                    punch={punch}
                    settings={settings}
                    canEdit={canEdit}
                    onCorrect={(selected) => startCorrection(CORRECTION_MODE.CORREGIR, selected)}
                    onVoid={(selected) => startCorrection(CORRECTION_MODE.ANULAR, selected)}
                  />
                ))}
              </ul>
            )}
            {weekClosed && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">
                La semana está cerrada. Para corregir fichajes, reabrila desde la pestaña Reporte.
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
