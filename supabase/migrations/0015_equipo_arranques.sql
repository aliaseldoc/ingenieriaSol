-- Espejo del ultimo numero de arranques registrado del equipo, para poder
-- mostrarselo al tecnico como referencia al cargar la proxima visita.
-- Se actualiza al recibir la visita, igual que hours_of_use (ver
-- markVisitReceived en src/api/visits.js).
alter table public.equipment add column starts_count numeric;
