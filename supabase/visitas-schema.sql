create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  origen text not null check (origen = 'web'),
  pagina text not null,
  created_at timestamptz not null default now()
);

alter table public.visitas enable row level security;

grant insert on public.visitas to anon, authenticated;

drop policy if exists "Public can insert web visits" on public.visitas;
create policy "Public can insert web visits"
  on public.visitas
  for insert
  to anon, authenticated
  with check (origen = 'web');
