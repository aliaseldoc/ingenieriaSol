-- Migracion 0028: "Cantidad de visitas mensuales" en los datos
-- administrativos de la ficha del equipo (lo contratado; en general una o dos
-- visitas por mes). Opcional, como el resto de esos datos. Se puede volver a
-- correr sin error.
alter table public.equipment add column if not exists monthly_visits smallint
  check (monthly_visits between 1 and 31);
