-- =============================================================
-- 0022 · Pacote padrão por tipo de organização (D-90)
-- Até aqui toda organização nascia com o pacote de prefeitura (0007): Lei Orgânica,
-- PPA/LDO/LOA, receitas, despesas, obras, emendas parlamentares... Uma secretaria não
-- publica isso: as contas dela estão nas da prefeitura. Agora o provisionamento lê
-- municipios.tipo_ente (0017):
--   prefeitura (e, por enquanto, câmara, autarquia e outros) → o pacote de sempre;
--   secretaria → pacote próprio: atos da área, editais e seleções, conselhos, planos e
--                relatórios, e um atalho para as contas públicas da prefeitura.
-- Também: criar_municipio recebe o tipo; e as secretarias que já existem trocam o pacote
-- (só o que está vazio sai; nada com documento, link ou página é apagado).
-- =============================================================

-- -------------------------------------------------------------
-- 1. Provisionamento por tipo
-- -------------------------------------------------------------
create or replace function public.provisionar_municipio(p_municipio uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s record;
  v_secao uuid;
  v_tipo  text;
  v_site  text;
begin
  if not public.is_admin(p_municipio) and auth.uid() is not null then
    raise exception 'Somente a SECKE ou o admin do município pode provisioná-lo' using errcode = '42501';
  end if;
  select m.tipo_ente, m.config ->> 'site_prefeitura' into v_tipo, v_site
    from public.municipios m where m.id = p_municipio;
  v_tipo := case when v_tipo = 'secretaria' then 'secretaria' else 'prefeitura' end;

  -- Módulos ligáveis por município, lidos pelo portal e pelo painel. O que já estiver em config prevalece.
  update public.municipios
     set config = jsonb_set(config, '{modulos}',
           '{"estrutura_organizacional": true, "perguntas_frequentes": true, "agenda": true,
             "galeria": true, "destaques": true, "legislacao": true, "carta_servicos": true}'::jsonb
           || coalesce(config -> 'modulos', '{}'::jsonb))
   where id = p_municipio;

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
    ('prefeitura', 'O Município',             'o-municipio',           '<p>História, dados geográficos e símbolos do município.</p>', 1),
    ('secretaria', 'Sobre a Secretaria',      'sobre',                 '<p>Competências, missão, endereço e horário de atendimento da Secretaria.</p>', 1),
    ('todos',      'Acesso à Informação',     'acesso-a-informacao',   '<p>Informações da Lei de Acesso à Informação (Lei 12.527/2011): como pedir informação, prazos e recursos.</p>', 2),
    ('prefeitura', 'e-SIC',                   'e-sic',                 '<p>Serviço de Informação ao Cidadão: endereço, telefone, horário e link para o pedido eletrônico.</p>', 3),
    ('todos',      'Ouvidoria',               'ouvidoria',             '<p>Canal de manifestações (Lei 13.460/2017): elogios, sugestões, reclamações e denúncias.</p>', 4),
    ('todos',      'Privacidade e Proteção de Dados', 'privacidade',   '<p>Política de privacidade e cookies, encarregado de dados (LGPD, Lei 13.709/2018) e como exercer os direitos do titular.</p>', 5),
    ('todos',      'Acessibilidade',          'acessibilidade',        '<p>Recursos de acessibilidade do portal (eMAG/WCAG) e canal para relatar problemas.</p>', 6)
  ) as pg(tipo, titulo, caminho, corpo, ordem)
  where pg.tipo in ('todos', v_tipo)
  on conflict (municipio_id, caminho) do nothing;

  -- Categorias padrão
  insert into public.categorias (municipio_id, escopo, nome, slug, ordem)
  select p_municipio, c.escopo, c.nome, c.slug, c.ordem
  from (values
    ('prefeitura', 'documento', 'Lei Orgânica',                     'lei-organica',          1),
    ('prefeitura', 'documento', 'Leis Complementares',              'leis-complementares',   2),
    ('prefeitura', 'documento', 'Leis Ordinárias',                  'leis-ordinarias',       3),
    ('prefeitura', 'documento', 'Decretos',                         'decretos',              4),
    ('secretaria', 'documento', 'Leis e Decretos da Área',          'leis-e-decretos',       1),
    ('todos',      'documento', 'Portarias',                        'portarias',             5),
    ('todos',      'documento', 'Resoluções',                       'resolucoes',            6),
    ('prefeitura', 'documento', 'Licitações',                       'licitacoes',           10),
    ('prefeitura', 'documento', 'Contratos e Aditivos',             'contratos',            11),
    ('prefeitura', 'documento', 'Atas de Registro de Preços',       'atas-registro-precos', 12),
    ('todos',      'documento', 'Convênios e Parcerias',            'convenios',            13),
    ('todos',      'documento', 'Editais e Chamamentos Públicos',   'chamamentos-publicos', 14),
    ('prefeitura', 'documento', 'Concursos Públicos',               'concursos-publicos',   20),
    ('todos',      'documento', 'Processos Seletivos',              'processos-seletivos',  21),
    ('secretaria', 'documento', 'Conselhos: Atas e Documentos',     'conselhos',            25),
    ('secretaria', 'documento', 'Planos e Programas',               'planos-e-programas',   30),
    ('prefeitura', 'documento', 'Planejamento (PPA, LDO, LOA)',     'planejamento',         30),
    ('todos',      'documento', 'Relatórios e Prestação de Contas', 'prestacao-de-contas',  31),
    ('todos',      'publicacao', 'Geral',                           'geral',                 1),
    ('todos',      'servico',    'Cidadão',                         'cidadao',               1),
    ('prefeitura', 'servico',    'Empresa',                         'empresa',               2),
    ('todos',      'servico',    'Servidor',                        'servidor',              3),
    ('todos',      'evento',     'Geral',                           'geral',                 1),
    ('todos',      'pergunta',   'Geral',                           'geral',                 1)
  ) as c(tipo, escopo, nome, slug, ordem)
  where c.tipo in ('todos', v_tipo)
  on conflict (municipio_id, escopo, slug) do nothing;

  -- Legislação: quais categorias a página /legislacao lista (o que já estiver em config prevalece).
  if v_tipo = 'secretaria' then
    update public.municipios
       set config = jsonb_build_object('legislacao_categorias', '["leis-e-decretos", "portarias", "resolucoes"]'::jsonb) || config
     where id = p_municipio;
  end if;

  -- Central de Transparência. Prefeitura: dimensões do PNTP. Secretaria: o que ela publica
  -- e um atalho para as contas da prefeitura (receitas, despesas, licitações, pessoal...).
  -- Itens padrão só apontam para o que o próprio portal tem (ou o site da prefeitura);
  -- links para sistemas externos (Fiorilli, Betha, IPM...) são cadastrados por organização.
  for s in
    select * from (values
      ('prefeitura', 'institucional',   'Informações Institucionais',        null, 1),
      ('prefeitura', 'receitas',        'Receitas',                          null, 2),
      ('prefeitura', 'despesas',        'Despesas',                          null, 3),
      ('prefeitura', 'convenios',       'Convênios e Transferências',        null, 4),
      ('prefeitura', 'pessoal',         'Recursos Humanos',                  null, 5),
      ('prefeitura', 'diarias',         'Diárias',                           null, 6),
      ('prefeitura', 'licitacoes',      'Licitações',                        null, 7),
      ('prefeitura', 'contratos',       'Contratos',                         null, 8),
      ('prefeitura', 'obras',           'Obras',                             null, 9),
      ('prefeitura', 'planejamento',    'Planejamento e Prestação de Contas',null, 10),
      ('prefeitura', 'sic',             'Serviço de Informação ao Cidadão',  null, 11),
      ('prefeitura', 'ouvidoria',       'Ouvidoria',                         null, 12),
      ('prefeitura', 'lgpd',            'LGPD e Governo Digital',            null, 13),
      ('prefeitura', 'renuncias',       'Renúncias de Receita',              null, 14),
      ('prefeitura', 'emendas',         'Emendas Parlamentares',             null, 15),
      ('prefeitura', 'saude',           'Saúde',                             null, 16),
      ('prefeitura', 'educacao',        'Educação',                          null, 17),
      ('prefeitura', 'acessibilidade',  'Acessibilidade',                    null, 18),
      ('secretaria', 'institucional',   'Informações Institucionais',        null, 1),
      ('secretaria', 'contas-publicas', 'Contas Públicas',
        'Receitas, despesas, licitações, contratos, servidores e orçamento da Secretaria fazem parte das contas da Prefeitura e são publicados por ela.', 2),
      ('secretaria', 'editais',         'Editais, Convênios e Seleções',     null, 3),
      ('secretaria', 'conselhos',       'Conselhos e Controle Social',       null, 4),
      ('secretaria', 'planejamento',    'Planos e Relatórios',               null, 5),
      ('secretaria', 'sic',             'Acesso à Informação',               null, 6),
      ('secretaria', 'ouvidoria',       'Ouvidoria',                         null, 7),
      ('secretaria', 'lgpd',            'Privacidade e Proteção de Dados',   null, 8),
      ('secretaria', 'acessibilidade',  'Acessibilidade',                    null, 9)
    ) as v(tipo, slug, titulo, descricao, ordem)
    where v.tipo = v_tipo
  loop
    insert into public.transparencia_secoes (municipio_id, titulo, slug, descricao, ordem)
    values (p_municipio, s.titulo, s.slug, s.descricao, s.ordem)
    on conflict (municipio_id, slug) do nothing
    returning id into v_secao;

    -- Seção recém-criada: recebe os itens padrão. Seção já existente fica como a organização deixou.
    continue when v_secao is null;
    insert into public.transparencia_itens (secao_id, municipio_id, titulo, url, pagina_id, categoria_id, ordem)
    select v_secao, p_municipio, i.titulo, i.url,
           (select id from public.paginas where municipio_id = p_municipio and caminho = i.pagina),
           (select id from public.categorias where municipio_id = p_municipio and escopo = 'documento' and slug = i.categoria),
           i.ordem
    from (values
      ('prefeitura', 'institucional',  'Estrutura organizacional',  '/estrutura-organizacional', null,                  null,                  1),
      ('prefeitura', 'institucional',  'Perguntas frequentes',      '/perguntas-frequentes',     null,                  null,                  2),
      ('prefeitura', 'institucional',  'Legislação municipal',      '/legislacao',               null,                  null,                  3),
      ('prefeitura', 'licitacoes',     'Licitações',                null,                        null,                  'licitacoes',          1),
      ('prefeitura', 'licitacoes',     'Atas de registro de preços',null,                        null,                  'atas-registro-precos',2),
      ('prefeitura', 'contratos',      'Contratos e aditivos',      null,                        null,                  'contratos',           1),
      ('prefeitura', 'convenios',      'Convênios e parcerias',     null,                        null,                  'convenios',           1),
      ('prefeitura', 'pessoal',        'Concursos públicos',        null,                        null,                  'concursos-publicos',  1),
      ('prefeitura', 'pessoal',        'Processos seletivos',       null,                        null,                  'processos-seletivos', 2),
      ('prefeitura', 'planejamento',   'PPA, LDO e LOA',            null,                        null,                  'planejamento',        1),
      ('prefeitura', 'planejamento',   'Relatórios e prestação de contas', null,                 null,                  'prestacao-de-contas', 2),
      ('prefeitura', 'sic',            'Acesso à informação',       null,                        'acesso-a-informacao', null,                  1),
      ('prefeitura', 'sic',            'e-SIC',                     null,                        'e-sic',               null,                  2),
      ('prefeitura', 'ouvidoria',      'Ouvidoria',                 null,                        'ouvidoria',           null,                  1),
      ('prefeitura', 'lgpd',           'Privacidade e proteção de dados', null,                  'privacidade',         null,                  1),
      ('prefeitura', 'acessibilidade', 'Acessibilidade do portal',  null,                        'acessibilidade',      null,                  1),
      ('secretaria', 'institucional',  'Sobre a Secretaria',        null,                        'sobre',               null,                  1),
      ('secretaria', 'institucional',  'Estrutura organizacional',  '/estrutura-organizacional', null,                  null,                  2),
      ('secretaria', 'institucional',  'Legislação',                '/legislacao',               null,                  null,                  3),
      ('secretaria', 'institucional',  'Perguntas frequentes',      '/perguntas-frequentes',     null,                  null,                  4),
      ('secretaria', 'contas-publicas','Site da Prefeitura',        v_site,                      null,                  null,                  1),
      ('secretaria', 'editais',        'Editais e chamamentos públicos', null,                   null,                  'chamamentos-publicos',1),
      ('secretaria', 'editais',        'Processos seletivos',       null,                        null,                  'processos-seletivos', 2),
      ('secretaria', 'editais',        'Convênios e parcerias',     null,                        null,                  'convenios',           3),
      ('secretaria', 'conselhos',      'Atas e documentos dos conselhos', null,                  null,                  'conselhos',           1),
      ('secretaria', 'planejamento',   'Planos e programas',        null,                        null,                  'planos-e-programas',  1),
      ('secretaria', 'planejamento',   'Relatórios e prestação de contas', null,                 null,                  'prestacao-de-contas', 2),
      ('secretaria', 'sic',            'Como pedir informação',     null,                        'acesso-a-informacao', null,                  1),
      ('secretaria', 'ouvidoria',      'Ouvidoria',                 null,                        'ouvidoria',           null,                  1),
      ('secretaria', 'lgpd',           'Privacidade e proteção de dados', null,                  'privacidade',         null,                  1),
      ('secretaria', 'acessibilidade', 'Acessibilidade do portal',  null,                        'acessibilidade',      null,                  1)
    ) as i(tipo, secao, titulo, url, pagina, categoria, ordem)
    where i.tipo = v_tipo and i.secao = s.slug
      -- Item sem destino (ex.: site da prefeitura ainda não cadastrado) não é criado.
      and num_nonnulls(i.url, i.pagina, i.categoria) = 1;
  end loop;
