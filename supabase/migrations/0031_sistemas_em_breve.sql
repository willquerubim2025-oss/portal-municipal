-- =============================================================
-- 0031 · Sistemas "em breve" e sistemas de servidores na página inicial (D-122)
-- A CI Eletrônica (sistema de servidores, ainda sem endereço publicado) entra no bloco "Sistemas" da página inicial.
--   sistemas_externos.em_breve  ainda não está no ar: o portal mostra o cartão sem link, com "Em breve";
--                               o endereço pode ficar vazio enquanto isso (url só é obrigatória fora do "em breve")
--   na_home vale também para sistemas de servidores: o visitante passa a ver o nome, a descrição e o logo deles
--   (o portal marca "Servidores"); os outros sistemas de servidor continuam invisíveis para o visitante.
-- Permissões: as da tabela (0008), sem GRANT novo.
-- =============================================================

alter table public.sistemas_externos
  add column em_breve boolean not null default false;
alter table public.sistemas_externos
  alter column url drop not null;
alter table public.sistemas_externos
  add constraint sistemas_externos_url_check check (url is not null or em_breve);
comment on column public.sistemas_externos.em_breve is 'Ainda não está no ar (D-122): o portal mostra sem link, com "Em breve"; o endereço pode ficar vazio.';

-- O visitante vê os sistemas públicos ativos e os ativos marcados para a página inicial; quem trabalha na organização vê todos.
alter policy "sistemas_externos: público lê ativos" on public.sistemas_externos
  using ((ativo and (publico = 'cidadao' or na_home)) or public.is_membro(municipio_id));

-- Logo de sistema ativo e visível no portal (público ou na página inicial) é público (amplia a 0030).
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
                 where se.logo_id = p_midia and se.ativo and (se.publico = 'cidadao' or se.na_home))
$$;
