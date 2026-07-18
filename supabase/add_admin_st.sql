-- ═══════════════════════════════════════════════════════════
-- Adiciona lucasnoronha.st@gmail.com como segundo admin.
-- Antes de correr: Authentication → Users → Add user
-- (email + password, marcar Auto Confirm User).
-- ═══════════════════════════════════════════════════════════

drop policy if exists "so o admin gere a playlist" on playlist_items;
create policy "so o admin gere a playlist"
  on playlist_items for all
  to authenticated
  using ((auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com'));

drop policy if exists "so o admin envia media" on storage.objects;
create policy "so o admin envia media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com')
  );

drop policy if exists "so o admin apaga media" on storage.objects;
create policy "so o admin apaga media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in ('lucasnoronha@msn.com', 'lucasnoronha.st@gmail.com')
  );
