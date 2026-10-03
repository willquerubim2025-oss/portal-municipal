-- =============================================================
-- 0007 · Módulos genéricos para qualquer prefeitura (D-10, D-12; doc 08)
--   Prioridade alta : estrutura organizacional, perguntas frequentes,
--                     provisionamento de município
--   Prioridade média: legislação com vigência, destaques (banners e
--                     alertas), galeria, agenda e eventos, expiração de
--                     publicações, módulos ligáveis por município
-- Concursos e processos seletivos usam `documentos` (categorias padrão
-- criadas no provisionamento), como as licitações (D-04).
-- =============================================================

-- -------------------------------------------------------------
-- Estrutura organizacional (LAI art. 8º §1º I): secretarias,
-- departamentos, autarquias, conselhos... com responsável e contatos.
-- -------------------------------------------------------------
create table public.orgaos (
  id                  uuid primary key default gen_random_uuid(),
  municipio_id        uuid not null references public.municipios on delete cascade,
  parent_id           uuid,
  tipo                text not null default 'secretaria'
                      check (tipo in ('gabinete', 'secretaria', 'departamento', 'divisao', 'setor',
                                      'autarquia', 'fundacao', 'conselho', 'outro')),
  nome                text not null,
  sigla               text,
  slug                text not null check (slug ~ '^[a-z0-9-]+$'),
  competencias_html   text,
  responsavel_nome    text,
  responsavel_cargo   text,
  responsavel_foto_id uuid,
  responsavel_curriculo_html text,
  email               text,
  telefone            text,
  endereco            text,
  horario_atendimento text,
  ordem               int not null default 0,
  ativo               boolean not null default true,
  legado              jsonb,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  busca               tsvector generated always as (
    public.tsv_pt('A', nome) || public.tsv_pt('A', sigla) || public.tsv_pt('B', responsavel_nome)
      || public.tsv_pt('C', public.html_para_texto(competencias_html))
  ) stored,
  unique (municipio_id, slug),
  unique (id, municipio_id),
  foreign key (parent_id, municipio_id) references public.orgaos (id, municipio_id) on delete set null (parent_id),
  foreign key (responsavel_foto_id, municipio_id) references public.midias (id, municipio_id) on delete set null (responsavel_foto_id)
);
create index on public.orgaos (municipio_id, parent_id, ordem);
create index on public.orgaos using gin (busca);
create trigger trg_orgaos_atualizado before update on public.orgaos
  for each row execute function public.set_atualizado_em();

-- Órgão responsável pelo conteúdo (substitui o texto livre em servicos).
alter table public.servicos    add column orgao_id uuid,
  add foreign key (orgao_id, municipio_id) references public.orgaos (id, municipio_id) on delete set null (orgao_id);
alter table public.documentos  add column orgao_id uuid,
  add foreign key (orgao_id, municipio_id) references public.orgaos (id, municipio_id) on delete set null (orgao_id);
alter table public.publicacoes add column orgao_id uuid,
  add foreign key (orgao_id, municipio_id) references public.orgaos (id, municipio_id) on delete set null (orgao_id);
create index on public.servicos (orgao_id);
create index on public.documentos (orgao_id);
create index on public.publicacoes (orgao_id);

-- -------------------------------------------------------------
-- Perguntas frequentes (LAI art. 8º §1º VI)
-- -------------------------------------------------------------
create table public.perguntas_frequentes (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  categoria_id   uuid,
  orgao_id       uuid,
  pergunta       text not null,
  resposta_html  text not null,
  ordem          int not null default 0,
  status         public.status_publicacao not null default 'rascunho',
  publicado_em   timestamptz,
  legado         jsonb,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  busca          tsvector generated always as (
    public.tsv_pt('A', pergunta) || public.tsv_pt('C', public.html_para_texto(resposta_html))
  ) stored,
  foreign key (categoria_id, municipio_id) references public.categorias (id, municipio_id) on delete set null (categoria_id),
  foreign key (orgao_id, municipio_id) references public.orgaos (id, municipio_id) on delete set null (orgao_id),
  check (status <> 'publicado' or publicado_em is not null)
);
create index on public.perguntas_frequentes (municipio_id, categoria_id, ordem);
create index on public.perguntas_frequentes using gin (busca);

