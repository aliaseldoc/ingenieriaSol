-- Migracion 0036: dias de estudio o medico (04/11/2026)
--
-- El empleado puede indicar que hoy no trabaja porque tiene un dia de estudio
-- o fue al medico. Ese dia paga la jornada (9 h de lunes a jueves, 8 h el
-- viernes), como un feriado, y si ademas trabajo, completa lo que falte para
-- llegar a la jornada (paidLeaveMinutesFor en
-- src/features/timesheet/computeTimesheet.js).
--
-- Quien lo marca:
--   * el tecnico y el administrativo (los que fichan en la app), solo el dia
--     de hoy y sin tocar lo que marco el supervisor;
--   * el supervisor, cualquier dia de lunes a viernes de una semana abierta:
--     asi lo carga tambien para quien solo ficha en el reloj.
--
-- Se puede volver a correr sin error.

-- ============================================================
-- 1. Tabla
-- ============================================================
-- Cascada: eliminar un legajo borra tambien sus dias de estudio o medico, igual
-- que sus fichajes y su almuerzo (la foto del cierre queda).
create table if not exists public.timesheet_leave_days (
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  kind text not null,
  marked_by_supervisor boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (employee_id, work_date)
);

comment on table public.timesheet_leave_days is
  'Dia de estudio o medico: paga la jornada de ese dia. Lo marca el empleado (solo hoy) o el supervisor.';

alter table public.timesheet_leave_days drop constraint if exists timesheet_leave_days_kind_check;
alter table public.timesheet_leave_days add constraint timesheet_leave_days_kind_check
  check (kind in ('estudio', 'medico'));

alter table public.timesheet_leave_days drop constraint if exists timesheet_leave_days_weekday_check;
alter table public.timesheet_leave_days add constraint timesheet_leave_days_weekday_check
  check (extract(isodow from work_date) between 1 and 5);

-- ============================================================
-- 2. Guarda: semana cerrada, dia que no es hoy, marca del supervisor
-- ============================================================
create or replace function public.timesheet_leave_days_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supervisor boolean := coalesce(public.current_staff_role() = 'supervisor', false);
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_date date;
  v_old_date date;
begin
  if tg_op = 'DELETE' then
    v_date := old.work_date;
  else
    v_date := new.work_date;
  end if;
  v_old_date := case when tg_op = 'INSERT' then v_date else old.work_date end;

  if exists (
    select 1 from public.timesheet_weeks
    where status = 'cerrada'
      and week_start in (date_trunc('week', v_date)::date, date_trunc('week', v_old_date)::date)
  ) then
    raise exception 'La semana ya está cerrada: pedile al supervisor que la reabra.';
  end if;

  if not v_supervisor then
    if tg_op <> 'INSERT' and old.marked_by_supervisor then
      raise exception 'Lo marcó el supervisor: pedile a él que lo cambie.';
    end if;
    if v_date <> v_today or v_old_date <> v_today then
      raise exception 'Solo se marca el día de hoy: pedile al supervisor que lo corrija.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  -- Quien, cuando y si fue el supervisor lo pone el servidor.
  new.marked_by_supervisor := v_supervisor;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists timesheet_leave_days_guard on public.timesheet_leave_days;
create trigger timesheet_leave_days_guard
  before insert or update or delete on public.timesheet_leave_days
  for each row execute function public.timesheet_leave_days_guard();

-- ============================================================
-- 3. Permisos
-- ============================================================
alter table public.timesheet_leave_days enable row level security;

-- El supervisor lee y corrige todo. El cierre automatico usa la clave de
-- servicio, que no pasa por la RLS.
drop policy if exists "timesheet_leave_days_all_supervisor" on public.timesheet_leave_days;
create policy "timesheet_leave_days_all_supervisor" on public.timesheet_leave_days
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

-- El tecnico y el administrativo (los que fichan en la app) marcan lo suyo.
drop policy if exists "timesheet_leave_days_select_own" on public.timesheet_leave_days;
create policy "timesheet_leave_days_select_own" on public.timesheet_leave_days
  for select to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

drop policy if exists "timesheet_leave_days_insert_own" on public.timesheet_leave_days;
create policy "timesheet_leave_days_insert_own" on public.timesheet_leave_days
  for insert to authenticated
  with check (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

drop policy if exists "timesheet_leave_days_update_own" on public.timesheet_leave_days;
create policy "timesheet_leave_days_update_own" on public.timesheet_leave_days
  for update to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id())
  with check (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

drop policy if exists "timesheet_leave_days_delete_own" on public.timesheet_leave_days;
create policy "timesheet_leave_days_delete_own" on public.timesheet_leave_days
  for delete to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

revoke all on public.timesheet_leave_days from anon;
