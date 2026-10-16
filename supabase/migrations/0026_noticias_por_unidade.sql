-- =============================================================
-- 0026 · Notícias das unidades (permissões, fase 1C, D-97)
-- Uma notícia pode ser de uma unidade (escola, creche...): publicacoes.unidade_id.
-- conteudo.editar e conteudo.publicar passam a aceitar escopo de unidade e de região.
-- Quem tem a permissão só na unidade (ex.: diretor) cria, edita e, se puder publicar,
-- publica SÓ as notícias da própria unidade; não vê nem mexe no resto do conteúdo.
-- Quem tem a permissão na rede continua como antes (is_membro/pode_publicar, 0021) e
-- pode marcar qualquer unidade ou nenhuma (notícia da organização).
-- Só notícias e avisos (publicacoes): páginas, documentos, serviços etc. seguem da rede.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Coluna
-- -------------------------------------------------------------
alter table public.publicacoes add column unidade_id uuid;
alter table public.publicacoes
  add constraint publicacoes_unidade_fkey foreign key (unidade_id, municipio_id)
  references public.unidades (id, municipio_id) on delete set null (unidade_id);
create index on public.publicacoes (unidade_id) where unidade_id is not null;
comment on column public.publicacoes.unidade_id is
  'Unidade (escola, creche...) dona da notícia; null = notícia da organização. Define quem pode editar com escopo de unidade/região (D-97).';

-- -------------------------------------------------------------
-- 2. Catálogo: as permissões de conteúdo aceitam unidade e região
-- -------------------------------------------------------------
update public.permissoes set escopos = '{rede,regiao,unidade}',
       descricao = descricao || ' Na unidade ou região: só as notícias das próprias unidades.'
 where codigo in ('conteudo.editar', 'conteudo.publicar') and not ('unidade' = any (escopos));

-- -------------------------------------------------------------
-- 3. Funções das policies (SECURITY INVOKER; seguranca.pode é quem lê os vínculos)
-- -------------------------------------------------------------
-- Pode escrever na notícia desta unidade (rascunho)?
create or replace function public.edita_unidade(p_municipio uuid, p_unidade uuid)
returns boolean language sql stable
set search_path = ''
as $$
  select p_unidade is not null
     and (seguranca.pode(p_municipio, 'conteudo.editar', p_unidade)
          or seguranca.pode(p_municipio, 'conteudo.publicar', p_unidade))
$$;

-- Pode publicar, retirar do site e excluir a notícia desta unidade?
create or replace function public.publica_unidade(p_municipio uuid, p_unidade uuid)
returns boolean language sql stable
set search_path = ''
as $$
  select p_unidade is not null and seguranca.pode(p_municipio, 'conteudo.publicar', p_unidade)
$$;

-- Tem permissão de conteúdo em alguma unidade da organização? (para enviar imagens)
create or replace function seguranca.conteudo_em_unidade(p_municipio uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.usuario_papeis up
      join public.papeis pa           on pa.id = up.papel_id and pa.ativo
      join public.papel_permissoes pp on pp.papel_id = up.papel_id and pp.ativo
                                     and pp.permissao_codigo in ('conteudo.editar', 'conteudo.publicar')
                                     and pp.escopo in ('unidade', 'regiao')
     where up.municipio_id = p_municipio and up.user_id = (select auth.uid()) and up.ativo
  )
$$;
revoke all on function seguranca.conteudo_em_unidade(uuid) from public;
grant execute on function seguranca.conteudo_em_unidade(uuid) to authenticated, service_role;

create or replace function public.conteudo_em_unidade(p_municipio uuid)
returns boolean language sql stable security invoker
set search_path = ''
as $$ select seguranca.conteudo_em_unidade(p_municipio) $$;

revoke all on function public.edita_unidade(uuid, uuid), public.publica_unidade(uuid, uuid),
  public.conteudo_em_unidade(uuid) from public;
grant execute on function public.edita_unidade(uuid, uuid), public.publica_unidade(uuid, uuid),
  public.conteudo_em_unidade(uuid) to authenticated, service_role;

-- -------------------------------------------------------------
-- 4. Policies a mais (permissivas: somam às da rede, 0005)
-- -------------------------------------------------------------
create policy "publicacoes: unidade lê as suas" on public.publicacoes for select to authenticated
  using (public.edita_unidade(municipio_id, unidade_id));
create policy "publicacoes: unidade cria" on public.publicacoes for insert to authenticated
  with check (public.edita_unidade(municipio_id, unidade_id)
              and (status <> 'publicado' or public.publica_unidade(municipio_id, unidade_id)));
create policy "publicacoes: unidade edita" on public.publicacoes for update to authenticated
  using (public.edita_unidade(municipio_id, unidade_id))
  with check (public.edita_unidade(municipio_id, unidade_id)
              and (status <> 'publicado' or public.publica_unidade(municipio_id, unidade_id)));
create policy "publicacoes: unidade exclui" on public.publicacoes for delete to authenticated
  using (public.publica_unidade(municipio_id, unidade_id));

