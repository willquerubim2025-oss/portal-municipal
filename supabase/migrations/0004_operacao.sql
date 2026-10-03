-- =============================================================
-- 0004 · Operação: redirecionamentos (RF17), auditoria (RF16),
-- verificação de links (RF18), exportação (RF19), contratos,
-- chamados e saldo de solicitações editoriais (RF20–RF22)
-- =============================================================

-- -------------------------------------------------------------
-- Redirecionamentos 301 das URLs antigas
-- -------------------------------------------------------------
create table public.redirecionamentos (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  origem         text not null check (origem like '/%'),   -- caminho (+ query) normalizado, minúsculo
  destino        text not null,                            -- caminho interno ou URL absoluta
  codigo         smallint not null default 301 check (codigo in (301, 302, 410)),
  acessos        bigint not null default 0,
  ultimo_acesso  timestamptz,
  criado_em      timestamptz not null default now(),
  unique (municipio_id, origem)
);

-- Chamada pelo portal ao servir um 301; incrementa o contador sem expor UPDATE ao anon.
create or replace function public.registrar_acesso_redirecionamento(p_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.redirecionamentos set acessos = acessos + 1, ultimo_acesso = now() where id = p_id
$$;

-- -------------------------------------------------------------
-- Auditoria genérica (quem criou/alterou/excluiu, quando, antes/depois)
-- -------------------------------------------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  municipio_id uuid references public.municipios on delete cascade,
  tabela       text not null,
  registro_id  text not null,
  acao         text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  user_id      uuid,
  em           timestamptz not null default now(),
  antes        jsonb,
  depois       jsonb
);
create index on public.auditoria (municipio_id, em desc);
create index on public.auditoria (tabela, registro_id);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_linha  jsonb := coalesce(v_depois, v_antes);
begin
  -- O vetor de busca é derivado do conteúdo; não precisa ir para o log.
  v_antes  := v_antes - 'busca';
  v_depois := v_depois - 'busca';
  if tg_op = 'UPDATE' and v_antes - 'atualizado_em' = v_depois - 'atualizado_em' then
    return null;
  end if;
  insert into public.auditoria (municipio_id, tabela, registro_id, acao, user_id, antes, depois)
  values (
    -- Na tabela municipios, o próprio registro é o município (coluna id).
    case when tg_table_name = 'municipios' then (v_linha ->> 'id')::uuid
         else (v_linha ->> 'municipio_id')::uuid end,
    tg_table_name,
    coalesce(v_linha ->> 'id', v_linha ->> 'user_id', v_linha ->> 'criterio_id'),
    tg_op,
    auth.uid(),
    v_antes,
    v_depois
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'publicacoes', 'paginas', 'documentos', 'servicos', 'categorias', 'midias',
    'menus', 'menu_itens', 'sistemas_externos', 'transparencia_secoes', 'transparencia_itens',
    'redirecionamentos', 'membros', 'municipios'
  ] loop
    execute format(
      'create trigger trg_%1$s_auditoria after insert or update or delete on public.%1$I
         for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- -------------------------------------------------------------
-- Verificação periódica de links (RF18) — preenchida por Edge Function agendada
-- -------------------------------------------------------------
create table public.verificacoes_links (
  id           uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios on delete cascade,
  iniciado_em  timestamptz not null default now(),
  concluido_em timestamptz,
  total_links  int,
  problemas    int
);
create index on public.verificacoes_links (municipio_id, iniciado_em desc);

create table public.verificacao_problemas (
  id             bigint generated always as identity primary key,
  verificacao_id uuid not null references public.verificacoes_links on delete cascade,
  tipo           text not null check (tipo in ('link_quebrado', 'pagina_indisponivel', 'conteudo_duplicado')),
  url            text not null,
  status_http    smallint,
  erro           text,
  origem_tabela  text,
  origem_id      uuid
);
create index on public.verificacao_problemas (verificacao_id);

-- -------------------------------------------------------------
-- Exportação completa para portabilidade (RF19)
-- -------------------------------------------------------------
create table public.exportacoes (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  solicitado_por uuid default auth.uid() references auth.users on delete set null,
  status         text not null default 'pendente' check (status in ('pendente', 'processando', 'concluida', 'erro')),
  arquivo_path   text,
  erro           text,
  criado_em      timestamptz not null default now(),
  concluido_em   timestamptz
);

-- -------------------------------------------------------------
-- Contratos e suporte
-- -------------------------------------------------------------
create table public.contratos (
  id                   uuid primary key default gen_random_uuid(),
  municipio_id         uuid not null references public.municipios on delete cascade,
  numero               text not null,
  processo             text,
  inicio               date not null,
  fim                  date not null,
  -- Limite de solicitações editoriais; null = sem limite. Sem valor padrão: cada contrato define o seu.
  limite_solicitacoes  int check (limite_solicitacoes >= 0),
  valor_implantacao    numeric(12, 2),
  valor_mensal         numeric(12, 2),
  criado_em            timestamptz not null default now(),
  check (fim > inicio),
  unique (id, municipio_id)
);
create index on public.contratos (municipio_id, inicio desc);

create table public.chamados (
  id                     uuid primary key default gen_random_uuid(),
  protocolo              bigint generated always as identity unique,
  municipio_id           uuid not null references public.municipios on delete cascade,
  contrato_id            uuid,
  aberto_por             uuid default auth.uid() references auth.users on delete set null,
  tipo                   text not null check (tipo in ('solicitacao_editorial', 'suporte_tecnico', 'incidente', 'duvida')),
  titulo                 text not null,
  descricao              text not null,
  status                 text not null default 'aberto'
                         check (status in ('aberto', 'em_andamento', 'aguardando_municipio', 'concluido', 'cancelado')),
  prioridade             text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'critica')),
  -- Quantas solicitações editoriais este chamado consome do saldo (definido pela SECKE ao concluir).
  solicitacoes_consumidas smallint not null default 0 check (solicitacoes_consumidas >= 0),
  aberto_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  concluido_em           timestamptz,
  foreign key (contrato_id, municipio_id) references public.contratos (id, municipio_id) on delete set null (contrato_id)
);
create index on public.chamados (municipio_id, aberto_em desc);
create index on public.chamados (contrato_id);
create trigger trg_chamados_atualizado before update on public.chamados
  for each row execute function public.set_atualizado_em();

