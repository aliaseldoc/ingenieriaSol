import { REPAIR_EVENT_TYPE, REPAIR_STATUS_LABELS } from '../../lib/constants'
import { daysBetween, formatDate, parseDateInput } from '../../lib/dateUtils'

const currencyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

// Number() a proposito: PostgREST puede devolver un numeric como numero o como
// string.
export function formatCurrency(amount) {
  if (amount == null || amount === '') return '—'
  return currencyFormatter.format(Number(amount))
}

function formatDayCount(days) {
  return `${days} ${days === 1 ? 'día' : 'días'}`
}

// Como esta el proximo paso respecto de hoy; null si no tiene fecha.
export function getNextActionDueState(repair, today = new Date()) {
  if (!repair.next_action || !repair.next_action_due) return null
  const days = daysBetween(today, parseDateInput(repair.next_action_due))
  if (days < 0) return { overdue: true, tone: 'error', label: `Vencido hace ${formatDayCount(-days)}` }
  if (days === 0) return { overdue: false, tone: 'warning', label: 'Para hoy' }
  return { overdue: false, tone: 'neutral', label: `Para el ${formatDate(repair.next_action_due)}` }
}

export function formatDaysAgo(dateInput, today = new Date()) {
  const days = daysBetween(new Date(dateInput), today)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${formatDayCount(days)}`
}

// Campos de "Presupuesto y Seguimiento", en el orden del formulario. `format`
// define como se escribe el valor en el resumen de la bitacora.
export const REPAIR_DATA_FIELDS = [
  { key: 'description', label: 'Trabajo a realizar', type: 'textarea' },
  { key: 'budget_number', label: 'N° de presupuesto', type: 'text' },
  { key: 'budget_amount', label: 'Monto', type: 'number', format: formatCurrency },
  { key: 'budget_sent_at', label: 'Fecha de envío', type: 'date', format: formatDate },
  { key: 'client_approved_at', label: 'Fecha de aprobación', type: 'date', format: formatDate },
  { key: 'purchase_order', label: 'Orden de compra', type: 'text' },
  { key: 'completed_at', label: 'Fecha de finalización', type: 'date', format: formatDate },
]

export function getRepairFieldLabel(key) {
  return REPAIR_DATA_FIELDS.find((field) => field.key === key)?.label ?? key
}

// Los inputs trabajan con strings; en la base un campo vacio es null y el
// monto, un numero.
export function toFormValue(value) {
  return value == null ? '' : String(value)
}

function toDbValue(field, formValue) {
  const trimmed = formValue.trim()
  if (trimmed === '') return null
  return field.type === 'number' ? Number(trimmed) : trimmed
}

function isSameValue(field, a, b) {
  if (a == null || b == null) return a == null && b == null
  return field.type === 'number' ? Number(a) === Number(b) : String(a) === String(b)
}

// De los campos editados, solo los que quedaron distintos de lo guardado.
export function getRepairChanges(repair, edits) {
  const changes = {}
  for (const field of REPAIR_DATA_FIELDS) {
    if (!(field.key in edits)) continue
    const value = toDbValue(field, edits[field.key])
    if (!isSameValue(field, value, repair[field.key])) changes[field.key] = value
  }
  return changes
}

// Resumen para la bitacora: "Monto: $ 450.000,00 · Fecha de envío: 26/09/2026".
export function describeRepairChanges(changes) {
  return REPAIR_DATA_FIELDS.filter((field) => field.key in changes)
    .map((field) => {
      const value = changes[field.key]
      const text = value == null ? '(sin dato)' : field.format ? field.format(value) : value
      return `${field.label}: ${text}`
    })
    .join(' · ')
}

export function describeRepairEvent(event) {
  if (event.event_type === REPAIR_EVENT_TYPE.CREADA) return 'Reparación solicitada'
  if (event.event_type === REPAIR_EVENT_TYPE.ESTADO) {
    return `Estado: ${REPAIR_STATUS_LABELS[event.from_status] ?? '—'} → ${REPAIR_STATUS_LABELS[event.to_status] ?? '—'}`
  }
  if (event.event_type === REPAIR_EVENT_TYPE.NOTA) return 'Anotación'
  return 'Datos actualizados'
}
