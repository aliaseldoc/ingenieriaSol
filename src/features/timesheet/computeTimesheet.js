// Motor de calculo de horas del fichaje (ver "Reglas de calculo" en
// FICHAJE.md). Funciones puras, sin React ni Supabase: las mismas se usan en
// el reporte del supervisor, en la vista del tecnico y en la foto que se
// guarda al cerrar la semana, asi los tres siempre dan igual.
import { PUNCH_SOURCE, PUNCH_TYPE, TIMESHEET_RULES } from '../../lib/constants'
import { addDaysToKey, minutesBetween, toDateKey, weekDayKeys, weekdayOfKey, zonedToInstant } from './workTime'

const MINUTE_MS = 60 * 1000

export const DAY_TYPE = {
  HABIL: 'habil',
  SABADO: 'sabado',
  DOMINGO: 'domingo',
  FERIADO: 'feriado',
}

export const DAY_TYPE_LABELS = {
  [DAY_TYPE.HABIL]: 'Día hábil',
  [DAY_TYPE.SABADO]: 'Sábado',
  [DAY_TYPE.DOMINGO]: 'Domingo',
  [DAY_TYPE.FERIADO]: 'Feriado',
}

export const DAY_STATUS = {
  SIN_FICHAJES: 'sin_fichajes',
  OK: 'ok',
  INCOMPLETO: 'incompleto',
  EN_CURSO: 'en_curso',
}

export const PUNCH_ISSUE = {
  ENTRADA_SIN_SALIDA: 'entrada_sin_salida',
  SALIDA_SIN_ENTRADA: 'salida_sin_entrada',
  ENTRADA_REPETIDA: 'entrada_repetida',
}

export const PUNCH_ISSUE_LABELS = {
  [PUNCH_ISSUE.ENTRADA_SIN_SALIDA]: 'Entrada sin salida',
  [PUNCH_ISSUE.SALIDA_SIN_ENTRADA]: 'Salida sin entrada',
  [PUNCH_ISSUE.ENTRADA_REPETIDA]: 'Dos entradas seguidas',
}

// Los segundos del reloj no se computan: "minutos exactos" = minuto fichado.
function truncateToMinute(instant) {
  return Math.floor(instant / MINUTE_MS) * MINUTE_MS
}

function punchInstant(punch) {
  return new Date(punch.punched_at).getTime()
}

// Feriado de lunes a viernes: se cobra como un dia normal, se trabaje o no.
// El de fin de semana no, porque el sabado y el domingo no son laborables.
function isPaidHoliday(dateKey, dayType) {
  if (dayType !== DAY_TYPE.FERIADO) return false
  const weekday = weekdayOfKey(dateKey)
  return weekday >= 1 && weekday <= 5
}

function classifyDay(dateKey, holidayKeys) {
  if (holidayKeys.has(dateKey)) return DAY_TYPE.FERIADO
  const weekday = weekdayOfKey(dateKey)
  if (weekday === 0) return DAY_TYPE.DOMINGO
  if (weekday === 6) return DAY_TYPE.SABADO
  return DAY_TYPE.HABIL
}

