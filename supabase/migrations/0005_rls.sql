-- =============================================================
-- 0005 · Row Level Security
--   anon            → lê só conteúdo publicado (portal público)
--   editor          → cria/edita rascunhos do seu município
--   publicador      → + publica, despublica e exclui conteúdo
--   admin           → + usuários, menus, categorias, transparência, redirecionamentos
--   equipe_plataforma (SECKE) → tudo, em todos os municípios
-- Edge Functions de rotina (links, exportação, backup) usam service_role.
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'municipios', 'municipio_dominios', 'equipe_plataforma', 'perfis', 'membros',
    'categorias', 'midias', 'publicacoes', 'publicacao_categorias', 'paginas',
    'documentos', 'documento_arquivos', 'servicos', 'menus', 'menu_itens',
    'sistemas_externos', 'transparencia_secoes', 'transparencia_itens',
    'pntp_criterios', 'pntp_atendimento', 'redirecionamentos', 'auditoria',
    'verificacoes_links', 'verificacao_problemas', 'exportacoes',
    'contratos', 'chamados', 'chamado_mensagens'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- -------------------------------------------------------------
-- Conteúdo editorial: mesma regra para as quatro tabelas
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['publicacoes', 'paginas', 'documentos', 'servicos'] loop
    execute format($f$
      create policy "%1$s: público lê publicado" on public.%1$I for select to anon, authenticated
        using (status = 'publicado' and publicado_em <= now());
      create policy "%1$s: membros leem tudo" on public.%1$I for select to authenticated
        using (public.is_membro(municipio_id));
      create policy "%1$s: membros criam" on public.%1$I for insert to authenticated
        with check (public.is_membro(municipio_id)
                    and (status <> 'publicado' or public.pode_publicar(municipio_id)));
      create policy "%1$s: membros editam" on public.%1$I for update to authenticated
        using (public.is_membro(municipio_id))
        with check (public.is_membro(municipio_id)
                    and (status <> 'publicado' or public.pode_publicar(municipio_id)));
      create policy "%1$s: publicador exclui" on public.%1$I for delete to authenticated
        using (public.pode_publicar(municipio_id));
    $f$, t);
  end loop;
end $$;

-- Tabelas filhas seguem o pai. Como o pai, filho de conteúdo publicado só é
-- alterado por publicador/admin (D-09), e a categoria/mídia vinculada tem de
-- ser do mesmo município (essas tabelas não têm municipio_id próprio).
create policy "pub_cat: leitura" on public.publicacao_categorias for select to anon, authenticated
  using (exists (select 1 from public.publicacoes p where p.id = publicacao_id));
create policy "pub_cat: membros gerenciam" on public.publicacao_categorias for all to authenticated
  using (exists (
    select 1 from public.publicacoes p where p.id = publicacao_id and public.is_membro(p.municipio_id)
      and (p.status <> 'publicado' or public.pode_publicar(p.municipio_id))
  ))
  with check (exists (
    select 1 from public.publicacoes p
    join public.categorias c on c.id = categoria_id and c.municipio_id = p.municipio_id
    where p.id = publicacao_id and public.is_membro(p.municipio_id)
      and (p.status <> 'publicado' or public.pode_publicar(p.municipio_id))
  ));

create policy "doc_arq: leitura" on public.documento_arquivos for select to anon, authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id));
create policy "doc_arq: membros gerenciam" on public.documento_arquivos for all to authenticated
  using (exists (
    select 1 from public.documentos d where d.id = documento_id and public.is_membro(d.municipio_id)
      and (d.status <> 'publicado' or public.pode_publicar(d.municipio_id))
  ))
  with check (exists (
    select 1 from public.documentos d where d.id = documento_id and public.is_membro(d.municipio_id)
      and (d.status <> 'publicado' or public.pode_publicar(d.municipio_id))
      and (midia_id is null or exists (
        select 1 from public.midias m where m.id = midia_id and m.municipio_id = d.municipio_id))
  ));

-- -------------------------------------------------------------
-- Leitura pública de estrutura do portal; escrita por admin
-- -------------------------------------------------------------
create policy "municipios: público lê ativos" on public.municipios for select to anon, authenticated
  using (ativo or public.is_membro(id));
create policy "municipios: admin edita o seu" on public.municipios for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));
create policy "municipios: plataforma cria/exclui" on public.municipios for all to authenticated
  using (public.is_plataforma()) with check (public.is_plataforma());

create policy "dominios: público lê" on public.municipio_dominios for select to anon, authenticated using (true);
create policy "dominios: plataforma gerencia" on public.municipio_dominios for all to authenticated
  using (public.is_plataforma()) with check (public.is_plataforma());

do $$
declare t text;
begin
  -- Tabelas de estrutura gerenciadas pelo admin do município.
  foreach t in array array['menus', 'menu_itens', 'transparencia_secoes', 'redirecionamentos'] loop
    execute format($f$
      create policy "%1$s: público lê" on public.%1$I for select to anon, authenticated using (true);
      create policy "%1$s: admin gerencia" on public.%1$I for all to authenticated
        using (public.is_admin(municipio_id)) with check (public.is_admin(municipio_id));
    $f$, t);
  end loop;
  foreach t in array array['sistemas_externos', 'transparencia_itens'] loop
    execute format($f$
      create policy "%1$s: público lê ativos" on public.%1$I for select to anon, authenticated
        using (ativo or public.is_membro(municipio_id));
      create policy "%1$s: admin gerencia" on public.%1$I for all to authenticated
        using (public.is_admin(municipio_id)) with check (public.is_admin(municipio_id));
    $f$, t);
  end loop;