-- -------------------------------------------------------------
-- Legislação com vigência: situação do ato e relações entre atos
-- -------------------------------------------------------------
-- null = não se aplica (ex.: edital, relatório). Para atos normativos o painel exige o valor.
alter table public.documentos add column situacao text
  check (situacao in ('vigente', 'alterado', 'revogado', 'suspenso', 'sem_efeito'));
create index on public.documentos (municipio_id, situacao) where situacao is not null;

-- "documento_id <tipo> relacionado_id", ex.: Lei 10/2026 revoga Lei 3/2001.
create table public.documento_relacoes (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  documento_id   uuid not null,
  relacionado_id uuid not null,
  tipo           text not null check (tipo in ('altera', 'revoga', 'revoga_parcialmente', 'regulamenta',
                                               'retifica', 'republica', 'prorroga', 'referencia')),
  observacao     text,
  criado_em      timestamptz not null default now(),
  unique (documento_id, relacionado_id, tipo),
  check (documento_id <> relacionado_id),
  foreign key (documento_id, municipio_id)   references public.documentos (id, municipio_id) on delete cascade,
  foreign key (relacionado_id, municipio_id) references public.documentos (id, municipio_id) on delete cascade
);
create index on public.documento_relacoes (relacionado_id);

-- -------------------------------------------------------------
-- Destaques da página inicial: banners rotativos e alertas
-- (ex.: Defesa Civil, vacinação, interrupção de serviço).
-- Ficam no ar de publicado_em até fim_em.
-- -------------------------------------------------------------
create table public.destaques (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  tipo           text not null default 'banner' check (tipo in ('banner', 'alerta')),
  nivel          text not null default 'informativo' check (nivel in ('informativo', 'atencao', 'urgente')),
  titulo         text not null,
  texto          text,
  imagem_id      uuid,
  url            text,
  nova_aba       boolean not null default false,
  fim_em         timestamptz,
  ordem          int not null default 0,
  status         public.status_publicacao not null default 'rascunho',
  publicado_em   timestamptz,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  foreign key (imagem_id, municipio_id) references public.midias (id, municipio_id) on delete set null (imagem_id),
  check (status <> 'publicado' or publicado_em is not null),
  check (fim_em is null or publicado_em is null or fim_em > publicado_em),
  -- Banner sem imagem não funciona no carrossel; o texto alternativo vem da mídia.
  check (tipo <> 'banner' or imagem_id is not null or status <> 'publicado')
);
create index on public.destaques (municipio_id, tipo, status, publicado_em desc);

-- -------------------------------------------------------------
-- Galeria: várias imagens por publicação, em ordem
-- -------------------------------------------------------------
create table public.publicacao_midias (
  municipio_id  uuid not null references public.municipios on delete cascade,
  publicacao_id uuid not null,
  midia_id      uuid not null,
  legenda       text,
  ordem         int not null default 0,
  primary key (publicacao_id, midia_id),
  foreign key (publicacao_id, municipio_id) references public.publicacoes (id, municipio_id) on delete cascade,
  foreign key (midia_id, municipio_id)      references public.midias (id, municipio_id) on delete cascade
);
create index on public.publicacao_midias (publicacao_id, ordem);

