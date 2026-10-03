// Calendario oficial de feriados nacionales.
//
// argentina.gob.ar/feriados es una pagina HTML y no habilita su lectura desde
// otro sitio, asi que no se puede consultar desde el navegador. Se usa un
// servicio publico que publica el mismo calendario como datos, con el tipo de
// cada fecha. Si algun dia deja de funcionar, este archivo es el unico lugar
// que hay que tocar: el resto del modulo no sabe de donde salen los feriados.
const FUENTE = 'https://api.argentinadatos.com/v1/feriados'

export const HOLIDAY_KIND = {
  INAMOVIBLE: 'inamovible',
  TRASLADABLE: 'trasladable',
  PUENTE: 'puente',
  OTRO: 'otro',
}

export const HOLIDAY_KIND_LABELS = {
  [HOLIDAY_KIND.INAMOVIBLE]: 'Feriado inamovible',
  [HOLIDAY_KIND.TRASLADABLE]: 'Feriado trasladable',
  [HOLIDAY_KIND.PUENTE]: 'Puente turístico',
  [HOLIDAY_KIND.OTRO]: 'Sin clasificar',
}

// Solo los feriados propiamente dichos se cobran como tales. Un "puente
// turistico" es un dia NO LABORABLE: el empleador decide si se trabaja y, si
// se trabaja, se paga como un dia comun. Tildarlo como feriado pagaria de mas,
// asi que llega sin tildar y decide el supervisor. Lo mismo con cualquier tipo
// que el calendario agregue en el futuro y no conozcamos.
const TIPOS_QUE_SE_PAGAN = new Set([HOLIDAY_KIND.INAMOVIBLE, HOLIDAY_KIND.TRASLADABLE])

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

// El patron no alcanza: "2026-13-45" lo cumple. Una fecha que no existe hace
// fallar el alta de todo el lote contra la base, asi que se descarta aca.
function esFechaReal(dateKey) {
  const fecha = new Date(`${dateKey}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === dateKey
}

// De la respuesta del calendario a lo que entiende el modulo. Descarta lo que
// no se pueda leer en vez de romper: un feriado de menos se marca a mano, pero
// una fecha inventada corrompe el calculo de horas de toda la semana.
export function normalizeOfficialHolidays(rows, year = null) {
  const porFecha = new Map()

  for (const row of Array.isArray(rows) ? rows : []) {
    const dateKey = String(row?.fecha ?? '').trim()
    if (!FECHA_VALIDA.test(dateKey) || !esFechaReal(dateKey)) continue
    if (year && !dateKey.startsWith(`${year}-`)) continue
    if (porFecha.has(dateKey)) continue

    const tipo = String(row?.tipo ?? '').trim()
    const kind = Object.values(HOLIDAY_KIND).includes(tipo) ? tipo : HOLIDAY_KIND.OTRO
    const name = String(row?.nombre ?? '').trim() || 'Feriado'

    porFecha.set(dateKey, { dateKey, name, kind, paid: TIPOS_QUE_SE_PAGAN.has(kind) })
  }

  return [...porFecha.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

export async function fetchOfficialHolidays(year, { signal } = {}) {
  const respuesta = await fetch(`${FUENTE}/${year}`, { signal, headers: { Accept: 'application/json' } })
  if (!respuesta.ok) throw new Error(`El calendario oficial respondió ${respuesta.status}.`)
  return normalizeOfficialHolidays(await respuesta.json(), year)
}
