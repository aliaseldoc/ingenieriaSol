import { useCallback, useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import StatusChip from '../../components/ui/StatusChip'
import { markHolidays } from '../../api/holidays'
import { listTimesheetWeeks } from '../../api/timesheetWeeks'
import { TIMESHEET_WEEK_STATUS } from '../../lib/constants'
import { fetchOfficialHolidays, HOLIDAY_KIND_LABELS } from './officialHolidays'
import { formatShortDayLabel, weekStartOfKey } from './workTime'

const ESTADO_INICIAL = { loading: true, error: null, items: [], closedWeeks: new Set() }

// Los feriados del calendario oficial, para revisar y confirmar. Nunca se
// marca nada solo: son horas que se pagan, asi que la ultima palabra es del
// supervisor.
export default function OfficialHolidaysModal({ open, year, existingKeys, onClose, onSaved }) {
  const [selectedYear, setSelectedYear] = useState(year)
  const [state, setState] = useState(ESTADO_INICIAL)
  const [selected, setSelected] = useState(() => new Set())
  const [loaded, setLoaded] = useState(() => new Set()) // los que se cargaron en esta pasada
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { error, text }

  useEffect(() => {
    if (open) setSelectedYear(year)
  }, [open, year])

  const yaCargado = useCallback(
    (dateKey) => existingKeys.has(dateKey) || loaded.has(dateKey),
    [existingKeys, loaded]
  )

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    let vigente = true

    async function cargar() {
      setState(ESTADO_INICIAL)
      setMessage(null)
      try {
        const items = await fetchOfficialHolidays(selectedYear, { signal: controller.signal })
        const weekStarts = [...new Set(items.map((item) => weekStartOfKey(item.dateKey)))]
        const weeks = await listTimesheetWeeks(weekStarts)
        if (!vigente) return

        const closedWeeks = new Set(
          weeks.filter((week) => week.status === TIMESHEET_WEEK_STATUS.CERRADA).map((week) => week.week_start)
        )
        setState({ loading: false, error: null, items, closedWeeks })
        setSelected(
          new Set(
            items
              .filter((item) => item.paid && !existingKeys.has(item.dateKey) && !closedWeeks.has(weekStartOfKey(item.dateKey)))
              .map((item) => item.dateKey)
          )
        )
      } catch (error) {
        if (!vigente || error?.name === 'AbortError') return
        setState({
          loading: false,
          error: error?.message || 'No se pudo consultar el calendario oficial.',
          items: [],
          closedWeeks: new Set(),
        })
      }
    }

    cargar()
    return () => {
      vigente = false
      controller.abort()
    }
    // existingKeys cambia de identidad en cada render del padre: se lee adentro
    // a proposito, sin disparar una recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedYear])

  function toggle(dateKey) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  async function handleSave() {
    const aCargar = state.items.filter((item) => selected.has(item.dateKey))
    if (aCargar.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      const cantidad = await markHolidays(aCargar.map((item) => ({ date: item.dateKey, name: item.name })))
      setLoaded((current) => new Set([...current, ...aCargar.map((item) => item.dateKey)]))
      setSelected(new Set())
      setMessage({
        error: false,
        text: cantidad === 1 ? 'Se cargó 1 feriado.' : `Se cargaron ${cantidad} feriados.`,
      })
      await onSaved()
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudieron cargar los feriados.' })
    } finally {
      setSaving(false)
    }
  }

  function estadoDe(item) {
    if (yaCargado(item.dateKey)) return { label: 'Ya cargado', tone: 'success' }
    if (state.closedWeeks.has(weekStartOfKey(item.dateKey))) return { label: 'Semana cerrada', tone: 'neutral' }
    return null
  }

  const anios = [year, year + 1]

  return (
    <Modal
      open={open}
      title="Feriados oficiales"
      size="lg-auto"
      onClose={onClose}
      actions={[
        { label: 'Cerrar', onClick: onClose },
        {
          label: saving ? 'Cargando…' : `Cargar ${selected.size} ${selected.size === 1 ? 'feriado' : 'feriados'}`,
          variant: 'primary',
          onClick: handleSave,
          disabled: saving || selected.size === 0,
        },
      ]}
    >
      <div className="space-y-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[52rem]">
            Vienen del calendario oficial de feriados nacionales. Los <strong>puentes turísticos</strong> llegan sin tildar: son días
            no laborables, así que si se trabaja se pagan como un día común y no al 100%. Si en la fábrica los tratan como feriado,
            tildalos a mano.
          </p>
          <div className="flex items-center gap-sm">
            <label htmlFor="holiday-year" className="font-label-sm text-label-sm text-on-surface-variant uppercase">
              Año
            </label>
            <select
              id="holiday-year"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
            >
              {anios.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.loading && <Spinner label="Consultando el calendario oficial…" />}

        {state.error && (
          <p role="alert" className="font-body-md text-body-md text-error">
            {state.error} Podés marcar los feriados a mano con el check de cada día en la grilla.
          </p>
        )}

        {!state.loading && !state.error && (
          <ul className="divide-y divide-outline-variant/50 border border-outline-variant rounded-lg">
            {state.items.map((item) => {
              const estado = estadoDe(item)
              const bloqueado = Boolean(estado)
              return (
                <li key={item.dateKey} className="flex flex-wrap items-center gap-sm p-sm">
                  <label className={`flex items-center gap-sm flex-1 min-w-[22rem] ${bloqueado ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(item.dateKey)}
                      disabled={bloqueado}
                      onChange={() => toggle(item.dateKey)}
                      className="w-[1.6rem] h-[1.6rem] accent-secondary"
                    />
                    <span className="font-body-md text-body-md text-on-surface whitespace-nowrap">{formatShortDayLabel(item.dateKey)}</span>
                    <span className="font-body-md text-body-md text-on-surface-variant">{item.name}</span>
                  </label>
                  <div className="flex items-center gap-sm">
                    <StatusChip label={HOLIDAY_KIND_LABELS[item.kind]} tone={item.paid ? 'success' : 'warning'} variant="tag" />
                    {estado && <StatusChip label={estado.label} tone={estado.tone} variant="tag" />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {message && (
          <p role="status" className={`font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-secondary'}`}>
            {message.text}
          </p>
        )}
      </div>
    </Modal>
  )
}
