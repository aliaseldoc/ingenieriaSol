// Notas del supervisor que pasan a la visita siguiente del mismo equipo
// (pedido del 23/10/2026). Una nota escrita en la visita A se ve en las
// visitas posteriores a A hasta que se envia una despues de escrita la nota:
// esa la conserva y las demas dejan de mostrarla. Si una planificada nunca se
// hace, la nota sigue en la proxima. Puro: sin React ni Supabase.

// Una visita sin fecha programada va al final, como si fuera la mas nueva.
const NO_DATE = '9999-12-31'

function time(timestamp) {
  return new Date(timestamp).getTime()
}

// Por fecha programada y, el mismo dia, por fecha de creacion.
function isBefore(a, b) {
  const aDate = a.scheduled_date ?? NO_DATE
  const bDate = b.scheduled_date ?? NO_DATE
  if (aDate !== bDate) return aDate < bDate
  return time(a.created_at) < time(b.created_at)
}

// La visita que se llevo la nota: la primera de las posteriores a la de la
// nota que se envio despues de escrita. Sin ninguna, la llevan todas las
// posteriores que siguen sin enviar.
function carrierVisit(note, sourceVisit, equipmentVisits) {
  return (
    equipmentVisits
      .filter((candidate) => candidate.id !== sourceVisit.id && isBefore(sourceVisit, candidate))
      .filter((candidate) => candidate.submitted_at && time(candidate.submitted_at) > time(note.created_at))
      .sort((a, b) => time(a.submitted_at) - time(b.submitted_at))[0] ?? null
  )
}

// equipmentVisits: las visitas del equipo de `visit`, cada una con sus notas
// del supervisor en `visit_events`. Devuelve las que corresponden a `visit`,
// de la mas nueva a la mas vieja, con la fecha de la visita donde se
// escribieron.
export function previousSupervisorNotesFor(visit, equipmentVisits) {
  const notes = []
  for (const sourceVisit of equipmentVisits) {
    if (sourceVisit.id === visit.id || !isBefore(sourceVisit, visit)) continue
    for (const note of sourceVisit.visit_events ?? []) {
      const carrier = carrierVisit(note, sourceVisit, equipmentVisits)
      const shows = carrier ? carrier.id === visit.id : !visit.submitted_at
      if (shows) notes.push({ ...note, visit_scheduled_date: sourceVisit.scheduled_date })
    }
  }
  return notes.sort((a, b) => time(b.created_at) - time(a.created_at))
}
