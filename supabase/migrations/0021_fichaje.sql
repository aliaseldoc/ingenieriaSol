-- Modulo de fichaje (ver FICHAJE.md): reloj biometrico de fabrica + fichaje
-- desde la app del tecnico. El supervisor es el unico que administra el
-- modulo; el tecnico solo inserta y consulta sus propios fichajes; el
-- administrativo no tiene acceso (sin policies).

-- ============================================================
-- employees: legajo de cada persona que ficha. Los empleados de fabrica no
-- tienen usuario (profile_id null); el personal con usuario tiene su legajo
-- vinculado por profile_id.
-- ============================================================
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  dni text,
  clock_pin text unique,
  phone text,
  profile_id uuid unique references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.employees is 'Legajos para el fichaje. clock_pin es el N° de usuario en el reloj biometrico.';

-- Un legajo por cada perfil existente (sin N° de reloj: lo carga el supervisor).
insert into public.employees (full_name, phone, profile_id, active)
select full_name, phone, id, active from public.profiles;

-- El alta de personal con usuario pasa por la Edge Function create-staff: en
-- vez de tocarla, un trigger crea el legajo en el mismo insert del perfil.
create or replace function public.create_employee_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employees (full_name, phone, profile_id, active)
  values (new.full_name, new.phone, new.id, new.active)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_employee
  after insert on public.profiles
  for each row execute function public.create_employee_for_profile();

-- Nombre, telefono y estado del legajo vinculado siguen siempre al perfil.
create or replace function public.sync_employee_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.employees
  set full_name = new.full_name, phone = new.phone, active = new.active
  where profile_id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_employee
  after update of full_name, phone, active on public.profiles
  for each row execute function public.sync_employee_from_profile();

-- Evita recursion y permite que las policies de time_punches sepan cual es
-- el legajo del usuario actual sin exponer la tabla employees.
create or replace function public.current_employee_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.employees where profile_id = auth.uid();
$$;

-- ============================================================
-- punch_imports: cada archivo del reloj que subio el supervisor
-- ============================================================
create table public.punch_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now(),
  rows_total integer not null default 0,
  rows_inserted integer not null default 0,
  rows_duplicated integer not null default 0,
  rows_unknown integer not null default 0,
  rows_closed_week integer not null default 0
);

-- ============================================================
-- time_punches: fichajes. Nunca se borran: una correccion anula el original
-- (voided_*) y crea uno manual que lo referencia (replaces_punch_id).
-- ============================================================
create table public.time_punches (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  punched_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  source text not null check (source in ('reloj', 'app', 'manual')),
  punch_type text check (punch_type in ('entrada', 'salida')),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  location_status text check (location_status in ('ok', 'sin_ubicacion')),
  location_error text check (location_error in ('permiso_denegado', 'no_disponible', 'tiempo_agotado')),
  recorded_offline boolean not null default false,
  arrived_after_close boolean not null default false,
  import_id uuid references public.punch_imports(id),
  replaces_punch_id uuid references public.time_punches(id),
  reason text,
  created_by uuid references public.profiles(id),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  -- El reloj no informa confiablemente entrada/salida (se infiere por
  -- alternancia); la app y las correcciones manuales siempre lo traen.
  constraint time_punches_type_required check (source = 'reloj' or punch_type is not null),
  constraint time_punches_manual_reason check (source <> 'manual' or nullif(trim(reason), '') is not null),
  constraint time_punches_void_reason check (voided_at is null or nullif(trim(void_reason), '') is not null),
  -- Hace segura la reimportacion del mismo archivo del reloj.
  constraint time_punches_unique_moment unique (employee_id, punched_at, source)
);

create index time_punches_employee_time_idx on public.time_punches(employee_id, punched_at);
create index time_punches_time_idx on public.time_punches(punched_at);

-- ============================================================
-- holidays: feriados cargados a mano por el supervisor
-- ============================================================
create table public.holidays (
  date date primary key,
  name text not null
);

-- ============================================================
-- timesheet_weeks: cierre semanal (lunes a domingo). Al cerrar se guarda la
-- foto del reporte; la semana cerrada no admite cambios.
-- ============================================================
create table public.timesheet_weeks (
  week_start date primary key check (extract(isodow from week_start) = 1),
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  snapshot jsonb
);

