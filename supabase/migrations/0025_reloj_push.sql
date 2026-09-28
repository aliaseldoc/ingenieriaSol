-- ============================================================
-- 0025 · Integracion directa con el reloj de huella (protocolo push de ZKTeco)
--
-- El reloj con WiFi sale a buscar al servidor por su cuenta y manda cada
-- fichaje apenas ocurre. El endpoint HTTP que lo atiende es solo un traductor
-- del protocolo: toda la logica vive aca, en una sola llamada atomica, igual
-- que el resto del modulo.
--
-- La importacion por archivo de 0021 queda intacta como respaldo: si el reloj
-- se queda sin red, se siguen bajando los registros con el pendrive y los
-- duplicados se descartan solos por la unicidad de time_punches.
-- ============================================================

-- ============================================================
-- Relojes dados de alta. Un fichaje solo entra si viene de un numero de serie
-- registrado y activo: es lo unico que identifica al equipo en el protocolo.
-- ============================================================
create table if not exists public.clock_devices (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique,
  name text not null,
  active boolean not null default true,
  last_seen_at timestamptz,
  last_push_at timestamptz,
  last_ip text,
  attlog_stamp text,
  clock_offset_seconds integer,
  punches_received integer not null default 0,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

comment on column public.clock_devices.attlog_stamp is
  'Marca que manda el reloj para saber desde donde seguir. Se le devuelve tal cual asi no reenvia todo cada vez.';
comment on column public.clock_devices.clock_offset_seconds is
  'Diferencia entre la hora que manda el reloj y la del servidor, medida sobre fichajes recientes. Positivo: el reloj esta adelantado.';

alter table public.time_punches
  add column if not exists device_id uuid references public.clock_devices(id);

-- ============================================================
-- Fichajes que llegaron pero todavia no se pueden guardar: un numero de reloj
-- sin legajo, o una semana ya cerrada. No se descartan nunca; entran solos en
-- cuanto se carga el legajo o se reabre la semana.
-- ============================================================
create table if not exists public.clock_pending_punches (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.clock_devices(id) on delete set null,
  clock_pin text not null,
  punched_at timestamptz not null,
  reason text not null check (reason in ('sin_legajo', 'semana_cerrada')),
  received_at timestamptz not null default now(),
  constraint clock_pending_unique unique (clock_pin, punched_at)
);

-- ============================================================
-- Diario del equipo: sirve para la puesta en marcha (ver que manda de verdad
-- el reloj) y para diagnosticar cuando deja de aparecer. Se poda solo.
-- ============================================================
create table if not exists public.clock_device_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.clock_devices(id) on delete cascade,
  serial_number text,
  kind text not null check (kind in ('contacto', 'fichajes', 'rechazo')),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clock_device_events_created_idx
  on public.clock_device_events (created_at desc);

-- ============================================================
-- Contacto del reloj (saludo inicial y consultas periodicas). Devuelve lo que
-- el endpoint necesita para contestarle sin conocer el modelo de datos.
-- ============================================================
create or replace function public.touch_clock_device(
  p_serial text,
  p_kind text default 'contacto',
  p_detail jsonb default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.clock_devices;
begin
  select * into v_device from public.clock_devices where serial_number = p_serial;

  if not found then
    insert into public.clock_device_events (serial_number, kind, detail)
    values (p_serial, 'rechazo', coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('motivo', 'serie no registrada'));
    return jsonb_build_object('conocido', false, 'activo', false);
  end if;

  update public.clock_devices
  set last_seen_at = now(),
      last_ip = coalesce(p_ip, last_ip)
  where id = v_device.id;

  if p_kind = 'contacto' then
    insert into public.clock_device_events (device_id, serial_number, kind, detail)
    values (v_device.id, p_serial, 'contacto', p_detail);
  end if;

  return jsonb_build_object(
    'conocido', true,
    'activo', v_device.active,
    'nombre', v_device.name,
    'attlog_stamp', v_device.attlog_stamp
  );
end;
$$;

-- ============================================================
-- Alta de los fichajes que manda el reloj. Una sola transaccion: o entran
-- todos los que se pueden, o no entra ninguno.
--
-- p_rows: [{ "pin": "15", "punched_at": "2026-09-27 08:03:12" }]
-- La hora viene sin zona, como la muestra el reloj, y se interpreta en hora
-- argentina (igual que el resto del modulo).
-- ============================================================
create or replace function public.ingest_clock_punches(
  p_serial text,
  p_rows jsonb,
  p_stamp text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.clock_devices;
  v_row jsonb;
  v_pin text;
  v_at timestamptz;
  v_employee uuid;
  v_offset integer;
  v_last_offset integer;
  v_affected integer;
  v_inserted integer := 0;
  v_duplicated integer := 0;
  v_unknown integer := 0;
  v_closed integer := 0;
  v_invalid integer := 0;
begin
  select * into v_device from public.clock_devices where serial_number = p_serial;

  if not found then
    insert into public.clock_device_events (serial_number, kind, detail)
    values (p_serial, 'rechazo', jsonb_build_object(
      'motivo', 'serie no registrada',
      'filas', jsonb_array_length(coalesce(p_rows, '[]'::jsonb))
    ));
    return jsonb_build_object('ok', false, 'motivo', 'serie_no_registrada');
  end if;

  if not v_device.active then
    insert into public.clock_device_events (device_id, serial_number, kind, detail)
    values (v_device.id, p_serial, 'rechazo', jsonb_build_object('motivo', 'reloj desactivado'));
    return jsonb_build_object('ok', false, 'motivo', 'inactivo');
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_pin := nullif(trim(v_row->>'pin'), '');

    begin
      v_at := (v_row->>'punched_at')::timestamp at time zone 'America/Argentina/Buenos_Aires';
    exception when others then
      v_at := null;
    end;

    if v_pin is null or v_at is null then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    -- Desfasaje del reloj: solo tiene sentido medirlo con fichajes recientes.
    -- Los que llegan atrasados porque el equipo estuvo sin red no dicen nada
    -- de su hora.
    v_offset := extract(epoch from (v_at - now()))::integer;
    if abs(v_offset) < 3600 then
      v_last_offset := v_offset;
    end if;

    select id into v_employee from public.employees where clock_pin = v_pin limit 1;

    if v_employee is null then
      insert into public.clock_pending_punches (device_id, clock_pin, punched_at, reason)
      values (v_device.id, v_pin, v_at, 'sin_legajo')
      on conflict (clock_pin, punched_at) do nothing;
      v_unknown := v_unknown + 1;
      continue;
    end if;

    if public.is_timesheet_week_closed(v_at) then
      insert into public.clock_pending_punches (device_id, clock_pin, punched_at, reason)
      values (v_device.id, v_pin, v_at, 'semana_cerrada')
      on conflict (clock_pin, punched_at) do nothing;
      v_closed := v_closed + 1;
      continue;
    end if;

    insert into public.time_punches (employee_id, punched_at, source, device_id)
    values (v_employee, v_at, 'reloj', v_device.id)
    on conflict (employee_id, punched_at, source) do nothing;

    get diagnostics v_affected = row_count;
    if v_affected > 0 then
      v_inserted := v_inserted + 1;
    else
      v_duplicated := v_duplicated + 1;
    end if;
  end loop;

  update public.clock_devices
  set last_seen_at = now(),
      last_push_at = case when jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 0 then now() else last_push_at end,
      last_ip = coalesce(p_ip, last_ip),
      attlog_stamp = coalesce(nullif(trim(coalesce(p_stamp, '')), ''), attlog_stamp),
      clock_offset_seconds = coalesce(v_last_offset, clock_offset_seconds),
      punches_received = punches_received + v_inserted,
      last_error = null,
      last_error_at = null
  where id = v_device.id;

  if v_inserted + v_duplicated + v_unknown + v_closed + v_invalid > 0 then
    insert into public.clock_device_events (device_id, serial_number, kind, detail)
    values (v_device.id, p_serial, 'fichajes', jsonb_build_object(
      'nuevos', v_inserted,
      'repetidos', v_duplicated,
      'sin_legajo', v_unknown,
      'semana_cerrada', v_closed,
      'invalidas', v_invalid
    ));
  end if;

  delete from public.clock_device_events where created_at < now() - interval '30 days';

  return jsonb_build_object(
    'ok', true,
    'nuevos', v_inserted,
    'repetidos', v_duplicated,
    'sin_legajo', v_unknown,
    'semana_cerrada', v_closed,
    'invalidas', v_invalid
  );
end;
$$;

-- ============================================================
-- Rescate de los fichajes en espera. Se llama sola cuando un legajo recibe su
-- numero de reloj, y a mano desde la pantalla del supervisor (por ejemplo
-- despues de reabrir una semana).
-- ============================================================
create or replace function public.claim_pending_punches(p_clock_pin text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.clock_pending_punches;
  v_employee uuid;
  v_affected integer;
  v_claimed integer := 0;
begin
  for v_pending in
    select * from public.clock_pending_punches
    where p_clock_pin is null or clock_pin = p_clock_pin
    order by punched_at
  loop
    select id into v_employee from public.employees where clock_pin = v_pending.clock_pin limit 1;
    continue when v_employee is null;
    continue when public.is_timesheet_week_closed(v_pending.punched_at);

    insert into public.time_punches (employee_id, punched_at, source, device_id)
    values (v_employee, v_pending.punched_at, 'reloj', v_pending.device_id)
    on conflict (employee_id, punched_at, source) do nothing;

    get diagnostics v_affected = row_count;
    delete from public.clock_pending_punches where id = v_pending.id;
    v_claimed := v_claimed + v_affected;
  end loop;

  return v_claimed;
end;
$$;

create or replace function public.employees_claim_pending_punches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clock_pin is not null and (tg_op = 'INSERT' or new.clock_pin is distinct from old.clock_pin) then
    perform public.claim_pending_punches(new.clock_pin);
  end if;
  return new;
end;
$$;

drop trigger if exists employees_claim_pending_punches on public.employees;
create trigger employees_claim_pending_punches
  after insert or update of clock_pin on public.employees
  for each row execute function public.employees_claim_pending_punches();

-- Version para la pantalla: misma logica, pero solo la puede pedir el supervisor.
create or replace function public.reprocess_clock_punches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo el supervisor puede reprocesar los fichajes del reloj.';
  end if;
  return public.claim_pending_punches(null);
end;
$$;

-- ============================================================
-- Permisos: las funciones que usa el endpoint son security definer y podrian
-- insertar fichajes a nombre de cualquiera, asi que no quedan al alcance de
-- un usuario logueado. Solo las llama el servidor con la clave de servicio.
-- ============================================================
revoke all on function public.ingest_clock_punches(text, jsonb, text, text) from public;
revoke all on function public.touch_clock_device(text, text, jsonb, text) from public;
revoke all on function public.claim_pending_punches(text) from public;

grant execute on function public.ingest_clock_punches(text, jsonb, text, text) to service_role;
grant execute on function public.touch_clock_device(text, text, jsonb, text) to service_role;
grant execute on function public.reprocess_clock_punches() to authenticated;

-- ============================================================
-- RLS: el modulo entero es del supervisor.
-- ============================================================
alter table public.clock_devices enable row level security;
alter table public.clock_pending_punches enable row level security;
alter table public.clock_device_events enable row level security;

drop policy if exists clock_devices_supervisor on public.clock_devices;
create policy clock_devices_supervisor on public.clock_devices
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

drop policy if exists clock_pending_punches_supervisor on public.clock_pending_punches;
create policy clock_pending_punches_supervisor on public.clock_pending_punches
  for all to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');

drop policy if exists clock_device_events_supervisor on public.clock_device_events;
create policy clock_device_events_supervisor on public.clock_device_events
  for select to authenticated
  using (public.current_staff_role() = 'supervisor');
