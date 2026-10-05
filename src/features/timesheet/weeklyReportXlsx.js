// Documento Excel del reporte semanal de horas. Puro: devuelve la definicion
// de las hojas para write-excel-file, sin importar la libreria. Lo usan la
// pantalla del supervisor (boton "Exportar Excel") y la Edge Function que manda
// el reporte por mail los lunes, asi el archivo es el mismo en los dos casos.
//
// Recibe filas con la forma del snapshot de cierre (o del calculo en vivo, que
// es la misma): { clockPin, fullName, totals, days[] }.
//
// Con extension explicita en los imports: Deno no adivina el ".js".
import { dateCell, durationCell, headerCell, numberCell, textCell } from '../../lib/xlsxCells.js'
import { DAY_STATUS, DAY_TYPE_LABELS } from './computeTimesheet.js'

const DAY_STATUS_LABELS = {
  [DAY_STATUS.SIN_FICHAJES]: 'Sin fichajes',
  [DAY_STATUS.OK]: 'Completo',
  [DAY_STATUS.INCOMPLETO]: 'Incompleto (no suma)',
  [DAY_STATUS.EN_CURSO]: 'En curso',
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function weekdayName(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

function byName(a, b) {
  return a.fullName.localeCompare(b.fullName, 'es')
}

function summarySheet(rows) {
  const header = ['Legajo', 'Empleado', 'Horas normales', 'Horas al 50%', 'Horas al 100%', 'Total', 'Días incompletos'].map(headerCell)
  const data = [...rows].sort(byName).map((row) => [
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
    data: [header, ...data],
    columns: [{ width: 10 }, { width: 32 }, { width: 15 }, { width: 14 }, { width: 14 }, { width: 11 }, { width: 16 }],
    stickyRowsCount: 1,
  }
}

// Una fila por persona y dia, para que el contador vea de donde sale cada
// total. Los dias sin fichajes se omiten: solo agregarian ruido.
function detailSheet(rows) {
  const header = ['Legajo', 'Empleado', 'Fecha', 'Día', 'Tipo de día', 'Estado', 'Normales', 'Al 50%', 'Al 100%', 'Total'].map(headerCell)
  const data = [...rows].sort(byName).flatMap((row) =>
    row.days
      .filter((day) => day.status !== DAY_STATUS.SIN_FICHAJES || day.paidHolidayMinutes > 0)
      .map((day) => [
        textCell(row.clockPin),
        textCell(row.fullName),
        dateCell(day.dateKey),
        textCell(weekdayName(day.dateKey)),
        textCell(DAY_TYPE_LABELS[day.dayType] ?? day.dayType),
        textCell(DAY_STATUS_LABELS[day.status] ?? day.status),
        durationCell(day.normalMinutes),
        durationCell(day.extra50Minutes),
        durationCell(day.extra100Minutes),
        durationCell(day.totalMinutes),
      ])
  )
  return {
    sheet: 'Detalle por día',
    data: [header, ...data],
    columns: [{ width: 10 }, { width: 32 }, { width: 12 }, { width: 11 }, { width: 13 }, { width: 20 }, { width: 11 }, { width: 10 }, { width: 10 }, { width: 10 }],
    stickyRowsCount: 1,
  }
}

export function weeklyReportFileName(weekStartKey) {
  return `fichajes-semana-${weekStartKey}.xlsx`
}

export function buildWeeklyReportSheets(rows) {
  return [summarySheet(rows), detailSheet(rows)]
}