create table public.timesheet_week_events (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  action text not null check (action in ('cerrada', 'reabierta')),
  reason text,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index timesheet_week_events_week_idx on public.timesheet_week_events(week_start);

-- ============================================================
-- timesheet_settings: una sola fila con la ubicacion de la fabrica
-- ============================================================
create table public.timesheet_settings (
  id boolean primary key default true check (id),
  factory_name text,
  factory_latitude double precision check (factory_latitude between -90 and 90),
  factory_longitude double precision check (factory_longitude between -180 and 180),
  factory_radius_m integer not null default 500 check (factory_radius_m > 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.timesheet_settings (id) values (true);

-- ============================================================
-- Semana cerrada y hora del servidor
-- ============================================================
-- Lunes de la semana (hora argentina) a la que pertenece un instante.
create or replace function public.timesheet_week_start(p_moment timestamptz)
returns date
language sql
stable
as $$
  select (date_trunc('week', p_moment at time zone 'America/Argentina/Buenos_Aires'))::date;
$$;

-- security definer: el tecnico no puede leer timesheet_weeks, pero su insert
-- igual necesita saber si la semana esta cerrada.
create or replace function public.is_timesheet_week_closed(p_moment timestamptz)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.timesheet_weeks
    where week_start = public.timesheet_week_start(p_moment) and status = 'cerrada'
  );
$$;

create or replace function public.time_punches_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.received_at := now();
    -- Con conexion la hora la pone el servidor: no se puede manipular desde
    -- el celular. Solo los fichajes hechos sin conexion traen la hora del
    -- dispositivo (y quedan marcados como tales).
    if new.source = 'app' and not new.recorded_offline then
      new.punched_at := now();
    end if;

    if public.is_timesheet_week_closed(new.punched_at) then
      -- Un fichaje de la app que sincroniza tarde no se pierde: se acepta
      -- marcado y el supervisor decide si reabre la semana.
      if new.source = 'app' then
        new.arrived_after_close := true;
      else
        raise exception 'La semana está cerrada. Reabrila para modificar fichajes.';
      end if;
    end if;
  elsif public.is_timesheet_week_closed(old.punched_at) or public.is_timesheet_week_closed(new.punched_at) then
    raise exception 'La semana está cerrada. Reabrila para modificar fichajes.';
  end if;
  return new;
end;
$$;

create trigger time_punches_guard
  before insert or update on public.time_punches
  for each row execute function public.time_punches_guard();

-- ============================================================
-- Cierre y reapertura: una sola llamada atomica que cambia el estado y deja
-- el registro en el historial.
-- ============================================================
create or replace function public.close_timesheet_week(p_week_start date, p_snapshot jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo un supervisor puede cerrar una semana.';
  end if;

  insert into public.timesheet_weeks (week_start, status, closed_by, closed_at, snapshot)
  values (p_week_start, 'cerrada', auth.uid(), now(), p_snapshot)
  on conflict (week_start) do update
    set status = 'cerrada', closed_by = excluded.closed_by, closed_at = excluded.closed_at, snapshot = excluded.snapshot
    where public.timesheet_weeks.status = 'abierta';

  if not found then
    raise exception 'La semana ya está cerrada.';
  end if;

  insert into public.timesheet_week_events (week_start, action, actor_id)
  values (p_week_start, 'cerrada', auth.uid());
end;
$$;

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
  set status = 'abierta', snapshot = null
  where week_start = p_week_start and status = 'cerrada';

  if not found then
    raise exception 'La semana no está cerrada.';
  end if;

  insert into public.timesheet_week_events (week_start, action, reason, actor_id)
  values (p_week_start, 'reabierta', p_reason, auth.uid());
end;
$$;

revoke execute on function public.close_timesheet_week(date, jsonb) from public;
grant execute on function public.close_timesheet_week(date, jsonb) to authenticated;
revoke execute on function public.reopen_timesheet_week(date, text) from public;
grant execute on function public.reopen_timesheet_week(date, text) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.employees enable row level security;
alter table public.punch_imports enable row level security;
alter table public.time_punches enable row level security;
alter table public.holidays enable row level security;
alter table public.timesheet_weeks enable row level security;
alter table public.timesheet_week_events enable row level security;
alter table public.timesheet_settings enable row level security;

-- Supervisor: acceso total a todo el modulo.
create policy "employees_supervisor_all" on public.employees
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

create policy "punch_imports_supervisor_all" on public.punch_imports
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

create policy "time_punches_supervisor_all" on public.time_punches
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

create policy "holidays_supervisor_all" on public.holidays
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

create policy "timesheet_weeks_supervisor_all" on public.timesheet_weeks
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

create policy "timesheet_week_events_supervisor_all" on public.timesheet_week_events
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

create policy "timesheet_settings_supervisor_all" on public.timesheet_settings
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

-- Tecnico: ve su legajo y sus fichajes, e inserta solo fichajes propios de
-- la app. Sin update ni delete. Sin acceso a timesheet_settings (no ve la
-- leyenda de rango). arrived_after_close no se valida aca: el WITH CHECK corre
-- despues del trigger, que es quien lo marca en true si la semana esta cerrada.
-- Filtran por rol ademas de por dueño: administrativos y supervisores
-- tambien tienen legajo, pero el administrativo no ve nada del modulo.
create policy "employees_select_own" on public.employees
  for select to authenticated
  using (public.current_staff_role() = 'tecnico' and profile_id = auth.uid());

create policy "time_punches_select_own" on public.time_punches
  for select to authenticated
  using (public.current_staff_role() = 'tecnico' and employee_id = public.current_employee_id());

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

-- Lo necesita para calcular sus propias horas.
create policy "holidays_select_tecnico" on public.holidays
  for select to authenticated
  using (public.current_staff_role() = 'tecnico');
