// Seguimiento de las visitas del mes (pedido del 24/10/2026; la propuesta
// aprobada esta en el artifact "Propuesta de Seguimiento"). Puro: sin React ni
// Supabase, asi se prueba con datos reales en Node.
//
// Reglas:
//   * Cuentan los equipos de clientes activos que no estan fuera de servicio.
//   * La meta de cada uno es su "Cantidad de Visitas Mensuales"
//     (equipment.monthly_visits), o 2 mientras no este cargada.
//   * Una visita esta hecha cuando el tecnico la envio (cualquier estado
//     despues de planificada o borrador). Por equipo cuenta hasta su meta, y
//     los reportes del tecnico (is_unplanned) no cuentan.
//   * Con 2 visitas, va una por quincena: del 1 al 15 y del 16 a fin de mes.
//   * Dias habiles: de lunes a viernes, sin los feriados cargados.
//
// Las fechas son claves 'AAAA-MM-DD' y los meses 'AAAA-MM'.
import { CONDITION_STATUS, VISIT_STATUS, isActiveClient } from '../../lib/constants.js'

export const DEFAULT_MONTHLY_VISITS = 2
const FIRST_FORTNIGHT_LAST_DAY = 15
const NOT_DONE_STATUSES = new Set([VISIT_STATUS.PLANIFICADA, VISIT_STATUS.BORRADOR])

// Equipos en riesgo, de la lista mas urgente a la menos urgente. Cada equipo
// aparece en una sola.
export const RISK = {
  OVERDUE: 'vencida',
  FORTNIGHT_MISSED: 'quincena_sin_visita',
  NOT_PLANNED: 'sin_planificar',
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function parseKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return { year, month, day }
}

export function monthKeyOf(dateKey) {
  return dateKey.slice(0, 7)
}

