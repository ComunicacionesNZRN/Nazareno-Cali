create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date not null,
  hora time not null,
  estado text not null check (estado in ('próximo', 'agotado', 'finalizado', 'cancelado')),
  imagen_fondo text,
  link_registro text,
  requiere_inscripcion boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Compatibilidad con instalaciones donde eventos ya existía sin imagen_fondo.
alter table public.eventos
  add column if not exists imagen_fondo text,
  add column if not exists requiere_inscripcion boolean not null default false;

-- Compatibilidad con instalaciones donde eventos ya existía sin propietario.
-- Se deja nullable para no romper filas antiguas; el formulario siempre envía
-- el usuario autenticado al crear nuevos eventos.
alter table public.eventos
  add column if not exists created_by uuid references auth.users(id);

alter table public.eventos enable row level security;

-- El sitio público puede leer eventos; solo administradores pueden mutarlos.
create policy "Public can read events"
  on public.eventos for select
  using (true);

create policy "Authenticated users can create events"
  on public.eventos for insert
  to authenticated
  with check (auth.uid() = created_by and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Authenticated users can update events"
  on public.eventos for update
  to authenticated
  using (auth.uid() = created_by and (auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check (auth.uid() = created_by and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Authenticated users can delete events"
  on public.eventos for delete
  to authenticated
  using (auth.uid() = created_by and (auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('eventos', 'eventos', true)
on conflict (id) do update set public = true;

create policy "Authenticated users can upload event images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'eventos' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Authenticated users can delete event images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'eventos' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Public can read event images"
  on storage.objects for select
  using (bucket_id = 'eventos');

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  dia text,
  hora time,
  zona text,
  lider text,
  contacto text,
  estado text not null default 'activo' check (estado in ('activo', 'pausado')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.grupos enable row level security;

create policy "Public can read groups"
  on public.grupos for select
  using (estado = 'activo' or (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can create groups"
  on public.grupos for insert
  to authenticated
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can update groups"
  on public.grupos for update
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can delete groups"
  on public.grupos for delete
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create table if not exists public.configuracion_sitio (
  clave text primary key,
  valor text not null default '',
  descripcion text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.configuracion_sitio enable row level security;

create policy "Public can read site settings"
  on public.configuracion_sitio for select
  using (true);

create policy "Admins can create site settings"
  on public.configuracion_sitio for insert
  to authenticated
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can update site settings"
  on public.configuracion_sitio for update
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create table if not exists public.carrusel_conexion (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  eyebrow text,
  image_url text,
  image_alt text,
  link_url text,
  tipo text not null default 'mensual' check (tipo in ('fijo', 'mensual')),
  mes smallint check (mes between 1 and 12),
  orden integer not null default 0,
  activo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.carrusel_conexion enable row level security;

create policy "Public can read active carousel content"
  on public.carrusel_conexion for select
  using (activo = true or (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can create carousel content"
  on public.carrusel_conexion for insert
  to authenticated
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can update carousel content"
  on public.carrusel_conexion for update
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins can delete carousel content"
  on public.carrusel_conexion for delete
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('carrusel', 'carrusel', true)
on conflict (id) do update set public = true;

create policy "Authenticated users can upload carousel images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'carrusel' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Public can read carousel images"
  on storage.objects for select
  using (bucket_id = 'carrusel');

create table if not exists public.admin_perfiles (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  correo text not null,
  nombre text,
  rol text not null default 'colaborador' check (rol in ('principal', 'colaborador')),
  permisos jsonb not null default '{"eventos": false, "grupos": false, "carrusel": false, "devocionales": false, "configuracion": false}'::jsonb,
  activo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.admin_perfiles
  add column if not exists created_by uuid references auth.users(id);

alter table public.admin_perfiles enable row level security;

create or replace function public.es_admin_principal()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select rol = 'principal' and activo from public.admin_perfiles where usuario_id = auth.uid()),
    (auth.jwt()->'app_metadata'->>'role') in ('admin', 'owner')
  );
$$;

create or replace function public.tiene_permiso_admin(nombre_permiso text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.es_admin_principal()
    or exists (
      select 1 from public.admin_perfiles
      where usuario_id = auth.uid()
        and activo = true
        and coalesce((permisos ->> nombre_permiso)::boolean, false) = true
    );
$$;

create policy "Admins can read their profile"
  on public.admin_perfiles for select
  to authenticated
  using (usuario_id = auth.uid() or public.es_admin_principal());

create policy "Principal admins can create profiles"
  on public.admin_perfiles for insert
  to authenticated
  with check (public.es_admin_principal());

create policy "Users can update their profile"
  on public.admin_perfiles for update
  to authenticated
  using (usuario_id = auth.uid() or public.es_admin_principal())
  with check (usuario_id = auth.uid() or public.es_admin_principal());

create policy "Principal admins can delete profiles"
  on public.admin_perfiles for delete
  to authenticated
  using (public.es_admin_principal());

create table if not exists public.devocionales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumen text,
  contenido text not null,
  imagen_url text,
  publicar_at timestamptz not null,
  publicado boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.devocionales enable row level security;

create policy "Public can read published devotionals"
  on public.devocionales for select
  using (publicado = true and publicar_at <= now());

create policy "Authorized collaborators can read devotionals"
  on public.devocionales for select
  to authenticated
  using (public.tiene_permiso_admin('devocionales'));

create policy "Authorized collaborators can create devotionals"
  on public.devocionales for insert
  to authenticated
  with check (public.tiene_permiso_admin('devocionales'));

create policy "Authorized collaborators can update devotionals"
  on public.devocionales for update
  to authenticated
  using (public.tiene_permiso_admin('devocionales'))
  with check (public.tiene_permiso_admin('devocionales'));

create policy "Authorized collaborators can delete devotionals"
  on public.devocionales for delete
  to authenticated
  using (public.tiene_permiso_admin('devocionales'));

-- Estas políticas se declaran después de crear tiene_permiso_admin.
drop policy if exists "Authenticated users can create events" on public.eventos;
drop policy if exists "Authenticated users can update events" on public.eventos;
drop policy if exists "Authenticated users can delete events" on public.eventos;
create policy "Authorized collaborators can create events" on public.eventos for insert to authenticated
  with check (auth.uid() = created_by and public.tiene_permiso_admin('eventos'));
create policy "Authorized collaborators can update events" on public.eventos for update to authenticated
  using (public.tiene_permiso_admin('eventos')) with check (public.tiene_permiso_admin('eventos'));
create policy "Authorized collaborators can delete events" on public.eventos for delete to authenticated
  using (public.tiene_permiso_admin('eventos'));

drop policy if exists "Admins can create groups" on public.grupos;
drop policy if exists "Admins can update groups" on public.grupos;
drop policy if exists "Admins can delete groups" on public.grupos;
create policy "Authorized collaborators can create groups" on public.grupos for insert to authenticated
  with check (public.tiene_permiso_admin('grupos'));
create policy "Authorized collaborators can update groups" on public.grupos for update to authenticated
  using (public.tiene_permiso_admin('grupos')) with check (public.tiene_permiso_admin('grupos'));
create policy "Authorized collaborators can delete groups" on public.grupos for delete to authenticated
  using (public.tiene_permiso_admin('grupos'));

drop policy if exists "Admins can create carousel content" on public.carrusel_conexion;
drop policy if exists "Admins can update carousel content" on public.carrusel_conexion;
drop policy if exists "Admins can delete carousel content" on public.carrusel_conexion;
create policy "Authorized collaborators can create carousel content" on public.carrusel_conexion for insert to authenticated
  with check (public.tiene_permiso_admin('carrusel'));
create policy "Authorized collaborators can update carousel content" on public.carrusel_conexion for update to authenticated
  using (public.tiene_permiso_admin('carrusel')) with check (public.tiene_permiso_admin('carrusel'));
create policy "Authorized collaborators can delete carousel content" on public.carrusel_conexion for delete to authenticated
  using (public.tiene_permiso_admin('carrusel'));

drop policy if exists "Authenticated users can upload event images" on storage.objects;
drop policy if exists "Authenticated users can delete event images" on storage.objects;
drop policy if exists "Authenticated users can upload carousel images" on storage.objects;
create policy "Authorized collaborators can upload event images" on storage.objects for insert to authenticated
  with check (bucket_id = 'eventos' and public.tiene_permiso_admin('eventos'));
create policy "Authorized collaborators can delete event images" on storage.objects for delete to authenticated
  using (bucket_id = 'eventos' and public.tiene_permiso_admin('eventos'));
create policy "Authorized collaborators can upload carousel images" on storage.objects for insert to authenticated
  with check (bucket_id = 'carrusel' and public.tiene_permiso_admin('carrusel'));

drop policy if exists "Admins can create site settings" on public.configuracion_sitio;
drop policy if exists "Admins can update site settings" on public.configuracion_sitio;
create policy "Authorized collaborators can create site settings" on public.configuracion_sitio for insert to authenticated
  with check (public.tiene_permiso_admin('configuracion'));
create policy "Authorized collaborators can update site settings" on public.configuracion_sitio for update to authenticated
  using (public.tiene_permiso_admin('configuracion')) with check (public.tiene_permiso_admin('configuracion'));
