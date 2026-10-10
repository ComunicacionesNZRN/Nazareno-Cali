-- Configuración independiente para inscripciones y galerías de cada encuentro.
-- Ejecutar en Supabase SQL Editor después de admin-permissions-migration.sql.

create table if not exists public.configuracion_encuentros (
  genero text primary key check (genero in ('hombres', 'mujeres')),
  inscripciones_abiertas boolean not null default true,
  galeria_urls jsonb not null default '[]'::jsonb,
  constraint configuracion_encuentros_galeria_array
    check (jsonb_typeof(galeria_urls) = 'array')
);

alter table public.configuracion_encuentros enable row level security;

drop policy if exists "Public can read encounter settings" on public.configuracion_encuentros;
drop policy if exists "Encounter admins can insert settings" on public.configuracion_encuentros;
drop policy if exists "Encounter admins can update settings" on public.configuracion_encuentros;

create policy "Public can read encounter settings"
  on public.configuracion_encuentros for select
  to anon, authenticated
  using (true);

create policy "Encounter admins can insert settings"
  on public.configuracion_encuentros for insert
  to authenticated
  with check (public.tiene_permiso_admin('encuentros'));

create policy "Encounter admins can update settings"
  on public.configuracion_encuentros for update
  to authenticated
  using (public.tiene_permiso_admin('encuentros'))
  with check (public.tiene_permiso_admin('encuentros'));

grant select on public.configuracion_encuentros to anon, authenticated;
grant insert, update on public.configuracion_encuentros to authenticated;

insert into storage.buckets (id, name, public)
values ('encuentros', 'encuentros', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read encounter gallery images" on storage.objects;
drop policy if exists "Encounter admins can upload gallery images" on storage.objects;
drop policy if exists "Encounter admins can delete gallery images" on storage.objects;

create policy "Public can read encounter gallery images"
  on storage.objects for select
  to public
  using (bucket_id = 'encuentros');

create policy "Encounter admins can upload gallery images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'encuentros' and public.tiene_permiso_admin('encuentros'));

create policy "Encounter admins can delete gallery images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'encuentros' and public.tiene_permiso_admin('encuentros'));

insert into public.configuracion_encuentros (genero, inscripciones_abiertas, galeria_urls)
values
  ('hombres', true, '["Media/01.jpg", "Media/03.jpg", "Media/02.jpg"]'::jsonb),
  ('mujeres', true, '["Media/03.jpg", "Media/01.jpg", "Media/02.jpg"]'::jsonb)
on conflict (genero) do nothing;
