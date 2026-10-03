-- =============================================================
-- 0003 · Central de Transparência (RF08–RF11)
-- O site só aponta para os sistemas oficiais (Fiorilli etc.);
-- não replica dados contábeis, fiscais ou de pessoal.
-- =============================================================

-- Sistemas externos do município: Fiorilli, Diário Oficial, e-SIC, Ouvidoria, NFS-e...
create table public.sistemas_externos (
  id            uuid primary key default gen_random_uuid(),
  municipio_id  uuid not null references public.municipios on delete cascade,
  nome          text not null,
  fornecedor    text,
  categoria     text not null default 'outro'
                check (categoria in ('transparencia', 'tributario', 'pessoal', 'diario_oficial', 'ouvidoria', 'esic', 'protocolo', 'nfse', 'outro')),
  url           text not null,
  descricao     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, nome),
  unique (id, municipio_id)
);
create trigger trg_sistemas_atualizado before update on public.sistemas_externos
  for each row execute function public.set_atualizado_em();

create table public.transparencia_secoes (
  id           uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios on delete cascade,
  titulo       text not null,
  slug         text not null check (slug ~ '^[a-z0-9-]+$'),
  descricao    text,
  icone        text,
  ordem        int not null default 0,
  unique (municipio_id, slug),
  unique (id, municipio_id)
);

-- Cada item aponta para exatamente um destino: URL, página, categoria de documentos ou sistema.
-- O destino não pode ser excluído enquanto estiver na Central (restrict): um item
-- sumir da transparência sem aviso prejudica a avaliação PNTP.
create table public.transparencia_itens (
  id            uuid primary key default gen_random_uuid(),
  secao_id      uuid not null,
  municipio_id  uuid not null references public.municipios on delete cascade,
  titulo        text not null,
  descricao     text,
  url           text,
  pagina_id     uuid,
  categoria_id  uuid,
  sistema_id    uuid,
  ordem         int not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, municipio_id),
  foreign key (secao_id, municipio_id)     references public.transparencia_secoes (id, municipio_id) on delete cascade,
  foreign key (pagina_id, municipio_id)    references public.paginas (id, municipio_id) on delete restrict,
  foreign key (categoria_id, municipio_id) references public.categorias (id, municipio_id) on delete restrict,
  foreign key (sistema_id, municipio_id)   references public.sistemas_externos (id, municipio_id) on delete restrict,
  check (num_nonnulls(url, pagina_id, categoria_id, sistema_id) = 1)
);
create index on public.transparencia_itens (secao_id, ordem);
create trigger trg_transp_itens_atualizado before update on public.transparencia_itens
  for each row execute function public.set_atualizado_em();

-- Catálogo global de critérios do PNTP/ATRICON (compartilhado entre municípios).
create table public.pntp_criterios (
  id          text primary key,            -- código do critério na matriz, ex.: '2025-1.1'
  ciclo       smallint not null,           -- ano da matriz
  dimensao    text not null,
  descricao   text not null,
  essencial   boolean not null default false,
  ordem       int not null default 0
);

-- Mapeamento critério → onde o município atende (RF11). Apoio à organização, sem garantia de nota.
create table public.pntp_atendimento (
  municipio_id          uuid not null references public.municipios on delete cascade,
  criterio_id           text not null references public.pntp_criterios on delete cascade,
  transparencia_item_id uuid,
  situacao              text not null default 'nao_verificado'
                        check (situacao in ('nao_verificado', 'atende', 'parcial', 'nao_atende', 'nao_se_aplica')),
  observacao            text,
  verificado_em         timestamptz,
  verificado_por        uuid references auth.users on delete set null,
  primary key (municipio_id, criterio_id),
  foreign key (transparencia_item_id, municipio_id)
    references public.transparencia_itens (id, municipio_id) on delete set null (transparencia_item_id)
);