// Pasos 1 a 5 del algoritmo: descarta anulados y rebotes del reloj, resuelve
// el tipo de cada fichaje y arma los tramos entrada -> salida.
//
// Devuelve:
//   segments: tramos cerrados { start, end } (instantes truncados al minuto)
//   issues: inconsistencias { kind, punchId, instant }
//   notes: Map punchId -> { type, inferred } o { ignored: true } (rebote)
//   openEntry: entrada todavia abierta y dentro del tramo maximo (en curso)
export function pairPunches(punches, { now = Date.now(), rules = TIMESHEET_RULES } = {}) {
  const maxShiftMs = rules.maxShiftHours * 60 * MINUTE_MS
  const reboundMs = rules.clockReboundMinutes * MINUTE_MS
  const ordered = punches
    .filter((punch) => !punch.voided_at)
    .map((punch) => ({ punch, instant: punchInstant(punch) }))
    .sort((a, b) => a.instant - b.instant)

  const segments = []
  const issues = []
  const notes = new Map()
  let open = null
  let lastClockInstant = null

  for (const { punch, instant } of ordered) {
    if (punch.source === PUNCH_SOURCE.RELOJ) {
      // Doble apoyo del dedo: el segundo fichaje del reloj no cuenta.
      if (lastClockInstant !== null && instant - lastClockInstant < reboundMs) {
        notes.set(punch.id, { ignored: true })
        continue
      }
      lastClockInstant = instant
    }

    // Una entrada abierta hace mas del tramo maximo ya no se puede cerrar:
    // queda incompleta y el fichaje actual arranca de cero (si es del reloj,
    // se vuelve a inferir como entrada).
    if (open && instant - open.instant > maxShiftMs) {
      issues.push({ kind: PUNCH_ISSUE.ENTRADA_SIN_SALIDA, punchId: open.punch.id, instant: open.instant })
      open = null
    }

    const inferred = !punch.punch_type
    const type = punch.punch_type ?? (open ? PUNCH_TYPE.SALIDA : PUNCH_TYPE.ENTRADA)
    notes.set(punch.id, { type, inferred })

    if (type === PUNCH_TYPE.ENTRADA) {
      if (open) {
        issues.push({ kind: PUNCH_ISSUE.ENTRADA_REPETIDA, punchId: open.punch.id, instant: open.instant })
        issues.push({ kind: PUNCH_ISSUE.ENTRADA_REPETIDA, punchId: punch.id, instant })
      }
      open = { punch, instant }
    } else if (!open) {
      issues.push({ kind: PUNCH_ISSUE.SALIDA_SIN_ENTRADA, punchId: punch.id, instant })
    } else {
      segments.push({ start: truncateToMinute(open.instant), end: truncateToMinute(instant) })
      open = null
    }
  }

  let openEntry = null
  if (open) {
    if (now - open.instant > maxShiftMs) {
      issues.push({ kind: PUNCH_ISSUE.ENTRADA_SIN_SALIDA, punchId: open.punch.id, instant: open.instant })
    } else {
      openEntry = open
    }
  }

  return { segments, issues, notes, openEntry }
}

// Paso 6: un tramo que cruza la medianoche se parte y cada parte se computa
// en su propio dia.
function splitAtMidnight(segment) {
  const pieces = []
  let start = segment.start
  while (start < segment.end) {
    const dateKey = toDateKey(start)
    const nextMidnight = zonedToInstant(addDaysToKey(dateKey, 1))
    const end = Math.min(segment.end, nextMidnight)
    pieces.push({ dateKey, start, end })
    start = end
  }
  return pieces
}

function emptyHours() {
  return {
    workedMinutes: 0,
    pauseMinutes: 0,
    lunchDiscountMinutes: 0,
    paidHolidayMinutes: 0,
    normalMinutes: 0,
    extra50Minutes: 0,
    extra100Minutes: 0,
  }
}

