-- El administrativo no puede eliminar clientes/equipos directamente (esa
-- accion queda reservada a supervisor, ver ClientDetailModal.jsx /
-- EquipmentHistoryPanel.jsx) pero puede solicitar la eliminacion; el
-- supervisor la ve en "Pendientes" dentro de Validacion y la aprueba o
-- rechaza. Sin FK real hacia clients/equipment: es polimorfica (una sola
-- tabla cubre ambos tipos) y la fila debe sobrevivir como registro de
-- auditoria aunque la entidad se borre al aprobar — por eso se denormaliza
-- entity_name al momento de la solicitud, mismo criterio que ya usa
-- visit_parameters con metric_label.
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('cliente', 'equipo')),
  entity_id uuid not null,
  entity_name text not null,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text
);
create index deletion_requests_status_idx on public.deletion_requests(status);

comment on table public.deletion_requests is 'Solicitudes de administrativo para eliminar un cliente o equipo, sujetas a aprobacion de supervisor.';

alter table public.deletion_requests enable row level security;

create policy "deletion_requests_select_staff" on public.deletion_requests
  for select to authenticated
  using (public.current_staff_role() in ('administrativo', 'supervisor'));

-- Solo administrativo puede crear una solicitud, y solo a su propio nombre.
create policy "deletion_requests_insert_administrativo" on public.deletion_requests
  for insert to authenticated
  with check (public.current_staff_role() = 'administrativo' and requested_by = auth.uid());

-- Solo supervisor puede resolverla (aprobar/rechazar).
create policy "deletion_requests_update_supervisor" on public.deletion_requests
  for update to authenticated
  using (public.current_staff_role() = 'supervisor')
  with check (public.current_staff_role() = 'supervisor');
