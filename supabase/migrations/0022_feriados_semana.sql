-- Feriados desde la grilla semanal (ver FICHAJE.md): el supervisor marca un
-- dia como feriado con un check junto al dia, sin nombre, y desaparece la
-- pestaña "Feriados". 0021 ya estaba aplicada en produccion, por eso el
-- cambio va en esta migracion aparte. Se puede correr mas de una vez.

-- El check no pide nombre: los feriados nuevos quedan como "Feriado". Los
-- nombres ya cargados se conservan (ya no se muestran en ninguna pantalla).
alter table public.holidays alter column name set default 'Feriado';

-- Marcar o desmarcar un feriado cambia las horas de esa semana: con la
-- semana cerrada no se permite, igual que corregir un fichaje.
create or replace function public.holidays_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.timesheet_weeks
    where status = 'cerrada'
      and week_start in (date_trunc('week', coalesce(new.date, old.date))::date, date_trunc('week', coalesce(old.date, new.date))::date)
  ) then
    raise exception 'La semana está cerrada. Reabrila para modificar feriados.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists holidays_guard on public.holidays;
create trigger holidays_guard
  before insert or update or delete on public.holidays
  for each row execute function public.holidays_guard();

-- Policies del tecnico en su version definitiva. Durante el desarrollo de
-- 0021 se les agrego el filtro por rol (el administrativo no ve nada del
-- modulo) y se saco arrived_after_close del WITH CHECK (lo marca el trigger).
-- Recrearlas garantiza esa version aunque 0021 se haya aplicado antes de esos
-- ajustes; si ya estaba la final, no cambia nada.
drop policy if exists "employees_select_own" on public.employees;
create policy "employees_select_own" on public.employees
  for select to authenticated
  using (public.current_staff_role() = 'tecnico' and profile_id = auth.uid());

drop policy if exists "time_punches_select_own" on public.time_punches;
create policy "time_punches_select_own" on public.time_punches
  for select to authenticated
  using (public.current_staff_role() = 'tecnico' and employee_id = public.current_employee_id());

drop policy if exists "time_punches_insert_own_app" on public.time_punches;
create policy "time_punches_insert_own_app" on public.time_punches
  for insert to authenticated
  with check (
    public.current_staff_role() = 'tecnico'
    and employee_id = public.current_employee_id()
    and source = 'app'
    and created_by = auth.uid()
    and voided_at is null
    and import_id is null
    and replaces_punch_id is null
    and punched_at <= now() + interval '5 minutes'
  );
