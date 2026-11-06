// Llamadas a la API de Google Sheets de una planilla, con el token de la cuenta
// de servicio (ver google.ts) y los errores de Google en castellano.
import { googleAccessToken } from './google.ts'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

function mensajeDeGoogle(status, body) {
  const detalle = body?.error?.message ?? ''
  if (status === 403) return 'La cuenta de servicio no puede editar la planilla de Drive: compartila con ella como Editor.'
  if (status === 404) return 'No se encontró la planilla de Drive. Revisá el id configurado.'
  if (status === 400 && detalle.includes('already exists')) {
    return 'Otra persona está actualizando la planilla en este momento. Probá de nuevo en unos segundos.'
  }
  return `Google respondió con un error (${status}): ${detalle || 'sin detalle'}`
}

// fetch(path) contra la planilla: '' es la planilla, '/values/...' sus
// valores y ':batchUpdate' los cambios.
export async function abrirPlanilla(serviceAccountJson, spreadsheetId) {
  const token = await googleAccessToken(JSON.parse(serviceAccountJson), SHEETS_SCOPE)
  return async function sheetsFetch(path, init = {}) {
    const response = await fetch(`${SHEETS_API}/${spreadsheetId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(mensajeDeGoogle(response.status, body))
    return body
  }
}

export function planillaUrl(spreadsheetId, sheetId = null) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${sheetId == null ? '' : `#gid=${sheetId}`}`
}
