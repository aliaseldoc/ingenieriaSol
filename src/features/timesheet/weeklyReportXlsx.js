// Documento Excel del reporte semanal de horas. Puro: devuelve la definicion
// de las hojas para write-excel-file, sin importar la libreria. Lo usan la
// pantalla del supervisor (boton "Exportar Excel") y la Edge Function que manda
// el reporte por mail los lunes, asi el archivo es el mismo en los dos casos.
//
// Recibe filas con la forma del snapshot de cierre (o del calculo en vivo, que
// es la misma): { clockPin, fullName, reportPosition, fixedWeeklyMinutes,
// totals, days[] }. Van en el orden de la liquidacion (compareReportRows).
//
// Las dos hojas tienen formato de tabla (tableData en xlsxCells.js), igual que
// los Excel de Equipos.
//
// Con extension explicita en los imports: Deno no adivina el ".js".
import { dateCell, durationCell, numberCell, tableColumns, tableData, textCell } from '../../lib/xlsxCells.js'
import { DAY_STATUS, DAY_TYPE_LABELS } from './computeTimesheet.js'
import { compareReportRows } from './reportEmployees.js'

// Horarios de un dia para el detalle (Excel y pantalla de Reporte): un tramo
// por posicion, "07:50 / 13:00" con "12:00 / 18:00". La salida del dia
// siguiente lleva "(+1)"; lo que falta en un dia incompleto dice "falta" y la
// jornada todavia abierta, "en curso". Las fotos de semanas cerradas antes de
// que se guardaran los horarios no los traen: quedan en blanco.
export function formatDayTimes(day) {
  const tramos = day.tramos ?? []
  const salida = (tramo) => {
    if (tramo.salida) return tramo.salidaDiaSiguiente ? `${tramo.salida} (+1)` : tramo.salida
    return tramo.enCurso ? 'en curso' : 'falta'
  }
  return {
    entradas: tramos.map((tramo) => tramo.entrada ?? 'falta').join(' / '),
    salidas: tramos.map(salida).join(' / '),
  }
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function weekdayName(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

function summarySheet(rows) {
  const header = ['Legajo', 'Empleado', 'Horas normales', 'Horas al 50%', 'Horas al 100%', 'Total', 'Días incompletos']
  const data = [...rows].sort(compareReportRows).map((row) => [
    textCell(row.clockPin),
    textCell(row.fullName),
    durationCell(row.totals.normalMinutes),
    durationCell(row.totals.extra50Minutes),
    durationCell(row.totals.extra100Minutes),
    durationCell(row.totals.totalMinutes),
    numberCell(row.totals.incompleteDays),
  ])
  return {
    sheet: 'Resumen',
    data: tableData(header, data),
    columns: tableColumns([10, 32, 15, 14, 14, 11, 16]),
    stickyRowsCount: 1,
  }
}

// Una fila por dia, con los horarios de entrada y salida. Los dias sin
// fichajes se omiten: solo agregarian ruido.
function dayDetailRows(row) {
  return row.days
    .filter((day) => day.status !== DAY_STATUS.SIN_FICHAJES || day.paidHolidayMinutes > 0)
    .map((day) => {
      const { entradas, salidas } = formatDayTimes(day)
      return [
        textCell(row.clockPin),
        textCell(row.fullName),
        dateCell(day.dateKey),
        textCell(weekdayName(day.dateKey)),
        textCell(DAY_TYPE_LABELS[day.dayType] ?? day.dayType),
        textCell(entradas),
        textCell(salidas),
        durationCell(day.normalMinutes),
        durationCell(day.extra50Minutes),
        durationCell(day.extra100Minutes),
        durationCell(day.totalMinutes),
      ]
    })
}

// Todo el personal, para que el contador vea de donde sale cada total.
function detailSheet(rows) {
  const header = ['Legajo', 'Empleado', 'Fecha', 'Día', 'Tipo de día', 'Entrada', 'Salida', 'Normales', 'Al 50%', 'Al 100%', 'Total']
  const data = [...rows]
    .sort(compareReportRows)
    .flatMap(dayDetailRows)
  return {
    sheet: 'Detalle por día',
    data: tableData(header, data),
    columns: tableColumns([10, 32, 12, 11, 13, 16, 19, 11, 10, 10, 10]),
    stickyRowsCount: 1,
  }
}

export function weeklyReportFileName(weekStartKey) {
  return `fichajes-semana-${weekStartKey}.xlsx`
}

export function buildWeeklyReportSheets(rows) {
  return [summarySheet(rows), detailSheet(rows)]
}
