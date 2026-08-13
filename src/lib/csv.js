function escapeCsvValue(value) {
  const stringValue = String(value ?? '')
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
}

export function rowsToCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')
}

const UTF8_BOM = '﻿'

// El BOM UTF-8 es necesario para que Excel en Windows detecte la
// codificacion y muestre bien los acentos y la ñ; sin el, los abre como
// Latin-1 y rompe el texto.
export function downloadCsv(filename, csvContent) {
  const blob = new Blob([UTF8_BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
