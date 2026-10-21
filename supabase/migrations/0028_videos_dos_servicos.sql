-- =============================================================
-- 0028 · Vídeos nas páginas de serviço (D-116)
-- Cada serviço da Carta de Serviços pode ter vídeos explicativos (ex.: "Como fazer a inscrição"),
-- mostrados no portal logo depois da foto de capa. Lista em jsonb, na ordem de exibição:
--   [{ "titulo": "...", "caminho": "<municipio_id>/videos/arquivo.mp4", "capa": "<municipio_id>/videos/arquivo.jpg" }]
-- caminho e capa são do bucket público "midias" e precisam estar na pasta da própria organização
-- (nenhum serviço aponta para arquivo de outra). Permissões: as da tabela servicos (0008), sem GRANT novo.
-- =============================================================

alter table public.servicos add column videos jsonb not null default '[]'::jsonb;

alter table public.servicos add constraint servicos_videos_validos check (
  jsonb_typeof(videos) = 'array'
  and jsonb_array_length(videos) <= 6
  -- todo item tem título e caminho em texto
  and not jsonb_path_exists(videos, '$[*] ? (!(@.titulo.type() == "string" && @.caminho.type() == "string"))')
  -- caminho e capa (se houver) dentro da pasta da organização
  and not jsonb_path_exists(videos, '$[*] ? (!(@.caminho starts with $p))', jsonb_build_object('p', municipio_id::text || '/'))
  and not jsonb_path_exists(videos, '$[*] ? (exists(@.capa) && !(@.capa starts with $p))', jsonb_build_object('p', municipio_id::text || '/'))
);

comment on column public.servicos.videos is
  'Vídeos do serviço (D-116): [{titulo, caminho, capa?}], arquivos no bucket midias, na pasta da organização. Até 6.';
