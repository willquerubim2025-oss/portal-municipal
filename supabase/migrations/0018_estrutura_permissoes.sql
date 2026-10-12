-- =============================================================
-- 0018 · Unidades, regiões e permissões configuráveis por papel (fase 1A)
-- Plano: docs/Plano de Migração — Fase 1.md (Portais-Publicos).
--
-- Cada organização cria seus papéis e liga/desliga cada permissão, com escopo:
--   rede     toda a organização
--   regiao   as unidades da região do vínculo
--   unidade  só a unidade do vínculo (ex.: diretor e a sua escola)
--   proprio  só o que a própria pessoa criou (a policy compara o dono)
-- O catálogo de permissões é global e vem do código (sincronizar_permissoes).
-- Fase 1A: só os módulos novos usam pode(); notícias, páginas, destaques e
-- serviços continuam com membros.papel (admin/publicador/editor) até a fase 1B.
-- O master é a equipe_plataforma (SECKE): não é um papel, ninguém o edita.
-- =============================================================

-- -------------------------------------------------------------
-- Regiões e unidades (escolas, creches, conveniadas, UBS...)
-- -------------------------------------------------------------
create table public.regioes (
  id            uuid primary key default gen_random_uuid(),
  municipio_id  uuid not null references public.municipios on delete cascade,
  nome          text not null,
  slug          text not null check (slug ~ '^[a-z0-9-]+$'),
  descricao     text,
  ordem         int not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, slug),
  unique (id, municipio_id)
);

create table public.unidades (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  regiao_id      uuid,
  -- Livre por organização: escola, creche, cei, emef, conveniada, administrativa, ubs...
  tipo           text not null default 'escola' check (tipo ~ '^[a-z_]+$'),
  nome           text not null,
  sigla          text,
  slug           text not null check (slug ~ '^[a-z0-9-]+$'),
  etapas         text[] not null default '{}',   -- ex.: {educacao_infantil, fundamental_1}
  codigo_inep    char(8) check (codigo_inep ~ '^[0-9]{8}$'),
  conveniada     boolean not null default false,
  endereco       text,
  bairro         text,
  cep            text,
  telefone       text,
  email          text,
  site           text,
  latitude       numeric(9, 6),
  longitude      numeric(9, 6),
  foto_id        uuid,
  ordem          int not null default 0,
  ativo          boolean not null default true,
  legado         jsonb,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  busca          tsvector generated always as (
    public.tsv_pt('A', nome) || public.tsv_pt('A', sigla) || public.tsv_pt('B', bairro) || public.tsv_pt('C', endereco)
  ) stored,
  unique (municipio_id, slug),
  unique (id, municipio_id),
  foreign key (regiao_id, municipio_id) references public.regioes (id, municipio_id) on delete set null (regiao_id),
  foreign key (foto_id, municipio_id)   references public.midias (id, municipio_id) on delete set null (foto_id)
);
create index on public.unidades (municipio_id, regiao_id, ordem);
create index on public.unidades using gin (busca);

-- -------------------------------------------------------------
-- Catálogo global de permissões (gerado a partir do código)
-- -------------------------------------------------------------
create table public.permissoes (
  codigo        text primary key check (codigo ~ '^[a-z_]+(\.[a-z_]+)+$'),
  modulo        text not null,
  nome          text not null,
  descricao     text,
  escopos       text[] not null default '{rede}'
                check (escopos <@ array['rede', 'regiao', 'unidade', 'proprio'] and cardinality(escopos) > 0),
  ordem         int not null default 0,
  -- false = saiu do código; fica pelo histórico e deixa de valer em pode().
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Papéis de cada organização e a chave liga/desliga por permissão
-- -------------------------------------------------------------
create table public.papeis (
  id            uuid primary key default gen_random_uuid(),
  municipio_id  uuid not null references public.municipios on delete cascade,
  slug          text not null check (slug ~ '^[a-z0-9-]+$'),
  nome          text not null,
  descricao     text,
  sistema       boolean not null default false,  -- criado pelo provisionamento
  protegido     boolean not null default false,  -- Administrador: não é excluído nem perde o essencial
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, slug),
  unique (id, municipio_id)
);

