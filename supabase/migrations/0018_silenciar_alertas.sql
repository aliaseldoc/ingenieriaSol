-- El supervisor puede silenciar una alerta de combustible bajo o de service
-- anual vencido, para equipos donde la alerta es esperada y solo hace ruido.
--
-- No se guarda un booleano sino EL VALOR QUE SE SILENCIO: la alerta se oculta
-- unicamente mientras la condicion siga siendo exactamente la misma. Cuando
-- cambia (se cargo combustible, se hizo el service) los valores dejan de
-- coincidir y la alerta vuelve sola, sin trigger, sin tarea programada y sin
-- codigo de limpieza disperso por la app.
alter table public.equipment add column fuel_alert_muted_percentage numeric;
alter table public.equipment add column annual_alert_muted_due_date date;
