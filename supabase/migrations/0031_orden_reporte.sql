-- Migracion 0031: orden de liquidacion y horas fijas en el reporte (21/10/2026)
--
-- 1. El mail y el Excel del reporte semanal salen en el orden en que liquida
--    el contador (Desing/ordenLiquidacion.jpeg), no por nombre. Quien no tiene
--    lugar va al final, por nombre (compareReportRows en
--    src/features/timesheet/reportEmployees.js).
-- 2. Quien no ficha por un acuerdo aparte cobra siempre las mismas horas por
--    semana: el reporte se las pone como normales, sin mirar fichajes,
--    feriados ni almuerzos (computeWeekReport en computeTimesheet.js).
--
-- Los datos de las secciones 2 y 3 son los legajos de produccion: en una base
-- de prueba esos ids no existen y los update no tocan nada.
-- Se puede volver a correr sin error.

-- ============================================================
-- 1. Columnas
-- ============================================================
alter table public.employees add column if not exists report_position integer;

comment on column public.employees.report_position is
  'Lugar en la liquidacion del contador: orden del mail y del Excel del reporte. null = al final, por nombre.';

alter table public.employees add column if not exists fixed_weekly_minutes integer;

alter table public.employees drop constraint if exists employees_fixed_weekly_minutes_check;
alter table public.employees add constraint employees_fixed_weekly_minutes_check
  check (fixed_weekly_minutes is null or fixed_weekly_minutes between 1 and 7 * 24 * 60);

comment on column public.employees.fixed_weekly_minutes is
  'Horas fijas por semana, en minutos: no ficha y el reporte le paga estas horas como normales. null = ficha.';

-- ============================================================
-- 2. Orden de liquidacion (pedido del 21/10/2026)
-- ============================================================
update public.employees e
set report_position = orden.posicion
from (
  values
    (1, '0951f474-dfdd-436b-839f-b76150241d67'::uuid),  -- Saldico, Orlando
    (2, '851b6fd0-0b42-450f-98f0-bf7f0c65dd27'::uuid),  -- Spano Horacio
    (3, '6447ac25-1dc6-4e2b-a06d-eb66f5057e26'::uuid),  -- Espinoza, Martin
    (4, '3746421b-76c7-409e-9174-1c3a46dd622b'::uuid),  -- Martinez, Carlos
    (5, '94757740-2fa0-47ae-baaf-22bf3af64c92'::uuid),  -- Dell'Olio, Lautaro (legajo de tecnico)
    (6, 'cabcc170-e0b5-44a3-8de0-619a4d2144de'::uuid),  -- Ledesma Lautaro
    (7, '3166dc97-8322-4e5e-8fde-9a9af8a54f76'::uuid),  -- Zontella, Nazareno
    (8, 'd77b3b87-1866-47cb-a9ed-8a9679d38aab'::uuid),  -- Juarez, Facundo
    (9, '6efb0b41-1a9e-4814-8050-48427bc196cf'::uuid),  -- Lagoria, Alexis
    (10, 'b26e3b22-8449-482d-ab2a-5c25b53b1c59'::uuid), -- Mansilla, Gabriel
    (11, '154fd914-0eaa-465a-ae40-aaf08030b3fc'::uuid), -- Calustro, Tiziano
    (12, '97de85c2-7af1-466f-b09b-d6c68d3abf0f'::uuid), -- Vizgarra, Hugo
    (13, '330a6523-c035-4e7c-94bc-4b3168115314'::uuid)  -- Romero, Victor
) as orden (posicion, employee_id)
where e.id = orden.employee_id;

-- ============================================================
-- 3. Horas fijas: Lautaro Dellolio no ficha, cobra 25 h por semana
-- ============================================================
update public.employees
set fixed_weekly_minutes = 25 * 60
where id = '94757740-2fa0-47ae-baaf-22bf3af64c92';
