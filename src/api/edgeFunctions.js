import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

// supabase.functions.invoke() solo da un mensaje generico ("Edge Function
// returned a non-2xx status code") cuando la funcion responde con error: el
// motivo real ("No podés eliminar tu propio usuario", "Esa semana no está
// cerrada") viaja en el cuerpo de esa respuesta y hay que leerlo aparte.
export async function invokeEdgeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
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