-- -------------------------------------------------------------
-- Agenda e eventos (agenda da cidade e agenda de autoridades)
-- -------------------------------------------------------------
create table public.eventos (
  id             uuid primary key default gen_random_uuid(),
  municipio_id   uuid not null references public.municipios on delete cascade,
  tipo           text not null default 'evento' check (tipo in ('evento', 'agenda_autoridade')),
  categoria_id   uuid,
  orgao_id       uuid,
  titulo         text not null,
  slug           text not null check (slug ~ '^[a-z0-9-]+$'),
  resumo         text,
  descricao_html text,
  inicio_em      timestamptz not null,
  fim_em         timestamptz,
  dia_inteiro    boolean not null default false,
  local          text,
  endereco       text,
  url_externa    text,               -- inscrição, transmissão
  imagem_id      uuid,
  status         public.status_publicacao not null default 'rascunho',
  publicado_em   timestamptz,
  legado         jsonb,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  busca          tsvector generated always as (
    public.tsv_pt('A', titulo) || public.tsv_pt('B', resumo) || public.tsv_pt('B', local)
      || public.tsv_pt('C', public.html_para_texto(descricao_html))
  ) stored,
  unique (municipio_id, slug),
  foreign key (categoria_id, municipio_id) references public.categorias (id, municipio_id) on delete set null (categoria_id),
  foreign key (orgao_id, municipio_id)     references public.orgaos (id, municipio_id) on delete set null (orgao_id),
  foreign key (imagem_id, municipio_id)    references public.midias (id, municipio_id) on delete set null (imagem_id),
  check (status <> 'publicado' or publicado_em is not null),
  check (fim_em is null or fim_em >= inicio_em)
);
create index on public.eventos (municipio_id, status, inicio_em);
create index on public.eventos using gin (busca);

-- -------------------------------------------------------------
-- Expiração de publicações: depois de expira_em o aviso sai das
-- listagens e da home, mas continua acessível pelo link (histórico).
-- -------------------------------------------------------------
alter table public.publicacoes add column expira_em timestamptz,
  add check (expira_em is null or publicado_em is null or expira_em > publicado_em);

-- -------------------------------------------------------------
-- Gatilhos comuns: atualizado_em/por, proteção do publicado (D-09), auditoria
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perguntas_frequentes', 'destaques', 'eventos'] loop
    execute format($f$
      create trigger trg_%1$s_atualizado before update on public.%1$I
        for each row execute function public.set_atualizado_em();
      create trigger trg_%1$s_atualizado_por before update on public.%1$I
        for each row execute function public.set_atualizado_por();
      create trigger trg_%1$s_publicacao before update on public.%1$I
        for each row execute function public.checar_permissao_publicacao();
    $f$, t);
  end loop;
  foreach t in array array['orgaos', 'perguntas_frequentes', 'destaques', 'eventos', 'documento_relacoes'] loop
    execute format(
      'create trigger trg_%1$s_auditoria after insert or update or delete on public.%1$I
         for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
alter table public.orgaos               enable row level security;
alter table public.perguntas_frequentes enable row level security;
alter table public.documento_relacoes   enable row level security;
alter table public.destaques            enable row level security;
alter table public.publicacao_midias    enable row level security;
alter table public.eventos              enable row level security;

-- Conteúdo editorial: mesma regra de publicacoes/paginas/documentos/servicos (0005).
do $$
declare t text;
begin
  foreach t in array array['perguntas_frequentes', 'destaques', 'eventos'] loop
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

-- Estrutura organizacional: dado institucional, gerenciado pelo admin (como menus e Central).
create policy "orgaos: público lê ativos" on public.orgaos for select to anon, authenticated
  using (ativo or public.is_membro(municipio_id));
create policy "orgaos: admin gerencia" on public.orgaos for all to authenticated
  using (public.is_admin(municipio_id)) with check (public.is_admin(municipio_id));

-- Filhos seguem o pai (D-09): mexer em filho de conteúdo publicado exige publicador/admin.
create policy "doc_rel: leitura" on public.documento_relacoes for select to anon, authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id));
create policy "doc_rel: membros gerenciam" on public.documento_relacoes for all to authenticated
  using (exists (
    select 1 from public.documentos d where d.id = documento_id and public.is_membro(d.municipio_id)
      and (d.status <> 'publicado' or public.pode_publicar(d.municipio_id))
  ))
  with check (exists (
    select 1 from public.documentos d where d.id = documento_id and public.is_membro(d.municipio_id)
      and (d.status <> 'publicado' or public.pode_publicar(d.municipio_id))
  ));

