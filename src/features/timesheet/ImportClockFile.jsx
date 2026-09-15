import { useCallback, useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { listEmployees } from '../../api/employees'
import { importClockPunches, listPunchImports, listPunchesInRange } from '../../api/timePunches'
import { listTimesheetWeeks } from '../../api/timesheetWeeks'
import { PUNCH_SOURCE, TIMESHEET_WEEK_STATUS } from '../../lib/constants'
import { formatDateTime } from '../../lib/dateUtils'
import { CLOCK_FILE_FORMAT_LABELS, normalizeClockPin, parseClockFile } from './clockFileParser'
import { weekStartOfKey, zonedToInstant } from './workTime'

const MAX_LISTED_ERRORS = 10
const MINUTE_MS = 60 * 1000

// Clasifica cada fila del archivo: nueva, duplicada (ya esta en la base o
// repetida en el mismo archivo), de un legajo desconocido o de una semana
// cerrada. Solo las nuevas se importan.
async function buildPreview(fileName, text) {
  const parsed = parseClockFile(text)
  const preview = { fileName, format: parsed.format, errors: parsed.errors, total: parsed.rows.length, toInsert: [], duplicated: 0, closedWeek: 0, unknownPins: new Map() }
  if (parsed.rows.length === 0) return preview

  const employees = await listEmployees()
  const employeeIdByPin = new Map(
    employees.filter((employee) => employee.clock_pin).map((employee) => [normalizeClockPin(employee.clock_pin), employee.id])
  )

  const rows = parsed.rows.map((row) => ({ ...row, instant: zonedToInstant(row.dateKey, row.time), weekStart: weekStartOfKey(row.dateKey) }))
  const instants = rows.map((row) => row.instant)
  const [existing, weeks] = await Promise.all([
    listPunchesInRange({ from: new Date(Math.min(...instants) - MINUTE_MS).toISOString(), to: new Date(Math.max(...instants) + MINUTE_MS).toISOString() }),
    listTimesheetWeeks([...new Set(rows.map((row) => row.weekStart))]),
  ])
  const seen = new Set(existing.filter((punch) => punch.source === PUNCH_SOURCE.RELOJ).map((punch) => `${punch.employee_id}|${new Date(punch.punched_at).getTime()}`))
  const closedWeeks = new Set(weeks.filter((week) => week.status === TIMESHEET_WEEK_STATUS.CERRADA).map((week) => week.week_start))

  for (const row of rows) {
    const employeeId = employeeIdByPin.get(row.pin)
    if (!employeeId) {
      preview.unknownPins.set(row.pin, (preview.unknownPins.get(row.pin) ?? 0) + 1)
      continue
    }
    if (closedWeeks.has(row.weekStart)) {
      preview.closedWeek += 1
      continue
    }
    const key = `${employeeId}|${row.instant}`
    if (seen.has(key)) {
      preview.duplicated += 1
      continue
    }
    seen.add(key)
    preview.toInsert.push({ employee_id: employeeId, punched_at: new Date(row.instant).toISOString() })
  }
  return preview
}

function unknownCount(preview) {
  return [...preview.unknownPins.values()].reduce((sum, count) => sum + count, 0)
}

function PreviewStat({ label, value, tone = 'text-on-surface' }) {
  return (
    <div className="border border-outline-variant rounded-lg p-sm">
      <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</dt>
      <dd className={`font-headline-md text-headline-md ${tone}`}>{value}</dd>
    </div>
  )
}

export default function ImportClockFile({ actorId, onImported }) {
  const [preview, setPreview] = useState(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState(null) // { error, text }
  const [history, setHistory] = useState(null)
  const [inputKey, setInputKey] = useState(0)

  const loadHistory = useCallback(async () => {
    setHistory(await listPunchImports())
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function reset() {
    setPreview(null)
    setInputKey((key) => key + 1)
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setReading(true)
    setMessage(null)
    setPreview(null)
    try {
      setPreview(await buildPreview(file.name, await file.text()))
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudo leer el archivo.' })
    } finally {
      setReading(false)
    }
  }

  async function handleImport(event) {
    event.preventDefault()
    setImporting(true)
    setMessage(null)
    try {
      const result = await importClockPunches({
        fileName: preview.fileName,
        actorId,
        punches: preview.toInsert,
        stats: { total: preview.total, duplicated: preview.duplicated, unknown: unknownCount(preview), closedWeek: preview.closedWeek },
      })
      setMessage({ error: false, text: `Importación terminada: ${result.rows_inserted} fichajes nuevos, ${result.rows_duplicated} duplicados ignorados.` })
      reset()
      await Promise.all([loadHistory(), onImported()])
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudo importar el archivo.' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-lg">
      <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md space-y-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Importar archivo del reloj</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Subí el archivo descargado del reloj por USB, o un CSV con encabezado <code>legajo,fecha,hora</code>. Antes de importar vas a ver
            una vista previa. Reimportar el mismo archivo es seguro: los duplicados se ignoran.
          </p>
        </div>

        <label className="inline-flex items-center gap-sm cursor-pointer rounded py-sm px-lg border border-outline text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined text-[1.8rem]">upload_file</span>
          Elegir archivo
          <input key={inputKey} type="file" accept=".csv,.txt,.dat,text/plain,text/csv" className="sr-only" onChange={handleFileChange} />
        </label>

        {reading && <Spinner label="Leyendo archivo…" />}

        {message && (
          <p role="alert" className={`font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-secondary'}`}>
            {message.text}
          </p>
        )}

        {preview && (
          <form onSubmit={handleImport} className="space-y-md">
            <p className="font-body-md text-body-md text-on-surface">
              <strong>{preview.fileName}</strong>
              {preview.format && ` · ${CLOCK_FILE_FORMAT_LABELS[preview.format]}`}
            </p>

            <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-sm">
              <PreviewStat label="Filas leídas" value={preview.total} />
              <PreviewStat label="Nuevos" value={preview.toInsert.length} tone="text-secondary" />
              <PreviewStat label="Duplicados" value={preview.duplicated} />
              <PreviewStat label="Legajos desconocidos" value={unknownCount(preview)} tone={preview.unknownPins.size > 0 ? 'text-warning' : 'text-on-surface'} />
              <PreviewStat label="Semanas cerradas" value={preview.closedWeek} tone={preview.closedWeek > 0 ? 'text-warning' : 'text-on-surface'} />
              <PreviewStat label="Errores de formato" value={preview.errors.length} tone={preview.errors.length > 0 ? 'text-error' : 'text-on-surface'} />
            </dl>

            {preview.unknownPins.size > 0 && (
              <div className="border border-outline-variant rounded-lg p-sm">
                <p className="font-label-md text-label-md text-on-surface mb-xs">
                  Estos N° del reloj no están cargados en ningún legajo (no se importan). Dalos de alta en Personal y volvé a importar el archivo:
                </p>
                <ul className="flex flex-wrap gap-sm font-body-sm text-body-sm text-on-surface-variant">
                  {[...preview.unknownPins.entries()].map(([pin, count]) => (
                    <li key={pin}>
                      N° {pin} ({count} {count === 1 ? 'fichaje' : 'fichajes'})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.closedWeek > 0 && (
              <p className="font-body-sm text-body-sm text-warning">
                Hay fichajes de semanas cerradas que no se importan. Para cargarlos, reabrí esas semanas y volvé a importar.
              </p>
            )}

            {preview.errors.length > 0 && (
              <div className="border border-error rounded-lg p-sm">
                <p className="font-label-md text-label-md text-error mb-xs">Líneas con errores (no se importan):</p>
                <ul className="font-body-sm text-body-sm text-on-surface-variant space-y-xs">
                  {preview.errors.slice(0, MAX_LISTED_ERRORS).map((error) => (
                    <li key={`${error.lineNumber}-${error.message}`}>
                      {error.lineNumber > 0 ? `Línea ${error.lineNumber}: ` : ''}
                      {error.message}
                    </li>
                  ))}
                  {preview.errors.length > MAX_LISTED_ERRORS && <li>… y {preview.errors.length - MAX_LISTED_ERRORS} más.</li>}
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse md:flex-row justify-end gap-sm">
              <Button variant="secondary-outline" onClick={reset} disabled={importing}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" icon="publish" disabled={importing || preview.toInsert.length === 0}>
                {importing ? 'Importando…' : `Importar ${preview.toInsert.length} fichajes`}
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wider px-md py-sm">Historial de importaciones</h3>
        {history === null ? (
          <Spinner label="Cargando historial…" />
        ) : history.length === 0 ? (
          <p className="p-md font-body-md text-body-md text-on-surface-variant">Todavía no se importó ningún archivo.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-styled">
            <table className="w-full min-w-[64rem] text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  {['Fecha', 'Archivo', 'Importó', 'Nuevos', 'Duplicados', 'Desconocidos', 'Sem. cerradas'].map((header) => (
                    <th key={header} className="font-label-md text-label-md text-on-surface-variant uppercase py-sm px-md">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-outline-variant/50 font-body-sm text-body-sm text-on-surface">
                    <td className="py-sm px-md">{formatDateTime(item.imported_at)}</td>
                    <td className="py-sm px-md break-all">{item.file_name}</td>
                    <td className="py-sm px-md">{item.profiles?.full_name ?? '—'}</td>
                    <td className="py-sm px-md">{item.rows_inserted}</td>
                    <td className="py-sm px-md">{item.rows_duplicated}</td>
                    <td className="py-sm px-md">{item.rows_unknown}</td>
                    <td className="py-sm px-md">{item.rows_closed_week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
