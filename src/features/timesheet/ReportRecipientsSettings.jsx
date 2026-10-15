import { useState } from 'react'
import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import FormSection from '../../components/ui/FormSection'
import { saveReportRecipients } from '../../api/timesheetSettings'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A quien le llega el reporte semanal por mail (el dueño y el contador). La
// semana se cierra sola los lunes a las 00:00 y el reporte sale a las 09:00;
// sin destinatarios cargados no se manda nada.
export default function ReportRecipientsSettings({ settings, actorId, onSaved }) {
  const [recipients, setRecipients] = useState(() => settings?.report_recipients ?? [])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { error, text }

  const saved = settings?.report_recipients ?? []
  const hasChanges = recipients.join(',') !== saved.join(',')

  function handleAdd() {
    const email = draft.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) {
      setMessage({ error: true, text: 'Ese mail no parece válido. Revisá que tenga el formato nombre@dominio.com.' })
      return
    }
    if (recipients.includes(email)) {
      setMessage({ error: true, text: 'Ese mail ya está en la lista.' })
      return
    }
    setRecipients((current) => [...current, email])
    setDraft('')
    setMessage(null)
  }

  function handleDraftKeyDown(event) {
    // Enter agrega el mail a la lista en vez de guardar el formulario.
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAdd()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveReportRecipients(recipients, actorId)
      setRecipients(result.report_recipients ?? [])
      setMessage({ error: false, text: 'Destinatarios guardados.' })
      await onSaved()
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudieron guardar los destinatarios.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md md:p-xl">
      <form onSubmit={handleSubmit} className="space-y-lg">
        <FormSection title="Destinatarios del reporte semanal">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            La semana se cierra sola cada lunes a las 00:00 y el reporte, con el Excel adjunto, sale por mail a las 09:00. Si una semana
            se reabre y se vuelve a cerrar, a la mañana siguiente sale la versión corregida.
          </p>

          {recipients.length === 0 ? (
            <p className="font-body-sm text-body-sm text-warning">Todavía no hay destinatarios: mientras tanto no se manda ningún mail.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/50 border border-outline-variant rounded">
              {recipients.map((email) => (
                <li key={email} className="flex items-center justify-between gap-sm px-md py-sm">
                  <span className="font-body-md text-body-md text-on-surface break-all">{email}</span>
                  <Button variant="destructive-outline" icon="close" onClick={() => setRecipients((current) => current.filter((item) => item !== email))}>
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-sm">
            <Field
              label="Agregar mail"
              type="email"
              value={draft}
              onChange={setDraft}
              onKeyDown={handleDraftKeyDown}
              className="flex-1 min-w-[22rem]"
            />
            <Button variant="secondary-outline" icon="add" onClick={handleAdd} disabled={!draft.trim()}>
              Agregar
            </Button>
          </div>
        </FormSection>

        {message && (
          <p role="alert" className={`font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-secondary'}`}>
            {message.text}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon="save" disabled={saving || !hasChanges}>
            {saving ? 'Guardando…' : 'Guardar destinatarios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
