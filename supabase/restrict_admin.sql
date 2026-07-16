-- ═══════════════════════════════════════════════════════════
-- Restringe a gestão da playlist ao admin (lucasnoronha@msn.com)
-- Correr no SQL Editor depois do schema.sql.
-- ═══════════════════════════════════════════════════════════

-- Tabela playlist_items
drop policy if exists "admin autenticado gere tudo" on playlist_items;

create policy "so o admin gere a playlist"
  on playlist_items for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'lucasnoronha@msn.com')
  with check ((auth.jwt() ->> 'email') = 'lucasnoronha@msn.com');

-- Storage (bucket media)
drop policy if exists "admin envia media" on storage.objects;
drop policy if exists "admin apaga media" on storage.objects;

create policy "so o admin envia media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') = 'lucasnoronha@msn.com'
  );

create policy "so o admin apaga media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') = 'lucasnoronha@msn.com'
  );