-- Sem linha = desligada (permissão nova do catálogo nasce desligada para todos).
create table public.papel_permissoes (
  municipio_id     uuid not null references public.municipios on delete cascade,
  papel_id         uuid not null,
  permissao_codigo text not null references public.permissoes on update cascade,
  ativo            boolean not null default false,
  escopo           text not null default 'rede' check (escopo in ('rede', 'regiao', 'unidade', 'proprio')),
  atualizado_por   uuid default auth.uid() references auth.users on delete set null,
  atualizado_em    timestamptz not null default now(),
  primary key (papel_id, permissao_codigo),
  foreign key (papel_id, municipio_id) references public.papeis (id, municipio_id) on delete cascade
);
create index on public.papel_permissoes (municipio_id, permissao_codigo);

-- Uma pessoa pode ter vários papéis; o vínculo pode apontar a unidade ou a região do escopo.
create table public.usuario_papeis (
  id           uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  papel_id     uuid not null,
  unidade_id   uuid,
  regiao_id    uuid,
  ativo        boolean not null default true,
  criado_por   uuid default auth.uid() references auth.users on delete set null,
  criado_em    timestamptz not null default now(),
  foreign key (papel_id, municipio_id)   references public.papeis (id, municipio_id) on delete cascade,
  foreign key (unidade_id, municipio_id) references public.unidades (id, municipio_id) on delete cascade,
  foreign key (regiao_id, municipio_id)  references public.regioes (id, municipio_id) on delete cascade,
  check (num_nonnulls(unidade_id, regiao_id) <= 1),
  unique nulls not distinct (user_id, papel_id, unidade_id, regiao_id)
);
create index on public.usuario_papeis (user_id, municipio_id);
create index on public.usuario_papeis (papel_id);

-- Histórico de toda mudança de papel, permissão e vínculo (quem, quando, de → para).
create table public.log_permissoes (
  id               bigint generated always as identity primary key,
  municipio_id     uuid not null references public.municipios on delete cascade,
  em               timestamptz not null default now(),
  user_id          uuid,                       -- quem fez (null = rotina/servidor)
  tabela           text not null check (tabela in ('papeis', 'papel_permissoes', 'usuario_papeis')),
  acao             text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  papel_id         uuid,
  permissao_codigo text,
  alvo_user_id     uuid,                       -- de quem é o vínculo (usuario_papeis)
  de               jsonb,
  para             jsonb
);
create index on public.log_permissoes (municipio_id, em desc);

-- -------------------------------------------------------------
-- Auditoria (corrige 0004): ao excluir uma organização inteira, as linhas
-- apagadas em cascata não têm mais onde ser registradas; antes, a auditoria
-- tentava gravá-las e a exclusão da organização falhava (FK).
-- -------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_linha  jsonb := coalesce(v_depois, v_antes);
  v_mid    uuid;
begin
  -- O vetor de busca é derivado do conteúdo; não precisa ir para o log.
  v_antes  := v_antes - 'busca';
  v_depois := v_depois - 'busca';
  if tg_op = 'UPDATE' and v_antes - 'atualizado_em' = v_depois - 'atualizado_em' then
    return null;
  end if;
  -- Na tabela municipios, o próprio registro é o município (coluna id).
  v_mid := case when tg_table_name = 'municipios' then (v_linha ->> 'id')::uuid
                else (v_linha ->> 'municipio_id')::uuid end;
  if tg_op = 'DELETE' and v_mid is not null
     and not exists (select 1 from public.municipios m where m.id = v_mid) then
    return null;
  end if;
  insert into public.auditoria (municipio_id, tabela, registro_id, acao, user_id, antes, depois)
  values (
    v_mid,
    tg_table_name,
    coalesce(v_linha ->> 'id', v_linha ->> 'user_id', v_linha ->> 'criterio_id'),
    tg_op,
    auth.uid(),
    v_antes,
    v_depois
  );
  return null;
