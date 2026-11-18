-- ============================================================
-- 0037 · Canal de ordenes hacia el reloj
--
-- El reloj F22 se traba: sigue preguntando "¿tenes ordenes para mi?" cada 10 s
-- (getrequest) pero deja de subir los fichajes hasta que lo reinician. El
-- canal de ordenes sigue andando durante el cuelgue, asi que el servidor lo
-- puede usar para pedirle los fichajes o reiniciarlo.
--
-- Esta migracion solo arma el canal y deja registro de lo que el equipo
-- contesta. No encola nada solo y no toca el guardado de fichajes: el formato
-- exacto de las ordenes depende del firmware, asi que primero se prueba a mano
-- y recien despues (0038) se automatiza.
-- ============================================================

-- ============================================================
-- Ordenes. El id es el que viaja en el protocolo ("C:<id>:<orden>") y con el
-- que el reloj identifica su respuesta.
-- ============================================================
create table if not exists public.clock_commands (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.clock_devices(id) on delete cascade,
  kind text not null check (kind in ('info', 'consulta', 'reiniciar')),
  command text not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'enviada', 'respondida', 'sin_respuesta')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  answered_at timestamptz,
  return_code text,
  response text
);

create index if not exists clock_commands_device_status_idx
  on public.clock_commands (device_id, status, created_at);

comment on table public.clock_commands is
  'Ordenes para el reloj. El servidor se las entrega cuando el equipo pregunta (getrequest) y el equipo contesta por devicecmd.';

-- El diario de eventos suma las respuestas a ordenes y las muestras.
alter table public.clock_device_events drop constraint if exists clock_device_events_kind_check;
alter table public.clock_device_events
  add constraint clock_device_events_kind_check
  check (kind in ('contacto', 'fichajes', 'rechazo', 'orden'));

-- ============================================================
-- Consulta del reloj (cada 10 s). Hace lo mismo que touch_clock_device con
-- kind 'ping' y ademas entrega la proxima orden pendiente, si hay. Una sola
-- llamada a la base por consulta, igual que antes.
-- ============================================================
create or replace function public.clock_poll(
  p_serial text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.clock_devices;
  v_cmd public.clock_commands;
begin
  select * into v_device from public.clock_devices where serial_number = p_serial;

  if not found then
    insert into public.clock_device_events (serial_number, kind, detail)
    values (p_serial, 'rechazo', jsonb_build_object('motivo', 'serie no registrada'));
    return jsonb_build_object('conocido', false, 'activo', false, 'orden', null);
  end if;

  update public.clock_devices
  set last_seen_at = now(),
      last_ip = coalesce(p_ip, last_ip)
  where id = v_device.id;

  if not v_device.active then
    return jsonb_build_object('conocido', true, 'activo', false, 'orden', null);
  end if;

  -- Una orden entregada que el equipo nunca contesto no se reintenta: se da
  -- por perdida para no dejar el canal trabado.
  update public.clock_commands
  set status = 'sin_respuesta'
  where device_id = v_device.id
    and status = 'enviada'
    and sent_at < now() - interval '10 minutes';

  select * into v_cmd
  from public.clock_commands
  where device_id = v_device.id and status = 'pendiente'
  order by created_at, id
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('conocido', true, 'activo', true, 'orden', null);
  end if;

  update public.clock_commands
  set status = 'enviada', sent_at = now()
  where id = v_cmd.id;

  return jsonb_build_object(
    'conocido', true,
    'activo', true,
    'orden', jsonb_build_object('id', v_cmd.id, 'texto', v_cmd.command)
  );
end;
$$;

-- ============================================================
-- Respuesta del reloj a una orden (devicecmd). Se guarda tal cual vino: es lo
-- que permite saber que formato habla este firmware. p_id puede ser null si el
-- equipo contesta algo que no reconocemos.
-- ============================================================
create or replace function public.clock_command_result(
  p_serial text,
  p_id bigint,
  p_return text,
  p_body text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.clock_devices;
  v_cmd public.clock_commands;
begin
  select * into v_device from public.clock_devices where serial_number = p_serial;

  if not found then
    insert into public.clock_device_events (serial_number, kind, detail)
    values (p_serial, 'rechazo', jsonb_build_object('motivo', 'serie no registrada'));
    return jsonb_build_object('ok', false, 'motivo', 'serie_no_registrada');
  end if;

  update public.clock_devices
  set last_seen_at = now(),
      last_ip = coalesce(p_ip, last_ip)
  where id = v_device.id;

  if p_id is not null then
    select * into v_cmd
    from public.clock_commands
    where id = p_id and device_id = v_device.id;
  end if;

  if v_cmd.id is not null then
    update public.clock_commands
    set status = 'respondida',
        answered_at = now(),
        return_code = left(p_return, 100),
        -- Las consultas de fichajes pueden ser largas; el diario guarda menos.
        response = left(p_body, 20000)
    where id = v_cmd.id;
  end if;

  insert into public.clock_device_events (device_id, serial_number, kind, detail)
  values (v_device.id, p_serial, 'orden', jsonb_build_object(
    'id', p_id,
    'orden', v_cmd.command,
    'tipo', v_cmd.kind,
    'conocida', v_cmd.id is not null,
    'retorno', left(p_return, 100),
    'cuerpo', left(p_body, 4000)
  ));

  return jsonb_build_object('ok', true, 'tipo', v_cmd.kind);
end;
$$;

-- ============================================================
-- Muestra de lo que manda el equipo en una tabla que hoy se descarta (por
-- ejemplo su configuracion). Una por tabla cada 6 horas: alcanza para ver el
-- formato sin llenar el diario.
-- ============================================================
create or replace function public.log_clock_sample(
  p_serial text,
  p_table text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.clock_devices;
begin
  select * into v_device from public.clock_devices where serial_number = p_serial;
  if not found then return; end if;

  if exists (
    select 1 from public.clock_device_events
    where device_id = v_device.id
      and kind = 'contacto'
      and detail->>'muestra' = 'true'
      and detail->>'tabla' = lower(p_table)
      and created_at > now() - interval '6 hours'
  ) then
    return;
  end if;

  insert into public.clock_device_events (device_id, serial_number, kind, detail)
  values (v_device.id, p_serial, 'contacto', jsonb_build_object(
    'muestra', true,
    'tabla', lower(p_table),
    'cuerpo', left(p_body, 4000)
  ));
end;
$$;

-- ============================================================
-- Permisos. Las llama solo el endpoint con la clave de servicio. Hay que
-- sacarselas a anon y authenticated por nombre (ver 0026, seccion 6).
-- ============================================================
revoke execute on function public.clock_poll(text, text) from public, anon, authenticated;
revoke execute on function public.clock_command_result(text, bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.log_clock_sample(text, text, text) from public, anon, authenticated;
grant execute on function public.clock_poll(text, text) to service_role;
grant execute on function public.clock_command_result(text, bigint, text, text, text) to service_role;
grant execute on function public.log_clock_sample(text, text, text) to service_role;

-- ============================================================
-- RLS: el supervisor las ve; solo el servidor las escribe.
-- ============================================================
alter table public.clock_commands enable row level security;

drop policy if exists clock_commands_supervisor_read on public.clock_commands;
create policy clock_commands_supervisor_read on public.clock_commands
  for select to authenticated
  using (public.current_staff_role() = 'supervisor');
