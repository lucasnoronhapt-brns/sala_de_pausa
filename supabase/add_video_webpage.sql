-- ═══════════════════════════════════════════════════════════
-- Fase 2: novos tipos de slide — vídeo e página web (iframe)
-- Correr no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════

alter table playlist_items drop constraint playlist_items_type_check;

alter table playlist_items add constraint playlist_items_type_check
  check (type in ('text', 'image', 'image_text', 'video', 'webpage'));