-- Categorias e galeria da notícia seguem a notícia.
create policy "pub_cat: unidade gerencia" on public.publicacao_categorias for all to authenticated
  using (exists (
    select 1 from public.publicacoes p where p.id = publicacao_id
      and public.edita_unidade(p.municipio_id, p.unidade_id)
      and (p.status <> 'publicado' or public.publica_unidade(p.municipio_id, p.unidade_id))
  ))
  with check (exists (
    select 1 from public.publicacoes p
    join public.categorias c on c.id = categoria_id and c.municipio_id = p.municipio_id
    where p.id = publicacao_id
      and public.edita_unidade(p.municipio_id, p.unidade_id)
      and (p.status <> 'publicado' or public.publica_unidade(p.municipio_id, p.unidade_id))
  ));
create policy "pub_midias: unidade gerencia" on public.publicacao_midias for all to authenticated
  using (exists (
    select 1 from public.publicacoes p where p.id = publicacao_id
      and public.edita_unidade(p.municipio_id, p.unidade_id)
      and (p.status <> 'publicado' or public.publica_unidade(p.municipio_id, p.unidade_id))
  ))
  with check (exists (
    select 1 from public.publicacoes p where p.id = publicacao_id
      and public.edita_unidade(p.municipio_id, p.unidade_id)
      and (p.status <> 'publicado' or public.publica_unidade(p.municipio_id, p.unidade_id))
  ));

-- Imagens: quem escreve notícia de unidade envia (excluir e substituir continua com quem publica na rede).
-- Também vê a biblioteca da organização (0016 só abre as usadas em conteúdo visível) e
-- corrige o texto alternativo do que ela mesma enviou.
create policy "midias: unidade envia" on public.midias for insert to authenticated
  with check (public.conteudo_em_unidade(municipio_id));
create policy "midias: unidade lê" on public.midias for select to authenticated
  using (public.conteudo_em_unidade(municipio_id));
create policy "midias: unidade edita as suas" on public.midias for update to authenticated
  using (criado_por = (select auth.uid()) and public.conteudo_em_unidade(municipio_id))
  with check (criado_por = (select auth.uid()) and public.conteudo_em_unidade(municipio_id));
create policy "midias: unidade lista" on storage.objects for select to authenticated
  using (bucket_id = 'midias' and public.conteudo_em_unidade(public.municipio_do_arquivo(name)));
create policy "midias: unidade envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.conteudo_em_unidade(public.municipio_do_arquivo(name)));

-- -------------------------------------------------------------
-- 5. Trava de publicação (0005): conta também a permissão na unidade da notícia
-- -------------------------------------------------------------
-- A policy de UPDATE só enxerga a linha nova; o gatilho confere a antiga e a nova.
-- Em publicacoes, quem publica na unidade pode publicar/despublicar as notícias dela
-- (a unidade antiga e a nova têm de ser dele).
create or replace function public.checar_permissao_publicacao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_unid_old uuid;
  v_unid_new uuid;
begin
  if auth.uid() is null
     or not (old.status = 'publicado' or new.status = 'publicado')
     or public.pode_publicar(new.municipio_id) then
    return new;
  end if;
  if tg_table_name = 'publicacoes' then
    v_unid_old := (to_jsonb(old)->>'unidade_id')::uuid;
    v_unid_new := (to_jsonb(new)->>'unidade_id')::uuid;
    if public.publica_unidade(new.municipio_id, v_unid_new)
       and public.publica_unidade(old.municipio_id, v_unid_old) then
      return new;
    end if;
  end if;
  raise exception 'Somente admin ou publicador pode alterar conteúdo publicado'
    using errcode = '42501';
end $$;

-- -------------------------------------------------------------
-- 6. Pré-visualização (0024): quem escreve a notícia da unidade também gera o link
-- -------------------------------------------------------------
create or replace function seguranca.criar_previa(p_tabela text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid   uuid;
  v_unid  uuid;
  v_token uuid;
begin
  if p_tabela not in ('publicacoes', 'paginas', 'servicos', 'eventos') then
    raise exception 'Pré-visualização não disponível para %', p_tabela using errcode = '22023';
  end if;
  if p_tabela = 'publicacoes' then
    select municipio_id, unidade_id into v_mid, v_unid from public.publicacoes where id = p_id;
  else
    v_mid := case p_tabela
      when 'paginas'  then (select municipio_id from public.paginas  where id = p_id)
      when 'servicos' then (select municipio_id from public.servicos where id = p_id)
      when 'eventos'  then (select municipio_id from public.eventos  where id = p_id)
    end;
  end if;
  if v_mid is null or not (public.is_membro(v_mid) or public.is_plataforma()
                           or public.edita_unidade(v_mid, v_unid)) then
    raise exception 'Sem permissão para pré-visualizar este conteúdo' using errcode = '42501';
  end if;
  delete from public.previas where expira_em < now();
  insert into public.previas (municipio_id, tabela, registro_id) values (v_mid, p_tabela, p_id)
  returning token into v_token;
  return v_token;
end $$;

-- -------------------------------------------------------------
-- 7. "Destacar na página inicial" é decisão da rede
-- -------------------------------------------------------------
-- Quem só escreve na unidade não liga nem desliga o destaque: o valor fica como estava
-- (notícia nova: sem destaque). Sem erro, para não travar a edição de uma notícia que a
-- rede destacou.
create or replace function seguranca.manter_destaque_da_rede()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_membro(new.municipio_id) then
    new.destaque := case when tg_op = 'UPDATE' then old.destaque else false end;
  end if;
  return new;
end $$;
revoke all on function seguranca.manter_destaque_da_rede() from public;
create trigger trg_publicacoes_destaque before insert or update on public.publicacoes
  for each row execute function seguranca.manter_destaque_da_rede();