end $$;

-- Mesmo caso na fila de limpeza do cache (corrige 0011).
create or replace function interno.marcar_cache_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_mid   uuid;
begin
  v_mid := case tg_table_name
    when 'municipios'            then (v_linha->>'id')::uuid
    when 'documento_arquivos'    then (select d.municipio_id from public.documentos d where d.id = (v_linha->>'documento_id')::uuid)
    when 'publicacao_categorias' then (select p.municipio_id from public.publicacoes p where p.id = (v_linha->>'publicacao_id')::uuid)
    else (v_linha->>'municipio_id')::uuid
  end;
  if v_mid is not null and exists (select 1 from public.municipios m where m.id = v_mid) then
    insert into interno.cache_pendente (municipio_id) values (v_mid) on conflict do nothing;
  end if;
  return null;
end $$;
revoke all on function interno.marcar_cache_pendente() from public, anon, authenticated;

-- -------------------------------------------------------------
-- Autorização: pode(organização, permissão, unidade, dono)
-- -------------------------------------------------------------
create or replace function seguranca.pode(p_municipio uuid, p_permissao text, p_unidade uuid default null, p_dono uuid default null)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select seguranca.is_plataforma() or exists (
    select 1
      from public.usuario_papeis up
      join public.papeis pa           on pa.id = up.papel_id and pa.ativo
      join public.papel_permissoes pp on pp.papel_id = up.papel_id and pp.ativo and pp.permissao_codigo = p_permissao
      join public.permissoes pe       on pe.codigo = pp.permissao_codigo and pe.ativa
     where up.municipio_id = p_municipio
       and up.user_id = (select auth.uid())
       and up.ativo
       and (pp.escopo = 'rede'
            or (pp.escopo = 'unidade' and p_unidade is not null and up.unidade_id = p_unidade)
            or (pp.escopo = 'regiao' and p_unidade is not null and up.regiao_id is not null
                and exists (select 1 from public.unidades u where u.id = p_unidade and u.regiao_id = up.regiao_id))
            or (pp.escopo = 'proprio' and p_dono is not null and p_dono = (select auth.uid())))
  )
$$;
revoke all on function seguranca.pode(uuid, text, uuid, uuid) from public;
grant execute on function seguranca.pode(uuid, text, uuid, uuid) to anon, authenticated, service_role;

create or replace function public.pode(p_municipio uuid, p_permissao text, p_unidade uuid default null, p_dono uuid default null)
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select seguranca.pode(p_municipio, p_permissao, p_unidade, p_dono) $$;
revoke all on function public.pode(uuid, text, uuid, uuid) from public;
grant execute on function public.pode(uuid, text, uuid, uuid) to anon, authenticated, service_role;

-- Para o painel mostrar/esconder telas: o que o usuário pode, com escopo e alvo.
-- SECURITY INVOKER: só enxerga os próprios vínculos (RLS).
create or replace function public.minhas_permissoes(p_municipio uuid)
returns table (permissao text, escopo text, unidade_id uuid, regiao_id uuid)
language sql stable security invoker
set search_path = ''
as $$
  select pe.codigo, 'rede'::text, null::uuid, null::uuid
    from public.permissoes pe where pe.ativa and public.is_plataforma()
  union
  select pp.permissao_codigo, pp.escopo, up.unidade_id, up.regiao_id
    from public.usuario_papeis up
    join public.papeis pa           on pa.id = up.papel_id and pa.ativo
    join public.papel_permissoes pp on pp.papel_id = up.papel_id and pp.ativo
    join public.permissoes pe       on pe.codigo = pp.permissao_codigo and pe.ativa
   where up.municipio_id = p_municipio and up.user_id = (select auth.uid()) and up.ativo
$$;
revoke all on function public.minhas_permissoes(uuid) from public;
grant execute on function public.minhas_permissoes(uuid) to authenticated, service_role;

