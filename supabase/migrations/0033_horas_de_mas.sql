-- Migracion 0033: horas de mas de quien tiene horas fijas (24/10/2026)
--
-- Quien no ficha por un acuerdo aparte (employees.fixed_weekly_minutes, ver
-- 0031) tiene un horario simbolico de lunes a viernes desde las 08:00 (25 h =
-- de 8 a 13). Si un dia trabaja de mas, lo carga el mismo desde su pantalla de
-- fichaje: el reporte le suma esas horas como normales y le corre la salida de
-- ese dia (computeWeekReport en src/features/timesheet/computeTimesheet.js).
-- Nadie mas las carga: el supervisor solo las lee.
--
-- Se puede volver a correr sin error.

-- ============================================================
-- 1. Tabla
-- ============================================================
-- 0 minutos = sin horas de mas, asi la pantalla nunca borra: solo hace upsert.
-- Cascada: eliminar un legajo borra tambien sus horas de mas, igual que sus
-- fichajes y su almuerzo (la foto del cierre queda).
create table if not exists public.timesheet_extra_hours (
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  minutes integer not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (employee_id, work_date)
);

comment on table public.timesheet_extra_hours is
  'Horas de mas de un dia de lunes a viernes, de quien tiene horas fijas. Las carga el propio empleado; el reporte las suma como normales.';

alter table public.timesheet_extra_hours drop constraint if exists timesheet_extra_hours_minutes_check;
alter table public.timesheet_extra_hours add constraint timesheet_extra_hours_minutes_check
  check (minutes between 0 and 10 * 60 and minutes % 30 = 0);

alter table public.timesheet_extra_hours drop constraint if exists timesheet_extra_hours_weekday_check;
alter table public.timesheet_extra_hours add constraint timesheet_extra_hours_weekday_check
  check (extract(isodow from work_date) between 1 and 5);

-- ============================================================
-- 2. Guarda: semana cerrada, dia que no paso, legajo sin horas fijas
-- ============================================================
create or replace function public.timesheet_extra_hours_guard()
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
    raise exception 'La semana ya está cerrada: pedile al supervisor que la reabra.';
  end if;
  if new.work_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'Ese día todavía no pasó.';
  end if;
  if not exists (
    select 1 from public.employees
    where id = new.employee_id and fixed_weekly_minutes is not null
  ) then
    raise exception 'Solo quien tiene horas fijas carga horas de más.';
  end if;
  -- Quien y cuando lo cargo lo pone el servidor.
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists timesheet_extra_hours_guard on public.timesheet_extra_hours;
create trigger timesheet_extra_hours_guard
  before insert or update on public.timesheet_extra_hours
  for each row execute function public.timesheet_extra_hours_guard();

-- ============================================================
-- 3. Permisos
-- ============================================================
alter table public.timesheet_extra_hours enable row level security;

-- El supervisor las lee para el reporte y el cierre. El cierre automatico usa
-- la clave de servicio, que no pasa por la RLS.
drop policy if exists "timesheet_extra_hours_select_supervisor" on public.timesheet_extra_hours;
create policy "timesheet_extra_hours_select_supervisor" on public.timesheet_extra_hours
  for select to authenticated
  using (public.current_staff_role() = 'supervisor');

-- El propio empleado, desde su usuario de tecnico, y solo con horas fijas.
drop policy if exists "timesheet_extra_hours_select_own" on public.timesheet_extra_hours;
create policy "timesheet_extra_hours_select_own" on public.timesheet_extra_hours
  for select to authenticated
  using (public.current_staff_role() = 'tecnico' and employee_id = public.current_employee_id());

drop policy if exists "timesheet_extra_hours_insert_own" on public.timesheet_extra_hours;
create policy "timesheet_extra_hours_insert_own" on public.timesheet_extra_hours
  for insert to authenticated
  with check (
    public.current_staff_role() = 'tecnico'
    and employee_id = public.current_employee_id()
    and exists (select 1 from public.employees e where e.id = timesheet_extra_hours.employee_id and e.fixed_weekly_minutes is not null)
  );

drop policy if exists "timesheet_extra_hours_update_own" on public.timesheet_extra_hours;
create policy "timesheet_extra_hours_update_own" on public.timesheet_extra_hours
  for update to authenticated
  using (public.current_staff_role() = 'tecnico' and employee_id = public.current_employee_id())
  with check (
    public.current_staff_role() = 'tecnico'
    and employee_id = public.current_employee_id()
    and exists (select 1 from public.employees e where e.id = timesheet_extra_hours.employee_id and e.fixed_weekly_minutes is not null)
  );

revoke all on public.timesheet_extra_hours from anon;
