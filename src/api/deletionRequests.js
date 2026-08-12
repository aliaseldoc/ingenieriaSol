import { supabase } from '../lib/supabaseClient'
import { deleteClient } from './clients'
import { deleteEquipment } from './equipment'

export async function listPendingDeletionRequests() {
  const { data, error } = await supabase
    .from('deletion_requests')
    .select('*, requested_by_profile:profiles!requested_by(full_name)')
    .eq('status', 'pendiente')
    .order('requested_at')
  if (error) throw error
  return data
}

export async function requestDeletion({ entityType, entityId, entityName, requestedBy }) {
  const { data, error } = await supabase
    .from('deletion_requests')
    .insert({ entity_type: entityType, entity_id: entityId, entity_name: entityName, requested_by: requestedBy })
    .select()
    .single()
  if (error) throw error
  return data
}

// request: { id, entity_type, entity_id } de la solicitud a resolver.
// Si status es 'aprobada', primero se intenta borrar la entidad real; si
// falla (ej. FK: todavia tiene equipos/visitas asociadas), la solicitud
// queda "pendiente" y el error se propaga sin marcarla como resuelta.
export async function resolveDeletionRequest(request, { status, reviewedBy, reviewNotes }) {
  if (status === 'aprobada') {
    if (request.entity_type === 'cliente') await deleteClient(request.entity_id)
    else await deleteEquipment(request.entity_id)
  }

  const { error } = await supabase
    .from('deletion_requests')
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_notes: reviewNotes })
    .eq('id', request.id)
  if (error) throw error
}
