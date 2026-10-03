// Lectura del archivo exportado por el reloj biometrico. Aislado a proposito
// (ver FICHAJE.md): cuando llegue el equipo real, el ajuste al formato
// definitivo deberia tocar solo este archivo.
//
// Formatos soportados:
//   1. CSV generico con encabezado legajo,fecha,hora (separador , o ;).
//   2. attlog tipico de ZKTeco: texto separado por tabulaciones, columna 1 el
//      N° de usuario y columna 2 "AAAA-MM-DD HH:MM:SS"; el resto se ignora.
//
// Devuelve filas { lineNumber, pin, dateKey, time } con la fecha y hora tal
// como las marca el reloj (hora de pared de la fabrica), mas los errores de
// formato por linea.

export const CLOCK_FILE_FORMAT = {
  CSV: 'csv',
  ZKTECO: 'zkteco',
}

export const CLOCK_FILE_FORMAT_LABELS = {
  [CLOCK_FILE_FORMAT.CSV]: 'CSV genérico',
  [CLOCK_FILE_FORMAT.ZKTECO]: 'Reloj ZKTeco',
}

const ZKTECO_LINE = /^\s*(\S+)\t(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)/

// Quita ceros a la izquierda para que "0007" del reloj coincida con "7".
export function normalizeClockPin(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed.replace(/^0+(?=\d)/, '')
}

function parseDate(value) {
  const text = value.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoMatch) return text
  const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (localMatch) {
    const [, day, month, year] = localMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!match) return null
  const [, hour, minute, second = '00'] = match
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null
  return `${hour.padStart(2, '0')}:${minute}:${second}`
}

function isValidDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function buildRow(lineNumber, pinText, dateText, timeText) {
  const pin = normalizeClockPin(pinText)
  const dateKey = parseDate(dateText)
  const time = parseTime(timeText)
  if (!pin) return { error: { lineNumber, message: 'Falta el N° de legajo.' } }
  if (!dateKey || !isValidDateKey(dateKey)) return { error: { lineNumber, message: `Fecha inválida: "${dateText.trim()}".` } }
  if (!time) return { error: { lineNumber, message: `Hora inválida: "${timeText.trim()}".` } }
  return { row: { lineNumber, pin, dateKey, time } }
}

function parseCsv(lines) {
  const header = lines[0].text
  const separator = header.includes(';') ? ';' : ','
  const columns = header.split(separator).map((column) => column.trim().toLowerCase())
  const pinIndex = columns.indexOf('legajo')
  const dateIndex = columns.indexOf('fecha')
  const timeIndex = columns.indexOf('hora')
  if (pinIndex === -1 || dateIndex === -1 || timeIndex === -1) {
    return { rows: [], errors: [{ lineNumber: lines[0].lineNumber, message: 'El encabezado debe tener las columnas legajo, fecha y hora.' }] }
  }

  const rows = []
  const errors = []
  for (const { lineNumber, text } of lines.slice(1)) {
    const cells = text.split(separator)
    const { row, error } = buildRow(lineNumber, cells[pinIndex] ?? '', cells[dateIndex] ?? '', cells[timeIndex] ?? '')
    if (row) rows.push(row)
    else errors.push(error)
  }
  return { rows, errors }
}

function parseZkteco(lines) {
  const rows = []
  const errors = []
  for (const { lineNumber, text } of lines) {
    const match = ZKTECO_LINE.exec(text)
    if (!match) {
      errors.push({ lineNumber, message: 'La línea no tiene el formato del reloj (N° de usuario, fecha y hora).' })
      continue
    }
    const { row, error } = buildRow(lineNumber, match[1], match[2], match[3])
    if (row) rows.push(row)
    else errors.push(error)
  }
  return { rows, errors }
}

export function parseClockFile(text) {
  const lines = String(text ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: line }))
    .filter(({ text: line }) => line.trim() !== '')

  if (lines.length === 0) {
    return { format: null, rows: [], errors: [{ lineNumber: 0, message: 'El archivo está vacío.' }] }
  }

  if (/legajo/i.test(lines[0].text)) {
    return { format: CLOCK_FILE_FORMAT.CSV, ...parseCsv(lines) }
  }
  if (ZKTECO_LINE.test(lines[0].text)) {
    return { format: CLOCK_FILE_FORMAT.ZKTECO, ...parseZkteco(lines) }
  }
  return {
    format: null,
    rows: [],
    errors: [{ lineNumber: 0, message: 'Formato no reconocido. Usá un CSV con encabezado legajo,fecha,hora o el archivo del reloj.' }],
  }
}
