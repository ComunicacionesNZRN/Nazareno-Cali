-- Migracion segura para una base que ya tiene las tablas principales creadas.
-- Ejecutar este archivo completo en Supabase SQL Editor.

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

alter table public.admin_perfiles add column if not exists created_by uuid references auth.users(id);
alter table public.admin_perfiles enable row level security;

create or replace function public.es_admin_principal()
returns boolean language sql security definer set search_path = public
as $$
  select coalesce(
    (select rol = 'principal' and activo from public.admin_perfiles where usuario_id = auth.uid()),
    (auth.jwt()->'app_metadata'->>'role') in ('admin', 'owner')
  );
$$;

create or replace function public.tiene_permiso_admin(nombre_permiso text)
returns boolean language sql security definer set search_path = public
as $$
  select public.es_admin_principal()
    or exists (
      select 1 from public.admin_perfiles
      where usuario_id = auth.uid()
        and activo = true
        and coalesce((permisos ->> nombre_permiso)::boolean, false) = true
    );
$$;

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
drop policy if exists "Public can read active carousel content" on public.carrusel_conexion;
create policy "Public can read active carousel content" on public.carrusel_conexion for select using (activo = true or public.es_admin_principal());

insert into storage.buckets (id, name, public)
values ('carrusel', 'carrusel', true)
on conflict (id) do update set public = true;

drop policy if exists "Authorized collaborators can upload carousel images" on storage.objects;
drop policy if exists "Public can read carousel images" on storage.objects;
create policy "Authorized collaborators can upload carousel images" on storage.objects for insert to authenticated
  with check (bucket_id = 'carrusel' and public.tiene_permiso_admin('carrusel'));
create policy "Public can read carousel images" on storage.objects for select
  using (bucket_id = 'carrusel');

alter table public.devocionales enable row level security;
drop policy if exists "Public can read published devotionals" on public.devocionales;
drop policy if exists "Authorized collaborators can read devotionals" on public.devocionales;
drop policy if exists "Authorized collaborators can create devotionals" on public.devocionales;
drop policy if exists "Authorized collaborators can update devotionals" on public.devocionales;
drop policy if exists "Authorized collaborators can delete devotionals" on public.devocionales;
create policy "Public can read published devotionals" on public.devocionales for select using (publicado = true and publicar_at <= now());
create policy "Authorized collaborators can read devotionals" on public.devocionales for select to authenticated using (public.tiene_permiso_admin('devocionales'));
create policy "Authorized collaborators can create devotionals" on public.devocionales for insert to authenticated with check (public.tiene_permiso_admin('devocionales'));
create policy "Authorized collaborators can update devotionals" on public.devocionales for update to authenticated using (public.tiene_permiso_admin('devocionales')) with check (public.tiene_permiso_admin('devocionales'));
create policy "Authorized collaborators can delete devotionals" on public.devocionales for delete to authenticated using (public.tiene_permiso_admin('devocionales'));

drop policy if exists "Admins can read their profile" on public.admin_perfiles;
drop policy if exists "Principal admins can create profiles" on public.admin_perfiles;
drop policy if exists "Users can update their profile" on public.admin_perfiles;
drop policy if exists "Principal admins can delete profiles" on public.admin_perfiles;
create policy "Admins can read their profile" on public.admin_perfiles for select to authenticated using (usuario_id = auth.uid() or public.es_admin_principal());
create policy "Principal admins can create profiles" on public.admin_perfiles for insert to authenticated with check (public.es_admin_principal());
create policy "Users can update their profile" on public.admin_perfiles for update to authenticated using (usuario_id = auth.uid() or public.es_admin_principal()) with check (usuario_id = auth.uid() or public.es_admin_principal());
create policy "Principal admins can delete profiles" on public.admin_perfiles for delete to authenticated using (public.es_admin_principal());

drop policy if exists "Authenticated users can create events" on public.eventos;
drop policy if exists "Authenticated users can update events" on public.eventos;
drop policy if exists "Authenticated users can delete events" on public.eventos;
drop policy if exists "Authorized collaborators can create events" on public.eventos;
drop policy if exists "Authorized collaborators can update events" on public.eventos;
drop policy if exists "Authorized collaborators can delete events" on public.eventos;
create policy "Authorized collaborators can create events" on public.eventos for insert to authenticated with check (auth.uid() = created_by and public.tiene_permiso_admin('eventos'));
create policy "Authorized collaborators can update events" on public.eventos for update to authenticated using (public.tiene_permiso_admin('eventos')) with check (public.tiene_permiso_admin('eventos'));
create policy "Authorized collaborators can delete events" on public.eventos for delete to authenticated using (public.tiene_permiso_admin('eventos'));

drop policy if exists "Admins can create groups" on public.grupos_conexion;
drop policy if exists "Admins can update groups" on public.grupos_conexion;
drop policy if exists "Admins can delete groups" on public.grupos_conexion;
drop policy if exists "Authorized collaborators can create groups" on public.grupos_conexion;
drop policy if exists "Authorized collaborators can update groups" on public.grupos_conexion;
drop policy if exists "Authorized collaborators can delete groups" on public.grupos_conexion;
create policy "Authorized collaborators can create groups" on public.grupos_conexion for insert to authenticated with check (public.tiene_permiso_admin('grupos'));
create policy "Authorized collaborators can update groups" on public.grupos_conexion for update to authenticated using (public.tiene_permiso_admin('grupos')) with check (public.tiene_permiso_admin('grupos'));
create policy "Authorized collaborators can delete groups" on public.grupos_conexion for delete to authenticated using (public.tiene_permiso_admin('grupos'));

drop policy if exists "Admins can create carousel content" on public.carrusel_conexion;
drop policy if exists "Admins can update carousel content" on public.carrusel_conexion;
drop policy if exists "Admins can delete carousel content" on public.carrusel_conexion;
drop policy if exists "Authorized collaborators can create carousel content" on public.carrusel_conexion;
drop policy if exists "Authorized collaborators can update carousel content" on public.carrusel_conexion;
drop policy if exists "Authorized collaborators can delete carousel content" on public.carrusel_conexion;
create policy "Authorized collaborators can create carousel content" on public.carrusel_conexion for insert to authenticated with check (public.tiene_permiso_admin('carrusel'));
create policy "Authorized collaborators can update carousel content" on public.carrusel_conexion for update to authenticated using (public.tiene_permiso_admin('carrusel')) with check (public.tiene_permiso_admin('carrusel'));
create policy "Authorized collaborators can delete carousel content" on public.carrusel_conexion for delete to authenticated using (public.tiene_permiso_admin('carrusel'));

drop policy if exists "Admins can create site settings" on public.site_config;
drop policy if exists "Admins can update site settings" on public.site_config;
drop policy if exists "Authorized collaborators can create site settings" on public.site_config;
drop policy if exists "Authorized collaborators can update site settings" on public.site_config;
create policy "Authorized collaborators can create site settings" on public.site_config for insert to authenticated with check (public.tiene_permiso_admin('configuracion'));
create policy "Authorized collaborators can update site settings" on public.site_config for update to authenticated using (public.tiene_permiso_admin('configuracion')) with check (public.tiene_permiso_admin('configuracion'));
