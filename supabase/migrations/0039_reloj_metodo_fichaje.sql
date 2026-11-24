-- ============================================================
-- 0039 · Con que se identifico cada fichaje del reloj
--
-- El F22 deja fichar con huella, clave o tarjeta, y con la clave o la tarjeta
-- uno puede fichar por otro. El equipo ya informa el metodo en cada linea de
-- RTLOG (verifytype=...), pero hasta ahora se descartaba.
--
-- Se guarda el codigo tal cual lo manda el equipo, sin traducirlo: la tabla de
-- codigos de ZKTeco cambia entre firmwares y la traduccion vive en el front
-- (CLOCK_VERIFY_TYPE en src/lib/constants.js), donde se corrige sin migrar.
-- Codigos esperados segun ZKTeco: 1 huella, 3 clave, 4 tarjeta, 15 rostro.
-- Sin confirmar en este equipo hasta hacer un fichaje de prueba con cada uno.
--
-- Los fichajes viejos quedan en null: el dato no se guardo y no se puede
-- recuperar.
--
-- Cambios:
--   * columna verify_type en time_punches y clock_pending_punches;
--   * ingest_clock_punches: igual que en 0038, mas el verify_type de cada fila;
--   * claim_pending_punches: igual que en 0026, mas el verify_type, asi no se
--     pierde el dato de los fichajes que estaban en espera.
--
-- El endpoint (api/iclock.js) y esta migracion se pueden subir en cualquier
-- orden: p_rows es jsonb y la funcion vieja ignora el campo nuevo.
-- ============================================================

alter table public.time_punches
  add column if not exists verify_type smallint;

alter table public.clock_pending_punches
  add column if not exists verify_type smallint;

comment on column public.time_punches.verify_type is
  'Solo fichajes del reloj: codigo verifytype que mando el equipo (ZKTeco: 1 huella, 3 clave, 4 tarjeta, 15 rostro). Null si es de antes de 0039 o el equipo no lo informo.';
comment on column public.clock_pending_punches.verify_type is
  'Codigo verifytype del reloj; pasa a time_punches al reclamar el fichaje.';

-- ============================================================
-- Alta de fichajes. Igual que en 0038 salvo verify_type.
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
  v_verify smallint;
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

    -- Un metodo que no sea un numero razonable no invalida el fichaje: se
    -- guarda sin metodo.
    v_verify := case
      when (v_row->>'verify_type') ~ '^\d{1,4}$' then (v_row->>'verify_type')::smallint
    end;

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
      insert into public.clock_pending_punches (device_id, clock_pin, punched_at, reason, verify_type)
      values (v_device.id, v_pin, v_at, 'sin_legajo', v_verify)
      on conflict (clock_pin, punched_at) do nothing;
      v_unknown := v_unknown + 1;
      continue;
    end if;

    if public.is_timesheet_week_closed(v_at) then
      insert into public.clock_pending_punches (device_id, clock_pin, punched_at, reason, verify_type)
      values (v_device.id, v_pin, v_at, 'semana_cerrada', v_verify)
      on conflict (clock_pin, punched_at) do nothing;
      v_closed := v_closed + 1;
      continue;
    end if;

    insert into public.time_punches (employee_id, punched_at, source, device_id, verify_type)
    values (v_employee, v_at, 'reloj', v_device.id, v_verify)
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
-- Fichajes en espera que ya se pueden guardar. Igual que en 0026 salvo
-- verify_type.
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

    insert into public.time_punches (employee_id, punched_at, source, device_id, verify_type)
    values (v_employee, v_pending.punched_at, 'reloj', v_pending.device_id, v_pending.verify_type)
    on conflict (employee_id, punched_at, source) do nothing;

    get diagnostics v_affected = row_count;
    delete from public.clock_pending_punches where id = v_pending.id;
    v_claimed := v_claimed + v_affected;
  end loop;

  return v_claimed;
end;
$$;
