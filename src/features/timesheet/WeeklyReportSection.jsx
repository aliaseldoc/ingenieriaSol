import { useCallback, useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import StatusChip from '../../components/ui/StatusChip'
import TextAreaField from '../../components/ui/TextAreaField'
import { closeTimesheetWeek, listWeekEvents, reopenTimesheetWeek, sendWeekReport } from '../../api/timesheetWeeks'
import { formatDateTime } from '../../lib/dateUtils'
import { DAY_STATUS, toWeekSnapshot } from './computeTimesheet'
import { formatShortDayLabel } from './workTime'
import { buildWeeklyReportSheets, weeklyReportFileName } from './weeklyReportXlsx'
import WeeklyReportTable from './WeeklyReportTable'

// Dias que impiden cerrar: incompletos o con una jornada todavia en curso.
function findCloseBlockers(rows) {
  return rows.flatMap((row) =>
    row.days
      .filter((day) => day.status === DAY_STATUS.INCOMPLETO || day.status === DAY_STATUS.EN_CURSO)
      .map((day) => ({ key: `${row.employeeId}-${day.dateKey}`, fullName: row.fullName, dateKey: day.dateKey, status: day.status }))
  )
}

// La Edge Function cierre-semanal solo manda sola las semanas cerradas en los
// ultimos dias (ver DIAS_PARA_ENVIO_AUTOMATICO alla); una mas vieja se manda
// con el boton.
const AUTO_SEND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Si el reporte de la semana cerrada ya salio por mail, o si va a salir.
function ReportMailStatus({ week, hasRecipients }) {
  let text
  if (week?.report_sent_at) {
    text = `Reporte enviado por mail el ${formatDateTime(week.report_sent_at)}.`
  } else if (!hasRecipients) {
    text = 'El reporte no se manda por mail: todavía no hay destinatarios cargados (más abajo).'
  } else if (week?.closed_at && Date.now() - new Date(week.closed_at).getTime() > AUTO_SEND_WINDOW_MS) {
    text = 'Esta semana se cerró hace más de 7 días y no salió por mail. Usá "Enviar reporte ahora" si hace falta.'
  } else {
    text = 'El reporte sale por mail a las 09:00.'
  }
  return <p className="font-body-sm text-body-sm text-on-surface-variant">{text}</p>
}

export default function WeeklyReportSection({ weekStartKey, rows, week, isClosed, hasRecipients, onChanged }) {
  const [events, setEvents] = useState([])
  const [dialog, setDialog] = useState(null) // 'cerrar' | 'bloqueada' | 'reabrir' | 'enviar'
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [working, setWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const displayRows = isClosed && week?.snapshot ? week.snapshot.rows : rows
  const blockers = findCloseBlockers(rows)

  const loadEvents = useCallback(async () => {
    setEvents(await listWeekEvents(weekStartKey))
  }, [weekStartKey])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  function closeDialog() {
    setDialog(null)
    setReopenReason('')
    setErrorMessage('')
  }

  // El mismo Excel que sale adjunto en el mail del lunes (weeklyReportXlsx.js).
  // La libreria se carga recien aca: no hace falta en el resto de la app.
  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser')
      await writeXlsxFile(buildWeeklyReportSheets(displayRows)).toFile(weeklyReportFileName(weekStartKey))
    } catch (error) {
      setExportError(error?.message || 'No se pudo generar el Excel.')
    } finally {
      setExporting(false)
    }
  }

  async function runAction(action) {
    setWorking(true)
    setErrorMessage('')
    try {
      await action()
      closeDialog()
      await Promise.all([onChanged(), loadEvents()])
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo completar la acción.')
    } finally {
      setWorking(false)
    }
  }

  function handleConfirmClose() {
    runAction(() => closeTimesheetWeek(weekStartKey, toWeekSnapshot(rows, weekStartKey)))
  }

  function handleConfirmSend() {
    runAction(() => sendWeekReport(weekStartKey))
  }

  function handleReopen(event) {
    event.preventDefault()
    if (!reopenReason.trim()) {
      setErrorMessage('Indicá el motivo de la reapertura.')
      return
    }
    runAction(() => reopenTimesheetWeek(weekStartKey, reopenReason.trim()))
  }

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <StatusChip label={isClosed ? 'Semana cerrada' : 'Semana abierta'} tone={isClosed ? 'success' : 'neutral'} variant="tag" />
          {isClosed && week?.closed_at && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cerrada el {formatDateTime(week.closed_at)}. El reporte muestra la foto guardada al cerrar.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-sm">
          <Button variant="secondary-outline" icon="download" onClick={handleExport} disabled={displayRows.length === 0 || exporting}>
            {exporting ? 'Generando…' : 'Exportar Excel'}
          </Button>
          {isClosed && (
            <Button variant="secondary-outline" icon="forward_to_inbox" onClick={() => setDialog('enviar')} disabled={!hasRecipients}>
              Enviar reporte ahora
            </Button>
          )}
          {isClosed ? (
            <Button variant="secondary-outline" icon="lock_open" onClick={() => setDialog('reabrir')}>
              Reabrir semana
            </Button>
          ) : (
            <Button variant="primary" icon="lock" onClick={() => setDialog(blockers.length > 0 ? 'bloqueada' : 'cerrar')}>
              Cerrar semana
            </Button>
          )}
        </div>
      </div>

      {exportError && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {exportError}
        </p>
      )}

      {isClosed && <ReportMailStatus week={week} hasRecipients={hasRecipients} />}

      <WeeklyReportTable rows={displayRows} />

      {events.length > 0 && (
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg">
          <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wider px-md py-sm rounded-t-lg">Historial de cierres</h3>
          <ul className="divide-y divide-outline-variant/50">
            {events.map((event) => (
              <li key={event.id} className="px-md py-sm font-body-sm text-body-sm text-on-surface">
                <strong>{event.action === 'cerrada' ? 'Cerrada' : 'Reabierta'}</strong> el {formatDateTime(event.created_at)}{' '}
                {event.actor_id ? `por ${event.profiles?.full_name ?? '—'}` : 'automáticamente'}
                {event.reason && <span className="text-on-surface-variant"> · Motivo: {event.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmModal
        open={dialog === 'cerrar'}
        title="Cerrar semana"
        confirmLabel={working ? 'Cerrando…' : 'Cerrar semana'}
        onCancel={working ? () => {} : closeDialog}
        onConfirm={working ? () => {} : handleConfirmClose}
      >
        Se guarda la foto del reporte y la semana queda bloqueada: no se podrán importar ni corregir fichajes hasta reabrirla.
        {errorMessage && <span role="alert" className="block text-error mt-sm">{errorMessage}</span>}
      </ConfirmModal>

      <ConfirmModal
        open={dialog === 'enviar'}
        title="Enviar reporte"
        confirmLabel={working ? 'Enviando…' : 'Enviar reporte'}
        onCancel={working ? () => {} : closeDialog}
        onConfirm={working ? () => {} : handleConfirmSend}
      >
        Se manda ahora el reporte de esta semana, con el Excel adjunto, a los destinatarios cargados abajo.
        {week?.report_sent_at && <span className="block mt-sm">Ya se había mandado el {formatDateTime(week.report_sent_at)}: les va a llegar de nuevo.</span>}
        {errorMessage && <span role="alert" className="block text-error mt-sm">{errorMessage}</span>}
      </ConfirmModal>

      <Modal
        open={dialog === 'bloqueada'}
        title="No se puede cerrar la semana"
        onClose={closeDialog}
        actions={[{ label: 'Entendido', variant: 'primary', onClick: closeDialog }]}
      >
        <p className="font-body-md text-body-md text-on-surface-variant mb-sm">Primero hay que resolver estos días:</p>
        <ul className="list-disc pl-lg font-body-sm text-body-sm text-on-surface space-y-xs">
          {blockers.map((blocker) => (
            <li key={blocker.key}>
              {blocker.fullName} · {formatShortDayLabel(blocker.dateKey)} ·{' '}
              {blocker.status === DAY_STATUS.INCOMPLETO ? 'fichaje incompleto' : 'jornada en curso'}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={dialog === 'reabrir'}
        title="Reabrir semana"
        onClose={working ? () => {} : closeDialog}
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: closeDialog, disabled: working },
          { label: working ? 'Reabriendo…' : 'Reabrir semana', variant: 'primary', type: 'submit', form: 'reopen-week-form', disabled: working },
        ]}
      >
        <form id="reopen-week-form" onSubmit={handleReopen} className="space-y-md">
          <p className="font-body-md text-body-md text-on-surface-variant">
            La semana vuelve a quedar editable y se descarta la foto guardada. Al cerrarla de nuevo se genera una nueva.
          </p>
          <TextAreaField label="Motivo" value={reopenReason} onChange={setReopenReason} required />
          {errorMessage && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {errorMessage}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
