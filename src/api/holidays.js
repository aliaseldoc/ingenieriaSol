import { supabase } from '../lib/supabaseClient'

// fromKey/toKey: 'AAAA-MM-DD', ambos inclusive.
export async function listHolidaysInRange(fromKey, toKey) {
  const { data, error } = await supabase.from('holidays').select('*').gte('date', fromKey).lte('date', toKey).order('date')
  if (error) throw error
  return data
}

// Check de feriado de la vista Semana. Marcar un dia que ya es feriado no
// falla (doble clic, otra pestaña abierta): simplemente no cambia nada.
export async function markHoliday(date) {
  const { error } = await supabase.from('holidays').upsert({ date }, { onConflict: 'date', ignoreDuplicates: true })
  if (error) throw error
}

export async function unmarkHoliday(date) {
  const { error } = await supabase.from('holidays').delete().eq('date', date)
  if (error) throw error
}
