import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateTime } from '../../lib/dateUtils'
import { useSupervisorNotes } from './SupervisorNotesContext'

// Campanita del tecnico: cuantas notas del supervisor tiene sin leer y cuales.
// Mismo patron de desplegable que UserMenu. Abrir una nota lleva a su visita,
// que es donde queda leida.
export default function NotificationBell() {
  const { unreadNotes } = useSupervisorNotes()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  function handleOpenNote(note) {
    setIsOpen(false)
    navigate(`/tecnico/visita/${note.visit_id}`)
  }

  const count = unreadNotes.length

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={count > 0 ? `Notas del supervisor: ${count} sin leer` : 'Notas del supervisor'}
        aria-expanded={isOpen}
        className="relative w-[4.4rem] h-[4.4rem] rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
      >
        <span className="material-symbols-outlined text-[2.4rem]">notifications</span>
        {count > 0 && (
          <span className="absolute top-0 right-0 min-w-[2rem] h-[2rem] px-[0.4rem] rounded-full bg-error text-on-error font-label-sm text-label-sm flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          {/* En mobile la campana queda a la izquierda del encabezado, asi que
              el desplegable abre hacia la derecha; en escritorio esta junto al
              menu de usuario y abre hacia la izquierda. */}
          <div className="absolute left-0 md:left-auto md:right-0 z-50 mt-sm w-[32rem] max-w-[calc(100vw-3.2rem)] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden">
            <p className="px-md py-sm font-label-md text-label-md text-on-surface border-b border-outline-variant">
              Notas del Supervisor
            </p>
            {count === 0 ? (
              <p className="px-md py-md font-body-sm text-body-sm text-on-surface-variant">No tenés notas nuevas.</p>
            ) : (
              <ul className="max-h-[40rem] overflow-y-auto divide-y divide-outline-variant/50">
                {unreadNotes.map((note) => (
                  <li key={note.event_id}>
                    <button
                      type="button"
                      onClick={() => handleOpenNote(note)}
                      className="w-full text-left px-md py-sm hover:bg-surface-container-low transition-colors"
                    >
                      <p className="font-label-md text-label-md text-on-surface">
                        {note.equipment_motor ?? 'Equipo'} · {note.client_name ?? 'Sin cliente'}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface line-clamp-2">{note.notes}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">
                        {note.author_name ?? 'Supervisor'} · {formatDateTime(note.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
