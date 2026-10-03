-- =============================================================
-- 0002 · Conteúdo: categorias, mídias, publicações, páginas,
-- documentos, serviços e menus (RF02, RF04–RF06, RF12, RF15)
-- Coluna `legado` guarda a origem da migração (ex.: {"wp_id": 123,
-- "url": "/noticia-x/"}) e alimenta os redirecionamentos (RM04).
-- Isolamento: toda referência entre tabelas de conteúdo usa FK composta
-- (id, municipio_id), para que um registro nunca aponte para outro
-- município (ex.: item de menu de A pendurado no menu de B).
-- =============================================================

-- Texto puro a partir do HTML do editor, para indexação.
create or replace function public.html_para_texto(text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$ select regexp_replace(coalesce($1, ''), '<[^>]+>', ' ', 'g') $$;

create or replace function public.tsv_pt(peso "char", texto text)
returns tsvector
language sql immutable parallel safe
set search_path = ''
as $$ select setweight(to_tsvector('pg_catalog.portuguese', public.f_unaccent(coalesce(texto, ''))), peso) $$;

-- -------------------------------------------------------------
-- Categorias (por escopo: publicações, documentos, serviços, eventos ou perguntas frequentes)
-- -------------------------------------------------------------
create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  municipio_id  uuid not null references public.municipios on delete cascade,
  escopo        text not null check (escopo in ('publicacao', 'documento', 'servico', 'evento', 'pergunta')),
  parent_id     uuid,
  nome          text not null,
  slug          text not null check (slug ~ '^[a-z0-9-]+$'),
  descricao     text,
  ordem         int not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, escopo, slug),
  unique (id, municipio_id),
  foreign key (parent_id, municipio_id) references public.categorias (id, municipio_id) on delete set null (parent_id)
);
create trigger trg_categorias_atualizado before update on public.categorias
  for each row execute function public.set_atualizado_em();

-- -------------------------------------------------------------
-- Biblioteca de mídias (RF15). Arquivo no Storage em midias/{municipio_id}/...
-- -------------------------------------------------------------
create table public.midias (
  id                uuid primary key default gen_random_uuid(),
  municipio_id      uuid not null references public.municipios on delete cascade,
  storage_path      text not null unique,
  nome_original     text not null,
  mime_type         text not null,
  tamanho_bytes     bigint,
  titulo            text,
  texto_alternativo text,           -- obrigatório na UI para imagens (RNF03)
  legenda           text,
  legado            jsonb,
  criado_por        uuid default auth.uid() references auth.users on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (id, municipio_id)
);
create index on public.midias (municipio_id, criado_em desc);
create index on public.midias (municipio_id, mime_type);
create trigger trg_midias_atualizado before update on public.midias
  for each row execute function public.set_atualizado_em();

-- -------------------------------------------------------------
-- Publicações: notícias e avisos (RF04)
-- -------------------------------------------------------------
create table public.publicacoes (
  id                  uuid primary key default gen_random_uuid(),
  municipio_id        uuid not null references public.municipios on delete cascade,
  tipo                text not null default 'noticia' check (tipo in ('noticia', 'aviso')),
  titulo              text not null,
  slug                text not null check (slug ~ '^[a-z0-9-]+$'),
  resumo              text,
  corpo_html          text,
  imagem_destaque_id  uuid,
  destaque            boolean not null default false,
  status              public.status_publicacao not null default 'rascunho',
  publicado_em        timestamptz,
  legado              jsonb,
  criado_por          uuid default auth.uid() references auth.users on delete set null,
  atualizado_por      uuid default auth.uid() references auth.users on delete set null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  busca               tsvector generated always as (
    public.tsv_pt('A', titulo) || public.tsv_pt('B', resumo) || public.tsv_pt('C', public.html_para_texto(corpo_html))
  ) stored,
  unique (municipio_id, slug),
  unique (id, municipio_id),
  foreign key (imagem_destaque_id, municipio_id) references public.midias (id, municipio_id) on delete set null (imagem_destaque_id),
  check (status <> 'publicado' or publicado_em is not null)
);
create index on public.publicacoes (municipio_id, tipo, status, publicado_em desc);
create index on public.publicacoes using gin (busca);
create trigger trg_publicacoes_atualizado before update on public.publicacoes
  for each row execute function public.set_atualizado_em();

create table public.publicacao_categorias (
  publicacao_id uuid not null references public.publicacoes on delete cascade,
  categoria_id  uuid not null references public.categorias on delete cascade,
  primary key (publicacao_id, categoria_id)
);
create index on public.publicacao_categorias (categoria_id);

-- -------------------------------------------------------------
-- Páginas institucionais (hierárquicas). `caminho` é a URL completa
-- sem barras nas pontas, ex.: 'transparencia/acesso-a-informacao'.
-- -------------------------------------------------------------
create table public.paginas (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  parent_id      uuid,
  titulo         text not null,
  caminho        text not null check (caminho ~ '^[a-z0-9-]+(/[a-z0-9-]+)*$'),
  resumo         text,
  corpo_html     text,
  ordem          int not null default 0,
  status         public.status_publicacao not null default 'rascunho',
  publicado_em   timestamptz,
  legado         jsonb,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  busca          tsvector generated always as (
    public.tsv_pt('A', titulo) || public.tsv_pt('B', resumo) || public.tsv_pt('C', public.html_para_texto(corpo_html))
  ) stored,
  unique (municipio_id, caminho),
  unique (id, municipio_id),
  foreign key (parent_id, municipio_id) references public.paginas (id, municipio_id) on delete set null (parent_id),
  check (status <> 'publicado' or publicado_em is not null)
);
create index on public.paginas using gin (busca);
create trigger trg_paginas_atualizado before update on public.paginas
  for each row execute function public.set_atualizado_em();

