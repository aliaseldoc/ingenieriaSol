import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMyTimesheet } from '../../hooks/useMyTimesheet'
import { useConnectivityStatus } from '../../offline/useOfflineSync'
import { savePunchOrQueue } from '../../offline/punchQueue'
import { getCurrentLocation } from '../../features/timesheet/geolocation'
import { DAY_STATUS, DAY_TYPE, DAY_TYPE_LABELS, PUNCH_ISSUE_LABELS } from '../../features/timesheet/computeTimesheet'
import { getPunchFlags } from '../../features/timesheet/punchFlags'
import { currentWeekStartKey, formatMinutes, formatPunchDateTime, formatShortDayLabel, toTimeString } from '../../features/timesheet/workTime'
import WeekPicker from '../../features/timesheet/WeekPicker'
import {
  LOCATION_ERROR_LABELS,
  LOCATION_STATUS,
  PUNCH_SOURCE,
  PUNCH_SOURCE_LABELS,
  PUNCH_TYPE,
  PUNCH_TYPE_LABELS,
  TIMESHEET_RULES,
} from '../../lib/constants'
import Modal from '../../components/ui/Modal'
import StatusChip from '../../components/ui/StatusChip'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const MINUTE_MS = 60 * 1000

function punchInstant(punch) {
  return new Date(punch.punched_at).getTime()
}

// Aviso de posible duplicado: el ultimo fichaje por app del mismo tipo es
// de hace menos de TIMESHEET_RULES.duplicateWarningMinutes.
function hasRecentSamePunch(punches, punchType, now) {
  return punches.some(
    (punch) =>
      punch.source === PUNCH_SOURCE.APP &&
      !punch.voided_at &&
      punch.punch_type === punchType &&
      now - punchInstant(punch) >= 0 &&
      now - punchInstant(punch) < TIMESHEET_RULES.duplicateWarningMinutes * MINUTE_MS
  )
}

function LocationStatus({ location }) {
  if (!location) {
    return (
      <p className="flex items-center gap-xs font-body-md text-body-md text-on-surface-variant">
        <span className="material-symbols-outlined text-[2rem] animate-pulse">location_searching</span>
        Obteniendo ubicación…
      </p>
    )
  }
  if (location.status === LOCATION_STATUS.OK) {
    return (
      <p className="flex items-center gap-xs font-body-md text-body-md text-on-surface">
        <span className="material-symbols-outlined text-[2rem] text-secondary">location_on</span>
        Ubicación registrada (precisión ±{Math.round(location.accuracy)} m)
      </p>
    )
  }
  return (
    <p className="flex items-start gap-xs font-body-md text-body-md text-warning">
      <span className="material-symbols-outlined text-[2rem]">location_off</span>
      <span>
        Sin ubicación: {LOCATION_ERROR_LABELS[location.error]}. El fichaje se guarda igual y queda marcado para revisión del supervisor.
      </span>
    </p>
  )
}

