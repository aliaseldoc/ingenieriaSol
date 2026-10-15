import { supabase } from '../lib/supabaseClient'
import { invokeEdgeFunction } from './edgeFunctions'

export async function createStaffMember({ username, fullName, role, password, phone, address, registeredAt }) {
  const { data, error } = await supabase.functions.invoke('create-staff', {
    body: { username, fullName, role, password, phone, address, registeredAt },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function renameStaffUsername(profileId, newUsername) {
  const { data, error } = await supabase.functions.invoke('update-username', {
    body: { profileId, newUsername },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// Lo que se pierde o cambia al eliminar a alguien (para la advertencia):
// { fichajes, visitas_pendientes, visitas_sin_tecnico, visitas_realizadas }.
export async function getStaffDeletionPreview(profileId) {
  const { data, error } = await supabase.rpc('staff_deletion_preview', { p_profile_id: profileId })
  if (error) throw error
  return data
}

// Borra la cuenta de acceso y las horas. El perfil queda como registro para
// que las visitas que hizo sigan mostrando su nombre (ver Edge Function
// delete-staff y la migracion 0026).
export async function deleteStaffMember(profileId) {
  return invokeEdgeFunction('delete-staff', { profileId })
}