-- -------------------------------------------------------------
-- Documentos (RF05): leis, decretos, portarias, editais, licitações,
-- relatórios. O tipo vem da categoria; campos específicos (modalidade,
-- situação da licitação, etc.) ficam em `metadados`.
-- -------------------------------------------------------------
create table public.documentos (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  categoria_id   uuid,
  titulo         text not null,
  slug           text not null check (slug ~ '^[a-z0-9-]+$'),
  numero         text,
  ano            smallint check (ano between 1900 and 2200),
  data_documento date,
  ementa         text,
  descricao_html text,
  metadados      jsonb not null default '{}',
  status         public.status_publicacao not null default 'rascunho',
  publicado_em   timestamptz,
  legado         jsonb,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  busca          tsvector generated always as (
    public.tsv_pt('A', titulo) || public.tsv_pt('A', numero) || public.tsv_pt('B', ementa)
      || public.tsv_pt('C', public.html_para_texto(descricao_html))
  ) stored,
  unique (municipio_id, slug),
  unique (id, municipio_id),
  foreign key (categoria_id, municipio_id) references public.categorias (id, municipio_id) on delete set null (categoria_id),
  check (status <> 'publicado' or publicado_em is not null)
);
create index on public.documentos (municipio_id, categoria_id, ano desc, data_documento desc);
create index on public.documentos using gin (busca);
create trigger trg_documentos_atualizado before update on public.documentos
  for each row execute function public.set_atualizado_em();

-- Arquivos do documento (edital, anexos, ata, homologação...).
create table public.documento_arquivos (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos on delete cascade,
  midia_id     uuid references public.midias on delete restrict,
  url_externa  text,
  rotulo       text not null,
  ordem        int not null default 0,
  check ((midia_id is null) <> (url_externa is null))
);
create index on public.documento_arquivos (documento_id, ordem);

-- -------------------------------------------------------------
-- Carta de Serviços (RF06 · Lei 13.460/2017)
-- -------------------------------------------------------------
create table public.servicos (
  id                uuid primary key default gen_random_uuid(),
  municipio_id      uuid not null references public.municipios on delete cascade,
  categoria_id      uuid,
  titulo            text not null,
  slug              text not null check (slug ~ '^[a-z0-9-]+$'),
  descricao         text,
  publico_alvo      text,
  requisitos_html   text,
  etapas_html       text,
  prazo             text,
  custo             text,
  canal_atendimento text,
  local_horario     text,
  url_externa       text,           -- quando o serviço é prestado em sistema externo
  status            public.status_publicacao not null default 'rascunho',
  publicado_em      timestamptz,
  legado            jsonb,
  criado_por        uuid default auth.uid() references auth.users on delete set null,
  atualizado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  busca             tsvector generated always as (
    public.tsv_pt('A', titulo) || public.tsv_pt('B', descricao)
      || public.tsv_pt('C', public.html_para_texto(requisitos_html) || ' ' || public.html_para_texto(etapas_html))
  ) stored,
  unique (municipio_id, slug),
  foreign key (categoria_id, municipio_id) references public.categorias (id, municipio_id) on delete set null (categoria_id),
  check (status <> 'publicado' or publicado_em is not null)
);
create index on public.servicos using gin (busca);
create trigger trg_servicos_atualizado before update on public.servicos
  for each row execute function public.set_atualizado_em();

-- -------------------------------------------------------------
-- Menus (RF02): principal, rodapé, atalhos, por público...
-- -------------------------------------------------------------
create table public.menus (
  id           uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios on delete cascade,
  local        text not null,              -- 'principal', 'rodape', 'atalhos', 'cidadao', 'servidor'...
  nome         text not null,
  unique (municipio_id, local),
  unique (id, municipio_id)
);

create table public.menu_itens (
  id           uuid primary key default gen_random_uuid(),
  menu_id      uuid not null,
  municipio_id uuid not null references public.municipios on delete cascade,
  parent_id    uuid,
  rotulo       text not null,
  pagina_id    uuid,
  categoria_id uuid,
  url          text,
  nova_aba     boolean not null default false,
  ordem        int not null default 0,
  unique (id, municipio_id),
  foreign key (menu_id, municipio_id)      references public.menus (id, municipio_id) on delete cascade,
  foreign key (parent_id, municipio_id)    references public.menu_itens (id, municipio_id) on delete cascade,
  foreign key (pagina_id, municipio_id)    references public.paginas (id, municipio_id) on delete cascade,
  foreign key (categoria_id, municipio_id) references public.categorias (id, municipio_id) on delete cascade,
  check (num_nonnulls(pagina_id, categoria_id, url) <= 1)
);
create index on public.menu_itens (menu_id, parent_id, ordem);

-- O default de atualizado_por só vale no INSERT; este trigger registra quem editou por último.
create or replace function public.set_atualizado_por()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['publicacoes', 'paginas', 'documentos', 'servicos'] loop
    execute format(
      'create trigger trg_%1$s_atualizado_por before update on public.%1$I
         for each row execute function public.set_atualizado_por()', t);
  end loop;
end $$;