-- -------------------------------------------------------------
-- Salvaguardas
-- -------------------------------------------------------------
-- Permissões que o papel protegido (Administrador) nunca perde: a organização
-- sempre tem quem configure. A SECKE (e rotinas do servidor) podem tudo.
create or replace function seguranca.essenciais_admin()
returns text[] language sql immutable set search_path = ''
as $$ select array['permissoes.gerenciar', 'usuarios.vincular'] $$;

create or replace function seguranca.proteger_papeis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or seguranca.is_plataforma() then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if new.sistema or new.protegido then
      raise exception 'Papéis de sistema são criados só pelo provisionamento' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.sistema, new.protegido) is distinct from (old.sistema, old.protegido)
       or (old.protegido and (new.slug, new.ativo, new.municipio_id) is distinct from (old.slug, old.ativo, old.municipio_id)) then
      raise exception 'O papel Administrador não pode ser desativado nem ter a identidade alterada' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' and old.protegido then
    raise exception 'O papel Administrador não pode ser excluído' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create or replace function seguranca.validar_papel_permissao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_protegido boolean;
begin
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.permissoes pe where pe.codigo = new.permissao_codigo and new.escopo = any (pe.escopos)
  ) then
    raise exception 'Escopo % não se aplica à permissão %', new.escopo, new.permissao_codigo using errcode = '23514';
  end if;
  if auth.uid() is null or seguranca.is_plataforma() then
    return coalesce(new, old);
  end if;
  select pa.protegido into v_protegido from public.papeis pa where pa.id = coalesce(old.papel_id, new.papel_id);
  if v_protegido and coalesce(old.permissao_codigo, new.permissao_codigo) = any (seguranca.essenciais_admin())
     and (tg_op = 'DELETE' or not new.ativo or new.escopo <> 'rede') then
    raise exception 'O Administrador não perde a permissão %', coalesce(old.permissao_codigo, new.permissao_codigo)
      using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return coalesce(new, old);
end $$;