export function addMonths(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

export function monthRange(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${monthKey}-01`, end: `${monthKey}-${pad(lastDay)}`, lastDay }
}

function weekday(dateKey) {
  const { year, month, day } = parseKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function fortnightOf(dateKey) {
  return parseKey(dateKey).day <= FIRST_FORTNIGHT_LAST_DAY ? 1 : 2
}

export function workingDayKeys(monthKey, holidayKeys = []) {
  const holidays = new Set(holidayKeys)
  const { lastDay } = monthRange(monthKey)
  const keys = []
  for (let day = 1; day <= lastDay; day += 1) {
    const dateKey = `${monthKey}-${pad(day)}`
    const dayOfWeek = weekday(dateKey)
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.has(dateKey)) keys.push(dateKey)
  }
  return keys
}

export function isOperating(item) {
  return isActiveClient(item.clients) && item.condition_status !== CONDITION_STATUS.FUERA_SERVICIO
}

export function monthlyTarget(item) {
  return item.monthly_visits ?? DEFAULT_MONTHLY_VISITS
}

function isDone(visit) {
  return !NOT_DONE_STATUSES.has(visit.status)
}

function compareEquipment(a, b) {
  const byClient = (a.clients?.name ?? '').localeCompare(b.clients?.name ?? '', 'es')
  return byClient || (a.motor ?? '').localeCompare(b.motor ?? '', 'es')
}

// Equipos que cuentan, cada uno con sus visitas planificadas del mes.
function equipmentWithVisits(equipment, visits, monthKey) {
  const visitsByEquipment = new Map()
  for (const visit of visits) {
    if (visit.is_unplanned || !visit.scheduled_date || monthKeyOf(visit.scheduled_date) !== monthKey) continue
    if (!visitsByEquipment.has(visit.equipment_id)) visitsByEquipment.set(visit.equipment_id, [])
    visitsByEquipment.get(visit.equipment_id).push(visit)
  }
  return equipment
    .filter(isOperating)
    .map((item) => {
      const itemVisits = visitsByEquipment.get(item.id) ?? []
      const target = monthlyTarget(item)
      return { item, target, visits: itemVisits, done: Math.min(itemVisits.filter(isDone).length, target) }
    })
    .filter((entry) => entry.target > 0)
}

// En que lista de riesgo cae un equipo hoy, o null. Solo para el mes en curso.
function riskOf(entry, todayKey) {
  if (entry.done >= entry.target) return null
  const overdue = entry.visits
    .filter((visit) => !isDone(visit) && visit.scheduled_date < todayKey)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  if (overdue.length > 0) return { kind: RISK.OVERDUE, visit: overdue[0] }

  const currentFortnight = fortnightOf(todayKey)
  const hasVisitIn = (fortnight, onlyDone) =>
    entry.visits.some((visit) => fortnightOf(visit.scheduled_date) === fortnight && (!onlyDone || isDone(visit)))

  if (entry.target >= 2) {
    if (currentFortnight === 2 && !hasVisitIn(1, true)) return { kind: RISK.FORTNIGHT_MISSED, fortnight: 1 }
    if (!hasVisitIn(currentFortnight, false)) return { kind: RISK.NOT_PLANNED, fortnight: currentFortnight }
    return null
  }
  // De 1 visita por mes: solo si no tiene ninguna en el mes.
  return entry.visits.length === 0 ? { kind: RISK.NOT_PLANNED, fortnight: currentFortnight } : null
}

// El mes elegido, tal como lo muestra Seguimiento. Para un mes que ya termino
// no hay pronostico ni riesgo, y `shortfall` son los equipos que no llegaron.
export function buildMonthProgress({ equipment, visits, holidayKeys = [], monthKey, todayKey }) {
  const entries = equipmentWithVisits(equipment, visits, monthKey)
  const workdays = workingDayKeys(monthKey, holidayKeys)
  const currentMonthKey = monthKeyOf(todayKey)
  const isPast = monthKey < currentMonthKey
  const isCurrent = monthKey === currentMonthKey

  const target = entries.reduce((sum, entry) => sum + entry.target, 0)
  const done = entries.reduce((sum, entry) => sum + entry.done, 0)
  const elapsedWorkdays = workdays.filter((dateKey) => dateKey < todayKey).length
  const remainingWorkdays = workdays.length - elapsedWorkdays

  let forecast = null
  if (isCurrent && elapsedWorkdays > 0) {
    forecast = Math.min(target, Math.round(done + (done / elapsedWorkdays) * remainingWorkdays))
  }

  const twoVisitEntries = entries.filter((entry) => entry.target >= 2)
  const fortnights = {
    total: twoVisitEntries.length,
    firstDone: twoVisitEntries.filter((entry) =>
      entry.visits.some((visit) => isDone(visit) && fortnightOf(visit.scheduled_date) === 1)
    ).length,
    secondPlanned: twoVisitEntries.filter((entry) =>
      entry.visits.some((visit) => fortnightOf(visit.scheduled_date) === 2)
    ).length,
    secondDone: twoVisitEntries.filter((entry) =>
      entry.visits.some((visit) => isDone(visit) && fortnightOf(visit.scheduled_date) === 2)
    ).length,
  }

  const risk = { [RISK.OVERDUE]: [], [RISK.FORTNIGHT_MISSED]: [], [RISK.NOT_PLANNED]: [] }
  if (isCurrent) {
    for (const entry of [...entries].sort((a, b) => compareEquipment(a.item, b.item))) {
      const found = riskOf(entry, todayKey)
      // done: cuantas ya hizo, para planificar la primera o la segunda.
      if (found) risk[found.kind].push({ item: entry.item, done: entry.done, ...found })
    }
    risk[RISK.OVERDUE].sort((a, b) => a.visit.scheduled_date.localeCompare(b.visit.scheduled_date))
  }

  const shortfall = entries
    .filter((entry) => entry.done < entry.target)
    .sort((a, b) => compareEquipment(a.item, b.item))
    .map((entry) => ({ item: entry.item, missing: entry.target - entry.done }))

  return {
    monthKey,
    isPast,
    isCurrent,
    equipmentCount: entries.length,
    target,
    done,
    percentage: target > 0 ? Math.round((done / target) * 100) : 0,
    workdayCount: workdays.length,
    elapsedWorkdays: isPast ? workdays.length : elapsedWorkdays,
    expected: isCurrent && workdays.length > 0 ? Math.round((target * elapsedWorkdays) / workdays.length) : null,
    forecast,
    fortnights,
    risk,
    shortfall,
  }
}

// Como venia otro mes en el mismo dia habil: las visitas de ese mes que ya
// estaban enviadas al terminar su dia habil numero `workdayNumber`, sobre su
// meta. La meta se calcula con los equipos y metas de hoy (no hay historial).
export function progressAtWorkday({ equipment, visits, holidayKeys = [], monthKey, workdayNumber }) {
  const workdays = workingDayKeys(monthKey, holidayKeys)
  if (workdayNumber <= 0 || workdays.length === 0) return null
  const cutoffKey = workdays[Math.min(workdayNumber, workdays.length) - 1]
  const submittedByCutoff = visits.filter(
    (visit) => isDone(visit) && visit.submitted_at && localDateKey(visit.submitted_at) <= cutoffKey
  )
  const entries = equipmentWithVisits(equipment, submittedByCutoff, monthKey)
  const target = entries.reduce((sum, entry) => sum + entry.target, 0)
  const done = entries.reduce((sum, entry) => sum + entry.done, 0)
  return { monthKey, cutoffKey, target, done, percentage: target > 0 ? Math.round((done / target) * 100) : 0 }
}

// Fecha local de un instante: un envio a las 23 h en Argentina es de ese dia,
// aunque en UTC ya sea el siguiente.
function localDateKey(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayDateKey(now = new Date()) {
  return localDateKey(now.getTime())
}
