-- =============================================================
-- 0024 · Pré-visualização também em páginas, serviços e eventos (D-93, amplia a D-91)
-- Mesmo mecanismo da 0023: o painel gera um token de 30 minutos (criar_previa) e o portal
-- mostra o rascunho em /previa/<token>. A leitura passa a ser uma função só,
-- previa_conteudo(token, organização), que devolve { tabela, dados } no formato de cada página.
-- previa_publicacao (0023) continua valendo.
-- =============================================================

alter table public.previas drop constraint previas_tabela_check;
alter table public.previas add constraint previas_tabela_check
  check (tabela in ('publicacoes', 'paginas', 'servicos', 'eventos'));

-- Gera o link: só quem pode editar o conteúdo daquela organização.
create or replace function seguranca.criar_previa(p_tabela text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid   uuid;
  v_token uuid;
begin
  v_mid := case p_tabela
    when 'publicacoes' then (select municipio_id from public.publicacoes where id = p_id)
    when 'paginas'     then (select municipio_id from public.paginas     where id = p_id)
    when 'servicos'    then (select municipio_id from public.servicos    where id = p_id)
    when 'eventos'     then (select municipio_id from public.eventos     where id = p_id)
  end;
  if p_tabela not in ('publicacoes', 'paginas', 'servicos', 'eventos') then
    raise exception 'Pré-visualização não disponível para %', p_tabela using errcode = '22023';
  end if;
  if v_mid is null or not (public.is_membro(v_mid) or public.is_plataforma()) then
    raise exception 'Sem permissão para pré-visualizar este conteúdo' using errcode = '42501';
  end if;
  delete from public.previas where expira_em < now();
  insert into public.previas (municipio_id, tabela, registro_id) values (v_mid, p_tabela, p_id)
  returning token into v_token;
  return v_token;
end $$;

-- Lê o conteúdo pelo token. null se o token não existir, tiver vencido ou for de outra organização.
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
        || jsonb_build_object('filhas', coalesce((select jsonb_agg(jsonb_build_object('titulo', f.titulo, 'caminho', f.caminho, 'resumo', f.resumo) order by f.ordem, f.titulo)
             from public.paginas f where f.parent_id = p.id and f.status = 'publicado'), '[]'::jsonb)))
        from public.paginas p where p.id = v.registro_id and p.municipio_id = p_municipio)
    when 'servicos' then (
      select jsonb_build_object('tabela', 'servicos', 'dados', to_jsonb(s) - 'busca' - 'legado'
        || jsonb_build_object(
             'categoria', (select jsonb_build_object('nome', c.nome, 'slug', c.slug) from public.categorias c where c.id = s.categoria_id),
             'orgao', (select jsonb_build_object('nome', o.nome, 'slug', o.slug, 'telefone', o.telefone) from public.orgaos o where o.id = s.orgao_id)))
        from public.servicos s where s.id = v.registro_id and s.municipio_id = p_municipio)
    when 'eventos' then (
      select jsonb_build_object('tabela', 'eventos', 'dados', to_jsonb(e) - 'busca' - 'legado'
        || jsonb_build_object(
             'orgao', (select jsonb_build_object('nome', o.nome, 'slug', o.slug) from public.orgaos o where o.id = e.orgao_id),
             'imagem', (select jsonb_build_object('storage_path', m.storage_path, 'texto_alternativo', m.texto_alternativo) from public.midias m where m.id = e.imagem_id)))
        from public.eventos e where e.id = v.registro_id and e.municipio_id = p_municipio)
  end;
end $$;
revoke all on function seguranca.previa_conteudo(uuid, uuid) from public;
grant execute on function seguranca.previa_conteudo(uuid, uuid) to anon, authenticated;

create or replace function public.previa_conteudo(p_token uuid, p_municipio uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$ select seguranca.previa_conteudo(p_token, p_municipio) $$;
revoke all on function public.previa_conteudo(uuid, uuid) from public;
grant execute on function public.previa_conteudo(uuid, uuid) to anon, authenticated;
