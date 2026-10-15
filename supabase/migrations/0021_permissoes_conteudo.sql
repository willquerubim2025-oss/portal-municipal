-- =============================================================
-- 0021 · Permissões de conteúdo (fase 1B, D-78)
-- O conteúdo do portal passa a obedecer também aos papéis configuráveis (D-38).
-- Em vez de reescrever as ~70 policies, amplia as três funções por onde todas
-- passam (is_membro, pode_publicar, is_admin): o papel antigo (membros) continua
-- valendo exatamente como antes (Jeriquara não muda) e as permissões novas somam.
--   conteudo.editar          → como "editor": cria e edita rascunhos
--   conteudo.publicar        → como "publicador": publica, agenda, retira do site, exclui
--   organizacao.administrar  → como "admin": menus, transparência, identidade, usuários...
-- Também: colegas visíveis por usuario_papeis (perfis) e o Administrador de cada
-- organização recebe as três permissões novas (rede).
-- =============================================================

-- -------------------------------------------------------------
-- 1. Catálogo (o registro no código do painel tem as mesmas entradas)
-- -------------------------------------------------------------
insert into public.permissoes (codigo, modulo, nome, descricao, escopos, ordem, ativa) values
  ('conteudo.editar', 'Conteúdo', 'Criar e editar conteúdo',
   'Criar e editar rascunhos de notícias, páginas, documentos, serviços, agenda, perguntas e banners.', '{rede}', 30, true),
  ('conteudo.publicar', 'Conteúdo', 'Publicar conteúdo',
   'Publicar, agendar, retirar do site e excluir conteúdo; gerenciar categorias.', '{rede}', 31, true),
  ('organizacao.administrar', 'Organização', 'Administrar a organização',
   'Menus, transparência, identidade visual e dados, estrutura, redirecionamentos, auditoria, exportação e usuários.', '{rede}', 40, true)
on conflict (codigo) do update
  set modulo = excluded.modulo, nome = excluded.nome, descricao = excluded.descricao,
      escopos = excluded.escopos, ordem = excluded.ordem, ativa = true;

-- -------------------------------------------------------------
-- 2. As três funções das policies: papel antigo OU permissão configurável
-- -------------------------------------------------------------
-- Mesmo nome e assinatura (sem DROP: as policies e os grants continuam apontando para elas).
-- seguranca.pode() já considera a equipe da SECKE (is_plataforma).
create or replace function public.is_membro(p_municipio uuid)
returns boolean language sql stable
set search_path = ''
as $$
  select public.tem_papel(p_municipio, array['admin', 'publicador', 'editor']::public.papel_usuario[])
      or seguranca.pode(p_municipio, 'conteudo.editar')
      or seguranca.pode(p_municipio, 'conteudo.publicar')
      or seguranca.pode(p_municipio, 'organizacao.administrar')
$$;

create or replace function public.pode_publicar(p_municipio uuid)
returns boolean language sql stable
set search_path = ''
as $$
  select public.tem_papel(p_municipio, array['admin', 'publicador']::public.papel_usuario[])
      or seguranca.pode(p_municipio, 'conteudo.publicar')
      or seguranca.pode(p_municipio, 'organizacao.administrar')
$$;

create or replace function public.is_admin(p_municipio uuid)
returns boolean language sql stable
set search_path = ''
as $$
  select public.tem_papel(p_municipio, array['admin']::public.papel_usuario[])
      or seguranca.pode(p_municipio, 'organizacao.administrar')
$$;

-- -------------------------------------------------------------
-- 3. Perfis: colega também por usuario_papeis
-- -------------------------------------------------------------
-- Vê o perfil de alguém quem trabalha com conteúdo, atribui papéis ou configura papéis
-- numa organização em que essa pessoa tem vínculo (antigo ou configurável).
-- SECURITY DEFINER: lê membros e usuario_papeis sem o RLS de quem consulta.
create or replace function seguranca.e_colega(p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from (
      select m.municipio_id from public.membros m where m.user_id = p_user
      union
      select up.municipio_id from public.usuario_papeis up where up.user_id = p_user
    ) o
    where public.is_membro(o.municipio_id)
       or seguranca.pode(o.municipio_id, 'usuarios.vincular')
       or seguranca.pode(o.municipio_id, 'permissoes.gerenciar')
  )
$$;
revoke all on function seguranca.e_colega(uuid) from public;
grant execute on function seguranca.e_colega(uuid) to authenticated, service_role;

alter policy "perfis: próprio ou colega" on public.perfis
  using (user_id = (select auth.uid()) or public.is_plataforma() or seguranca.e_colega(user_id));

-- -------------------------------------------------------------
-- 4. O Administrador (papel protegido) de cada organização recebe as permissões novas
-- -------------------------------------------------------------
-- Organizações novas já recebem pelo provisionar_papeis (todo o catálogo ativo).
insert into public.papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo)
select pa.municipio_id, pa.id, c.codigo, true, 'rede'
  from public.papeis pa
 cross join (values ('conteudo.editar'), ('conteudo.publicar'), ('organizacao.administrar')) c(codigo)
 where pa.protegido
on conflict (papel_id, permissao_codigo) do nothing;
