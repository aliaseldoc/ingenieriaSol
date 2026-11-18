-- ============================================================
-- 0038 · Autodiagnostico del reloj y reinicio remoto
--
-- Lo que se probo en el equipo real el 18/11 (ver 0037):
--   * INFO contesta bien y trae TransactionCount (fichajes que el equipo tiene
--     guardados sin subir). Sano: 0.
--   * REBOOT lo acepta (Return=0).
--   * DATA QUERY de fichajes contesta error 588 y el equipo no guarda una tabla
--     consultable: pedirle los fichajes no sirve en este firmware.
--
-- Entonces: el servidor le pregunta INFO cada 3 minutos en horario laboral. Si
-- el equipo tiene fichajes sin subir en dos lecturas seguidas (o directamente
-- no contesta), esta trabado y se le manda REBOOT. Los fichajes no se pierden:
-- el equipo los sube apenas se reconecta.
--
-- Ademas se corrige el aviso falso de "hora corrida" y se registra cuando los
-- fichajes llegan tarde.
--
-- El reinicio automatico se apaga por equipo con clock_devices.auto_reboot.
-- ============================================================

alter table public.clock_devices
  add column if not exists clock_offset_at timestamptz,
  add column if not exists last_late_at timestamptz,
  add column if not exists last_late_seconds integer,
  add column if not exists unsent_punches integer,
  add column if not exists unsent_checked_at timestamptz,
  add column if not exists unsent_since timestamptz,
  add column if not exists auto_reboot boolean not null default true,
  add column if not exists last_auto_reboot_at timestamptz;

comment on column public.clock_devices.unsent_punches is
  'TransactionCount del ultimo INFO: fichajes que el equipo tiene guardados sin subir. Sano: 0.';
comment on column public.clock_devices.unsent_since is
  'Desde cuando el equipo informa fichajes sin subir de corrido. Null si el ultimo INFO dio 0.';
comment on column public.clock_devices.auto_reboot is
  'Si el servidor puede reiniciar el equipo solo cuando detecta que se trabo.';

-- El valor que habia (-2427 s) era la demora de la subida, no la hora del
-- equipo: se descarta.
update public.clock_devices set clock_offset_seconds = null, clock_offset_at = null;

-- ============================================================
-- Alta de fichajes. Igual que en 0025 salvo la medicion del desfasaje y el
-- registro de demoras:
--   * La demora solo puede dar un desfasaje negativo, asi que solo sirven como
--     muestra de la hora del equipo los fichajes de menos de 5 minutos de
--     demora, y de ellos el menos demorado. Un equipo adelantado (positivo)
--     sigue detectandose.
--   * El valor guardado solo se reemplaza por uno mejor (mas alto) o si tiene
--     mas de 24 horas.
--   * Un fichaje con mas de 5 minutos de demora se anota como llegada tarde.
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
  v_best_offset integer;
  v_max_late integer;
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

    -- Diferencia entre la hora del fichaje y la del servidor (negativa si el
    -- fichaje llego despues de ocurrir).
    v_offset := extract(epoch from (v_at - now()))::integer;
    if v_offset > -300 and v_offset < 3600 then
      v_best_offset := greatest(coalesce(v_best_offset, v_offset), v_offset);
    elsif v_offset <= -300 and v_offset > -604800 then
      v_max_late := greatest(coalesce(v_max_late, -v_offset), -v_offset);
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
      clock_offset_seconds = case
        when v_best_offset is not null
          and (clock_offset_seconds is null or v_best_offset > clock_offset_seconds or clock_offset_at < now() - interval '24 hours')
        then v_best_offset
        else clock_offset_seconds
      end,
      clock_offset_at = case
        when v_best_offset is not null
          and (clock_offset_seconds is null or v_best_offset > clock_offset_seconds or clock_offset_at < now() - interval '24 hours')
        then now()
        else clock_offset_at
      end,
      last_late_at = case when v_max_late is not null then now() else last_late_at end,
      last_late_seconds = case when v_max_late is not null then v_max_late else last_late_seconds end,
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
-- Respuesta del reloj a una orden. Si es un INFO, se toma el contador de
-- fichajes sin subir y no se llena el diario con cada lectura.
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
  v_unsent integer;
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
        response = left(p_body, 20000)
    where id = v_cmd.id;
  end if;

  if v_cmd.kind = 'info' then
    v_unsent := substring(p_body from 'TransactionCount=(\d+)')::integer;
    if v_unsent is not null then
      update public.clock_devices
      set unsent_punches = v_unsent,
          unsent_checked_at = now(),
          unsent_since = case
            when v_unsent = 0 then null
            else coalesce(unsent_since, now())
          end
      where id = v_device.id;
    end if;
    return jsonb_build_object('ok', true, 'tipo', v_cmd.kind, 'sin_subir', v_unsent);
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
-- Consulta del reloj (cada 10 s): entrega la orden pendiente y, en horario
-- laboral (5 a 21 h, hora argentina), decide si hay que preguntarle INFO o
-- reiniciarlo.
--
-- Se considera trabado si, con el equipo conectado:
--   * informo fichajes sin subir en dos lecturas separadas por 3 minutos o mas, o
--   * recibio un INFO y no lo contesto.
-- Tope: un reinicio automatico cada 30 minutos.
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
  v_hour integer;
  v_motivo text;
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

  -- Una orden entregada que el equipo no contesto en 3 minutos se da por
  -- perdida (el equipo contesta en segundos) para no dejar el canal trabado.
  update public.clock_commands
  set status = 'sin_respuesta'
  where device_id = v_device.id
    and status = 'enviada'
    and sent_at < now() - interval '3 minutes';

  v_hour := extract(hour from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer;

  if v_hour between 5 and 20
     and not exists (
       select 1 from public.clock_commands
       where device_id = v_device.id and status in ('pendiente', 'enviada')
     )
  then
    v_motivo := null;

    if v_device.unsent_since is not null
       and v_device.unsent_since <= now() - interval '3 minutes'
       and v_device.unsent_checked_at > now() - interval '10 minutes' then
      v_motivo := format('el reloj tenia %s fichajes sin subir', v_device.unsent_punches);
    elsif exists (
      select 1 from public.clock_commands
      where device_id = v_device.id
        and kind = 'info'
        and status = 'sin_respuesta'
        and created_at > now() - interval '10 minutes'
    ) then
      v_motivo := 'el reloj no contesto la consulta de estado';
    end if;

    if v_motivo is not null
       and v_device.auto_reboot
       and (v_device.last_auto_reboot_at is null or v_device.last_auto_reboot_at < now() - interval '30 minutes')
    then
      insert into public.clock_commands (device_id, kind, command)
      values (v_device.id, 'reiniciar', 'REBOOT');

      update public.clock_devices
      set last_auto_reboot_at = now(), unsent_since = null
      where id = v_device.id;

      insert into public.clock_device_events (device_id, serial_number, kind, detail)
      values (v_device.id, p_serial, 'orden', jsonb_build_object(
        'auto', true,
        'tipo', 'reiniciar',
        'motivo', v_motivo,
        'sin_subir', v_device.unsent_punches
      ));
    elsif not exists (
      select 1 from public.clock_commands
      where device_id = v_device.id and kind = 'info' and created_at > now() - interval '3 minutes'
    ) then
      insert into public.clock_commands (device_id, kind, command)
      values (v_device.id, 'info', 'INFO');

      -- El historial de ordenes no hace falta mas de una semana.
      delete from public.clock_commands
      where device_id = v_device.id and created_at < now() - interval '7 days';
    end if;
  end if;

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
