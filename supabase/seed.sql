-- Seed: Jeriquara/SP (primeiro município). Sistemas externos vêm do inventário do site atual (02/10/2026).
-- Revisar URLs com a prefeitura na reunião inicial.

insert into public.municipios (id, slug, nome, uf, config) values (
  '00000000-0000-4000-8000-000000000001', 'jeriquara', 'Prefeitura Municipal de Jeriquara', 'SP',
  '{"site_atual": "https://www.jeriquara.sp.gov.br"}'
);

insert into public.municipio_dominios (dominio, municipio_id, ambiente, principal) values
  ('jeriquara.sp.gov.br',     '00000000-0000-4000-8000-000000000001', 'producao', true),
  ('www.jeriquara.sp.gov.br', '00000000-0000-4000-8000-000000000001', 'producao', false);

insert into public.sistemas_externos (municipio_id, nome, fornecedor, categoria, url) values
  ('00000000-0000-4000-8000-000000000001', 'Portal da Transparência', 'Fiorilli', 'transparencia', 'http://sppmjeriquara.dcfiorilli.com.br:8079/transparencia/'),
  ('00000000-0000-4000-8000-000000000001', 'SIS-Web',                 'Fiorilli', 'tributario',    'https://sppmjeriquara.dcfiorilli.com.br:897/sis/'),
  ('00000000-0000-4000-8000-000000000001', 'SCPI 9.0',                'Fiorilli', 'transparencia', 'https://scpijeriquara.dcfiorilli.com.br:879/scpi9/'),
  ('00000000-0000-4000-8000-000000000001', 'FlowDocs',                'FlowDocs', 'protocolo',     'https://jeriquara.flowdocs.com.br:2053/'),
  ('00000000-0000-4000-8000-000000000001', 'NFS-e Nacional',          'Governo Federal', 'nfse',   'https://www.nfse.gov.br/');

insert into public.contratos (municipio_id, numero, processo, inicio, fim, limite_solicitacoes, valor_implantacao, valor_mensal) values
  ('00000000-0000-4000-8000-000000000001', 'A DEFINIR', 'Dispensa Eletrônica 028/2026 · Processo 227/2026',
   '2026-11-01', '2027-10-31', 120, 4000.00, 750.00);

-- Pacote padrão (categorias, menus, páginas obrigatórias em rascunho, Central de Transparência).
select public.provisionar_municipio('00000000-0000-4000-8000-000000000001');
