-- Migracion 0024: validacion del supervisor, notas al tecnico y Reparaciones.
--
-- La validacion pasa a tener dos salidas: "Aprobar" (sin cambios) y
-- "Reparacion Solicitada", que aprueba la visita y ademas abre un caso en la
-- vista Reparaciones. "Rechazar" y "Solicitar Revision" desaparecen de la app:
-- los estados rechazada/revision_solicitada quedan en la base solo por el
-- historial. En su lugar el supervisor le deja notas al tecnico, que son solo
-- informativas (no cambian el estado de la visita) y le llegan como aviso
-- dentro de la app.
--
-- Numerada 0024: 0021/0022 son del modulo de fichaje y 0023 ya esta aplicada.

-- ============================================================
-- visit_events: la nota al tecnico y la reparacion solicitada
-- ============================================================
alter table public.visit_events drop constraint visit_events_event_type_check;
alter table public.visit_events add constraint visit_events_event_type_check
  check (event_type in ('creada', 'borrador_guardado', 'enviada', 'revision_solicitada',
                        'recibida', 'aprobada', 'rechazada', 'resultados_enviados',
                        'nota_supervisor', 'reparacion_solicitada'));

-- ============================================================
-- visit_event_reads: que tecnico leyo cada nota del supervisor
-- ============================================================
-- profile_id apunta a auth.users y no a profiles a proposito: con las dos FK
-- (visit_events y profiles) dentro de la PK, PostgREST tomaria esta tabla como
-- puente de una relacion muchos-a-muchos, y el embed profiles(full_name) que
-- ya hacen listEventsForVisit/listRecentEvents sobre visit_events pasaria a
-- ser ambiguo (habria dos caminos: actor_id y esta tabla).
create table public.visit_event_reads (
  event_id uuid not null references public.visit_events(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

alter table public.visit_event_reads enable row level security;

-- El tecnico ve sus propias lecturas; administrativo y supervisor ven todas,
-- porque el historial de la visita muestra "Leida por ...".
create policy "visit_event_reads_select" on public.visit_event_reads
  for select to authenticated
  using (profile_id = auth.uid() or public.current_staff_role() in ('administrativo', 'supervisor'));

create policy "visit_event_reads_insert_own" on public.visit_event_reads
  for insert to authenticated
  with check (profile_id = auth.uid());

-- ============================================================
-- repairs: un caso de reparacion por visita (reemplaza el Excel de
-- seguimiento del supervisor)
-- ============================================================
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  -- unique: una visita abre un solo caso. set null: si alguna vez se borra la
  -- visita, el caso y su bitacora se conservan.
  visit_id uuid unique references public.visits(id) on delete set null,
  equipment_id uuid not null references public.equipment(id),
  status text not null default 'pendiente_presupuesto'
    check (status in ('pendiente_presupuesto', 'presupuesto_enviado', 'aprobada',
                      'en_ejecucion', 'finalizada', 'cancelada')),
  -- Trabajo a realizar.
  description text not null,
  -- Seguimiento del presupuesto: el documento se sigue armando fuera de la app.
  budget_number text,
  budget_amount numeric,
  budget_sent_at date,
  client_approved_at date,
  purchase_order text,
  completed_at date,
  -- "Proximo paso": el pendiente que no hay que perder de vista.
  next_action text,
  next_action_due date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index repairs_equipment_idx on public.repairs(equipment_id);

alter table public.repairs enable row level security;

create policy "repairs_select_staff" on public.repairs
  for select to authenticated
  using (public.current_staff_role() in ('administrativo', 'supervisor'));

create policy "repairs_insert_staff" on public.repairs
  for insert to authenticated
  with check (public.current_staff_role() in ('administrativo', 'supervisor'));

create policy "repairs_update_staff" on public.repairs
  for update to authenticated
  using (public.current_staff_role() in ('administrativo', 'supervisor'))
  with check (public.current_staff_role() in ('administrativo', 'supervisor'));

-- Sin policy de DELETE: un caso que no sigue se cierra como "cancelada" y
-- conserva su bitacora.

-- ============================================================
-- repair_events: bitacora del caso (append-only, igual que visit_events)
-- ============================================================
create table public.repair_events (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  event_type text not null check (event_type in ('creada', 'estado', 'nota', 'datos')),
  from_status text,
  to_status text,
  notes text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index repair_events_repair_idx on public.repair_events(repair_id, created_at);

alter table public.repair_events enable row level security;

create policy "repair_events_select_staff" on public.repair_events
  for select to authenticated
  using (public.current_staff_role() in ('administrativo', 'supervisor'));

create policy "repair_events_insert_staff" on public.repair_events
  for insert to authenticated
  with check (public.current_staff_role() in ('administrativo', 'supervisor'));

-- ============================================================
-- request_visit_repair: el boton "Reparacion Solicitada"
-- ============================================================
-- Aprueba la visita y abre el caso en una sola transaccion, para que no quede
-- una visita aprobada sin su reparacion (o al reves) si algo falla a mitad de
-- camino. Security invoker (el default): corre con los permisos de quien la
-- llama, asi que la RLS de cada tabla sigue aplicando.
create or replace function public.request_visit_repair(p_visit_id uuid, p_description text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_description text := nullif(trim(p_description), '');
  v_equipment_id uuid;
  v_repair_id uuid;
begin
  if public.current_staff_role() is distinct from 'supervisor' then
    raise exception 'Solo el supervisor puede solicitar una reparación';
  end if;

  if v_description is null then
    raise exception 'Falta describir el trabajo a realizar';
  end if;

  -- Solo una visita que sigue pendiente de validacion: si otro supervisor ya
  -- la valido, no se pisa su decision.
  update public.visits
     set status = 'aprobada',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = v_description
   where id = p_visit_id
     and status = 'enviada'
  returning equipment_id into v_equipment_id;

  if v_equipment_id is null then
    raise exception 'La visita ya no está pendiente de validación';
  end if;

  insert into public.repairs (visit_id, equipment_id, description, created_by)
  values (p_visit_id, v_equipment_id, v_description, auth.uid())
  returning id into v_repair_id;

  insert into public.repair_events (repair_id, event_type, to_status, notes, actor_id)
  values (v_repair_id, 'creada', 'pendiente_presupuesto', v_description, auth.uid());

  insert into public.visit_events (visit_id, event_type, actor_id, notes)
  values (p_visit_id, 'reparacion_solicitada', auth.uid(), v_description);

  return v_repair_id;
end;
$$;

revoke execute on function public.request_visit_repair(uuid, text) from public;
grant execute on function public.request_visit_repair(uuid, text) to authenticated;

-- ============================================================
-- Aviso al tecnico: notas sin leer y marcarlas como leidas
-- ============================================================
-- Las notas del supervisor en visitas del tecnico que todavia no leyo, con lo
-- necesario para listarlas sin otra consulta. La RLS de visit_events ya las
-- limita a las visitas del tecnico; el filtro explicito deja clara la
-- intencion (y deja afuera al staff, que ve todas las visitas).
create or replace function public.unread_supervisor_notes()
returns table (
  event_id uuid,
  visit_id uuid,
  notes text,
  created_at timestamptz,
  author_name text,
  equipment_motor text,
  client_name text
)
language sql
stable
set search_path = public
as $$
  select e.id, e.visit_id, e.notes, e.created_at, p.full_name, eq.motor, c.name
  from public.visit_events e
  join public.visits v on v.id = e.visit_id
  join public.equipment eq on eq.id = v.equipment_id
  left join public.clients c on c.id = eq.client_id
  left join public.profiles p on p.id = e.actor_id
  where e.event_type = 'nota_supervisor'
    and public.is_route_sheet_technician(v.route_sheet_id)
    and not exists (
      select 1 from public.visit_event_reads r
      where r.event_id = e.id and r.profile_id = auth.uid()
    )
  order by e.created_at desc;
$$;

revoke execute on function public.unread_supervisor_notes() from public;
grant execute on function public.unread_supervisor_notes() to authenticated;

-- El tecnico abrio la visita: todas sus notas quedan leidas por el. Idempotente
-- (on conflict do nothing), asi que se puede llamar cada vez que se abre.
create or replace function public.mark_visit_notes_read(p_visit_id uuid)
returns void
language sql
set search_path = public
as $$
  insert into public.visit_event_reads (event_id, profile_id)
  select e.id, auth.uid()
  from public.visit_events e
  join public.visits v on v.id = e.visit_id
  where e.visit_id = p_visit_id
    and e.event_type = 'nota_supervisor'
    and public.is_route_sheet_technician(v.route_sheet_id)
  on conflict do nothing;
$$;

revoke execute on function public.mark_visit_notes_read(uuid) from public;
grant execute on function public.mark_visit_notes_read(uuid) to authenticated;