function TotalsSummary({ totals }) {
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

function MyPunch({ punch }) {
  const flags = getPunchFlags(punch)
  const struck = Boolean(punch.voided_at) || punch.ignored
  return (
    <li className="flex flex-wrap items-center gap-xs py-xs">
      <span className={`font-label-md text-label-md text-on-surface ${struck ? 'line-through text-on-surface-variant' : ''}`}>
        {toTimeString(punchInstant(punch))} · {PUNCH_TYPE_LABELS[punch.resolvedType] ?? 'Sin tipo'}
      </span>
      <StatusChip label={PUNCH_SOURCE_LABELS[punch.source]} tone="neutral" variant="tag" />
      {punch.pending && <StatusChip label={punch.pendingError ? 'Error al sincronizar' : 'Sin sincronizar'} tone={punch.pendingError ? 'error' : 'warning'} variant="tag" />}
      {!punch.pending && flags.offline && <StatusChip label="Registrado sin conexión" tone="neutral" variant="tag" />}
      {flags.withoutLocation && <StatusChip label="Sin ubicación" tone="warning" variant="tag" />}
      {punch.voided_at && <StatusChip label="Anulado por el supervisor" tone="error" variant="tag" />}
      {flags.manual && <StatusChip label="Cargado por el supervisor" tone="neutral" variant="tag" />}
      {punch.ignored && <StatusChip label="Repetido (no cuenta)" tone="neutral" variant="tag" />}
    </li>
  )
}

function MyDay({ day }) {
  const hasHours = day.totalMinutes > 0
  return (
    <li className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <p className="font-label-md text-label-md text-on-surface">
          {formatShortDayLabel(day.dateKey)}
          {day.dayType !== DAY_TYPE.HABIL && <span className="text-on-surface-variant"> · {DAY_TYPE_LABELS[day.dayType]}</span>}
        </p>
        {day.status === DAY_STATUS.INCOMPLETO && <StatusChip label="Incompleto" tone="error" variant="tag" />}
        {day.status === DAY_STATUS.EN_CURSO && <StatusChip label="En curso" tone="warning" variant="tag" />}
        {(day.status === DAY_STATUS.OK || day.status === DAY_STATUS.SIN_FICHAJES) && hasHours && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Normales {formatMinutes(day.normalMinutes)}
            {day.paidHolidayMinutes > 0 && ' (feriado pago)'}
            {day.extra50Minutes > 0 && ` · 50% ${formatMinutes(day.extra50Minutes)}`}
            {day.extra100Minutes > 0 && ` · 100% ${formatMinutes(day.extra100Minutes)}`}
          </p>
        )}
      </div>
      {day.punches.length > 0 && (
        <ul className="mt-xs">
          {day.punches.map((punch) => (
            <MyPunch key={punch.id} punch={punch} />
          ))}
        </ul>
      )}
      {day.issues.length > 0 && (
        <p className="font-body-sm text-body-sm text-error mt-xs">
          {day.issues.map((issue) => PUNCH_ISSUE_LABELS[issue.kind]).join(' · ')}. Avisá al supervisor para que lo corrija.
        </p>
      )}
    </li>
  )
}

