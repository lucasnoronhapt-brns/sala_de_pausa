-- ═══════════════════════════════════════════════════════════
-- Sinalização Digital — Schema Supabase (Fase 1)
-- Correr isto no SQL Editor do painel do Supabase.
-- ═══════════════════════════════════════════════════════════

create table if not exists playlist_items (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('text', 'image', 'image_text')),
  title            text,
  body             text,
  image_url        text,
  duration_seconds int  not null default 8 check (duration_seconds between 3 and 120),
  order_index      int  not null default 0,
  start_date       timestamptz,          -- null = aparece desde já
  end_date         timestamptz,          -- null = nunca expira
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table playlist_items enable row level security;

-- A TV (sem login) só pode LER itens ativos
create policy "tv pode ler itens ativos"
  on playlist_items for select
  using (active = true);

-- Admin autenticado pode tudo
-- NOTA: num projeto Supabase partilhado com outra app (ex.: bolão),
-- corre depois o restrict_admin.sql para limitar isto ao email do admin.
create policy "admin autenticado gere tudo"
  on playlist_items for all
  to authenticated
  using (true)
  with check (true);

-- ── Storage: bucket para imagens ────────────────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Leitura pública (a TV precisa de carregar as imagens sem login)
create policy "leitura publica de media"
  on storage.objects for select
  using (bucket_id = 'media');

-- Só admin autenticado pode enviar/apagar imagens
create policy "admin envia media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy "admin apaga media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media');
