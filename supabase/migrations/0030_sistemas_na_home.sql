-- =============================================================
-- 0030 · Sistemas na página inicial (D-121)
-- A Secretaria terá vários sistemas "orbitando" o portal (SISS, matrícula, uniforme...). A página inicial ganha
-- o bloco "sistemas" (config.home.blocos), com o logo de cada sistema público num círculo e o link.
--   sistemas_externos.na_home  aparece no bloco da página inicial
--   sistemas_externos.ordem    ordem no bloco
--   sistemas_externos.logo_id  logo (midias da própria organização); sem logo, o portal usa o ícone
--   sistemas_externos.icone    ícone de reserva (mesmos nomes de servicos.icone)
-- O logo de um sistema público e ativo passa a ser mídia pública (seguranca.midia_publica, amplia a 0027).
-- Permissões: as da tabela (0008), sem GRANT novo.
-- =============================================================

alter table public.sistemas_externos
  add column na_home boolean not null default false,
  add column ordem   integer not null default 0,
  add column icone   text,
  add column logo_id uuid;
alter table public.sistemas_externos
  add constraint sistemas_externos_logo_fkey foreign key (logo_id, municipio_id)
  references public.midias (id, municipio_id) on delete set null (logo_id);
create index if not exists sistemas_externos_logo_idx on public.sistemas_externos (logo_id) where logo_id is not null;
create index if not exists sistemas_externos_home_idx on public.sistemas_externos (municipio_id, ordem) where na_home;
comment on column public.sistemas_externos.na_home is 'Aparece no bloco "Sistemas" da página inicial (D-121).';
comment on column public.sistemas_externos.logo_id is 'Logo do sistema (D-121); sem logo, o portal usa o ícone.';

-- Logo de sistema público e ativo é público (amplia a 0027).
create or replace function seguranca.midia_publica(p_midia uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.publicacoes p
                 where p.imagem_destaque_id = p_midia and p.status = 'publicado' and p.publicado_em <= now())
      or exists (select 1 from public.publicacao_midias pm join public.publicacoes p on p.id = pm.publicacao_id
                 where pm.midia_id = p_midia and p.status = 'publicado' and p.publicado_em <= now())
      or exists (select 1 from public.destaques d
                 where d.imagem_id = p_midia and d.status = 'publicado' and d.publicado_em <= now())
      or exists (select 1 from public.eventos e
                 where e.imagem_id = p_midia and e.status = 'publicado' and e.publicado_em <= now())
      or exists (select 1 from public.orgaos o
                 where o.responsavel_foto_id = p_midia and o.ativo)
      or exists (select 1 from public.documento_arquivos a join public.documentos d on d.id = a.documento_id
                 where a.midia_id = p_midia and d.status = 'publicado' and d.publicado_em <= now())
      or exists (select 1 from public.unidades u where u.foto_id = p_midia and u.ativo)
      or exists (select 1 from public.equipe q where q.foto_id = p_midia and q.visivel and q.autorizacao_imagem)
      or exists (select 1 from public.paginas pg
                 where pg.imagem_id = p_midia and pg.status = 'publicado' and pg.publicado_em <= now())
      or exists (select 1 from public.servicos s
                 where s.imagem_id = p_midia and s.status = 'publicado' and s.publicado_em <= now())
      or exists (select 1 from public.sistemas_externos se
                 where se.logo_id = p_midia and se.ativo and se.publico = 'cidadao')
$$;
