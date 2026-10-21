-- =============================================================
-- 0029 · Título da seção de vídeos do serviço (D-117)
-- Os vídeos do serviço (0028) passam a ficar numa caixa com título próprio (ex.: "Inscrição para creche").
-- Vazio: o portal usa "Vídeos explicativos". Permissões: as da tabela servicos (0008).
-- =============================================================
alter table public.servicos add column videos_titulo text check (videos_titulo is null or length(btrim(videos_titulo)) between 1 and 80);
comment on column public.servicos.videos_titulo is 'Título da seção de vídeos do serviço (D-117); vazio = "Vídeos explicativos".';