export default function PunchPage() {
  const { profile } = useAuth()
  const online = useConnectivityStatus()
  const [weekStartKey, setWeekStartKey] = useState(() => currentWeekStartKey())
  const { employee, loadingEmployee, loadingWeek, fromCache, cachedAt, allPunches, days, totals, reloadWeek } = useMyTimesheet(profile?.id, weekStartKey)
  const [draft, setDraft] = useState(null) // { punchType, startedAt, location }
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { error, text }

  function startPunch(punchType) {
    const startedAt = Date.now()
    setMessage(null)
    setDraft({ punchType, startedAt, location: null })
    // El modal se abre enseguida; la ubicacion llega cuando el GPS responde.
    getCurrentLocation().then((location) => {
      setDraft((current) => (current?.startedAt === startedAt ? { ...current, location } : current))
    })
  }

  async function confirmPunch() {
    const { punchType, location } = draft
    const now = new Date()
    const punch = {
      id: crypto.randomUUID(),
      employee_id: employee.id,
      source: PUNCH_SOURCE.APP,
      punch_type: punchType,
      punched_at: now.toISOString(),
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      accuracy_m: location.accuracy ?? null,
      location_status: location.status,
      location_error: location.error ?? null,
      created_by: profile.id,
    }
    setSaving(true)
    try {
      const { queued } = await savePunchOrQueue(punch)
      const label = PUNCH_TYPE_LABELS[punchType]
      setMessage({
        error: false,
        text: queued
          ? `${label} guardada sin conexión a las ${toTimeString(now.getTime())}. Se envía sola al recuperar la señal.`
          : `${label} registrada a las ${toTimeString(now.getTime())}.`,
      })
      if (weekStartKey !== currentWeekStartKey()) setWeekStartKey(currentWeekStartKey())
      else if (!queued) reloadWeek()
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudo registrar el fichaje.' })
    } finally {
      setSaving(false)
      setDraft(null)
    }
  }

  if (loadingEmployee) return <Spinner label="Cargando tu legajo…" />

  if (!employee) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
        <EmptyState
          icon="badge"
          title="Tu usuario no tiene legajo de fichaje"
          description="Pedile al supervisor que lo configure. Si estás sin conexión, abrí esta pantalla una vez con señal para descargarlo."
        />
      </div>
    )
  }

  const duplicateWarning = draft && hasRecentSamePunch(allPunches, draft.punchType, draft.startedAt)

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Fichaje</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Registrá tu entrada y tu salida cuando empezás o terminás la jornada fuera de la fábrica.
      </p>

      <div className="grid grid-cols-2 gap-md mb-sm">
        <button
          type="button"
          onClick={() => startPunch(PUNCH_TYPE.ENTRADA)}
          disabled={saving}
          className="flex flex-col items-center justify-center gap-xs min-h-[12rem] rounded-lg bg-secondary text-on-secondary shadow-elevation-1 hover:bg-secondary-container transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[4rem]">login</span>
          <span className="font-label-md text-label-md uppercase tracking-wider">Registrar entrada</span>
        </button>
        <button
          type="button"
          onClick={() => startPunch(PUNCH_TYPE.SALIDA)}
          disabled={saving}
          className="flex flex-col items-center justify-center gap-xs min-h-[12rem] rounded-lg bg-primary-container text-on-primary shadow-elevation-1 hover:bg-primary transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[4rem]">logout</span>
          <span className="font-label-md text-label-md uppercase tracking-wider">Registrar salida</span>
        </button>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
        Los fichajes del reloj de fábrica aparecen cuando el supervisor importa el archivo.
      </p>

      {message && (
        <p role="status" className={`font-body-md text-body-md mb-md ${message.error ? 'text-error' : 'text-secondary'}`}>
          {message.text}
        </p>
      )}

      <section className="mt-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-sm mb-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Mis fichajes</h2>
          <WeekPicker weekStartKey={weekStartKey} onChange={setWeekStartKey} disabled={!online} />
        </div>

        {fromCache && (
          <p className="font-body-sm text-body-sm text-warning mb-sm">
            Sin conexión: {cachedAt ? `se muestra lo descargado el ${formatPunchDateTime(new Date(cachedAt).getTime())}` : 'no hay datos descargados de esta semana'}.
          </p>
        )}

        {loadingWeek ? (
          <Spinner label="Cargando tus fichajes…" />
        ) : (
          <>
            <TotalsSummary totals={totals} />
            <ul className="space-y-sm">
              {days.map((day) => (
                <MyDay key={day.dateKey} day={day} />
              ))}
            </ul>
          </>
        )}
      </section>

      <Modal
        open={Boolean(draft)}
        title={draft ? `Registrar ${PUNCH_TYPE_LABELS[draft.punchType].toLowerCase()}` : ''}
        onClose={saving ? () => {} : () => setDraft(null)}
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: () => setDraft(null), disabled: saving },
          {
            label: saving ? 'Guardando…' : `Confirmar ${draft ? PUNCH_TYPE_LABELS[draft.punchType].toLowerCase() : ''}`,
            variant: 'primary',
            onClick: confirmPunch,
            disabled: saving || !draft?.location,
          },
        ]}
      >
        {draft && (
          <div className="space-y-md">
            <dl className="grid grid-cols-2 gap-sm">
              <div>
                <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tipo</dt>
                <dd className="font-headline-md text-headline-md text-on-surface">{PUNCH_TYPE_LABELS[draft.punchType]}</dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">Hora</dt>
                <dd className="font-headline-md text-headline-md text-on-surface">{toTimeString(draft.startedAt)}</dd>
              </div>
            </dl>
            <LocationStatus location={draft.location} />
            {!online && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Estás sin conexión: el fichaje se guarda en el celular con esta hora y se envía solo al recuperar la señal.
              </p>
            )}
            {duplicateWarning && (
              <p role="alert" className="font-body-sm text-body-sm text-warning">
                Ya registraste una {PUNCH_TYPE_LABELS[draft.punchType].toLowerCase()} hace menos de {TIMESHEET_RULES.duplicateWarningMinutes} minutos.
                ¿Seguro que querés registrar otra?
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
