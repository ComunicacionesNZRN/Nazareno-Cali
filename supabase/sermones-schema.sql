-- Ejecuta admin-permissions-migration.sql antes de este archivo.
-- Las escrituras quedan limitadas a usuarios con permisos de administracion.

create table if not exists public.sermones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  predicador text not null,
  fecha date not null,
  youtube_url text not null,
  youtube_video_id text unique,
  youtube_channel_id text,
  thumbnail_url text,
  en_vivo boolean not null default false,
  publicado boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists sermones_un_solo_en_vivo
  on public.sermones (en_vivo)
  where en_vivo = true;

create table if not exists public.youtube_sync_state (
  id smallint primary key default 1 check (id = 1),
  last_attempt_at timestamptz not null default '1970-01-01 00:00:00+00',
  last_success_at timestamptz,
  last_error text
);

insert into public.youtube_sync_state (id)
values (1)
on conflict (id) do nothing;

alter table public.youtube_sync_state enable row level security;
revoke all on public.youtube_sync_state from anon, authenticated;

create table if not exists public.podcasts (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  programa text,
  descripcion text,
  fecha date,
  youtube_url text,
  audio_url text,
  thumbnail_url text,
  publicado boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint podcasts_media_url_required check (youtube_url is not null or audio_url is not null)
);

alter table public.sermones enable row level security;
alter table public.podcasts enable row level security;

drop policy if exists "Public can read published sermons" on public.sermones;
create policy "Public can read published sermons"
  on public.sermones for select to anon, authenticated
  using (publicado = true or public.tiene_permiso_admin('sermones'));

drop policy if exists "Authorized admins can create sermons" on public.sermones;
create policy "Authorized admins can create sermons"
  on public.sermones for insert to authenticated
  with check (public.tiene_permiso_admin('sermones'));

drop policy if exists "Authorized admins can update sermons" on public.sermones;
create policy "Authorized admins can update sermons"
  on public.sermones for update to authenticated
  using (public.tiene_permiso_admin('sermones'))
  with check (public.tiene_permiso_admin('sermones'));

drop policy if exists "Authorized admins can delete sermons" on public.sermones;
create policy "Authorized admins can delete sermons"
  on public.sermones for delete to authenticated
  using (public.tiene_permiso_admin('sermones'));

drop policy if exists "Public can read published podcasts" on public.podcasts;
create policy "Public can read published podcasts"
  on public.podcasts for select to anon, authenticated
  using (publicado = true or public.tiene_permiso_admin('sermones'));

drop policy if exists "Authorized admins can create podcasts" on public.podcasts;
create policy "Authorized admins can create podcasts"
  on public.podcasts for insert to authenticated
  with check (public.tiene_permiso_admin('sermones'));

drop policy if exists "Authorized admins can update podcasts" on public.podcasts;
create policy "Authorized admins can update podcasts"
  on public.podcasts for update to authenticated
  using (public.tiene_permiso_admin('sermones'))
  with check (public.tiene_permiso_admin('sermones'));

drop policy if exists "Authorized admins can delete podcasts" on public.podcasts;
create policy "Authorized admins can delete podcasts"
  on public.podcasts for delete to authenticated
  using (public.tiene_permiso_admin('sermones'));

grant select on public.sermones, public.podcasts to anon, authenticated;
grant insert, update, delete on public.sermones, public.podcasts to authenticated;