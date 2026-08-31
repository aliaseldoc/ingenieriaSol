-- Reporte del tecnico: una visita que el propio tecnico genera en terreno,
-- por fuera de la planificacion del administrativo.
--
-- En el modelo de datos es una hoja de ruta de un solo equipo con el tecnico
-- autoasignado: visits.route_sheet_id es NOT NULL y toda la visibilidad del
-- tecnico pasa por route_sheet_technicians (ver policies de 0004), asi que una
-- visita sin hoja de ruta seria invisible incluso para su propio autor.
--
-- La creacion va por una funcion SECURITY DEFINER en vez de abrir policies de
-- INSERT sobre las tres tablas: es una sola puerta de entrada, atomica (no
-- queda una hoja de ruta huerfana si falla el insert de la visita) y evita que
-- un tecnico pueda autoasignarse a hojas de ruta ajenas.
alter table public.visits add column is_unplanned boolean not null default false;

create or replace function public.create_unplanned_visit(p_equipment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route_sheet_id uuid;
  v_visit_id uuid;
begin
  if public.current_staff_role() is distinct from 'tecnico' then
    raise exception 'Solo un tecnico puede generar un reporte de visita';
  end if;

  insert into public.route_sheets (scheduled_date, created_by)
  values (current_date, auth.uid())
  returning id into v_route_sheet_id;

  insert into public.route_sheet_technicians (route_sheet_id, technician_id)
  values (v_route_sheet_id, auth.uid());

  -- Nace en 'planificada' a proposito: es el estado que
  -- TECHNICIAN_EDITABLE_STATUSES y la policy visits_update_own_editable
  -- habilitan para editar. De ahi sigue el ciclo normal.
  insert into public.visits (equipment_id, route_sheet_id, scheduled_date, status, is_unplanned, created_by)
  values (p_equipment_id, v_route_sheet_id, current_date, 'planificada', true, auth.uid())
  returning id into v_visit_id;

  return v_visit_id;
end;
$$;

revoke execute on function public.create_unplanned_visit(uuid) from public;
grant execute on function public.create_unplanned_visit(uuid) to authenticated;
