-- =============================================================
-- 0032 · Destaque com "arte pronta" (D-129)
-- Banner cuja imagem já traz o texto (arte de divulgação). O portal mostra a arte inteira, sem escurecer e sem
-- escrever título, texto nem botão por cima; o título continua existindo para leitores de tela e o link, se houver,
-- vale para o banner todo.
-- Permissões: as da tabela (0008), sem GRANT novo.
-- =============================================================
alter table public.destaques add column arte_pronta boolean not null default false;
comment on column public.destaques.arte_pronta is 'A imagem já traz o texto: o portal não sobrepõe título, texto nem botão (D-129).';
