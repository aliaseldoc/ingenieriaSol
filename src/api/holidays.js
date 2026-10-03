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

// Carga varios feriados de una sola vez (calendario oficial). ignoreDuplicates:
// lo que ya estaba marcado no se toca, ni siquiera el nombre — actualizar una
// fila de una semana cerrada lo rechaza la base, y el supervisor pudo haberlo
// marcado a proposito. Devuelve cuantos entraron de verdad.
export async function markHolidays(rows) {
  if (rows.length === 0) return 0
  const { data, error } = await supabase
    .from('holidays')
    .upsert(
      rows.map(({ date, name }) => ({ date, name })),
      { onConflict: 'date', ignoreDuplicates: true }
    )
    .select('date')
  if (error) throw error
  return data?.length ?? 0
}
