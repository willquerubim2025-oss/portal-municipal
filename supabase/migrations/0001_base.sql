-- =============================================================
-- 0001 · Base multi-prefeitura: municípios, domínios, usuários e papéis
-- Todo dado de conteúdo carrega municipio_id; o acesso é decidido
-- por RLS (0005) a partir da tabela membros.
-- =============================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent não é IMMUTABLE; este wrapper permite usá-lo em colunas geradas e índices.
create or replace function public.f_unaccent(text)
returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create type public.papel_usuario as enum ('admin', 'publicador', 'editor');
create type public.status_publicacao as enum ('rascunho', 'publicado', 'despublicado');

-- Mantém atualizado_em em qualquer tabela que tenha a coluna.
create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- -------------------------------------------------------------
-- Municípios (tenants)
-- -------------------------------------------------------------
create table public.municipios (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nome          text not null,
  uf            char(2) not null,
  cnpj          text,
  -- Identidade visual: cores, logo, brasão, fontes (lido pelo portal público).
  tema          jsonb not null default '{}',
  -- Contatos, endereço, horário, redes sociais, textos do rodapé.
  config        jsonb not null default '{}',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger trg_municipios_atualizado before update on public.municipios
  for each row execute function public.set_atualizado_em();

-- O portal resolve o município pelo host da requisição.
create table public.municipio_dominios (
  dominio      text primary key check (dominio = lower(dominio)),
  municipio_id uuid not null references public.municipios on delete cascade,
  ambiente     text not null default 'producao' check (ambiente in ('producao', 'homologacao')),
  principal    boolean not null default false
);
create index on public.municipio_dominios (municipio_id);
create unique index municipio_dominio_principal_unico
  on public.municipio_dominios (municipio_id, ambiente) where principal;

-- -------------------------------------------------------------
-- Usuários
-- -------------------------------------------------------------
-- Equipe da plataforma (SECKE): suporte com acesso a todos os municípios.
create table public.equipe_plataforma (
  user_id   uuid primary key references auth.users on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now()
);

create table public.perfis (
  user_id       uuid primary key references auth.users on delete cascade,
  nome          text not null,
  email         text not null,
  cargo         text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger trg_perfis_atualizado before update on public.perfis
  for each row execute function public.set_atualizado_em();

-- Vínculo usuário × município com o papel (RF13). Um usuário pode servir a mais de um município.
create table public.membros (
  municipio_id  uuid not null references public.municipios on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  papel         public.papel_usuario not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (municipio_id, user_id)
);
create index on public.membros (user_id);
create trigger trg_membros_atualizado before update on public.membros
  for each row execute function public.set_atualizado_em();

-- -------------------------------------------------------------
-- Funções de autorização usadas pelas policies
-- -------------------------------------------------------------
create or replace function public.is_plataforma()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.equipe_plataforma where user_id = (select auth.uid()))
$$;

create or replace function public.tem_papel(p_municipio uuid, p_papeis public.papel_usuario[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_plataforma() or exists (
    select 1 from public.membros m
    where m.municipio_id = p_municipio
      and m.user_id = (select auth.uid())
      and m.ativo
      and m.papel = any (p_papeis)
  )
$$;

-- Atalhos legíveis para as policies.
create or replace function public.is_membro(p_municipio uuid)
returns boolean language sql stable
set search_path = ''
as $$ select public.tem_papel(p_municipio, array['admin', 'publicador', 'editor']::public.papel_usuario[]) $$;

create or replace function public.pode_publicar(p_municipio uuid)
returns boolean language sql stable
set search_path = ''
as $$ select public.tem_papel(p_municipio, array['admin', 'publicador']::public.papel_usuario[]) $$;

create or replace function public.is_admin(p_municipio uuid)
returns boolean language sql stable
set search_path = ''
as $$ select public.tem_papel(p_municipio, array['admin']::public.papel_usuario[]) $$;

create or replace function public.municipio_por_dominio(p_dominio text)
returns uuid
language sql stable
set search_path = ''
as $$
  select d.municipio_id
  from public.municipio_dominios d
  join public.municipios m on m.id = d.municipio_id and m.ativo
  where d.dominio = lower(p_dominio)
$$;