create table public.chamado_mensagens (
  id         bigint generated always as identity primary key,
  chamado_id uuid not null references public.chamados on delete cascade,
  autor_id   uuid default auth.uid() references auth.users on delete set null,
  mensagem   text not null,
  interna    boolean not null default false,   -- nota interna da equipe SECKE, invisível ao município
  em         timestamptz not null default now()
);
create index on public.chamado_mensagens (chamado_id, em);

-- Saldo de solicitações editoriais por contrato (RF21).
create view public.saldo_solicitacoes
with (security_invoker = true) as
select
  c.id as contrato_id,
  c.municipio_id,
  c.numero,
  c.limite_solicitacoes,
  coalesce(sum(ch.solicitacoes_consumidas), 0)::int as consumidas,
  c.limite_solicitacoes - coalesce(sum(ch.solicitacoes_consumidas), 0)::int as saldo
from public.contratos c
left join public.chamados ch on ch.contrato_id = c.id and ch.status <> 'cancelado'
group by c.id;

-- Relatório mensal para o fiscal do contrato (RF22).
create view public.relatorio_mensal_chamados
with (security_invoker = true) as
select
  municipio_id,
  contrato_id,
  date_trunc('month', aberto_em)::date as mes,
  tipo,
  count(*) as abertos,
  count(*) filter (where status = 'concluido') as concluidos,
  sum(solicitacoes_consumidas)::int as solicitacoes_consumidas,
  avg(extract(epoch from (concluido_em - aberto_em)) / 3600)
    filter (where concluido_em is not null)::numeric(10, 1) as horas_medias_ate_conclusao
from public.chamados
group by municipio_id, contrato_id, date_trunc('month', aberto_em), tipo;