// Paso 7: clasificacion de las horas de un dia segun su tipo.
function computeDayHours(dateKey, dayType, pieces, rules) {
  const hours = emptyHours()
  const ordered = [...pieces].sort((a, b) => a.start - b.start)

  for (const [index, piece] of ordered.entries()) {
    hours.workedMinutes += minutesBetween(piece.start, piece.end)
    if (index > 0) hours.pauseMinutes += Math.max(0, minutesBetween(ordered[index - 1].end, piece.start))
  }

  if (dayType === DAY_TYPE.HABIL) {
    // El almuerzo se descuenta siempre, salvo lo que ya se ficho como pausa:
    // nunca se descuenta dos veces.
    if (hours.workedMinutes > 0) {
      hours.lunchDiscountMinutes = Math.min(hours.workedMinutes, Math.max(0, rules.lunchDiscountMinutes - hours.pauseMinutes))
    }
    const netMinutes = hours.workedMinutes - hours.lunchDiscountMinutes
    hours.normalMinutes = Math.min(netMinutes, rules.dailyNormalMinutes)
    hours.extra50Minutes = netMinutes - hours.normalMinutes
  } else if (dayType === DAY_TYPE.SABADO) {
    const cutoff = zonedToInstant(dateKey, rules.saturdayCutoffTime)
    for (const piece of ordered) {
      hours.extra50Minutes += Math.max(0, minutesBetween(piece.start, Math.min(piece.end, cutoff)))
      hours.extra100Minutes += Math.max(0, minutesBetween(Math.max(piece.start, cutoff), piece.end))
    }
  } else {
    hours.extra100Minutes = hours.workedMinutes
  }

  return hours
}

// Calcula todos los dias pedidos de un empleado. `punches` puede (y
// conviene) incluir fichajes de un dia antes y uno despues del rango, para
// que los tramos que cruzan la medianoche en los bordes se armen bien.
//
// Cada dia: { dateKey, dayType, status, issues, punches, ...horas, totalMinutes }
// donde `punches` son los fichajes de ese dia (tambien los anulados) con
// `resolvedType` y `ignored` agregados para mostrarlos.
export function computeEmployeeDays({ punches, dayKeys, holidayKeys = [], now = Date.now(), rules = TIMESHEET_RULES }) {
  const holidays = holidayKeys instanceof Set ? holidayKeys : new Set(holidayKeys)
  const { segments, issues, notes, openEntry } = pairPunches(punches, { now, rules })

  const piecesByDay = new Map()
  for (const piece of segments.flatMap(splitAtMidnight)) {
    if (!piecesByDay.has(piece.dateKey)) piecesByDay.set(piece.dateKey, [])
    piecesByDay.get(piece.dateKey).push(piece)
  }

  const issuesByDay = new Map()
  for (const issue of issues) {
    const dateKey = toDateKey(issue.instant)
    if (!issuesByDay.has(dateKey)) issuesByDay.set(dateKey, [])
    issuesByDay.get(dateKey).push(issue)
  }

  const punchesByDay = new Map()
  for (const punch of [...punches].sort((a, b) => punchInstant(a) - punchInstant(b))) {
    const dateKey = toDateKey(punchInstant(punch))
    const note = notes.get(punch.id)
    if (!punchesByDay.has(dateKey)) punchesByDay.set(dateKey, [])
    punchesByDay.get(dateKey).push({
      ...punch,
      resolvedType: note?.type ?? punch.punch_type ?? null,
      ignored: Boolean(note?.ignored),
    })
  }

  const openEntryDay = openEntry ? toDateKey(openEntry.instant) : null

  return dayKeys.map((dateKey) => {
    const dayType = classifyDay(dateKey, holidays)
    const dayIssues = issuesByDay.get(dateKey) ?? []
    const dayPunches = punchesByDay.get(dateKey) ?? []
    const hours = computeDayHours(dateKey, dayType, piecesByDay.get(dateKey) ?? [], rules)

    let status = DAY_STATUS.OK
    if (dayIssues.length > 0) status = DAY_STATUS.INCOMPLETO
    else if (openEntryDay === dateKey) status = DAY_STATUS.EN_CURSO
    else if (!dayPunches.some((punch) => !punch.voided_at && !punch.ignored) && hours.workedMinutes === 0) status = DAY_STATUS.SIN_FICHAJES

    // Un dia incompleto no suma lo trabajado hasta que el supervisor lo corrija.
    const workedHours = status === DAY_STATUS.INCOMPLETO ? { ...emptyHours(), workedMinutes: hours.workedMinutes } : hours
    // El feriado pago suma una jornada normal aparte de lo trabajado (que ese
    // dia ya se clasifico todo al 100%), y no depende de los fichajes.
    const paidHolidayMinutes = isPaidHoliday(dateKey, dayType) ? rules.dailyNormalMinutes : 0
    const counted = { ...workedHours, paidHolidayMinutes, normalMinutes: workedHours.normalMinutes + paidHolidayMinutes }

    return {
      dateKey,
      dayType,
      status,
      issues: dayIssues,
      punches: dayPunches,
      ...counted,
      totalMinutes: counted.normalMinutes + counted.extra50Minutes + counted.extra100Minutes,
    }
  })
}

