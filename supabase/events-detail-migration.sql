create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date date,
  time time,
  location text,
  image_url text,
  registration_url text,
  requires_registration boolean not null default false,
  status text not null default 'activo',
  requirements text,
  is_featured boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists date date,
  add column if not exists time time,
  add column if not exists location text,
  add column if not exists image_url text,
  add column if not exists registration_url text,
  add column if not exists requires_registration boolean not null default false,
  add column if not exists status text not null default 'activo',
  add column if not exists requirements text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists created_at timestamptz not null default now();

alter table public.events drop constraint if exists events_status_check;

update public.events
set status = case
  when lower(coalesce(status, '')) in ('terminado', 'finalizado', 'cancelado') then 'terminado'
  else 'activo'
end;

alter table public.events
  alter column status set default 'activo',
  alter column status set not null,
  add constraint events_status_check check (status in ('activo', 'terminado'));

create index if not exists events_public_date_idx
  on public.events (date)
  where status = 'activo';

-- Importa los registros existentes desde la tabla legacy sin reemplazar la tabla usada por otras herramientas.
do $$
begin
  if to_regclass('public.eventos') is not null then
    execute 'alter table public.eventos add column if not exists descripcion text';
    execute 'alter table public.eventos add column if not exists ubicacion text';
    execute 'alter table public.eventos add column if not exists requisitos text';
    execute 'alter table public.eventos add column if not exists es_destacado boolean not null default false';
    execute 'alter table public.eventos add column if not exists fecha date';
    execute 'alter table public.eventos add column if not exists hora time';
    execute 'alter table public.eventos add column if not exists imagen_fondo text';
    execute 'alter table public.eventos add column if not exists link_registro text';
    execute 'alter table public.eventos add column if not exists requiere_inscripcion boolean not null default false';
    execute 'alter table public.eventos add column if not exists created_by uuid references auth.users(id)';
    execute 'alter table public.eventos add column if not exists created_at timestamptz not null default now()';
    execute $copy$
      insert into public.events (
        id, title, description, date, time, location, image_url,
        registration_url, requires_registration, status, requirements, is_featured, created_by, created_at
      )
      select
        id,
        titulo,
        descripcion,
        case
          when pg_input_is_valid(nullif(btrim(fecha::text), ''), 'date')
            then btrim(fecha::text)::date
          else null
        end,
        case
          when pg_input_is_valid(nullif(btrim(hora::text), ''), 'time')
            then btrim(hora::text)::time
          else null
        end,
        ubicacion,
        imagen_fondo,
        link_registro,
        coalesce(requiere_inscripcion, false),
        case
          when lower(coalesce(estado, '')) in ('finalizado', 'terminado', 'cancelado') then 'terminado'
          else 'activo'
        end,
        requisitos,
        coalesce(es_destacado, false),
        created_by,
        coalesce(created_at, now())
      from public.eventos
      where id is not null and titulo is not null
      on conflict (id) do nothing
    $copy$;

    execute $sync_registration$
      update public.events as public_event
      set requires_registration = coalesce(legacy_event.requiere_inscripcion, false)
      from public.eventos as legacy_event
      where public_event.id = legacy_event.id
    $sync_registration$;
  end if;
end
$$;

alter table public.events enable row level security;

drop policy if exists "Public can read active events" on public.events;
drop policy if exists "Event editors can read events" on public.events;
drop policy if exists "Event editors can insert events" on public.events;
drop policy if exists "Event editors can update events" on public.events;
drop policy if exists "Event editors can delete events" on public.events;

create policy "Public can read active events"
  on public.events for select
  using (status = 'activo');

create policy "Event editors can read events"
  on public.events for select to authenticated
  using (public.tiene_permiso_admin('eventos'));

create policy "Event editors can insert events"
  on public.events for insert to authenticated
  with check (public.tiene_permiso_admin('eventos') and (created_by is null or created_by = auth.uid()));

create policy "Event editors can update events"
  on public.events for update to authenticated
  using (public.tiene_permiso_admin('eventos'))
  with check (public.tiene_permiso_admin('eventos'));

create policy "Event editors can delete events"
  on public.events for delete to authenticated
  using (public.tiene_permiso_admin('eventos'));
