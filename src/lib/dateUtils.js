import { ANNUAL_SERVICE_ALERT_WINDOW_DAYS } from './constants'

const MS_PER_DAY = 86400000

// "YYYY-MM-DD" (columna DATE de Supabase, sin hora) es interpretado por
// `new Date()` como medianoche UTC, lo que puede correr el dia en un dia
// hacia atras en husos horarios negativos (ej. Argentina, UTC-3). Estas
// fechas "puras" se parsean por componentes para construirlas en hora local.
function parseDateInput(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(dateInput)
}

export function addYears(date, years) {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
}

// changedAt + yearsAhead, como "YYYY-MM-DD". Usado tanto al editar el
// seguimiento de un equipo a mano (EquipmentHistoryPanel.jsx) como al
// recibir una visita con cambios de filtro/bateria marcados (markVisitReceived
// en src/api/visits.js) — mismo criterio +1 año (filtros) / +2 años (bateria)
// en un solo lugar.
export function computeNextDueDate(changedAtIso, yearsAhead) {
  return toISODateString(addYears(parseDateInput(changedAtIso), yearsAhead))
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY)
}

const NEXT_SERVICE_DATE_FIELDS = [
  'fuel_filter_next_due_at',
  'oil_filter_next_due_at',
  'air_filter_next_due_at',
  'battery_next_due_at',
]

// La fecha de proximo service de un equipo es la mas cercana entre sus 4
// campos de "Proximo Service" (ficha tecnica) y, si existiera, la derivada
// de last_annual_service_date (legado: ya no se completa desde el formulario
// de visita, pero se sigue respetando por si algun equipo la tiene cargada).
export function getNextAnnualServiceDue(equipment) {
  const candidates = NEXT_SERVICE_DATE_FIELDS
    .map((field) => equipment[field])
    .filter(Boolean)
    .map((value) => new Date(value))

  if (equipment.last_annual_service_date) {
    candidates.push(addYears(new Date(equipment.last_annual_service_date), 1))
  }

  if (candidates.length === 0) return null
  return candidates.reduce((earliest, date) => (date < earliest ? date : earliest))
}

// 'sin_datos' | 'vencido' | 'proximo' | 'al_dia'
export function getAlertLevel(dueDate, today = new Date()) {
  if (!dueDate) return 'sin_datos'
  const days = daysBetween(today, dueDate)
  if (days < 0) return 'vencido'
  if (days <= ANNUAL_SERVICE_ALERT_WINDOW_DAYS) return 'proximo'
  return 'al_dia'
}

export function formatDate(dateInput) {
  if (!dateInput) return '—'
  const date = parseDateInput(dateInput)
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Ej: "Lunes 3 de Agosto del 2026" (titular del detalle del dia).
export function formatFullDate(dateInput) {
  if (!dateInput) return '—'
  const date = parseDateInput(dateInput)
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} del ${date.getFullYear()}`
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '—'
  const date = new Date(dateInput)
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function startOfWeek(date) {
  const result = startOfDay(date)
  const day = result.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diffToMonday)
  return result
}

export function addDays(date, days) {
  const result = startOfDay(date)
  result.setDate(result.getDate() + days)
  return result
}

export function toISODateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

// Cantidad de dias habiles (lunes a viernes) desde el 1 del mes hasta la
// fecha dada, inclusive (1-indexado). Ej: si el mes empieza sabado, el
// primer lunes es el "dia habil 1".
export function businessDayOrdinalOfMonth(date) {
  let ordinal = 0
  let cursor = startOfMonth(date)
  while (cursor <= date) {
    if (!isWeekend(cursor)) ordinal += 1
    cursor = addDays(cursor, 1)
  }
  return ordinal
}

// N-esimo dia habil del mes de "monthAnchor" (1-indexado). Si ese mes no
// tiene tantos dias habiles, devuelve su ultimo dia habil.
export function nthBusinessDayOfMonth(monthAnchor, ordinal) {
  const end = endOfMonth(monthAnchor)
  let cursor = startOfMonth(monthAnchor)
  let count = 0
  let lastBusinessDay = cursor
  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      count += 1
      lastBusinessDay = cursor
      if (count === ordinal) return cursor
    }
    cursor = addDays(cursor, 1)
  }
  return lastBusinessDay
}

// Grilla de semanas completas (Lunes a Domingo) que cubre todo el mes,
// incluyendo dias de los meses vecinos, para que la grilla sea siempre
// rectangular (filas completas de 7 dias).
export function getMonthGridWeeks(monthAnchor) {
  const gridStart = startOfWeek(startOfMonth(monthAnchor))
  const gridEnd = addDays(startOfWeek(endOfMonth(monthAnchor)), 6)
  const totalDays = daysBetween(gridStart, gridEnd) + 1
  const days = Array.from({ length: totalDays }, (_, index) => addDays(gridStart, index))

  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}
