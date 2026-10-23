-- Migracion 0032: pedido de datos al tecnico (21/10/2026)
--
-- Desde "Datos Incompletos" el administrativo le pide al tecnico que releve en
-- la proxima visita a un equipo los datos que le faltan: de la ficha tecnica
-- (N° de serie, codigos de filtros, capacidades, baterias) y del contacto del
-- cliente. El pedido queda en el equipo, sale en el formulario de cualquier
-- visita a ese equipo y lo que el tecnico carga queda en la visita. Al recibir
-- la visita se copia a la ficha y al cliente, y esos datos salen del pedido
-- (markVisitReceived en src/api/visits.js).
--
-- No cambia permisos: el administrativo y el supervisor ya editan equipos
-- (equipment_write_staff) y el tecnico ya escribe su visita editable
-- (visits_update_own_editable).
-- Se puede volver a correr sin error.

-- Los datos pedidos. Solo las claves del catalogo que se le pueden pedir al
-- tecnico (src/features/missingData/missingData.js, requestable: true).
alter table public.equipment add column if not exists requested_data_fields text[] not null default '{}';

alter table public.equipment drop constraint if exists equipment_requested_data_fields_check;
alter table public.equipment add constraint equipment_requested_data_fields_check
  check (requested_data_fields <@ array[
    'motor', 'serial_number', 'generador', 'power_kva', 'fuel_type',
    'fuel_filter_spec', 'oil_filter_spec', 'air_filter_spec', 'coolant_capacity',
    'fuel_capacity', 'oil_capacity', 'battery_quantity', 'battery_size',
    'contact_name', 'contact_phone', 'contact_email'
  ]::text[]);

comment on column public.equipment.requested_data_fields is
  'Datos que el administrativo pidio relevar en la proxima visita (Datos Incompletos). Salen del pedido al recibir la visita que los trae.';

-- Lo que cargo el tecnico, por clave del catalogo: {"serial_number": "...", ...}.
alter table public.visits add column if not exists collected_data jsonb not null default '{}'::jsonb;

comment on column public.visits.collected_data is
  'Datos pedidos que relevo el tecnico en esta visita. Se copian a la ficha del equipo y al cliente al recibirla.';
