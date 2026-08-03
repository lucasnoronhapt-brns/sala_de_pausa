-- ═══════════════════════════════════════════════════════════
-- Permissões por restaurante.
-- admin_users: quem pode gerir o quê.
--   restaurant_slug NULL  = super admin (gere tudo + restaurantes)
--   restaurant_slug 'xyz' = só gere os itens desse restaurante
-- Correr no SQL Editor DEPOIS do add_restaurants.sql.
-- Idempotente — pode ser corrido mais de uma vez.
-- ═══════════════════════════════════════════════════════════

create table if not exists admin_users (
  email           text primary key,
  restaurant_slug text references restaurants(slug) on delete set null on update cascade,
  created_at      timestamptz not null default now()
);

alter table admin_users enable row level security;

drop policy if exists "cada admin le o seu registo" on admin_users;
create policy "cada admin le o seu registo"
  on admin_users for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- Super admins atuais
insert into admin_users (email, restaurant_slug) values
  ('lucasnoronha@msn.com', null),
  ('lucasnoronha.st@gmail.com', null)
on conflict (email) do nothing;

-- ── playlist_items: cada admin só gere o que lhe pertence ───
drop policy if exists "admin autenticado gere tudo" on playlist_items;
drop policy if exists "so o admin gere a playlist" on playlist_items;
drop policy if exists "admins gerem os seus itens" on playlist_items;

create policy "admins gerem os seus itens"
  on playlist_items for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.email = (auth.jwt() ->> 'email')
        and (au.restaurant_slug is null
             or au.restaurant_slug = playlist_items.restaurant_slug)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.email = (auth.jwt() ->> 'email')
        and (au.restaurant_slug is null
             or au.restaurant_slug = playlist_items.restaurant_slug)
    )
  );

-- ── storage: qualquer admin registado envia/apaga media ─────
drop policy if exists "admin envia media" on storage.objects;
drop policy if exists "so o admin envia media" on storage.objects;
drop policy if exists "admins enviam media" on storage.objects;
create policy "admins enviam media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and exists (select 1 from admin_users au where au.email = (auth.jwt() ->> 'email'))
  );

drop policy if exists "admin apaga media" on storage.objects;
drop policy if exists "so o admin apaga media" on storage.objects;
drop policy if exists "admins apagam media" on storage.objects;
create policy "admins apagam media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and exists (select 1 from admin_users au where au.email = (auth.jwt() ->> 'email'))
  );

-- ── restaurants: só super admins criam/apagam ───────────────
drop policy if exists "admins gerem restaurantes" on restaurants;
drop policy if exists "super admins gerem restaurantes" on restaurants;
create policy "super admins gerem restaurantes"
  on restaurants for all
  to authenticated
  using (
    exists (select 1 from admin_users au
            where au.email = (auth.jwt() ->> 'email') and au.restaurant_slug is null)
  )
  with check (
    exists (select 1 from admin_users au
            where au.email = (auth.jwt() ->> 'email') and au.restaurant_slug is null)
  );

-- ═══════════════════════════════════════════════════════════
-- COMO ADICIONAR O ADMIN DE UM RESTAURANTE:
-- 1. Authentication → Users → Add user (email + password, Auto Confirm)
-- 2. Correr (com o email e o slug certos):
--    insert into admin_users (email, restaurant_slug)
--    values ('pessoa@exemplo.com', 'guarda');
-- Slugs: serra-shopping, covilha-drive, guarda,
--        castelo-branco-drive, castelo-branco-forum, portoalegre
-- ═══════════════════════════════════════════════════════════
