// Motor de calculo de horas del fichaje (ver "Reglas de calculo" en
// FICHAJE.md). Funciones puras, sin React ni Supabase: las mismas se usan en
// el reporte del supervisor, en la vista del tecnico y en la foto que se
// guarda al cerrar la semana, asi los tres siempre dan igual.
// Con extension explicita: la Edge Function de cierre semanal corre este mismo
// motor en Deno, que no adivina el ".js" como Vite.
import { PUNCH_SOURCE, PUNCH_TYPE, TIMESHEET_RULES } from '../../lib/constants.js'
import { addDaysToKey, minutesBetween, toDateKey, toTimeString, weekDayKeys, weekdayOfKey, weekStartOfKey, zonedToInstant } from './workTime.js'

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

// Quien decidio si ese dia hubo almuerzo: lo que marca el supervisor gana a
// lo que declaro el empleado al registrar la salida, y si nadie dijo nada se
// asume que almorzo.
export const LUNCH_SOURCE = {
  SUPERVISOR: 'supervisor',
  EMPLEADO: 'empleado',
  DEFAULT: 'default',
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

// Un feriado paga la jornada de ese dia (9 h de lunes a jueves, 8 h el
// viernes), se trabaje o no. El de fin de semana no paga nada, porque el
// sabado y el domingo no son laborables.
function paidHolidayMinutesFor(dateKey, dayType, rules) {
  if (dayType !== DAY_TYPE.FERIADO) return 0
  return rules.weekdayNormalMinutes[weekdayOfKey(dateKey)] ?? 0
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
//   segments: tramos cerrados { start, end, lunchTaken, entryId, exitId }
//     (instantes truncados al minuto; lunchTaken es lo que declaro la salida
//     que lo cierra, o null; los ids son los de los dos fichajes)
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
      segments.push({
        start: truncateToMinute(open.instant),
        end: truncateToMinute(instant),
        lunchTaken: punch.lunch_taken ?? null,
        entryId: open.punch.id,
        exitId: punch.id,
      })
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

// Paso 5b: la jornada arranca a las 08:00. En un dia habil, un tramo que
// empieza entre las 06 y las 08 cuenta recien desde las 08: el fichaje se
// guarda y se muestra con su hora, pero esos minutos no suman. Antes de las 06
// es una urgencia de madrugada y se paga entera (la noche va al 100%); el
// sabado, el domingo y el feriado no tienen horario y cuentan desde que se
// ficha. earlyMinutes son los minutos que no se cuentan, para mostrarlo.
function clampEarlyStart(segment, holidays, rules) {
  const dateKey = toDateKey(segment.start)
  if (classifyDay(dateKey, holidays) !== DAY_TYPE.HABIL) return segment
  const earlyWindowStart = zonedToInstant(dateKey, rules.nightEndTime)
  const workdayStart = zonedToInstant(dateKey, rules.workdayStartTime)
  if (segment.start < earlyWindowStart || segment.start >= workdayStart) return segment
  const start = Math.min(workdayStart, segment.end)
  return { ...segment, start, earlyMinutes: minutesBetween(segment.start, start) }
}

// Entradas y salidas de cada dia, para el reporte y el Excel. Un tramo va en
// el dia de su entrada con la hora fichada de verdad (aunque haya empezado a
// contar a las 08), y si la salida cae al dia siguiente queda marcado. Los
// fichajes sin pareja (dia incompleto o jornada en curso) van solos en su dia.
function tramosByDay(punches, segments, notes, openEntry) {
  const byDay = new Map()
  const add = (instant, tramo) => {
    const dateKey = toDateKey(instant)
    if (!byDay.has(dateKey)) byDay.set(dateKey, [])
    byDay.get(dateKey).push({ instant, tramo })
  }

  const paired = new Set()
  for (const segment of segments) {
    paired.add(segment.entryId)
    paired.add(segment.exitId)
    const tramo = { entrada: toTimeString(segment.start), salida: toTimeString(segment.end) }
    if (toDateKey(segment.end) !== toDateKey(segment.start)) tramo.salidaDiaSiguiente = true
    add(segment.start, tramo)
  }

  for (const punch of punches) {
    const note = notes.get(punch.id)
    if (punch.voided_at || !note || note.ignored || paired.has(punch.id)) continue
    const instant = punchInstant(punch)
    const tramo = note.type === PUNCH_TYPE.ENTRADA ? { entrada: toTimeString(instant), salida: null } : { entrada: null, salida: toTimeString(instant) }
    if (openEntry?.punch.id === punch.id) tramo.enCurso = true
    add(instant, tramo)
  }

  for (const [dateKey, list] of byDay) {
    byDay.set(dateKey, list.sort((a, b) => a.instant - b.instant).map((item) => item.tramo))
  }
  return byDay
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

// Minutos de un tramo que caen dentro de [from, to).
function overlapMinutes(piece, from, to) {
  return Math.max(0, minutesBetween(Math.max(piece.start, from), Math.min(piece.end, to)))
}

// La pausa del almuerzo fichada: los cortes entre dos tramos que caen enteros
// dentro de la jornada (de 08 a 18, el viernes hasta las 17). Si alguien
// termina a las 18 y vuelve a las 20 por una urgencia, ese corte no es el
// almuerzo: la jornada lleva su descuento y la vuelta suma aparte. Tampoco lo
// es el hueco entre un turno de noche que termino a las 06 y la jornada.
function lunchPauseMinutes(dateKey, dayType, ordered, rules) {
  const endTime = rules.workdayEndTime[weekdayOfKey(dateKey)]
  if (dayType !== DAY_TYPE.HABIL || !endTime) return 0
  const workdayStart = zonedToInstant(dateKey, rules.workdayStartTime)
  const workdayEnd = zonedToInstant(dateKey, endTime)
  let pauseMinutes = 0
  for (let index = 1; index < ordered.length; index += 1) {
    const from = ordered[index - 1].end
    const to = ordered[index].start
    if (from >= workdayStart && to <= workdayEnd) pauseMinutes += Math.max(0, minutesBetween(from, to))
  }
  return pauseMinutes
}

// Paso 7: las horas de un dia, antes de mirar la semana. Las diurnas (de 06 a
// 22 entre semana, de 06 a 13 el sabado) cuentan para las 44 h semanales; el
// resto del dia (la noche, el sabado desde las 13) va siempre al 100%. El
// domingo y el feriado van enteros al 100%.
function computeDayHours(dateKey, dayType, pieces, lunchTaken, rules) {
  const ordered = [...pieces].sort((a, b) => a.start - b.start)
  let workedMinutes = 0
  for (const piece of ordered) workedMinutes += minutesBetween(piece.start, piece.end)
  const pauseMinutes = lunchPauseMinutes(dateKey, dayType, ordered, rules)

  let daytimeMinutes = 0
  if (dayType === DAY_TYPE.HABIL || dayType === DAY_TYPE.SABADO) {
    const from = zonedToInstant(dateKey, rules.nightEndTime)
    const to = zonedToInstant(dateKey, dayType === DAY_TYPE.SABADO ? rules.saturdayCutoffTime : rules.nightStartTime)
    for (const piece of ordered) daytimeMinutes += overlapMinutes(piece, from, to)
  }

  // El almuerzo se descuenta solo los dias habiles en que se almorzo, y solo
  // de las horas diurnas: nunca de las que van al 100% (asi un turno que
  // cruza la medianoche no pierde dos almuerzos). Lo que ya se ficho como
  // pausa del almuerzo no se vuelve a descontar.
  const lunchDiscountMinutes =
    dayType === DAY_TYPE.HABIL && lunchTaken
      ? Math.min(daytimeMinutes, Math.max(0, rules.lunchDiscountMinutes - pauseMinutes))
      : 0

  return {
    workedMinutes,
    pauseMinutes,
    lunchDiscountMinutes,
    weeklyMinutes: daytimeMinutes - lunchDiscountMinutes,
    extra100Minutes: workedMinutes - daytimeMinutes,
  }
}

// Paso 8: el cupo de 44 h normales es por semana. Las horas que paga un
// feriado son siempre normales y ocupan su lugar en el cupo (una semana con
// feriado se cobra como cualquier otra); las diurnas trabajadas lo van
// llenando de lunes a domingo y lo que lo pasa va al 50%. Por eso el 50% cae
// en el dia en que la semana supera las 44 h, aunque el dia largo haya sido
// otro. Se agrupa por semana por si se piden dias de mas de una.
function splitWeeklyNormal(days, rules) {
  const quotaByWeek = new Map()
  for (const day of days) {
    const weekKey = weekStartOfKey(day.dateKey)
    quotaByWeek.set(weekKey, (quotaByWeek.get(weekKey) ?? rules.weeklyNormalMinutes) - day.paidHolidayMinutes)
  }

  const splitByDay = new Map()
  for (const day of [...days].sort((a, b) => a.dateKey.localeCompare(b.dateKey))) {
    const weekKey = weekStartOfKey(day.dateKey)
    const quota = Math.max(0, quotaByWeek.get(weekKey))
    const normalMinutes = Math.min(day.weeklyMinutes, quota)
    quotaByWeek.set(weekKey, quota - normalMinutes)
    splitByDay.set(day.dateKey, { normalMinutes, extra50Minutes: day.weeklyMinutes - normalMinutes })
  }

  return days.map(({ weeklyMinutes, ...day }) => {
    const split = splitByDay.get(day.dateKey)
    const normalMinutes = day.paidHolidayMinutes + split.normalMinutes
    return {
      ...day,
      normalMinutes,
      extra50Minutes: split.extra50Minutes,
      totalMinutes: normalMinutes + split.extra50Minutes + day.extra100Minutes,
    }
  })
}

// Lo que declaro el empleado: la salida que cierra un tramo vale para el dia
// en que ese tramo empezo (un turno de 20 a 02 es del lunes). Si hay varias
// salidas en la jornada, vale la primera que trae el dato: es la que bloquea
// el check en la pantalla de fichaje.
function declaredLunchByDay(segments) {
  const declared = new Map()
  for (const segment of segments) {
    if (segment.lunchTaken === null) continue
    const dateKey = toDateKey(segment.start)
    if (!declared.has(dateKey)) declared.set(dateKey, segment.lunchTaken)
  }
  return declared
}

function resolveLunch(dateKey, lunchOverrides, declaredLunch) {
  if (lunchOverrides.has(dateKey)) return { lunchTaken: lunchOverrides.get(dateKey), lunchSource: LUNCH_SOURCE.SUPERVISOR }
  if (declaredLunch.has(dateKey)) return { lunchTaken: declaredLunch.get(dateKey), lunchSource: LUNCH_SOURCE.EMPLEADO }
  return { lunchTaken: true, lunchSource: LUNCH_SOURCE.DEFAULT }
}

// Filas de timesheet_lunch_overrides de un empleado -> Map dia -> almorzo.
export function lunchOverridesByDay(rows = []) {
  return new Map(rows.map((row) => [row.work_date, row.lunch_taken]))
}

// Calcula todos los dias pedidos de un empleado. `dayKeys` tiene que cubrir
// semanas enteras (de lunes a domingo): el cupo de 44 h es semanal. `punches`
// puede (y conviene) incluir fichajes de un dia antes y uno despues del rango,
// para que los tramos que cruzan la medianoche en los bordes se armen bien.
// `lunchOverrides` es lo que marco el supervisor: Map dia -> almorzo.
//
// Cada dia: { dateKey, dayType, status, issues, punches, tramos, lunchTaken,
// lunchSource, earlyStartMinutes, ...horas, totalMinutes } donde `punches` son los fichajes de
// ese dia (tambien los anulados) con `resolvedType` y `ignored` agregados para
// mostrarlos.
export function computeEmployeeDays({ punches, dayKeys, holidayKeys = [], lunchOverrides = new Map(), now = Date.now(), rules = TIMESHEET_RULES }) {
  const holidays = holidayKeys instanceof Set ? holidayKeys : new Set(holidayKeys)
  const paired = pairPunches(punches, { now, rules })
  const { issues, notes, openEntry } = paired
  const segments = paired.segments.map((segment) => clampEarlyStart(segment, holidays, rules))
  const declaredLunch = declaredLunchByDay(segments)
  // Con los tramos sin recortar: se muestra la hora fichada, no la de las 08.
  const tramos = tramosByDay(punches, paired.segments, notes, openEntry)

  const earlyMinutesByDay = new Map()
  for (const segment of segments) {
    if (!segment.earlyMinutes) continue
    const dateKey = toDateKey(segment.start)
    earlyMinutesByDay.set(dateKey, (earlyMinutesByDay.get(dateKey) ?? 0) + segment.earlyMinutes)
  }

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

  const days = dayKeys.map((dateKey) => {
    const dayType = classifyDay(dateKey, holidays)
    const dayIssues = issuesByDay.get(dateKey) ?? []
    const dayPunches = punchesByDay.get(dateKey) ?? []
    const lunch = resolveLunch(dateKey, lunchOverrides, declaredLunch)
    const hours = computeDayHours(dateKey, dayType, piecesByDay.get(dateKey) ?? [], lunch.lunchTaken, rules)

    let status = DAY_STATUS.OK
    if (dayIssues.length > 0) status = DAY_STATUS.INCOMPLETO
    else if (openEntryDay === dateKey) status = DAY_STATUS.EN_CURSO
    else if (!dayPunches.some((punch) => !punch.voided_at && !punch.ignored) && hours.workedMinutes === 0) status = DAY_STATUS.SIN_FICHAJES

    // Un dia incompleto no suma lo trabajado (ni ocupa cupo de las 44 h)
    // hasta que el supervisor lo corrija.
    const counted =
      status === DAY_STATUS.INCOMPLETO
        ? { workedMinutes: hours.workedMinutes, pauseMinutes: 0, lunchDiscountMinutes: 0, weeklyMinutes: 0, extra100Minutes: 0 }
        : hours

    return {
      dateKey,
      dayType,
      status,
      issues: dayIssues,
      punches: dayPunches,
      tramos: tramos.get(dateKey) ?? [],
      ...lunch,
      // Minutos fichados antes de las 08:00 que no se cuentan (ver
      // clampEarlyStart). Solo para mostrarlo.
      earlyStartMinutes: earlyMinutesByDay.get(dateKey) ?? 0,
      ...counted,
      // El feriado pago suma su jornada aparte de lo trabajado (que ese dia
      // ya se clasifico todo al 100%), y no depende de los fichajes.
      paidHolidayMinutes: paidHolidayMinutesFor(dateKey, dayType, rules),
    }
  })

  return splitWeeklyNormal(days, rules)
}

// Paso 9: totales de la semana.
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
// `lunchOverrides` son las filas de timesheet_lunch_overrides de la semana.
export function computeWeekReport({ employees, punches, weekStartKey, holidayKeys = [], lunchOverrides = [], now = Date.now(), rules = TIMESHEET_RULES }) {
  const dayKeys = weekDayKeys(weekStartKey)
  const punchesByEmployee = new Map()
  for (const punch of punches) {
    if (!punchesByEmployee.has(punch.employee_id)) punchesByEmployee.set(punch.employee_id, [])
    punchesByEmployee.get(punch.employee_id).push(punch)
  }
  const overridesByEmployee = new Map()
  for (const row of lunchOverrides) {
    if (!overridesByEmployee.has(row.employee_id)) overridesByEmployee.set(row.employee_id, [])
    overridesByEmployee.get(row.employee_id).push(row)
  }

  return employees.map((employee) => {
    const days = computeEmployeeDays({
      punches: punchesByEmployee.get(employee.id) ?? [],
      dayKeys,
      holidayKeys,
      lunchOverrides: lunchOverridesByDay(overridesByEmployee.get(employee.id)),
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
        // Entradas y salidas: el Excel del mail las muestra desde la foto.
        tramos: day.tramos ?? [],
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
