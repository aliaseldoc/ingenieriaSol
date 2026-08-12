-- Nuevo recuadro "Cambios y Agregados" del formulario tecnico (aceite y
-- refrigerante agregados, mas los 4 "cambio de filtro/bateria" Si/No). Una
-- sola columna jsonb, mismo criterio que checklist_data: el set de campos
-- vive en src/lib/constants.js (VISIT_CHANGES_FIELDS), agregar uno nuevo no
-- requiere otra migracion. RLS: no hace falta policy nueva, es a nivel de
-- fila y "visits_update_own_editable"/"visits_update_staff" ya cubren
-- cualquier columna de visits (ver 0009_visit_signatures.sql).
alter table public.visits add column changes_data jsonb;

comment on column public.visits.changes_data is 'Aceite/refrigerante agregados y cambios de filtro/bateria durante la visita, ver VISIT_CHANGES_FIELDS.';