create policy "pub_midias: leitura" on public.publicacao_midias for select to anon, authenticated
  using (exists (select 1 from public.publicacoes p where p.id = publicacao_id));
create policy "pub_midias: membros gerenciam" on public.publicacao_midias for all to authenticated
  using (exists (
    select 1 from public.publicacoes p where p.id = publicacao_id and public.is_membro(p.municipio_id)
      and (p.status <> 'publicado' or public.pode_publicar(p.municipio_id))
  ))
  with check (exists (
    select 1 from public.publicacoes p where p.id = publicacao_id and public.is_membro(p.municipio_id)
      and (p.status <> 'publicado' or public.pode_publicar(p.municipio_id))
  ));

-- -------------------------------------------------------------
-- Busca unificada: agora também eventos, perguntas frequentes e órgãos.
-- Os caminhos são as rotas padrão do portal.
-- -------------------------------------------------------------
create or replace function public.buscar(
  p_municipio uuid,
  p_termo     text,
  p_limite    int default 20,
  p_offset    int default 0
)
returns table (
  tipo         text,
  id           uuid,
  titulo       text,
  resumo       text,
  caminho      text,
  publicado_em timestamptz,
  relevancia   real
)
language sql stable
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('pg_catalog.portuguese', public.f_unaccent(p_termo)) as tsq
  )
  select * from (
    select p.tipo, p.id, p.titulo, p.resumo, 'noticias/' || p.slug, p.publicado_em, ts_rank(p.busca, q.tsq)
    from public.publicacoes p, q where p.municipio_id = p_municipio and p.busca @@ q.tsq
    union all
    select 'pagina', g.id, g.titulo, g.resumo, g.caminho, g.publicado_em, ts_rank(g.busca, q.tsq)
    from public.paginas g, q where g.municipio_id = p_municipio and g.busca @@ q.tsq
    union all
    select 'documento', d.id, d.titulo, d.ementa, 'documentos/' || d.slug, d.publicado_em, ts_rank(d.busca, q.tsq)
    from public.documentos d, q where d.municipio_id = p_municipio and d.busca @@ q.tsq
    union all
    select 'servico', s.id, s.titulo, s.descricao, 'servicos/' || s.slug, s.publicado_em, ts_rank(s.busca, q.tsq)
    from public.servicos s, q where s.municipio_id = p_municipio and s.busca @@ q.tsq
    union all
    select 'evento', e.id, e.titulo, e.resumo, 'eventos/' || e.slug, e.publicado_em, ts_rank(e.busca, q.tsq)
    from public.eventos e, q where e.municipio_id = p_municipio and e.busca @@ q.tsq
    union all
    select 'pergunta', f.id, f.pergunta, null, 'perguntas-frequentes#' || f.id, f.publicado_em, ts_rank(f.busca, q.tsq)
    from public.perguntas_frequentes f, q where f.municipio_id = p_municipio and f.busca @@ q.tsq
    union all
    select 'orgao', o.id, o.nome, o.responsavel_nome, 'estrutura-organizacional/' || o.slug, null::timestamptz, ts_rank(o.busca, q.tsq)
    from public.orgaos o, q where o.municipio_id = p_municipio and o.busca @@ q.tsq
  ) r
  order by 7 desc, 6 desc nulls last
  limit least(p_limite, 100) offset p_offset
$$;

