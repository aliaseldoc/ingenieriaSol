import { useCallback, useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import FormSection from '../../components/ui/FormSection'
import Spinner from '../../components/ui/Spinner'
import StatusChip from '../../components/ui/StatusChip'
import {
  createClockDevice,
  describeClockDeviceError,
  listClockDeviceEvents,
  listClockDevices,
  listPendingPunches,
  reprocessClockPunches,
  updateClockDevice,
} from '../../api/clockDevices'
import {
  CLOCK_DRIFT_WARNING_SECONDS,
  CLOCK_EVENT_KIND_LABELS,
  CLOCK_OFFLINE_MINUTES,
  CLOCK_PUSH_SERVER,
  PENDING_PUNCH_REASON_LABELS,
} from '../../lib/constants'
import { formatPunchDateTime } from './workTime'

function minutesSince(value) {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 60000)
}

function formatAgo(minutes) {
  if (minutes === null) return 'nunca'
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

function connectionState(device) {
  const minutes = minutesSince(device.last_seen_at)
  if (minutes === null) return { label: 'Nunca se comunicó', tone: 'warning' }
  if (minutes > CLOCK_OFFLINE_MINUTES) return { label: `Sin contacto ${formatAgo(minutes)}`, tone: 'error' }
  return { label: `Conectado, ${formatAgo(minutes)}`, tone: 'success' }
}

// El reloj manda su propia hora: si se corrió, todos los fichajes entran
// corridos. Se avisa para corregirlo en el equipo.
function driftNotice(device) {
  const seconds = device.clock_offset_seconds
  if (seconds === null || seconds === undefined) return null
  if (Math.abs(seconds) < CLOCK_DRIFT_WARNING_SECONDS) return null
  const minutes = Math.round(Math.abs(seconds) / 60)
  return `La hora del reloj está ${minutes} min ${seconds > 0 ? 'adelantada' : 'atrasada'}: corregila en el equipo.`
}

function describeEvent(event) {
  const detail = event.detail ?? {}
  if (event.kind === 'fichajes') {
    const parts = [`${detail.nuevos ?? 0} nuevos`]
    if (detail.repetidos) parts.push(`${detail.repetidos} repetidos`)
    if (detail.sin_legajo) parts.push(`${detail.sin_legajo} sin legajo`)
    if (detail.semana_cerrada) parts.push(`${detail.semana_cerrada} de semana cerrada`)
    if (detail.invalidas) parts.push(`${detail.invalidas} ilegibles`)
    return parts.join(' · ')
  }
  if (event.kind === 'rechazo') return detail.motivo ?? 'Rechazado'
  return 'El reloj se comunicó'
}

// Pestaña "Reloj": alta de los equipos que fichan por WiFi, su estado y los
// fichajes que llegaron pero todavia no se pudieron guardar.
export default function ClockDevicesSection({ actorId, onChanged }) {
  const [state, setState] = useState({ loading: true, devices: [], pending: [], events: [] })
  const [form, setForm] = useState({ name: '', serialNumber: '' })
  const [saving, setSaving] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [message, setMessage] = useState(null) // { error, text }

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }))
    try {
      const [devices, pending, events] = await Promise.all([
        listClockDevices(),
        listPendingPunches(),
        listClockDeviceEvents(),
      ])
      setState({ loading: false, devices, pending, events })
    } catch (error) {
      setState({ loading: false, devices: [], pending: [], events: [] })
      setMessage({ error: true, text: error?.message || 'No se pudieron cargar los relojes.' })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(event) {
    event.preventDefault()
    const name = form.name.trim()
    const serialNumber = form.serialNumber.trim()
    if (!name || !serialNumber) {
      setMessage({ error: true, text: 'Completá el nombre y el número de serie del reloj.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await createClockDevice({ name, serialNumber }, actorId)
      setForm({ name: '', serialNumber: '' })
      setMessage({ error: false, text: 'Reloj dado de alta. En cuanto se comunique, sus fichajes entran solos.' })
      await load()
    } catch (error) {
      setMessage({ error: true, text: describeClockDeviceError(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(device) {
    setMessage(null)
    try {
      await updateClockDevice(device.id, { active: !device.active })
      await load()
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudo cambiar el estado del reloj.' })
    }
  }

  async function handleReprocess() {
    setReprocessing(true)
    setMessage(null)
    try {
      const claimed = await reprocessClockPunches()
      setMessage({
        error: false,
        text: claimed > 0 ? `Entraron ${claimed} fichajes que estaban en espera.` : 'No hay fichajes en espera que se puedan guardar todavía.',
      })
      await load()
      if (claimed > 0) await onChanged?.()
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudieron reprocesar los fichajes.' })
    } finally {
      setReprocessing(false)
    }
  }

  const pendingByReason = state.pending.reduce((counts, punch) => {
    counts[punch.reason] = (counts[punch.reason] ?? 0) + 1
    return counts
  }, {})

  return (
    <div className="max-w-[80rem] space-y-lg">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md md:p-xl space-y-lg">
        <FormSection title="Cómo se conecta el reloj">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            En el equipo: <strong>Menú → Comunicación → Servidor en la nube (ADMS)</strong>. Se carga solo el dominio, sin barras ni
            rutas: el reloj arma el resto por su cuenta.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <div>
              <dt className="font-label-sm text-label-sm text-on-surface-variant">Dirección del servidor</dt>
              <dd className="font-body-md text-body-md text-on-surface break-all">{CLOCK_PUSH_SERVER.host}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-label-sm text-on-surface-variant">Puerto</dt>
              <dd className="font-body-md text-body-md text-on-surface">{CLOCK_PUSH_SERVER.port}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-label-sm text-on-surface-variant">Conexión segura (HTTPS)</dt>
              <dd className="font-body-md text-body-md text-on-surface">{CLOCK_PUSH_SERVER.https ? 'Activada' : 'Desactivada'}</dd>
            </div>
          </dl>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            La importación por archivo sigue disponible: si el reloj se queda sin red, se bajan los registros con el pendrive y los
            repetidos se descartan solos.
          </p>
        </FormSection>

        <form onSubmit={handleSubmit} className="space-y-md">
          <FormSection title="Dar de alta un reloj">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              El número de serie figura en la etiqueta del equipo y en <strong>Menú → Sistema → Información</strong>. Hasta que no esté
              cargado acá, el servidor no le acepta fichajes: el reloj los guarda y los vuelve a mandar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field
                label="Nombre"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="Reloj de la entrada"
              />
              <Field
                label="Número de serie"
                value={form.serialNumber}
                onChange={(value) => setForm((current) => ({ ...current, serialNumber: value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" icon="add" disabled={saving}>
                {saving ? 'Guardando…' : 'Agregar reloj'}
              </Button>
            </div>
          </FormSection>
        </form>

        {message && (
          <p role="alert" className={`font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-secondary'}`}>
            {message.text}
          </p>
        )}
      </div>

      {state.loading ? (
        <Spinner />
      ) : (
        <>
          <section className="space-y-md">
            <h3 className="font-title-md text-title-md text-on-surface">Relojes</h3>
            {state.devices.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
                <EmptyState
                  icon="schedule"
                  title="Todavía no hay relojes"
                  description="Cargá el número de serie del equipo para que empiece a mandar los fichajes."
                />
              </div>
            ) : (
              <ul className="space-y-md">
                {state.devices.map((device) => {
                  const connection = connectionState(device)
                  const drift = driftNotice(device)
                  return (
                    <li key={device.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md space-y-sm">
                      <div className="flex flex-wrap items-center justify-between gap-sm">
                        <div className="space-y-xs">
                          <p className="font-title-sm text-title-sm text-on-surface">{device.name}</p>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">N° de serie {device.serial_number}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-sm">
                          <StatusChip label={connection.label} tone={device.active ? connection.tone : 'neutral'} />
                          {!device.active && <StatusChip label="Desactivado" tone="neutral" variant="tag" />}
                          <Button variant="secondary-outline" onClick={() => handleToggleActive(device)}>
                            {device.active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 md:grid-cols-4 gap-sm font-body-sm text-body-sm text-on-surface-variant">
                        <div>
                          <dt className="font-label-sm text-label-sm">Fichajes guardados</dt>
                          <dd className="text-on-surface">{device.punches_received}</dd>
                        </div>
                        <div>
                          <dt className="font-label-sm text-label-sm">Último fichaje</dt>
                          <dd className="text-on-surface">
                            {device.last_push_at ? formatPunchDateTime(new Date(device.last_push_at).getTime()) : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-label-sm text-label-sm">Último contacto</dt>
                          <dd className="text-on-surface">
                            {device.last_seen_at ? formatPunchDateTime(new Date(device.last_seen_at).getTime()) : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-label-sm text-label-sm">Dirección de red</dt>
                          <dd className="text-on-surface break-all">{device.last_ip ?? '—'}</dd>
                        </div>
                      </dl>
                      {drift && <p className="font-body-sm text-body-sm text-error">{drift}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {state.pending.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md space-y-md">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <div className="space-y-xs">
                  <h3 className="font-title-md text-title-md text-on-surface">Fichajes en espera</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Llegaron del reloj pero todavía no se pueden guardar. No se pierden: entran solos cuando se carga el N° en el
                    legajo o se reabre la semana.
                  </p>
                </div>
                <Button variant="secondary-outline" icon="refresh" onClick={handleReprocess} disabled={reprocessing}>
                  {reprocessing ? 'Reprocesando…' : 'Reprocesar'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-sm">
                {Object.entries(pendingByReason).map(([reason, count]) => (
                  <StatusChip key={reason} label={`${PENDING_PUNCH_REASON_LABELS[reason] ?? reason}: ${count}`} tone="warning" />
                ))}
              </div>
              <div className="overflow-x-auto scrollbar-styled">
                <table className="w-full min-w-[40rem] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="font-label-md text-label-md text-on-surface-variant uppercase py-sm px-sm">N° en el reloj</th>
                      <th className="font-label-md text-label-md text-on-surface-variant uppercase py-sm px-sm">Fecha y hora</th>
                      <th className="font-label-md text-label-md text-on-surface-variant uppercase py-sm px-sm">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.pending.map((punch) => (
                      <tr key={punch.id} className="border-b border-outline-variant/50">
                        <td className="font-body-md text-body-md text-on-surface py-sm px-sm">{punch.clock_pin}</td>
                        <td className="font-body-md text-body-md text-on-surface py-sm px-sm">
                          {formatPunchDateTime(new Date(punch.punched_at).getTime())}
                        </td>
                        <td className="font-body-md text-body-md text-on-surface py-sm px-sm">
                          {PENDING_PUNCH_REASON_LABELS[punch.reason] ?? punch.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {state.events.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md space-y-sm">
              <h3 className="font-title-md text-title-md text-on-surface">Últimos movimientos</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Sirve para la puesta en marcha: acá se ve si el reloj llegó a comunicarse y qué mandó.
              </p>
              <ul className="divide-y divide-outline-variant/50">
                {state.events.map((event) => (
                  <li key={event.id} className="py-sm flex flex-wrap items-baseline justify-between gap-sm">
                    <span className="font-body-md text-body-md text-on-surface">
                      {CLOCK_EVENT_KIND_LABELS[event.kind] ?? event.kind}: {describeEvent(event)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {event.serial_number ?? '—'} · {formatPunchDateTime(new Date(event.created_at).getTime())}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
