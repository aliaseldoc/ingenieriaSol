-- Tareas programadas del cierre semanal del fichaje (pg_cron + pg_net).
-- Llaman a la Edge Function cierre-semanal, que es la que calcula, cierra y
-- manda el mail (ver supabase/functions/cierre-semanal). Se puede correr mas
-- de una vez: cron.schedule con el mismo nombre reemplaza la tarea.
--
-- Solo para Supabase: pg_cron y pg_net no existen en un Postgres comun.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- El secreto con el que la tarea se identifica ante la Edge Function vive en
-- Vault, nunca en este archivo. Se cargo una sola vez con
--   select vault.create_secret('<valor>', 'cierre_semanal_secret');
-- y el mismo valor como secret CRON_SECRET de la Edge Function.
create or replace function public.llamar_cierre_semanal(p_accion text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select net.http_post(
    url := 'https://jnwarvofganlkeonukzk.supabase.co/functions/v1/cierre-semanal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cierre_semanal_secret')
    ),
    body := jsonb_build_object('accion', p_accion),
    -- Cerrar trae todos los fichajes de la semana: mas que los 5 s por defecto.
    timeout_milliseconds := 60000
  );
$$;

revoke execute on function public.llamar_cierre_semanal(text) from public, anon, authenticated;

-- pg_cron trabaja en UTC. Argentina es UTC-3 todo el año: si algun dia vuelve
-- el horario de verano, hay que correr estas dos horas.
--   Lunes 00:00 (ART) = lunes 03:00 UTC: se cierra la semana que termino.
select cron.schedule('fichaje-cierre-semanal', '0 3 * * 1', $$ select public.llamar_cierre_semanal('cerrar') $$);
--   Todos los dias 09:00 (ART) = 12:00 UTC: sale el reporte de las semanas
--   cerradas que todavia no se mandaron (el lunes, la recien cerrada).
select cron.schedule('fichaje-envio-reporte', '0 12 * * *', $$ select public.llamar_cierre_semanal('enviar') $$);