// Paso 8: totales de la semana.
export function sumDays(days) {
  const totals = {
    normalMinutes: 0,
    paidHolidayMinutes: 0,
    extra50Minutes: 0,
    extra100Minutes: 0,
    totalMinutes: 0,
    incompleteDays: 0,
    inProgressDays: 0,
  }
  for (const day of days) {
    totals.normalMinutes += day.normalMinutes
    totals.paidHolidayMinutes += day.paidHolidayMinutes
    totals.extra50Minutes += day.extra50Minutes
    totals.extra100Minutes += day.extra100Minutes
    totals.totalMinutes += day.totalMinutes
    if (day.status === DAY_STATUS.INCOMPLETO) totals.incompleteDays += 1
    if (day.status === DAY_STATUS.EN_CURSO) totals.inProgressDays += 1
  }
  return totals
}

// Rango de fichajes a pedir para calcular una semana: un dia de margen a
// cada lado por los tramos que cruzan la medianoche.
export function weekPunchRange(weekStartKey) {
  return {
    from: new Date(zonedToInstant(addDaysToKey(weekStartKey, -1))).toISOString(),
    to: new Date(zonedToInstant(addDaysToKey(weekStartKey, 8))).toISOString(),
  }
}

// Una fila por empleado, con la misma forma que la foto guardada al cerrar
// (ver toWeekSnapshot), para que el reporte pueda mostrar cualquiera de las dos.
export function computeWeekReport({ employees, punches, weekStartKey, holidayKeys = [], now = Date.now(), rules = TIMESHEET_RULES }) {
  const dayKeys = weekDayKeys(weekStartKey)
  const punchesByEmployee = new Map()
  for (const punch of punches) {
    if (!punchesByEmployee.has(punch.employee_id)) punchesByEmployee.set(punch.employee_id, [])
    punchesByEmployee.get(punch.employee_id).push(punch)
  }

  return employees.map((employee) => {
    const days = computeEmployeeDays({
      punches: punchesByEmployee.get(employee.id) ?? [],
      dayKeys,
      holidayKeys,
      now,
      rules,
    })
    return {
      employeeId: employee.id,
      fullName: employee.full_name,
      clockPin: employee.clock_pin,
      days,
      totals: sumDays(days),
    }
  })
}

// Lo que se guarda en timesheet_weeks.snapshot al cerrar: solo horas, sin el
// detalle de fichajes (ese queda en time_punches, que no cambia mientras la
// semana este cerrada).
export function toWeekSnapshot(rows, weekStartKey) {
  return {
    weekStart: weekStartKey,
    generatedAt: new Date().toISOString(),
    rows: rows.map((row) => ({
      employeeId: row.employeeId,
      fullName: row.fullName,
      clockPin: row.clockPin,
      totals: row.totals,
      days: row.days.map((day) => ({
        dateKey: day.dateKey,
        dayType: day.dayType,
        status: day.status,
        workedMinutes: day.workedMinutes,
        lunchDiscountMinutes: day.lunchDiscountMinutes,
        paidHolidayMinutes: day.paidHolidayMinutes,
        normalMinutes: day.normalMinutes,
        extra50Minutes: day.extra50Minutes,
        extra100Minutes: day.extra100Minutes,
        totalMinutes: day.totalMinutes,
      })),
    })),
  }
}