create or replace function seguranca.registrar_log_permissoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_linha jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  -- Exclusão da organização inteira (cascata): não há onde registrar.
  if not exists (select 1 from public.municipios m where m.id = (v_linha->>'municipio_id')::uuid) then
    return null;
  end if;
  if tg_op = 'UPDATE' and to_jsonb(old) - 'atualizado_em' - 'atualizado_por' = to_jsonb(new) - 'atualizado_em' - 'atualizado_por' then
    return null;
  end if;
  insert into public.log_permissoes (municipio_id, user_id, tabela, acao, papel_id, permissao_codigo, alvo_user_id, de, para)
  values (
    (v_linha->>'municipio_id')::uuid, auth.uid(), tg_table_name, tg_op,
    coalesce(v_linha->>'papel_id', case when tg_table_name = 'papeis' then v_linha->>'id' end)::uuid,
    v_linha->>'permissao_codigo',
    (v_linha->>'user_id')::uuid,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

-- Quem só pode "editar" uma unidade (diretor, escopo unidade/região) não muda
-- o que é da rede: região, situação, tipo, identificação oficial.
create or replace function seguranca.checar_campos_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not seguranca.pode(old.municipio_id, 'unidades.gerenciar')
     and (new.municipio_id, new.regiao_id, new.ativo, new.tipo, new.slug, new.codigo_inep, new.conveniada, new.ordem)
         is distinct from
         (old.municipio_id, old.regiao_id, old.ativo, old.tipo, old.slug, old.codigo_inep, old.conveniada, old.ordem) then
    raise exception 'Somente quem gerencia as unidades altera região, situação, tipo, INEP e ordem' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function seguranca.essenciais_admin(), seguranca.proteger_papeis(), seguranca.validar_papel_permissao(),
  seguranca.registrar_log_permissoes(), seguranca.checar_campos_unidade() from public;

create trigger trg_papeis_proteger before insert or update or delete on public.papeis
  for each row execute function seguranca.proteger_papeis();
create trigger trg_papel_permissoes_validar before insert or update or delete on public.papel_permissoes
  for each row execute function seguranca.validar_papel_permissao();
create trigger trg_unidades_campos before update on public.unidades
  for each row execute function seguranca.checar_campos_unidade();

do $$
declare t text;
begin
  foreach t in array array['papeis', 'papel_permissoes', 'usuario_papeis'] loop
    execute format(
      'create trigger trg_%1$s_log after insert or update or delete on public.%1$I
         for each row execute function seguranca.registrar_log_permissoes()', t);
  end loop;
  foreach t in array array['regioes', 'unidades', 'papeis', 'permissoes'] loop
    execute format(
      'create trigger trg_%1$s_atualizado before update on public.%1$I
         for each row execute function public.set_atualizado_em()', t);
  end loop;
  execute 'create trigger trg_unidades_atualizado_por before update on public.unidades
             for each row execute function public.set_atualizado_por()';
  -- Auditoria geral (as tabelas de permissão já têm o log_permissoes).
  foreach t in array array['regioes', 'unidades', 'usuario_papeis', 'papeis'] loop
    execute format(
      'create trigger trg_%1$s_auditoria after insert or update or delete on public.%1$I
         for each row execute function public.registrar_auditoria()', t);
  end loop;
  -- Cache do portal (0011): o que o visitante vê.
  foreach t in array array['regioes', 'unidades'] loop
    execute format(
      'create trigger trg_%1$s_cache after insert or update or delete on public.%1$I
         for each row execute function interno.marcar_cache_pendente()', t);
  end loop;
end $$;

-- Auxiliares das policies: leem sem RLS para que papeis e usuario_papeis
-- não consultem um ao outro (o Postgres acusaria recursão).
create or replace function seguranca.tenho_o_papel(p_papel uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.usuario_papeis up
                 where up.papel_id = p_papel and up.user_id = (select auth.uid()) and up.ativo)
$$;

create or replace function seguranca.papel_protegido(p_papel uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select pa.protegido from public.papeis pa where pa.id = p_papel), false) $$;

revoke all on function seguranca.tenho_o_papel(uuid), seguranca.papel_protegido(uuid) from public;
grant execute on function seguranca.tenho_o_papel(uuid), seguranca.papel_protegido(uuid) to anon, authenticated, service_role;

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
alter table public.regioes          enable row level security;
alter table public.unidades         enable row level security;
alter table public.permissoes       enable row level security;
alter table public.papeis           enable row level security;
alter table public.papel_permissoes enable row level security;
alter table public.usuario_papeis   enable row level security;
alter table public.log_permissoes   enable row level security;

create policy "regioes: público lê ativas" on public.regioes for select to anon, authenticated
  using (ativo or public.is_membro(municipio_id) or public.pode(municipio_id, 'unidades.gerenciar'));
create policy "regioes: gestor gerencia" on public.regioes for all to authenticated
  using (public.pode(municipio_id, 'unidades.gerenciar'))
  with check (public.pode(municipio_id, 'unidades.gerenciar'));

create policy "unidades: público lê ativas" on public.unidades for select to anon, authenticated
  using (ativo or public.is_membro(municipio_id) or public.pode(municipio_id, 'unidades.editar', id));
create policy "unidades: gestor cria" on public.unidades for insert to authenticated
  with check (public.pode(municipio_id, 'unidades.gerenciar'));
create policy "unidades: gestor ou responsável edita" on public.unidades for update to authenticated
  using (public.pode(municipio_id, 'unidades.gerenciar') or public.pode(municipio_id, 'unidades.editar', id))
  with check (public.pode(municipio_id, 'unidades.gerenciar') or public.pode(municipio_id, 'unidades.editar', id));
create policy "unidades: gestor exclui" on public.unidades for delete to authenticated
  using (public.pode(municipio_id, 'unidades.gerenciar'));

create policy "permissoes: catálogo para o painel" on public.permissoes for select to authenticated using (true);

create policy "papeis: quem administra ou tem o papel vê" on public.papeis for select to authenticated
  using (public.pode(municipio_id, 'permissoes.gerenciar') or public.pode(municipio_id, 'usuarios.vincular')
         or seguranca.tenho_o_papel(id));
create policy "papeis: administrador gerencia" on public.papeis for all to authenticated
  using (public.pode(municipio_id, 'permissoes.gerenciar'))
  with check (public.pode(municipio_id, 'permissoes.gerenciar'));

create policy "papel_permissoes: quem administra ou tem o papel vê" on public.papel_permissoes for select to authenticated
  using (public.pode(municipio_id, 'permissoes.gerenciar')
         or seguranca.tenho_o_papel(papel_id));
create policy "papel_permissoes: administrador liga e desliga" on public.papel_permissoes for all to authenticated
  using (public.pode(municipio_id, 'permissoes.gerenciar'))
  with check (public.pode(municipio_id, 'permissoes.gerenciar'));

-- Ninguém se promove sozinho; dar o papel Administrador exige permissoes.gerenciar.
create policy "usuario_papeis: próprio ou quem vincula vê" on public.usuario_papeis for select to authenticated
  using (user_id = (select auth.uid()) or public.pode(municipio_id, 'usuarios.vincular')
         or public.pode(municipio_id, 'permissoes.gerenciar'));
create policy "usuario_papeis: quem vincula gerencia" on public.usuario_papeis for all to authenticated
  using (public.pode(municipio_id, 'usuarios.vincular') and user_id <> (select auth.uid()))
  with check (
    public.pode(municipio_id, 'usuarios.vincular') and user_id <> (select auth.uid())
    and (not seguranca.papel_protegido(papel_id) or public.pode(municipio_id, 'permissoes.gerenciar'))
  );

create policy "log_permissoes: administrador lê" on public.log_permissoes for select to authenticated
  using (public.pode(municipio_id, 'permissoes.gerenciar'));

-- -------------------------------------------------------------
-- Permissões explícitas (D-13)
-- -------------------------------------------------------------
grant select on public.regioes, public.unidades to anon;
grant select, insert, update, delete on
  public.regioes, public.unidades, public.papeis, public.papel_permissoes, public.usuario_papeis
to authenticated;
grant select on public.permissoes, public.log_permissoes to authenticated;
grant all on public.regioes, public.unidades, public.permissoes, public.papeis,
  public.papel_permissoes, public.usuario_papeis, public.log_permissoes to service_role;
grant usage on all sequences in schema public to authenticated, service_role;

-- -------------------------------------------------------------
-- Catálogo: sincronização a partir do código (só a chave de serviço)
-- -------------------------------------------------------------
-- p_catalogo: [{codigo, modulo, nome, descricao, escopos, ordem}]. Insere as novas
-- (desligadas para todos os papéis), atualiza as existentes e marca como inativas
-- as que saíram do código, sem apagar o histórico.
create or replace function public.sincronizar_permissoes(p_catalogo jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_novas int; v_inativas int;
begin
  with entrada as (
    select e->>'codigo' codigo, e->>'modulo' modulo, e->>'nome' nome, e->>'descricao' descricao,
           coalesce(array(select jsonb_array_elements_text(e->'escopos')), '{rede}') escopos,
           coalesce((e->>'ordem')::int, 0) ordem
      from jsonb_array_elements(p_catalogo) e
  ), gravadas as (
    insert into public.permissoes as p (codigo, modulo, nome, descricao, escopos, ordem, ativa)
    select codigo, modulo, nome, descricao, escopos, ordem, true from entrada
    on conflict (codigo) do update
      set modulo = excluded.modulo, nome = excluded.nome, descricao = excluded.descricao,
          escopos = excluded.escopos, ordem = excluded.ordem, ativa = true
    returning (xmax = 0) as nova
  )
  select count(*) filter (where nova) into v_novas from gravadas;

  update public.permissoes set ativa = false
   where ativa and codigo not in (select e->>'codigo' from jsonb_array_elements(p_catalogo) e);
  get diagnostics v_inativas = row_count;
  return jsonb_build_object('novas', v_novas, 'inativadas', v_inativas);
end $$;
revoke all on function public.sincronizar_permissoes(jsonb) from public;
grant execute on function public.sincronizar_permissoes(jsonb) to service_role;

-- Catálogo inicial da fase 1A (depois, mantido pelo registro no código do painel).
select public.sincronizar_permissoes('[
  {"codigo": "permissoes.gerenciar", "modulo": "Usuários e permissões", "nome": "Configurar papéis e permissões",
   "descricao": "Criar papéis, ligar e desligar permissões e ver o histórico.", "escopos": ["rede"], "ordem": 1},
  {"codigo": "usuarios.vincular", "modulo": "Usuários e permissões", "nome": "Atribuir papéis a usuários",
   "descricao": "Dar e retirar papéis das pessoas (nunca de si mesmo).", "escopos": ["rede"], "ordem": 2},
  {"codigo": "unidades.gerenciar", "modulo": "Unidades", "nome": "Gerenciar unidades e regiões",
   "descricao": "Cadastrar, excluir e organizar unidades, regiões e supervisores.", "escopos": ["rede"], "ordem": 10},
  {"codigo": "unidades.editar", "modulo": "Unidades", "nome": "Editar dados da unidade",
   "descricao": "Atualizar contato, endereço, foto e etapas da unidade.", "escopos": ["rede", "regiao", "unidade"], "ordem": 11},
  {"codigo": "equipe.gerenciar", "modulo": "Equipe gestora", "nome": "Gerenciar a equipe gestora",
   "descricao": "Cadastrar membros, fotos autorizadas e o que aparece no portal.", "escopos": ["rede"], "ordem": 20}
]'::jsonb);

-- -------------------------------------------------------------
-- Papéis padrão de cada organização (idempotente)
-- -------------------------------------------------------------
create or replace function public.provisionar_papeis(p_municipio uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_admin uuid; v_diretor uuid;
begin
  if auth.uid() is not null and not public.is_plataforma() then
    raise exception 'Somente a SECKE provisiona papéis' using errcode = '42501';
  end if;

  insert into public.papeis (municipio_id, slug, nome, descricao, sistema, protegido) values
    (p_municipio, 'administrador', 'Administrador', 'Toda a organização, inclusive usuários e permissões.', true, true),
    (p_municipio, 'diretor',       'Diretor',       'Responsável por uma unidade (ex.: diretor de escola).', true, false),
    (p_municipio, 'professor',     'Professor',     'Professores da rede.', true, false),
    (p_municipio, 'estudante',     'Estudante',     'Estudantes da rede.', true, false)
  on conflict (municipio_id, slug) do nothing;

  select id into v_admin   from public.papeis where municipio_id = p_municipio and slug = 'administrador';
  select id into v_diretor from public.papeis where municipio_id = p_municipio and slug = 'diretor';

  -- Administrador: tudo o que existe hoje no catálogo, na rede inteira.
  insert into public.papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo)
  select p_municipio, v_admin, pe.codigo, true, 'rede' from public.permissoes pe where pe.ativa
  on conflict do nothing;
  -- Diretor: edita a própria unidade.
  insert into public.papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo)
  values (p_municipio, v_diretor, 'unidades.editar', true, 'unidade')
  on conflict do nothing;
end $$;
revoke all on function public.provisionar_papeis(uuid) from public;
grant execute on function public.provisionar_papeis(uuid) to authenticated, service_role;

-- Organização nova já nasce com os papéis (amplia 0007).
create or replace function public.criar_municipio(
  p_slug    text,
  p_nome    text,
  p_uf      char(2),
  p_dominio text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is not null and not public.is_plataforma() then
    raise exception 'Somente a SECKE cria municípios' using errcode = '42501';
  end if;
  insert into public.municipios (slug, nome, uf) values (p_slug, p_nome, upper(p_uf)) returning id into v_id;
  if p_dominio is not null then
    insert into public.municipio_dominios (dominio, municipio_id, ambiente, principal)
    values (lower(p_dominio), v_id, 'producao', true);
  end if;
  perform public.provisionar_municipio(v_id);
  perform public.provisionar_papeis(v_id);
  return v_id;
end $$;

-- Organizações que já existem recebem os papéis padrão.
select public.provisionar_papeis(id) from public.municipios;
