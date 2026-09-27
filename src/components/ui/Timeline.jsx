// `meta` es una linea opcional debajo de las notas de un evento (ej. quien leyo
// una nota del supervisor).
export default function Timeline({ events }) {
  if (events.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no hay eventos registrados.</p>
  }

  return (
    <ol className="relative border-l border-outline-variant ml-sm space-y-lg">
      {events.map((event) => (
        <li key={event.id} className="ml-lg">
          <span className="absolute -left-[0.55rem] w-[1.1rem] h-[1.1rem] rounded-full bg-secondary border-2 border-surface-container-lowest" />
          <p className="font-label-md text-label-md text-on-surface">{event.label}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {event.actor} · {event.timestamp}
          </p>
          {event.notes && <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs whitespace-pre-wrap">{event.notes}</p>}
          {event.meta && <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs italic">{event.meta}</p>}
        </li>
      ))}
    </ol>
  )
}