end $$;

-- -------------------------------------------------------------
-- 2. Criar organização já com o tipo (o pacote depende dele)
-- -------------------------------------------------------------
drop function if exists public.criar_municipio(text, text, char, text);
create or replace function public.criar_municipio(
  p_slug      text,
  p_nome      text,
  p_uf        char(2),
  p_dominio   text default null,
  p_tipo_ente text default 'prefeitura'
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
  insert into public.municipios (slug, nome, uf, tipo_ente)
  values (p_slug, p_nome, upper(p_uf), p_tipo_ente) returning id into v_id;
  if p_dominio is not null then
    insert into public.municipio_dominios (dominio, municipio_id, ambiente, principal)
    values (lower(p_dominio), v_id, 'producao', true);
  end if;
  perform public.provisionar_municipio(v_id);
  perform public.provisionar_papeis(v_id);
  return v_id;
end $$;
revoke all on function public.criar_municipio(text, text, char, text, text) from public;
grant execute on function public.criar_municipio(text, text, char, text, text) to authenticated, service_role;

-- -------------------------------------------------------------
-- 3. Trocar o pacote de uma organização que mudou de tipo (ou que nasceu com o de prefeitura)
-- -------------------------------------------------------------
-- Hoje só converte para secretaria. Só sai o que está vazio: seção sem item com destino
-- real, categoria sem documento e sem uso (transparência, menu, serviço), e a página e-SIC
-- ainda em rascunho e sem uso. Nada com documento, link, sistema ou página publicada é apagado.
create or replace function public.aplicar_pacote_tipo(p_municipio uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  so_prefeitura_secoes text[] := array['receitas', 'despesas', 'convenios', 'pessoal', 'diarias', 'licitacoes',
                                       'contratos', 'obras', 'planejamento', 'renuncias', 'emendas', 'saude', 'educacao'];
  so_prefeitura_cats   text[] := array['lei-organica', 'leis-complementares', 'leis-ordinarias', 'decretos',
                                       'licitacoes', 'contratos', 'atas-registro-precos', 'concursos-publicos',
                                       'planejamento'];
begin
  if auth.uid() is not null and not public.is_plataforma() then
    raise exception 'Somente a SECKE troca o pacote de uma organização' using errcode = '42501';
  end if;
  if (select tipo_ente from public.municipios where id = p_municipio) is distinct from 'secretaria' then
    perform public.provisionar_municipio(p_municipio);
    return;
  end if;

  -- Itens padrão que apontam para categorias de prefeitura sem nenhum documento.
  delete from public.transparencia_itens ti
   using public.categorias c
   where ti.municipio_id = p_municipio and ti.categoria_id = c.id
     and c.slug = any (so_prefeitura_cats)
     and not exists (select 1 from public.documentos d where d.categoria_id = c.id);
  -- Seções de prefeitura sem nenhum item com destino real (link, sistema, página ou categoria com documento).
  -- "Planejamento" sai também quando só sobrou o item de relatórios vazio: o pacote de secretaria o recria.
  delete from public.transparencia_secoes ts
   where ts.municipio_id = p_municipio and ts.slug = any (so_prefeitura_secoes)
     and not exists (select 1 from public.transparencia_itens ti
                      where ti.secao_id = ts.id
                        and (ti.url is not null or ti.sistema_id is not null or ti.pagina_id is not null
                             or exists (select 1 from public.documentos d where d.categoria_id = ti.categoria_id)));
  -- Categorias de prefeitura vazias e sem uso.
  delete from public.categorias c
   where c.municipio_id = p_municipio and c.escopo = 'documento' and c.slug = any (so_prefeitura_cats)
     and not exists (select 1 from public.documentos d where d.categoria_id = c.id)
     and not exists (select 1 from public.transparencia_itens ti where ti.categoria_id = c.id)
     and not exists (select 1 from public.menu_itens mi where mi.categoria_id = c.id);
  delete from public.categorias c
   where c.municipio_id = p_municipio and c.escopo = 'servico' and c.slug = 'empresa'
     and not exists (select 1 from public.servicos s where s.categoria_id = c.id)
     and not exists (select 1 from public.menu_itens mi where mi.categoria_id = c.id);
  -- Página e-SIC (de prefeitura) em rascunho e sem uso: o pedido de informação fica em /acesso-a-informacao.
  delete from public.transparencia_itens ti
   using public.paginas p
   where ti.municipio_id = p_municipio and ti.pagina_id = p.id and p.caminho = 'e-sic' and p.status = 'rascunho';
  delete from public.paginas p
   where p.municipio_id = p_municipio and p.caminho = 'e-sic' and p.status = 'rascunho'
     and not exists (select 1 from public.menu_itens mi where mi.pagina_id = p.id)
     and not exists (select 1 from public.paginas f where f.parent_id = p.id);

  -- Seções comuns (institucional, sic, ouvidoria, lgpd, acessibilidade): ficam, com título e ordem do pacote novo.
  update public.transparencia_secoes set titulo = 'Acesso à Informação', ordem = 6 where municipio_id = p_municipio and slug = 'sic';
  update public.transparencia_secoes set ordem = 7 where municipio_id = p_municipio and slug = 'ouvidoria';
  update public.transparencia_secoes set titulo = 'Privacidade e Proteção de Dados', ordem = 8 where municipio_id = p_municipio and slug = 'lgpd';
  update public.transparencia_secoes set ordem = 9 where municipio_id = p_municipio and slug = 'acessibilidade';
  update public.transparencia_itens ti set titulo = 'Legislação'
    from public.transparencia_secoes ts
   where ti.secao_id = ts.id and ts.municipio_id = p_municipio and ts.slug = 'institucional' and ti.titulo = 'Legislação municipal';
  update public.categorias set nome = 'Editais e Chamamentos Públicos'
   where municipio_id = p_municipio and escopo = 'documento' and slug = 'chamamentos-publicos' and nome = 'Chamamentos Públicos';

  -- O pacote de secretaria completa o resto: seções novas, categorias, página "Sobre", legislação.
  perform public.provisionar_municipio(p_municipio);
  -- A seção institucional já existia (não recebe itens de novo): entra o "Sobre a Secretaria".
  insert into public.transparencia_itens (secao_id, municipio_id, titulo, pagina_id, ordem)
  select ts.id, p_municipio, 'Sobre a Secretaria', p.id, 0
    from public.transparencia_secoes ts
    join public.paginas p on p.municipio_id = p_municipio and p.caminho = 'sobre'
   where ts.municipio_id = p_municipio and ts.slug = 'institucional'
     and not exists (select 1 from public.transparencia_itens ti where ti.secao_id = ts.id and ti.pagina_id = p.id);
end $$;
revoke all on function public.aplicar_pacote_tipo(uuid) from public;
grant execute on function public.aplicar_pacote_tipo(uuid) to authenticated, service_role;

-- Secretarias que já existem trocam o pacote agora.
select public.aplicar_pacote_tipo(id) from public.municipios where tipo_ente = 'secretaria';
