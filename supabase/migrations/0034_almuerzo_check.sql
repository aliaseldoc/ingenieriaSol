-- Migracion 0034: el check de almuerzo se guarda solo (24/10/2026)
--
-- Hasta ahora el check "Hoy frene a almorzar" de la pantalla de fichaje viajaba
-- con la salida registrada en la app (time_punches.lunch_taken, ver 0029). Si
-- la salida se fichaba en el reloj, lo marcado se perdia y se descontaba la
-- hora. Ahora el check se guarda apenas se toca, aparte de los fichajes, y el
-- motor lo lee se fiche donde se fiche la salida (resolveLunch en
-- src/features/timesheet/computeTimesheet.js): gana lo del supervisor
-- (timesheet_lunch_overrides), despues lo que trae la salida de la app (el
-- check se bloquea con la salida, asi que es lo ultimo que marco el empleado)
-- y despues este check.
--
-- Se puede volver a correr sin error.

-- ============================================================
-- 1. Tabla
-- ============================================================
-- Cascada: eliminar un legajo borra tambien lo que marco de su almuerzo, igual
-- que sus fichajes (la foto del cierre queda).
create table if not exists public.timesheet_lunch_checks (
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  lunch_taken boolean not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (employee_id, work_date)
);

comment on table public.timesheet_lunch_checks is
  'Almuerzo del dia marcado por el propio empleado en su pantalla de fichaje. Lo marcado por el supervisor le gana.';

-- ============================================================
-- 2. Guarda: semana cerrada, dia que no es hoy
-- ============================================================
-- Solo el dia de hoy: los anteriores los corrige el supervisor. Que no se
-- cambie despues de la salida lo controla la pantalla (la salida del reloj no
-- trae tipo: entrada o salida lo decide el motor).
create or replace function public.timesheet_lunch_checks_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.timesheet_weeks
    where status = 'cerrada'
      and week_start in (date_trunc('week', new.work_date)::date, date_trunc('week', coalesce(old.work_date, new.work_date))::date)
  ) then
    raise exception 'La semana ya está cerrada: pedile al supervisor que lo corrija.';
  end if;
  if new.work_date <> (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'Solo se marca el almuerzo de hoy: pedile al supervisor que lo corrija.';
  end if;
  -- Quien y cuando lo marco lo pone el servidor.
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists timesheet_lunch_checks_guard on public.timesheet_lunch_checks;
create trigger timesheet_lunch_checks_guard
  before insert or update on public.timesheet_lunch_checks
  for each row execute function public.timesheet_lunch_checks_guard();

-- ============================================================
-- 3. Permisos
-- ============================================================
alter table public.timesheet_lunch_checks enable row level security;

-- El supervisor lo lee para el reporte y el cierre; para corregirlo usa
-- timesheet_lunch_overrides. El cierre automatico usa la clave de servicio, que
-- no pasa por la RLS.
drop policy if exists "timesheet_lunch_checks_select_supervisor" on public.timesheet_lunch_checks;
create policy "timesheet_lunch_checks_select_supervisor" on public.timesheet_lunch_checks
  for select to authenticated
  using (public.current_staff_role() = 'supervisor');

-- El tecnico y el administrativo (los que fichan en la app) marcan lo suyo.
drop policy if exists "timesheet_lunch_checks_select_own" on public.timesheet_lunch_checks;
create policy "timesheet_lunch_checks_select_own" on public.timesheet_lunch_checks
  for select to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

drop policy if exists "timesheet_lunch_checks_insert_own" on public.timesheet_lunch_checks;
create policy "timesheet_lunch_checks_insert_own" on public.timesheet_lunch_checks
  for insert to authenticated
  with check (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

drop policy if exists "timesheet_lunch_checks_update_own" on public.timesheet_lunch_checks;
create policy "timesheet_lunch_checks_update_own" on public.timesheet_lunch_checks
  for update to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id())
  with check (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

revoke all on public.timesheet_lunch_checks from anon;
