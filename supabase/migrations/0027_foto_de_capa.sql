-- =============================================================
-- 0027 · Foto de capa nas páginas e nos serviços (D-100)
-- Opcional: aparece no alto da página institucional e da página do serviço, no layout vitrine.
-- A foto passa a ser pública quando a página/serviço está publicado (midia_publica, 0016/0019),
-- e a pré-visualização (0024) traz a foto também.
-- =============================================================

alter table public.paginas  add column imagem_id uuid;
alter table public.servicos add column imagem_id uuid;
alter table public.paginas
  add constraint paginas_imagem_fkey foreign key (imagem_id, municipio_id)
  references public.midias (id, municipio_id) on delete set null (imagem_id);
alter table public.servicos
  add constraint servicos_imagem_fkey foreign key (imagem_id, municipio_id)
  references public.midias (id, municipio_id) on delete set null (imagem_id);
create index if not exists paginas_imagem_idx  on public.paginas (imagem_id)  where imagem_id is not null;
create index if not exists servicos_imagem_idx on public.servicos (imagem_id) where imagem_id is not null;
comment on column public.paginas.imagem_id  is 'Foto de capa opcional (D-100).';
comment on column public.servicos.imagem_id is 'Foto de capa opcional (D-100).';

-- Mídias públicas: também a capa de página e de serviço publicados (amplia 0019).
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
$$;

-- Pré-visualização (0024): páginas e serviços trazem a foto de capa.
create or replace function seguranca.previa_conteudo(p_token uuid, p_municipio uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.previas%rowtype;
begin
  select * into v from public.previas
   where token = p_token and municipio_id = p_municipio and expira_em > now();
  if not found then
    return null;
  end if;
  return case v.tabela
    when 'publicacoes' then jsonb_build_object('tabela', 'publicacoes', 'dados', seguranca.previa_publicacao(p_token, p_municipio))
    when 'paginas' then (
      select jsonb_build_object('tabela', 'paginas', 'dados', to_jsonb(p) - 'busca' - 'legado'
        || jsonb_build_object(
             'filhas', coalesce((select jsonb_agg(jsonb_build_object('titulo', f.titulo, 'caminho', f.caminho, 'resumo', f.resumo) order by f.ordem, f.titulo)
               from public.paginas f where f.parent_id = p.id and f.status = 'publicado'), '[]'::jsonb),
             'imagem', (select jsonb_build_object('storage_path', m.storage_path, 'texto_alternativo', m.texto_alternativo) from public.midias m where m.id = p.imagem_id)))
        from public.paginas p where p.id = v.registro_id and p.municipio_id = p_municipio)
    when 'servicos' then (
      select jsonb_build_object('tabela', 'servicos', 'dados', to_jsonb(s) - 'busca' - 'legado'
        || jsonb_build_object(
             'categoria', (select jsonb_build_object('nome', c.nome, 'slug', c.slug) from public.categorias c where c.id = s.categoria_id),
             'orgao', (select jsonb_build_object('nome', o.nome, 'slug', o.slug, 'telefone', o.telefone) from public.orgaos o where o.id = s.orgao_id),
             'imagem', (select jsonb_build_object('storage_path', m.storage_path, 'texto_alternativo', m.texto_alternativo) from public.midias m where m.id = s.imagem_id)))
        from public.servicos s where s.id = v.registro_id and s.municipio_id = p_municipio)
    when 'eventos' then (
      select jsonb_build_object('tabela', 'eventos', 'dados', to_jsonb(e) - 'busca' - 'legado'
        || jsonb_build_object(
             'orgao', (select jsonb_build_object('nome', o.nome, 'slug', o.slug) from public.orgaos o where o.id = e.orgao_id),
             'imagem', (select jsonb_build_object('storage_path', m.storage_path, 'texto_alternativo', m.texto_alternativo) from public.midias m where m.id = e.imagem_id)))
        from public.eventos e where e.id = v.registro_id and e.municipio_id = p_municipio)
  end;
end $$;
