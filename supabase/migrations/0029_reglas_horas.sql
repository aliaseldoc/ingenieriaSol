-- Migracion 0029: nuevas reglas de horas del fichaje (14/10/2026)
--
-- Las reglas (44 h semanales, noche y fin de semana al 100%, feriado que paga
-- la jornada de su dia) viven en el motor, src/features/timesheet/
-- computeTimesheet.js. La base solo guarda si cada dia hubo almuerzo, que ahora
-- se puede declarar:
--   * el empleado, con el check de la pantalla de fichaje: viaja con la salida
--     (time_punches.lunch_taken), asi funciona igual sin conexion;
--   * el supervisor, desde el detalle del dia (timesheet_lunch_overrides): gana
--     a lo que dijo el empleado y sirve para los de fabrica, que fichan solo
--     con el reloj.
-- Sin dato se asume que almorzo. Se puede volver a correr sin error.

-- ============================================================
-- 1. Lo que declara el empleado al registrar la salida
-- ============================================================
-- null = no lo declaro (fichajes del reloj, anteriores a esta version o
-- cargados por el supervisor).
alter table public.time_punches add column if not exists lunch_taken boolean;

alter table public.time_punches drop constraint if exists time_punches_lunch_only_salida;
alter table public.time_punches add constraint time_punches_lunch_only_salida
  check (lunch_taken is null or punch_type = 'salida');

-- ============================================================
-- 2. Lo que marca el supervisor
-- ============================================================
-- Cascada: eliminar un legajo (delete_staff_member, delete_factory_employee)
-- borra tambien lo que se marco de su almuerzo, igual que sus fichajes.
create table if not exists public.timesheet_lunch_overrides (
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  lunch_taken boolean not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (employee_id, work_date)
);

comment on table public.timesheet_lunch_overrides is
  'Almuerzo de un dia marcado por el supervisor. Gana a lo que declaro el empleado en su salida.';

-- Con la semana cerrada no se cambia (igual que holidays_guard). No mira los
-- borrados: los hace solo la cascada al eliminar un legajo, que tambien borra
-- sus fichajes de semanas cerradas (la foto del cierre queda).
create or replace function public.timesheet_lunch_overrides_guard()
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
    raise exception 'La semana está cerrada. Reabrila para modificar el almuerzo.';
  end if;
  -- Quien y cuando lo marco lo pone el servidor.
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists timesheet_lunch_overrides_guard on public.timesheet_lunch_overrides;
create trigger timesheet_lunch_overrides_guard
  before insert or update on public.timesheet_lunch_overrides
  for each row execute function public.timesheet_lunch_overrides_guard();

alter table public.timesheet_lunch_overrides enable row level security;

-- El supervisor marca y lee todo. El tecnico y el administrativo leen lo suyo,
-- para que su vista de horas de lo mismo que la del supervisor; no lo editan.
drop policy if exists "timesheet_lunch_overrides_supervisor_all" on public.timesheet_lunch_overrides;
create policy "timesheet_lunch_overrides_supervisor_all" on public.timesheet_lunch_overrides
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

drop policy if exists "timesheet_lunch_overrides_select_own" on public.timesheet_lunch_overrides;
create policy "timesheet_lunch_overrides_select_own" on public.timesheet_lunch_overrides
  for select to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

revoke all on public.timesheet_lunch_overrides from anon;
