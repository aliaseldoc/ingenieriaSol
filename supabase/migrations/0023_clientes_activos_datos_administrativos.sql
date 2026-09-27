-- Migracion 0023: CORRECCIONES25S.md
--
-- Numerada 0023 aunque main todavia no tiene 0021/0022: esas dos son del
-- modulo de fichaje (rama feature/fichaje) y 0021 ya esta aplicada en la base.

-- Switch Activo/Inactivo en "Detalle del Cliente". Un cliente inactivo
-- conserva su ficha e historial, pero sale de la operacion: sus equipos no se
-- ofrecen al planificar ni en el reporte del tecnico, y no cuentan como grupos
-- activos ni generan alertas. Los clientes existentes quedan activos.
alter table public.clients add column active boolean not null default true;

-- "Datos administrativos" de la ficha del equipo.
alter table public.equipment add column service_start_date date;
alter table public.equipment add column service_end_date date;
alter table public.equipment add column purchase_order text;

-- La solicitud de eliminacion desaparece: el administrativo borra clientes y
-- equipos igual que el supervisor (la RLS de 0002 ya se lo permitia). La
-- tabla deletion_requests (0013) queda sin uso, pero no se borra aca: la app
-- publicada la sigue usando hasta que esta version llegue a produccion.
