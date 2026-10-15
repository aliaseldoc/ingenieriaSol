import { supabase } from '../lib/supabaseClient'

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function listTechnicians() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'tecnico')
    .eq('active', true)
    .order('full_name')
  if (error) throw error
  return data
}

// Activos e inactivos (para poder reactivar), pero no los eliminados: esos
// quedan en la base solo para que las visitas que hicieron sigan mostrando su
// nombre.
export async function listStaff() {
  const { data, error } = await supabase.from('profiles').select('*').is('deleted_at', null).order('full_name')
  if (error) throw error
  return data
}

export async function setProfileActive(profileId, active) {
  const { error } = await supabase.from('profiles').update({ active }).eq('id', profileId)
  if (error) throw error
}

export async function updateProfile(profileId, changes) {
  const { data, error } = await supabase.from('profiles').update(changes).eq('id', profileId).select().single()
  if (error) throw error
  return data
}
