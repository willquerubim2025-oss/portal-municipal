-- =============================================================
-- 0016 · Correções de segurança do diagnóstico de 12/10/2026
--   1. perfis: o admin só cria perfil de quem é membro do SEU município
--      (antes bastava ser admin em qualquer município).
--   2. Funções SECURITY DEFINER saem do schema exposto pela Data API.
--      Elas vão para o schema "seguranca" (não exposto); em public ficam
--      invólucros SECURITY INVOKER com o mesmo nome e assinatura, então as
--      policies, o painel e o portal continuam funcionando sem mudança.
--   3. midias: o visitante só lê a mídia usada em conteúdo que ele pode ver
--      (publicado). Antes a tabela era pública por inteiro, e o storage_path
--      de anexos de rascunho (ex.: edital ainda não publicado) permitia
--      baixá-los pelo bucket público.
-- =============================================================

-- -------------------------------------------------------------
-- 1. perfis
-- -------------------------------------------------------------
-- O convite (Edge Function convidar-usuario) grava o perfil com a chave de
-- serviço, depois de criar o vínculo em membros; não depende desta policy.
-- ALTER (e não DROP + CREATE): mesma policy, regra nova.
alter policy "perfis: admin cria" on public.perfis
  with check (
    user_id = (select auth.uid()) or public.is_plataforma() or exists (
      select 1 from public.membros m
      where m.user_id = perfis.user_id and public.is_admin(m.municipio_id)
    )
  );

-- -------------------------------------------------------------
-- 2. Funções SECURITY DEFINER fora da Data API
-- -------------------------------------------------------------
-- As policies rodam com o papel de quem consulta, então anon e authenticated
-- precisam de USAGE no schema e EXECUTE nas funções; o que muda é que elas
-- deixam de ser chamáveis por /rest/v1/rpc diretamente.
create schema if not exists seguranca;
revoke all on schema seguranca from public;
grant usage on schema seguranca to anon, authenticated, service_role;

create or replace function seguranca.is_plataforma()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.equipe_plataforma where user_id = (select auth.uid()))
$$;

create or replace function seguranca.tem_papel(p_municipio uuid, p_papeis public.papel_usuario[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select seguranca.is_plataforma() or exists (
    select 1 from public.membros m
    where m.municipio_id = p_municipio
      and m.user_id = (select auth.uid())
      and m.ativo
      and m.papel = any (p_papeis)
  )
$$;

-- Contador estatístico do 301; o anon não tem UPDATE em redirecionamentos.
create or replace function seguranca.registrar_acesso_redirecionamento(p_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.redirecionamentos set acessos = acessos + 1, ultimo_acesso = now() where id = p_id
$$;

revoke all on all functions in schema seguranca from public;
grant execute on all functions in schema seguranca to anon, authenticated, service_role;

-- Invólucros em public: mesma assinatura, agora SECURITY INVOKER.
create or replace function public.is_plataforma()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select seguranca.is_plataforma() $$;

create or replace function public.tem_papel(p_municipio uuid, p_papeis public.papel_usuario[])
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select seguranca.tem_papel(p_municipio, p_papeis) $$;

create or replace function public.registrar_acesso_redirecionamento(p_id uuid)
returns void
language sql security invoker
set search_path = ''
as $$ select seguranca.registrar_acesso_redirecionamento(p_id) $$;

-- -------------------------------------------------------------
-- 3. midias: leitura pública só do que está em conteúdo visível
-- -------------------------------------------------------------
-- A conferência é feita por função SECURITY DEFINER (sem RLS) porque a
-- policy de documento_arquivos já consulta midias: um EXISTS direto daqui
-- para lá entraria em recursão. A função repete as mesmas regras das
-- policies públicas (0005, 0007): publicado e com publicado_em <= now();
-- órgão ativo. Membros do município continuam vendo tudo.
-- O brasão e as imagens do tema são lidos pelo caminho guardado em
-- municipios.tema e não dependem desta tabela.
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
$$;
revoke all on function seguranca.midia_publica(uuid) from public;
grant execute on function seguranca.midia_publica(uuid) to anon, authenticated, service_role;

alter policy "midias: público lê" on public.midias rename to "midias: público lê as usadas em conteúdo visível";
alter policy "midias: público lê as usadas em conteúdo visível" on public.midias
  using (public.is_membro(municipio_id) or seguranca.midia_publica(id));

create index if not exists publicacoes_imagem_destaque_idx on public.publicacoes (imagem_destaque_id) where imagem_destaque_id is not null;
create index if not exists publicacao_midias_midia_idx     on public.publicacao_midias (midia_id);
create index if not exists destaques_imagem_idx            on public.destaques (imagem_id) where imagem_id is not null;
create index if not exists eventos_imagem_idx              on public.eventos (imagem_id) where imagem_id is not null;
create index if not exists orgaos_responsavel_foto_idx     on public.orgaos (responsavel_foto_id) where responsavel_foto_id is not null;
create index if not exists documento_arquivos_midia_idx    on public.documento_arquivos (midia_id) where midia_id is not null;
