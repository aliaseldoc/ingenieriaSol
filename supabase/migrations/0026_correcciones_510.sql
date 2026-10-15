-- CORRECCIONES510: eliminar personal, cuentas desactivadas que no entran,
-- ubicacion privada al fichar, administrativos que fichan y cierre semanal
-- automatico. Se puede correr mas de una vez.

-- ============================================================
-- 1. Cuentas desactivadas o eliminadas: sin permisos
-- ============================================================
-- Hasta ahora "Desactivar" solo cambiaba una marca: nadie la controlaba y la
-- cuenta seguia entrando con todos sus permisos. current_staff_role() es la
-- llave de casi todas las politicas, asi que alcanza con que no devuelva rol
-- para una cuenta inactiva o eliminada.
alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active and deleted_at is null;
$$;

-- El tecnico ve y edita las visitas de sus hojas de ruta por esta funcion,
-- que solo miraba si figuraba en la hoja. Ahora ademas tiene que estar activo.
create or replace function public.is_route_sheet_technician(p_route_sheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() is not null and exists (
    select 1 from public.route_sheet_technicians rst
    where rst.route_sheet_id = p_route_sheet_id and rst.technician_id = auth.uid()
  );
$$;

-- Las lecturas abiertas a "cualquier logueado" pasan a exigir cuenta activa.
drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated" on public.clients
  for select to authenticated
  using (public.current_staff_role() is not null);

drop policy if exists "equipment_select_authenticated" on public.equipment;
create policy "equipment_select_authenticated" on public.equipment
  for select to authenticated
  using (public.current_staff_role() is not null);

drop policy if exists "vehicles_select_authenticated" on public.vehicles;
create policy "vehicles_select_authenticated" on public.vehicles
  for select to authenticated
  using (public.current_staff_role() is not null);

-- El propio perfil se sigue pudiendo leer aunque este desactivado: es lo que
-- le permite a la app decirle por que no puede entrar.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (public.current_staff_role() is not null or id = auth.uid());

-- Antes cada uno podia modificar su propio perfil, columnas incluidas: un
-- tecnico podia ponerse rol de supervisor, y un desactivado reactivarse. La
-- app nunca usaba esa rama (las unicas escrituras son del supervisor y "Mi
-- perfil" solo cambia la contraseña, que va por auth), asi que se cierra.
drop policy if exists "profiles_update_self_or_supervisor" on public.profiles;
drop policy if exists "profiles_update_supervisor" on public.profiles;
create policy "profiles_update_supervisor" on public.profiles
  for update to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

drop policy if exists "visit_event_reads_insert_own" on public.visit_event_reads;
create policy "visit_event_reads_insert_own" on public.visit_event_reads
  for insert to authenticated
  with check (profile_id = auth.uid() and public.current_staff_role() is not null);

drop policy if exists "visit_event_reads_select" on public.visit_event_reads;
create policy "visit_event_reads_select" on public.visit_event_reads
  for select to authenticated
  using (
    (profile_id = auth.uid() and public.current_staff_role() is not null)
    or public.current_staff_role() in ('administrativo', 'supervisor')
  );

-- ============================================================
-- 2. Eliminar personal y empleados de fabrica
-- ============================================================
-- Personal: el perfil NO se borra. Visitas, hojas de ruta, validaciones y
-- cierres de semana lo referencian sin cascada, y las visitas realizadas
-- tienen que seguir mostrando quien las hizo. Queda como "lapida": marcado
-- deleted_at, sin cuenta de acceso (la Edge Function delete-staff la borra) y
-- sin horas. Por eso se suelta la FK hacia auth.users: con ella, borrar la
-- cuenta arrastraba al perfil, y las visitas lo impedian.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Una hoja de ruta "pendiente" es la que no tiene ninguna visita realizada
-- (todas planificadas o en borrador). De esas se saca a quien se elimina; de
-- las que tienen visitas hechas no, porque ahi esta su historial.
create or replace function public.is_pending_route_sheet(p_route_sheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.visits v
    where v.route_sheet_id = p_route_sheet_id and v.status not in ('planificada', 'borrador')
  );
$$;

-- Lo que se va a perder o cambiar, para la advertencia antes de confirmar.
create or replace function public.staff_deletion_preview(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo un supervisor puede eliminar personal.';
  end if;

  select id into v_employee_id from public.employees where profile_id = p_profile_id;

  return (
    with hojas as (
      select rst.route_sheet_id,
             (select count(*) from public.route_sheet_technicians o where o.route_sheet_id = rst.route_sheet_id) as tecnicos
      from public.route_sheet_technicians rst
      where rst.technician_id = p_profile_id and public.is_pending_route_sheet(rst.route_sheet_id)
    )
    select jsonb_build_object(
      'fichajes', (select count(*) from public.time_punches where employee_id = v_employee_id),
      'visitas_pendientes', (select count(*) from public.visits v where v.route_sheet_id in (select route_sheet_id from hojas)),
      'visitas_sin_tecnico', (select count(*) from public.visits v
                               where v.route_sheet_id in (select route_sheet_id from hojas where tecnicos = 1)),
      'visitas_realizadas', (select count(*) from public.visits v
                              join public.route_sheet_technicians rst on rst.route_sheet_id = v.route_sheet_id
                              where rst.technician_id = p_profile_id and v.status not in ('planificada', 'borrador'))
    )
  );
end;
$$;

-- Todo en una transaccion: si algo falla, no se pierde nada.
create or replace function public.delete_staff_member(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_employee public.employees;
  v_fichajes integer := 0;
  v_pendientes integer := 0;
  v_hojas integer := 0;
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo un supervisor puede eliminar personal.';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'No podés eliminar tu propio usuario.';
  end if;

  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'No se encontró a esa persona.';
  end if;
  -- Reintentar es seguro: si ya se elimino, no hay nada mas que hacer.
  if v_profile.deleted_at is not null then
    return jsonb_build_object('fichajes', 0, 'pendientes', 0, 'hojas', 0, 'ya_eliminado', true);
  end if;

  select * into v_employee from public.employees where profile_id = p_profile_id;
  if found then
    if v_employee.clock_pin is not null then
      delete from public.clock_pending_punches where clock_pin = v_employee.clock_pin;
      get diagnostics v_pendientes = row_count;
    end if;
    delete from public.time_punches where employee_id = v_employee.id;
    get diagnostics v_fichajes = row_count;
    delete from public.employees where id = v_employee.id;
  end if;

  delete from public.route_sheet_technicians rst
  where rst.technician_id = p_profile_id and public.is_pending_route_sheet(rst.route_sheet_id);
  get diagnostics v_hojas = row_count;

  -- El nombre se conserva tal cual (es lo que muestran las visitas). El
  -- usuario se libera para poder volver a darlo de alta.
  update public.profiles
  set deleted_at = now(),
      active = false,
      username = username || '.eliminado.' || left(replace(id::text, '-', ''), 6)
  where id = p_profile_id;

  return jsonb_build_object('fichajes', v_fichajes, 'pendientes', v_pendientes, 'hojas', v_hojas);
end;
$$;

-- Empleado de fabrica: no tiene cuenta ni visitas, se borra entero.
create or replace function public.delete_factory_employee(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees;
  v_fichajes integer := 0;
  v_pendientes integer := 0;
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo un supervisor puede eliminar empleados.';
  end if;

  select * into v_employee from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'No se encontró ese empleado.';
  end if;
  if v_employee.profile_id is not null then
    raise exception 'Ese legajo es de una cuenta de Personal: eliminala desde Personal.';
  end if;

  if v_employee.clock_pin is not null then
    delete from public.clock_pending_punches where clock_pin = v_employee.clock_pin;
    get diagnostics v_pendientes = row_count;
  end if;
  delete from public.time_punches where employee_id = v_employee.id;
  get diagnostics v_fichajes = row_count;
  delete from public.employees where id = v_employee.id;

  return jsonb_build_object('fichajes', v_fichajes, 'pendientes', v_pendientes);
end;
$$;

-- Los permisos de ejecucion de todo el archivo estan al final (seccion 6).

-- ============================================================
-- 3. Ubicacion privada: solo la distancia a la fabrica
-- ============================================================
-- Al fichar desde la app se calcula a cuantos metros de la fabrica estaba la
-- persona y se descartan las coordenadas. Lo que no se guarda no se puede ver
-- ni filtrar, ni siquiera con herramientas tecnicas. security definer porque
-- el tecnico no puede leer la configuracion de la fabrica.
alter table public.time_punches add column if not exists distance_to_factory_m integer;

create or replace function public.time_punches_location_privacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.timesheet_settings;
begin
  if new.latitude is not null and new.longitude is not null then
    select * into v_settings from public.timesheet_settings where id;
    if v_settings.factory_latitude is not null and v_settings.factory_longitude is not null then
      -- Haversine, igual que geo.js. El least() evita un asin(1.0000001) por
      -- redondeo de punto flotante.
      new.distance_to_factory_m := round(2 * 6371000 * asin(least(1, sqrt(
        power(sin(radians(new.latitude - v_settings.factory_latitude) / 2), 2)
        + cos(radians(v_settings.factory_latitude)) * cos(radians(new.latitude))
          * power(sin(radians(new.longitude - v_settings.factory_longitude) / 2), 2)
      ))));
    end if;
  end if;
  new.latitude := null;
  new.longitude := null;
  return new;
end;
$$;

drop trigger if exists time_punches_location_privacy on public.time_punches;
create trigger time_punches_location_privacy
  before insert or update on public.time_punches
  for each row execute function public.time_punches_location_privacy();

-- Las coordenadas que ya estaban: el trigger calcula su distancia y las borra.
-- La guarda de semana cerrada se apaga solo para esta pasada, que no cambia
-- ningun horario.
alter table public.time_punches disable trigger time_punches_guard;
update public.time_punches set latitude = latitude
where latitude is not null or longitude is not null;
alter table public.time_punches enable trigger time_punches_guard;

-- ============================================================
-- 4. Los administrativos fichan, igual que el tecnico
-- ============================================================
-- Ven lo suyo y fichan desde la app. Editar sigue siendo solo del supervisor.
drop policy if exists "employees_select_own" on public.employees;
create policy "employees_select_own" on public.employees
  for select to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and profile_id = auth.uid());

drop policy if exists "time_punches_select_own" on public.time_punches;
create policy "time_punches_select_own" on public.time_punches
  for select to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo') and employee_id = public.current_employee_id());

drop policy if exists "time_punches_insert_own_app" on public.time_punches;
create policy "time_punches_insert_own_app" on public.time_punches
  for insert to authenticated
  with check (
    public.current_staff_role() in ('tecnico', 'administrativo')
    and employee_id = public.current_employee_id()
    and source = 'app'
    and created_by = auth.uid()
    and voided_at is null
    and import_id is null
    and replaces_punch_id is null
    and punched_at <= now() + interval '5 minutes'
  );

drop policy if exists "holidays_select_tecnico" on public.holidays;
drop policy if exists "holidays_select_quienes_fichan" on public.holidays;
create policy "holidays_select_quienes_fichan" on public.holidays
  for select to authenticated
  using (public.current_staff_role() in ('tecnico', 'administrativo'));

-- ============================================================
-- 5. Cierre semanal automatico y mail del reporte
-- ============================================================
-- A quien se le manda el reporte: lo carga el supervisor en la configuracion
-- del fichaje. Vacio = no se manda nada.
alter table public.timesheet_settings
  add column if not exists report_recipients text[] not null default '{}';

-- Si el reporte de la semana ya salio por mail. report_sent_count > 0 al
-- mandarlo de nuevo = es una version corregida.
alter table public.timesheet_weeks add column if not exists report_sent_at timestamptz;
alter table public.timesheet_weeks add column if not exists report_sent_count integer not null default 0;

-- El cierre automatico no lo hace ninguna persona.
alter table public.timesheet_week_events alter column actor_id drop not null;

-- Lo llama solo la Edge Function cierre-semanal (con la clave de servicio).
-- Si la semana ya estaba cerrada (el supervisor se adelanto), no hace nada.
create or replace function public.close_timesheet_week_auto(p_week_start date, p_snapshot jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.timesheet_weeks (week_start, status, closed_by, closed_at, snapshot)
  values (p_week_start, 'cerrada', null, now(), p_snapshot)
  on conflict (week_start) do update
    set status = 'cerrada', closed_by = null, closed_at = now(), snapshot = excluded.snapshot
    where public.timesheet_weeks.status = 'abierta';

  if not found then
    return false;
  end if;

  insert into public.timesheet_week_events (week_start, action, reason, actor_id)
  values (p_week_start, 'cerrada', 'Cierre automático', null);
  return true;
end;
$$;

create or replace function public.mark_week_report_sent(p_week_start date)
returns void
language sql
security definer
set search_path = public
as $$
  update public.timesheet_weeks
  set report_sent_at = now(), report_sent_count = report_sent_count + 1
  where week_start = p_week_start and status = 'cerrada';
$$;

-- Igual que en 0021, pero ademas marca el reporte como no enviado: si se
-- reabre para corregir y se vuelve a cerrar, sale la version corregida.
create or replace function public.reopen_timesheet_week(p_week_start date, p_reason text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo un supervisor puede reabrir una semana.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Indicá el motivo de la reapertura.';
  end if;

  -- closed_at se conserva: sirve para detectar fichajes que llegaron despues
  -- del ultimo cierre.
  update public.timesheet_weeks
  set status = 'abierta', snapshot = null, report_sent_at = null
  where week_start = p_week_start and status = 'cerrada';

  if not found then
    raise exception 'La semana no está cerrada.';
  end if;

  insert into public.timesheet_week_events (week_start, action, reason, actor_id)
  values (p_week_start, 'reabierta', p_reason, auth.uid());
end;
$$;

-- ============================================================
-- 6. Permisos de ejecucion
-- ============================================================
-- Supabase le da permiso de ejecucion DIRECTO a anon y authenticated sobre
-- cada funcion nueva del esquema public (default privileges). Por eso un
-- "revoke ... from public" no alcanza: hay que sacarselo a cada rol por
-- nombre. Verificado en produccion el 2026-10-05: las funciones del reloj
-- (0025), que se documentaron como "revocadas para los logueados", las podia
-- llamar cualquiera con la clave publica de la app, anon incluido.

-- Solo el servidor (clave de servicio): el endpoint del reloj y el cierre
-- semanal. Las internas las llaman funciones security definer, que corren
-- como su dueño y no necesitan el permiso.
revoke execute on function public.ingest_clock_punches(text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.touch_clock_device(text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.claim_pending_punches(text) from public, anon, authenticated;
revoke execute on function public.close_timesheet_week_auto(date, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_week_report_sent(date) from public, anon, authenticated;
revoke execute on function public.is_pending_route_sheet(uuid) from public, anon, authenticated;
grant execute on function public.ingest_clock_punches(text, jsonb, text, text) to service_role;
grant execute on function public.touch_clock_device(text, text, jsonb, text) to service_role;
grant execute on function public.close_timesheet_week_auto(date, jsonb) to service_role;
grant execute on function public.mark_week_report_sent(date) to service_role;

-- Del supervisor (lo controlan por dentro), nunca de anon.
revoke execute on function public.staff_deletion_preview(uuid) from public, anon;
revoke execute on function public.delete_staff_member(uuid) from public, anon;
revoke execute on function public.delete_factory_employee(uuid) from public, anon;
revoke execute on function public.reprocess_clock_punches() from public, anon;
grant execute on function public.staff_deletion_preview(uuid) to authenticated;
grant execute on function public.delete_staff_member(uuid) to authenticated;
grant execute on function public.delete_factory_employee(uuid) to authenticated;
grant execute on function public.reprocess_clock_punches() to authenticated;
