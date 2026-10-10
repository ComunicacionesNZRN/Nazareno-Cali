-- Ejecutar completo en Supabase SQL Editor.
-- Requiere las funciones public.tiene_permiso_admin() y public.es_admin_principal().

create table if not exists public.guias_biblicas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mes text not null,
  descripcion text,
  archivo_url text not null,
  archivo_nombre text not null,
  archivo_path text not null unique,
  activa boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index if not exists guias_biblicas_una_activa_idx
  on public.guias_biblicas (activa)
  where activa = true;

alter table public.guias_biblicas enable row level security;

drop policy if exists "Public can read active bible guides" on public.guias_biblicas;
create policy "Public can read active bible guides"
  on public.guias_biblicas for select
  to anon, authenticated
  using (activa = true);

drop policy if exists "Authorized collaborators can read bible guides" on public.guias_biblicas;
create policy "Authorized collaborators can read bible guides"
  on public.guias_biblicas for select
  to authenticated
  using (public.tiene_permiso_admin('devocionales'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias-biblicas', 'guias-biblicas', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['application/pdf'];

drop policy if exists "Public can read bible guide PDFs" on storage.objects;
create policy "Public can read bible guide PDFs"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'guias-biblicas');

drop policy if exists "Authorized collaborators can upload bible guide PDFs" on storage.objects;
create policy "Authorized collaborators can upload bible guide PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'guias-biblicas'
    and public.tiene_permiso_admin('devocionales')
  );

drop policy if exists "Authorized collaborators can delete bible guide PDFs" on storage.objects;
create policy "Authorized collaborators can delete bible guide PDFs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'guias-biblicas'
    and public.tiene_permiso_admin('devocionales')
  );

create or replace function public.publicar_guia_biblica(
  p_titulo text,
  p_mes text,
  p_descripcion text,
  p_archivo_url text,
  p_archivo_nombre text,
  p_archivo_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_guia_id uuid;
begin
  if not public.tiene_permiso_admin('devocionales') then
    raise exception 'No tienes permiso para publicar guías bíblicas.'
      using errcode = '42501';
  end if;

  update public.guias_biblicas
  set activa = false
  where activa = true;

  insert into public.guias_biblicas (
    titulo,
    mes,
    descripcion,
    archivo_url,
    archivo_nombre,
    archivo_path,
    activa,
    created_by
  ) values (
    p_titulo,
    p_mes,
    p_descripcion,
    p_archivo_url,
    p_archivo_nombre,
    p_archivo_path,
    true,
    auth.uid()
  )
  returning id into nueva_guia_id;

  return nueva_guia_id;
end;
$$;

revoke all on function public.publicar_guia_biblica(text, text, text, text, text, text) from public, anon;
grant execute on function public.publicar_guia_biblica(text, text, text, text, text, text) to authenticated;