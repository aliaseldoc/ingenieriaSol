import { supabase } from '../lib/supabaseClient'
import { invokeEdgeFunction } from './edgeFunctions'

// El usuario es la parte de adelante del email de la cuenta (usuario@dominio):
// Supabase rechaza espacios, acentos y simbolos. El minimo de la contrasena es
// el de Supabase Auth.
export const MIN_PASSWORD_LENGTH = 6
const USERNAME_PATTERN = /^[a-z0-9._-]+$/

// Lo que esta mal en el usuario, o null si sirve. Se revisa antes de llamar a
// la funcion para avisar en el momento y en castellano.
export function usernameProblem(username) {
  const normalized = username.trim().toLowerCase()
  if (!normalized) return 'Falta el usuario.'
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'El usuario solo puede tener letras sin acentos, números, puntos o guiones, sin espacios.'
  }
  return null
}

// Supabase Auth responde en ingles: se traducen los rechazos que se pueden dar
// al dar de alta o renombrar una cuenta.
function describeAccountError(error) {
  const message = error?.message ?? ''
  if (/already (been )?registered|already exists|profiles_username_key/i.test(message)) {
    return 'Ya existe una cuenta con ese usuario. Elegí otro.'
  }
  const minLength = message.match(/at least (\d+) characters/i)
  if (minLength) return `La contraseña tiene que tener al menos ${minLength[1]} caracteres.`
  if (/weak|should contain/i.test(message)) return 'La contraseña es muy débil: combiná letras y números.'
  if (/invalid format|validate email/i.test(message)) {
    return 'El usuario solo puede tener letras sin acentos, números, puntos o guiones, sin espacios.'
  }
  return message || 'No se pudo completar la operación.'
}

export async function createStaffMember({ username, fullName, role, password, phone, address, registeredAt }) {
  try {
    return await invokeEdgeFunction('create-staff', { username, fullName, role, password, phone, address, registeredAt })
  } catch (error) {
    throw new Error(describeAccountError(error))
  }
}

export async function renameStaffUsername(profileId, newUsername) {
  try {
    return await invokeEdgeFunction('update-username', { profileId, newUsername })
  } catch (error) {
    throw new Error(describeAccountError(error))
  }
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
