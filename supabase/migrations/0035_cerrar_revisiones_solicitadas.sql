-- Migracion 0035: cierre de las visitas que quedaron en "Revision Solicitada"
-- (25/10/2026)
--
-- "Solicitar Revision" salio de la app con la 0024 (27/09/2026), pero 25
-- visitas de agosto y septiembre quedaron en ese estado: el tecnico todavia
-- podia editarlas y no figuraban como aprobadas. El usuario pidio desestimar
-- esos pedidos y darlas por cerradas, sin mandarlas a Recepcion:
--   * pasan a 'aprobada' y dejan de ser editables por el tecnico;
--   * reviewed_at y reviewed_by no se tocan: son de antes del 06/10/2026, asi
--     que las que nadie recibio siguen fuera de Pendientes de Recepcion (ver
--     RECEPTION_INDEPENDENT_SINCE en src/features/visitReview/receptionRules.js);
--     las que ya estaban recibidas siguen recibidas;
--   * queda un evento 'aprobada' en el historial de cada una, a nombre de
--     quien lo pidio (Lautaro Dellolio, supervisor).
--
-- Se puede volver a correr sin error: la segunda vez no encuentra ninguna.

insert into public.visit_events (visit_id, event_type, actor_id, notes)
select v.id, 'aprobada', '666b0d00-277b-4dfa-9e55-1eeb11019b5d', 'Cerrada sin revisión: se desestimó la revisión solicitada.'
from public.visits v
where v.status = 'revision_solicitada';

update public.visits
set status = 'aprobada'
where status = 'revision_solicitada';
