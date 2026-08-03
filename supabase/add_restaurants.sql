-- ═══════════════════════════════════════════════════════════
-- Multi-restaurante: tabela restaurants + coluna nos itens.
-- Item com restaurant_slug NULL aparece em TODOS os restaurantes.
-- Cada TV aponta para /tv/<slug> no Fully Kiosk.
-- Correr no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════

create table if not exists restaurants (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table restaurants enable row level security;

create policy "leitura publica de restaurantes"
  on restaurants for select
  using (true);

create policy "admins gerem restaurantes"
  on restaurants for all
  to authenticated
  using ((auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com'));

-- Se um restaurante for apagado, os itens dele passam a "todos"
alter table playlist_items
  add column if not exists restaurant_slug text
  references restaurants(slug) on delete set null on update cascade;