-- -------------------------------------------------------------
-- Provisionamento: o "pacote padrão" de um município novo (D-10).
-- Idempotente: pode rodar de novo sem duplicar nem sobrescrever o que o
-- município já personalizou. Páginas nascem em rascunho, para a prefeitura
-- revisar o texto antes de publicar.
-- SECURITY INVOKER: obedece ao RLS (SECKE ou admin do próprio município).
-- -------------------------------------------------------------
create or replace function public.provisionar_municipio(p_municipio uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s record;
  v_secao uuid;
begin
  if not public.is_admin(p_municipio) and auth.uid() is not null then
    raise exception 'Somente a SECKE ou o admin do município pode provisioná-lo' using errcode = '42501';
  end if;

  -- Módulos ligáveis por município, lidos pelo portal e pelo painel. O que já estiver em config prevalece.
  update public.municipios
     set config = jsonb_set(config, '{modulos}',
           '{"estrutura_organizacional": true, "perguntas_frequentes": true, "agenda": true,
             "galeria": true, "destaques": true, "legislacao": true, "carta_servicos": true}'::jsonb
           || coalesce(config -> 'modulos', '{}'::jsonb))
   where id = p_municipio;

  -- Categorias padrão
  insert into public.categorias (municipio_id, escopo, nome, slug, ordem)
  select p_municipio, c.escopo, c.nome, c.slug, c.ordem
  from (values
    ('documento', 'Lei Orgânica',                          'lei-organica',                  1),
    ('documento', 'Leis Complementares',                   'leis-complementares',           2),
    ('documento', 'Leis Ordinárias',                       'leis-ordinarias',               3),
    ('documento', 'Decretos',                              'decretos',                      4),
    ('documento', 'Portarias',                             'portarias',                     5),
    ('documento', 'Resoluções',                            'resolucoes',                    6),
    ('documento', 'Licitações',                            'licitacoes',                   10),
    ('documento', 'Contratos e Aditivos',                  'contratos',                    11),
    ('documento', 'Atas de Registro de Preços',            'atas-registro-precos',         12),
    ('documento', 'Convênios e Parcerias',                 'convenios',                    13),
    ('documento', 'Chamamentos Públicos',                  'chamamentos-publicos',         14),
    ('documento', 'Concursos Públicos',                    'concursos-publicos',           20),
    ('documento', 'Processos Seletivos',                   'processos-seletivos',          21),
    ('documento', 'Planejamento (PPA, LDO, LOA)',          'planejamento',                 30),
    ('documento', 'Relatórios e Prestação de Contas',      'prestacao-de-contas',          31),
    ('publicacao', 'Geral',                                'geral',                         1),
    ('servico',    'Cidadão',                              'cidadao',                       1),
    ('servico',    'Empresa',                              'empresa',                       2),
    ('servico',    'Servidor',                             'servidor',                      3),
    ('evento',     'Geral',                                'geral',                         1),
    ('pergunta',   'Geral',                                'geral',                         1)
  ) as c(escopo, nome, slug, ordem)
  on conflict (municipio_id, escopo, slug) do nothing;

  -- Menus
  insert into public.menus (municipio_id, local, nome) values
    (p_municipio, 'principal', 'Menu principal'),
    (p_municipio, 'rodape',    'Rodapé'),
    (p_municipio, 'atalhos',   'Acesso rápido')
  on conflict (municipio_id, local) do nothing;

  -- Páginas obrigatórias, em rascunho com texto-guia
  insert into public.paginas (municipio_id, titulo, caminho, corpo_html, ordem)
  select p_municipio, pg.titulo, pg.caminho, pg.corpo, pg.ordem
  from (values
    ('O Município',             'o-municipio',           '<p>História, dados geográficos e símbolos do município.</p>', 1),
    ('Acesso à Informação',     'acesso-a-informacao',   '<p>Informações da Lei de Acesso à Informação (Lei 12.527/2011): como pedir informação, prazos e recursos.</p>', 2),
    ('e-SIC',                   'e-sic',                 '<p>Serviço de Informação ao Cidadão: endereço, telefone, horário e link para o pedido eletrônico.</p>', 3),
    ('Ouvidoria',               'ouvidoria',             '<p>Canal de manifestações (Lei 13.460/2017): elogios, sugestões, reclamações e denúncias.</p>', 4),
    ('Privacidade e Proteção de Dados', 'privacidade',   '<p>Política de privacidade e cookies, encarregado de dados (LGPD, Lei 13.709/2018) e como exercer os direitos do titular.</p>', 5),
    ('Acessibilidade',          'acessibilidade',        '<p>Recursos de acessibilidade do portal (eMAG/WCAG) e canal para relatar problemas.</p>', 6)
  ) as pg(titulo, caminho, corpo, ordem)
  on conflict (municipio_id, caminho) do nothing;

  -- Central de Transparência: seções no modelo das dimensões do PNTP.
  -- Itens padrão só apontam para o que o próprio portal tem; links para
  -- sistemas externos (Fiorilli, Betha, IPM...) são cadastrados por município.
  for s in
    select * from (values
      ('institucional',   'Informações Institucionais',        1),
      ('receitas',        'Receitas',                          2),
      ('despesas',        'Despesas',                          3),
      ('convenios',       'Convênios e Transferências',        4),
      ('pessoal',         'Recursos Humanos',                  5),
      ('diarias',         'Diárias',                           6),
      ('licitacoes',      'Licitações',                        7),
      ('contratos',       'Contratos',                         8),
      ('obras',           'Obras',                             9),
      ('planejamento',    'Planejamento e Prestação de Contas',10),
      ('sic',             'Serviço de Informação ao Cidadão', 11),
      ('ouvidoria',       'Ouvidoria',                        12),
      ('lgpd',            'LGPD e Governo Digital',           13),
      ('renuncias',       'Renúncias de Receita',             14),
      ('emendas',         'Emendas Parlamentares',            15),
      ('saude',           'Saúde',                            16),
      ('educacao',        'Educação',                         17),
      ('acessibilidade',  'Acessibilidade',                   18)
    ) as v(slug, titulo, ordem)
  loop
    insert into public.transparencia_secoes (municipio_id, titulo, slug, ordem)
    values (p_municipio, s.titulo, s.slug, s.ordem)
    on conflict (municipio_id, slug) do nothing
    returning id into v_secao;

    -- Seção recém-criada: recebe os itens padrão. Seção já existente fica como o município deixou.
    continue when v_secao is null;
    insert into public.transparencia_itens (secao_id, municipio_id, titulo, url, pagina_id, categoria_id, ordem)
    select v_secao, p_municipio, i.titulo, i.url,
           (select id from public.paginas where municipio_id = p_municipio and caminho = i.pagina),
           (select id from public.categorias where municipio_id = p_municipio and escopo = 'documento' and slug = i.categoria),
           i.ordem
    from (values
      ('institucional',  'Estrutura organizacional',  '/estrutura-organizacional', null,                  null,                  1),
      ('institucional',  'Perguntas frequentes',      '/perguntas-frequentes',     null,                  null,                  2),
      ('institucional',  'Legislação municipal',      '/legislacao',               null,                  null,                  3),
      ('licitacoes',     'Licitações',                null,                        null,                  'licitacoes',          1),
      ('licitacoes',     'Atas de registro de preços',null,                        null,                  'atas-registro-precos',2),
      ('contratos',      'Contratos e aditivos',      null,                        null,                  'contratos',           1),
      ('convenios',      'Convênios e parcerias',     null,                        null,                  'convenios',           1),
      ('pessoal',        'Concursos públicos',        null,                        null,                  'concursos-publicos',  1),
      ('pessoal',        'Processos seletivos',       null,                        null,                  'processos-seletivos', 2),
      ('planejamento',   'PPA, LDO e LOA',            null,                        null,                  'planejamento',        1),
      ('planejamento',   'Relatórios e prestação de contas', null,                 null,                  'prestacao-de-contas', 2),
      ('sic',            'Acesso à informação',       null,                        'acesso-a-informacao', null,                  1),
      ('sic',            'e-SIC',                     null,                        'e-sic',               null,                  2),
      ('ouvidoria',      'Ouvidoria',                 null,                        'ouvidoria',           null,                  1),
      ('lgpd',           'Privacidade e proteção de dados', null,                  'privacidade',         null,                  1),
      ('acessibilidade', 'Acessibilidade do portal',  null,                        'acessibilidade',      null,                  1)
    ) as i(secao, titulo, url, pagina, categoria, ordem)
    where i.secao = s.slug;
  end loop;
end $$;

-- Cadastro completo de um município novo pela SECKE: município + domínio + pacote padrão.
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
  return v_id;
end $$;