end $$;

-- Categorias: publicador também cria (precisa ao classificar conteúdo).
create policy "categorias: público lê" on public.categorias for select to anon, authenticated using (true);
create policy "categorias: publicador gerencia" on public.categorias for all to authenticated
  using (public.pode_publicar(municipio_id)) with check (public.pode_publicar(municipio_id));

-- Mídias: qualquer membro envia; publicador exclui.
create policy "midias: público lê" on public.midias for select to anon, authenticated using (true);
create policy "midias: membros enviam" on public.midias for insert to authenticated
  with check (public.is_membro(municipio_id));
create policy "midias: membros editam" on public.midias for update to authenticated
  using (public.is_membro(municipio_id)) with check (public.is_membro(municipio_id));
create policy "midias: publicador exclui" on public.midias for delete to authenticated
  using (public.pode_publicar(municipio_id));

-- PNTP
create policy "pntp_criterios: leitura" on public.pntp_criterios for select to anon, authenticated using (true);
create policy "pntp_criterios: plataforma gerencia" on public.pntp_criterios for all to authenticated
  using (public.is_plataforma()) with check (public.is_plataforma());
create policy "pntp_atendimento: membros leem" on public.pntp_atendimento for select to authenticated
  using (public.is_membro(municipio_id));
create policy "pntp_atendimento: admin gerencia" on public.pntp_atendimento for all to authenticated
  using (public.is_admin(municipio_id)) with check (public.is_admin(municipio_id));

-- -------------------------------------------------------------
-- Usuários
-- -------------------------------------------------------------
create policy "equipe: vê a si mesmo" on public.equipe_plataforma for select to authenticated
  using (user_id = (select auth.uid()) or public.is_plataforma());

create policy "perfis: próprio ou colega" on public.perfis for select to authenticated
  using (
    user_id = (select auth.uid()) or public.is_plataforma() or exists (
      select 1 from public.membros m where m.user_id = perfis.user_id and public.is_membro(m.municipio_id)
    )
  );
create policy "perfis: edita o próprio" on public.perfis for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "perfis: admin cria" on public.perfis for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_plataforma() or exists (
    select 1 from public.membros m where m.user_id = (select auth.uid()) and m.papel = 'admin' and m.ativo
  ));

create policy "membros: vê o próprio e colegas" on public.membros for select to authenticated
  using (user_id = (select auth.uid()) or public.is_membro(municipio_id));
create policy "membros: admin gerencia" on public.membros for all to authenticated
  using (public.is_admin(municipio_id) and user_id <> (select auth.uid()))
  with check (public.is_admin(municipio_id) and user_id <> (select auth.uid()));

-- -------------------------------------------------------------
-- Operação
-- -------------------------------------------------------------
create policy "auditoria: admin lê" on public.auditoria for select to authenticated
  using (public.is_admin(municipio_id) or public.is_plataforma());

create policy "verificacoes: publicador lê" on public.verificacoes_links for select to authenticated
  using (public.pode_publicar(municipio_id));
create policy "problemas: publicador lê" on public.verificacao_problemas for select to authenticated
  using (exists (select 1 from public.verificacoes_links v where v.id = verificacao_id and public.pode_publicar(v.municipio_id)));

create policy "exportacoes: admin lê" on public.exportacoes for select to authenticated
  using (public.is_admin(municipio_id));
create policy "exportacoes: admin solicita" on public.exportacoes for insert to authenticated
  with check (public.is_admin(municipio_id) and status = 'pendente');

create policy "contratos: membros leem" on public.contratos for select to authenticated
  using (public.is_membro(municipio_id));
create policy "contratos: plataforma gerencia" on public.contratos for all to authenticated
  using (public.is_plataforma()) with check (public.is_plataforma());

-- Município abre e acompanha; só a SECKE altera status e consumo do saldo.
create policy "chamados: membros leem" on public.chamados for select to authenticated
  using (public.is_membro(municipio_id));
create policy "chamados: membros abrem" on public.chamados for insert to authenticated
  with check (public.is_membro(municipio_id) and status = 'aberto' and solicitacoes_consumidas = 0);
create policy "chamados: plataforma gerencia" on public.chamados for update to authenticated
  using (public.is_plataforma()) with check (public.is_plataforma());

create policy "mensagens: membros leem públicas" on public.chamado_mensagens for select to authenticated
  using (exists (
    select 1 from public.chamados c where c.id = chamado_id
      and (public.is_plataforma() or (not interna and public.is_membro(c.municipio_id)))
  ));
create policy "mensagens: membros escrevem" on public.chamado_mensagens for insert to authenticated
  with check (exists (
    select 1 from public.chamados c where c.id = chamado_id
      and (public.is_plataforma() or (not interna and public.is_membro(c.municipio_id)))
  ));

-- A policy de UPDATE só enxerga a linha nova; este trigger impede que um editor
-- tire do ar (despublique) ou altere um conteúdo que já está publicado.
create or replace function public.checar_permissao_publicacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (old.status = 'publicado' or new.status = 'publicado')
     and not public.pode_publicar(new.municipio_id) then
    raise exception 'Somente admin ou publicador pode alterar conteúdo publicado'
      using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['publicacoes', 'paginas', 'documentos', 'servicos'] loop
    execute format(
      'create trigger trg_%1$s_publicacao before update on public.%1$I
         for each row execute function public.checar_permissao_publicacao()', t);
  end loop;
end $$;
