// Fechas y horas del fichaje, siempre en la zona horaria de la empresa
// (TIMESHEET_RULES.timeZone) y nunca en la del navegador: un dia, una semana
// y el corte de las 13:00 del sabado tienen que dar igual en cualquier
// dispositivo. Todo con Intl nativo, sin librerias.
//
// Convenciones: un "instante" es un numero de milisegundos (Date.getTime());
// una "clave de dia" es un string 'AAAA-MM-DD' en la zona de la empresa.
import { TIMESHEET_RULES } from '../../lib/constants'

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MINUTE_MS = 60 * 1000

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMESHEET_RULES.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})

function pad(value) {
  return String(value).padStart(2, '0')
}

export function getZonedParts(instant) {
  const parts = {}
  for (const { type, value } of partsFormatter.formatToParts(new Date(instant))) parts[type] = value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday],
  }
}

export function toDateKey(instant) {
  const { year, month, day } = getZonedParts(instant)
  return `${year}-${pad(month)}-${pad(day)}`
}

export function toTimeString(instant) {
  const { hour, minute } = getZonedParts(instant)
  return `${pad(hour)}:${pad(minute)}`
}

// Diferencia entre la hora "de pared" de la empresa y UTC en ese instante.
function zoneOffsetMs(instant) {
  const wholeSecond = Math.floor(instant / 1000) * 1000
  const { year, month, day, hour, minute, second } = getZonedParts(wholeSecond)
  return Date.UTC(year, month - 1, day, hour, minute, second) - wholeSecond
}

// Instante que corresponde a una fecha y hora "de pared" de la empresa.
// Se corrige dos veces por si justo hubiera un cambio de horario en el medio.
export function zonedToInstant(dateKey, time = '00:00') {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute, second = 0] = time.split(':').map(Number)
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const firstGuess = wallClockAsUtc - zoneOffsetMs(wallClockAsUtc)
  return wallClockAsUtc - zoneOffsetMs(firstGuess)
}

// Aritmetica de calendario pura (sin zona): una clave de dia es una fecha
// civil, sumarle dias nunca depende de husos horarios.
export function addDaysToKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function weekdayOfKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

// Semana de lunes a domingo, igual que startOfWeek de src/lib/dateUtils.js.
export function weekStartOfKey(dateKey) {
  const daysSinceMonday = (weekdayOfKey(dateKey) + 6) % 7
  return addDaysToKey(dateKey, -daysSinceMonday)
}

export function currentWeekStartKey(now = Date.now()) {
  return weekStartOfKey(toDateKey(now))
}

export function weekDayKeys(weekStartKey) {
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStartKey, index))
}

export function isValidWeekStartKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && weekdayOfKey(value) === 1
}

export function minutesBetween(startInstant, endInstant) {
  return Math.round((endInstant - startInstant) / MINUTE_MS)
}

// 540 -> "9:00", 12 -> "0:12". Formato de todo el modulo (pantalla y CSV).
export function formatMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes ?? 0))
  return `${Math.floor(safeMinutes / 60)}:${pad(safeMinutes % 60)}`
}

export function formatDayKey(dateKey) {
  const [year, month, day] = dateKey.split('-')
  return `${day}/${month}/${year}`
}

// "Lun 14/09"
export function formatShortDayLabel(dateKey) {
  const [, month, day] = dateKey.split('-')
  return `${DAY_NAMES[weekdayOfKey(dateKey)]} ${day}/${month}`
}

// "14/09 al 20/09/2026"
export function formatWeekRange(weekStartKey) {
  const [, startMonth, startDay] = weekStartKey.split('-')
  return `${startDay}/${startMonth} al ${formatDayKey(addDaysToKey(weekStartKey, 6))}`
}

// "14/09/2026 18:02"
export function formatPunchDateTime(instant) {
  return `${formatDayKey(toDateKey(instant))} ${toTimeString(instant)}`
}
