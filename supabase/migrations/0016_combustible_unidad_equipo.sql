-- El tecnico carga el combustible en litros o en porcentaje, segun el equipo
-- (ver FuelParameterField.jsx). Hasta ahora la ficha del equipo solo espejaba
-- el porcentaje, asi que una visita cargada en litros terminaba mostrandose
-- convertida: 120 L en un tanque de 1000 L se veia como "12%".
--
-- Se agrega el valor en litros y la unidad elegida, para que la planilla
-- muestre el nivel en la misma unidad en que se relevo. fuel_percentage se
-- mantiene porque es lo que usan las alertas de combustible (<= 30%).
alter table public.equipment add column fuel_liters numeric;
alter table public.equipment add column fuel_level_unit text;
