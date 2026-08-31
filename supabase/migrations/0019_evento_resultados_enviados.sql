-- El supervisor registra 'resultados_enviados' al mandar los resultados por
-- mail (ver ValidationPage), pero ese valor nunca estuvo en el check del
-- event_type: el insert fallaba, el catch mostraba el cartel de error aunque
-- el mail ya habia salido, y el contador de envios nunca subia.
alter table public.visit_events drop constraint visit_events_event_type_check;
alter table public.visit_events add constraint visit_events_event_type_check
  check (event_type in ('creada', 'borrador_guardado', 'enviada', 'revision_solicitada',
                        'recibida', 'aprobada', 'rechazada', 'resultados_enviados'));
