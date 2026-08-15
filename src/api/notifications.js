import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

// supabase.functions.invoke() solo da un mensaje generico ("Edge Function
// returned a non-2xx status code") cuando la funcion responde con error: el
// motivo real (permiso, dato faltante, credenciales de EmailJS) viaja en el
// cuerpo de esa respuesta y hay que leerlo aparte.
async function invokeNotificationFunction(body) {
  const { data, error } = await supabase.functions.invoke('send-visit-email', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const errorBody = await error.context.json().catch(() => null)
      throw new Error(errorBody?.error || error.message)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function sendVisitNotificationEmail(routeSheetId) {
  return invokeNotificationFunction({ type: 'notificacion', routeSheetId })
}

export async function sendVisitResultsEmail(visitId) {
  return invokeNotificationFunction({ type: 'resultados', visitId })
}
