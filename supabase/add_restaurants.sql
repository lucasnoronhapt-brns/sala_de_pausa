-- ═══════════════════════════════════════════════════════════
-- Multi-restaurante: tabela restaurants + coluna nos itens.
-- Item com restaurant_slug NULL aparece em TODOS os restaurantes.
-- Cada TV aponta para /tv/<slug> no Fully Kiosk.
-- rotation: 270 = TV na vertical (como a do Serra Shopping),
--           0   = TV na horizontal.
-- Este ficheiro é idempotente — pode ser corrido mais de uma vez.
-- ═══════════════════════════════════════════════════════════

create table if not exists restaurants (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  rotation   int  not null default 0 check (rotation in (0, 90, 270)),
  created_at timestamptz not null default now()
);

-- Para quem já tinha criado a tabela sem a coluna rotation
alter table restaurants
  add column if not exists rotation int not null default 0;

alter table restaurants enable row level security;

drop policy if exists "leitura publica de restaurantes" on restaurants;
create policy "leitura publica de restaurantes"
  on restaurants for select
  using (true);

drop policy if exists "admins gerem restaurantes" on restaurants;
create policy "admins gerem restaurantes"
  on restaurants for all
  to authenticated
  using ((auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com'));

-- Se um restaurante for apagado, os itens dele passam a "todos"
alter table playlist_items
  add column if not exists restaurant_slug text
  references restaurants(slug) on delete set null on update cascade;

-- ── Os 6 restaurantes ───────────────────────────────────────
insert into restaurants (slug, name, rotation) values
  ('serra-shopping',       'Serra Shopping',       270),
  ('covilha-drive',        'Covilhã Drive',        0),
  ('guarda',               'Guarda',               0),
  ('castelo-branco-drive', 'Castelo Branco Drive', 0),
  ('castelo-branco-forum', 'Castelo Branco Forum', 0),
  ('portoalegre',          'Portoalegre',          0)
on conflict (slug) do nothing;
