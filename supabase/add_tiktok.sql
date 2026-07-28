-- ═══════════════════════════════════════════════════════════
-- Novo tipo de slide: tiktok (TikTok Embed Player oficial)
-- image_url guarda apenas o ID numérico do vídeo.
-- Correr no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════

alter table playlist_items drop constraint playlist_items_type_check;

alter table playlist_items add constraint playlist_items_type_check
  check (type in ('text', 'image', 'image_text', 'video', 'webpage', 'tiktok'));
