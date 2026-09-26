import { useState } from 'react'
import Button from '../../components/ui/Button'
import TextAreaField from '../../components/ui/TextAreaField'

// "Enviar nota al tecnico", debajo del historial de la validacion. La nota es
// solo informativa: no cambia el estado de la visita y le llega al tecnico
// como aviso en la app (ver SupervisorNotesContext.jsx).
export default function SupervisorNoteForm({ onSend }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim()) return
    setSending(true)
    setMessage(null)
    try {
      await onSend(text)
      setText('')
      setMessage({ error: false, text: 'Nota enviada. El técnico la va a ver en su app.' })
    } catch (error) {
      setMessage({ error: true, text: error.message || 'No se pudo enviar la nota.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-sm">
      <TextAreaField
        label="Nota para el técnico"
        value={text}
        onChange={setText}
        rows={3}
        placeholder="Escribí una indicación sobre esta visita…"
      />
      <div className="flex flex-wrap items-center justify-end gap-sm">
        {message && (
          <p role="alert" className={`flex-1 font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-tertiary-fixed-dim'}`}>
            {message.text}
          </p>
        )}
        <Button type="submit" variant="secondary-outline" icon="send" disabled={sending || !text.trim()}>
          {sending ? 'Enviando…' : 'Enviar Nota al Técnico'}
        </Button>
      </div>
    </form>
  )
}
