-- El tecnico puede eliminar un reporte propio que todavia no envio. Solo
-- reportes (is_unplanned): una visita planificada la organiza el
-- administrativo y no le corresponde al tecnico darla de baja.
--
-- Simetrica a create_unplanned_visit: el tecnico no tiene DELETE sobre visits
-- ni sobre route_sheets, asi que la baja entera va por una funcion
-- SECURITY DEFINER en vez de abrir dos policies nuevas. Ademas tiene que ser
-- atomica, porque son dos borrados encadenados.
--
-- visit_parameters y visit_events se van solos: sus FK hacia visits son
-- ON DELETE CASCADE.
create or replace function public.delete_unplanned_visit(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route_sheet_id uuid;
begin
  if public.current_staff_role() is distinct from 'tecnico' then
    raise exception 'Solo un tecnico puede eliminar su reporte';
  end if;

  -- Adentro de una funcion SECURITY DEFINER la RLS no aplica, asi que las
  -- condiciones que normalmente pondria una policy van explicitas aca.
  select v.route_sheet_id into v_route_sheet_id
  from public.visits v
  where v.id = p_visit_id
    and v.is_unplanned
    and v.submitted_at is null
    and v.status in ('planificada', 'borrador')
    and public.is_route_sheet_technician(v.route_sheet_id);

  if v_route_sheet_id is null then
    raise exception 'El reporte no existe, ya fue enviado o no es tuyo';
  end if;

  delete from public.visits where id = p_visit_id;

  -- La hoja de ruta de un reporte es exclusiva de esa visita (la crea
  -- create_unplanned_visit): si no le queda ninguna, se va con el reporte
  -- para no dejar una hoja vacia en el calendario del administrativo. El
  -- not exists la protege igual por si alguna vez cuelga otra visita.
  delete from public.route_sheets rs
  where rs.id = v_route_sheet_id
    and not exists (select 1 from public.visits v where v.route_sheet_id = rs.id);
end;
$$;

revoke execute on function public.delete_unplanned_visit(uuid) from public;
grant execute on function public.delete_unplanned_visit(uuid) to authenticated;
