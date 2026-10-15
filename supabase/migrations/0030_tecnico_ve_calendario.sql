-- Migracion 0030: el tecnico ve todo el calendario de planificacion (14/10/2026)
--
-- La solapa "Calendario" del tecnico muestra las hojas de ruta de todos y las
-- visitas completas de sus companeros, igual que las ve el supervisor, sin
-- poder cambiar nada. Hasta ahora la base le dejaba leer solo sus hojas de
-- ruta (is_route_sheet_technician en las policies de lectura de 0004).
--
-- Solo se AGREGAN policies de lectura: las permisivas se suman con OR, asi que
-- ninguna escritura cambia (visits_update_own_editable, visit_parameters_write,
-- visit_events_insert y las *_write_staff siguen limitadas a lo propio). Para
-- un UPDATE o DELETE Postgres exige ademas la policy de escritura.
--
-- is_route_sheet_technician() NO se toca: sostiene lo que el tecnico puede
-- escribir, las notas del supervisor (unread_supervisor_notes,
-- mark_visit_notes_read) y el borrado de sus reportes (delete_unplanned_visit).
--
-- Una cuenta desactivada o eliminada no ve nada: current_staff_role() es null.
-- El "(select ...)" hace que se evalue una vez por consulta y no por fila.
-- Se puede volver a correr sin error.

-- ============================================================
-- 1. Lectura de la planificacion completa
-- ============================================================
drop policy if exists "route_sheets_select_tecnico" on public.route_sheets;
create policy "route_sheets_select_tecnico" on public.route_sheets
  for select to authenticated
  using ((select public.current_staff_role()) = 'tecnico');

drop policy if exists "route_sheet_technicians_select_tecnico" on public.route_sheet_technicians;
create policy "route_sheet_technicians_select_tecnico" on public.route_sheet_technicians
  for select to authenticated
  using ((select public.current_staff_role()) = 'tecnico');

drop policy if exists "visits_select_tecnico" on public.visits;
create policy "visits_select_tecnico" on public.visits
  for select to authenticated
  using ((select public.current_staff_role()) = 'tecnico');

drop policy if exists "visit_parameters_select_tecnico" on public.visit_parameters;
create policy "visit_parameters_select_tecnico" on public.visit_parameters
  for select to authenticated
  using ((select public.current_staff_role()) = 'tecnico');

drop policy if exists "visit_events_select_tecnico" on public.visit_events;
create policy "visit_events_select_tecnico" on public.visit_events
  for select to authenticated
  using ((select public.current_staff_role()) = 'tecnico');

-- ============================================================
-- 2. "Leida por": solo el tecnico de la hoja de ruta marca una nota
-- ============================================================
-- Con el historial de otros a la vista, un tecnico podria registrarse como
-- lector de la nota de un companero llamando directo a la API, y el
-- supervisor la veria como leida (VisitDetailPanel no distingue quien).
-- La app solo marca lecturas con mark_visit_notes_read, que ya filtra asi.
drop policy if exists "visit_event_reads_insert_own" on public.visit_event_reads;
create policy "visit_event_reads_insert_own" on public.visit_event_reads
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.visit_events e
      join public.visits v on v.id = e.visit_id
      where e.id = visit_event_reads.event_id
        and public.is_route_sheet_technician(v.route_sheet_id)
    )
  );
