import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite({ extensions: { unaccent, pg_trgm } })

// Simula o que o Supabase já provê: auth, storage, schema extensions e papéis.
await db.exec(`
  create schema extensions; create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
`)

const files = fs.readdirSync(path.join(ROOT, 'migrations')).sort()
for (const f of files) {
  try { await db.exec(fs.readFileSync(path.join(ROOT, 'migrations', f), 'utf8')); console.log('OK', f) }
  catch (e) { console.log('ERRO', f, e.message); process.exit(1) }
}
await db.exec(fs.readFileSync(path.join(ROOT, 'seed.sql'), 'utf8')); console.log('OK seed.sql')

// Só o que o Supabase já concede por conta própria (schemas, auth, storage, extensões).
// As permissões do schema public vêm da migration 0008, como em produção, onde o
// projeto não expõe tabelas novas automaticamente (D-13).
await db.exec(`
  grant usage on schema public, auth, extensions, storage to anon, authenticated;
  grant all on all tables in schema storage to anon, authenticated;
  grant execute on all functions in schema auth, extensions, storage to anon, authenticated;
`)

const J = '00000000-0000-4000-8000-000000000001'
const U = { plat: 'a0000000-0000-4000-8000-000000000001', admin: 'a0000000-0000-4000-8000-000000000002',
            editor: 'a0000000-0000-4000-8000-000000000003', outro: 'a0000000-0000-4000-8000-000000000004' }
await db.exec(`
  insert into auth.users values ${Object.values(U).map(u => `('${u}', '${u}@x')`).join(',')};
  insert into public.equipe_plataforma values ('${U.plat}', 'SECKE');
  insert into public.municipios (id, slug, nome, uf) values ('00000000-0000-4000-8000-000000000002', 'outra', 'Outra', 'SP');
  insert into public.membros (municipio_id, user_id, papel) values
    ('${J}', '${U.admin}', 'admin'), ('${J}', '${U.editor}', 'editor'),
    ('00000000-0000-4000-8000-000000000002', '${U.outro}', 'admin');
`)

let ok = 0, falhas = 0
async function como(quem, sql) {
  await db.exec('reset role')
  if (quem === 'anon') await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false)`)
  else await db.exec(`select set_config('request.jwt.claim.sub', '${U[quem]}', false); set role authenticated`)
  try { return { rows: (await db.query(sql)).rows } } catch (e) { return { erro: e.message } }
  finally { await db.exec('reset role') }
}
function espera(nome, cond) { if (cond) { ok++; console.log('  ✔', nome) } else { falhas++; console.log('  ✘', nome) } }

console.log('\nTestes de permissão')
let r = await como('editor', `insert into publicacoes (municipio_id, titulo, slug, corpo_html) values ('${J}', 'Campanha de Vacinação na Saúde', 'campanha', '<p>Vacina contra gripe</p>') returning id`)
espera('editor cria rascunho', r.rows?.length === 1)
const pubId = r.rows?.[0]?.id
r = await como('editor', `insert into publicacoes (municipio_id, titulo, slug, status, publicado_em) values ('${J}', 'X', 'x', 'publicado', now())`)
espera('editor NÃO publica direto', !!r.erro)
r = await como('editor', `update publicacoes set status = 'publicado', publicado_em = now() where id = '${pubId}'`)
espera('editor NÃO publica via update', !!r.erro)
r = await como('outro', `select count(*)::int n from publicacoes where municipio_id = '${J}'`)
espera('admin de outro município não vê rascunho', r.rows?.[0].n === 0)
r = await como('outro', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Invasão', 'invasao')`)
espera('admin de outro município não escreve em Jeriquara', !!r.erro)
r = await como('anon', `select count(*)::int n from publicacoes`)
espera('anon não vê rascunho', r.rows?.[0].n === 0)
r = await como('admin', `update publicacoes set status = 'publicado', publicado_em = now() - interval '1 minute' where id = '${pubId}' returning id`)
espera('admin publica', r.rows?.length === 1)
r = await como('editor', `update publicacoes set status = 'despublicado' where id = '${pubId}' returning 1`)
espera('editor NÃO despublica conteúdo no ar', !!r.erro || !r.rows?.length)
r = await como('editor', `update publicacoes set titulo = 'alterado' where id = '${pubId}' returning 1`)
espera('editor NÃO altera conteúdo publicado', !!r.erro || !r.rows?.length)
r = await como('anon', `select titulo from buscar('${J}', 'saude vacinacao')`)
espera('anon encontra pela busca sem acento', r.rows?.length === 1)
r = await como('anon', `select count(*)::int n from buscar('00000000-0000-4000-8000-000000000002', 'vacinacao')`)
espera('busca não vaza entre municípios', r.rows?.[0].n === 0)
r = await como('admin', `select acao, user_id from auditoria where registro_id = '${pubId}' order by id`)
espera('auditoria registra INSERT do editor e UPDATE do admin',
  r.rows?.length === 2 && r.rows[0].user_id === U.editor && r.rows[1].user_id === U.admin)
r = await como('editor', `select count(*)::int n from auditoria`)
espera('editor não lê auditoria', r.rows?.[0].n === 0)
r = await como('editor', `insert into membros (municipio_id, user_id, papel) values ('${J}', '${U.outro}', 'admin')`)
espera('editor não concede papéis', !!r.erro)
r = await como('admin', `update membros set papel = 'admin' where user_id = '${U.admin}' returning 1`)
espera('admin não altera o próprio papel', !r.rows?.length)

console.log('\nChamados e saldo')
const contrato = (await db.query(`select id from contratos where municipio_id = '${J}'`)).rows[0].id
r = await como('editor', `insert into chamados (municipio_id, contrato_id, tipo, titulo, descricao) values ('${J}', '${contrato}', 'solicitacao_editorial', 'Publicar edital', 'Segue anexo') returning id, protocolo`)
espera('editor abre chamado com protocolo', r.rows?.[0]?.protocolo != null)
const ch = r.rows?.[0]?.id
r = await como('editor', `insert into chamados (municipio_id, contrato_id, tipo, titulo, descricao, solicitacoes_consumidas) values ('${J}', '${contrato}', 'duvida', 'x', 'x', 5)`)
espera('município não define consumo do saldo', !!r.erro)
r = await como('editor', `update chamados set status = 'concluido' where id = '${ch}' returning 1`)
espera('município não muda status', !r.rows?.length)
r = await como('plat', `update chamados set status = 'concluido', concluido_em = now(), solicitacoes_consumidas = 3 where id = '${ch}' returning 1`)
espera('SECKE conclui e consome 3', r.rows?.length === 1)
r = await como('editor', `select saldo from saldo_solicitacoes`)
espera('saldo visível ao município = 117', r.rows?.[0]?.saldo === 117)
await como('plat', `insert into chamado_mensagens (chamado_id, mensagem, interna) values ('${ch}', 'nota interna', true)`)
r = await como('editor', `select count(*)::int n from chamado_mensagens`)
espera('nota interna invisível ao município', r.rows?.[0].n === 0)

console.log('\nStorage')
r = await como('editor', `insert into storage.objects (bucket_id, name) values ('midias', '${J}/2026/10/edital.pdf') returning 1`)
espera('editor envia arquivo na pasta do seu município', r.rows?.length === 1)
r = await como('editor', `insert into storage.objects (bucket_id, name) values ('midias', '00000000-0000-4000-8000-000000000002/x.pdf')`)
espera('editor NÃO envia na pasta de outro município', !!r.erro)

r = await como('editor', `update storage.objects set owner = null where name = '${J}/2026/10/edital.pdf' returning 1`)
espera('editor NÃO substitui arquivo enviado', !r.rows?.length)
r = await como('admin', `update storage.objects set owner = null where name = '${J}/2026/10/edital.pdf' returning 1`)
espera('admin substitui arquivo', r.rows?.length === 1)

console.log('\nIsolamento entre municípios (FKs compostas)')
const O = '00000000-0000-4000-8000-000000000002'
const menuJ = (await db.query(`select id from menus where municipio_id = '${J}' and local = 'principal'`)).rows[0].id
r = await como('outro', `insert into menu_itens (menu_id, municipio_id, rotulo, url) values ('${menuJ}', '${O}', 'Golpe', 'https://x')`)
espera('admin de outro município NÃO pendura item no menu de Jeriquara', !!r.erro)
await db.exec(`insert into contratos (municipio_id, numero, inicio, fim) values ('${O}', '1/2026', '2026-01-01', '2026-12-31')`)
r = await como('outro', `insert into chamados (municipio_id, contrato_id, tipo, titulo, descricao) values ('${O}', '${contrato}', 'duvida', 'x', 'x')`)
espera('chamado NÃO consome saldo do contrato de outro município', !!r.erro)
const catO = (await db.query(`insert into categorias (municipio_id, escopo, nome, slug) values ('${O}', 'publicacao', 'Cat O', 'cat-o') returning id`)).rows[0].id
r = await como('admin', `insert into publicacao_categorias values ('${pubId}', '${catO}')`)
espera('publicação NÃO usa categoria de outro município', !!r.erro)

console.log('\nConteúdo publicado e integridade')
r = await como('admin', `insert into documentos (municipio_id, titulo, slug, status, publicado_em) values ('${J}', 'Edital 1/2026', 'edital-1-2026', 'publicado', now()) returning id`)
const docPub = r.rows?.[0]?.id
r = await como('editor', `insert into documento_arquivos (documento_id, url_externa, rotulo) values ('${docPub}', 'https://x/anexo.pdf', 'Anexo')`)
espera('editor NÃO anexa arquivo a documento publicado', !!r.erro)
r = await como('admin', `insert into documento_arquivos (documento_id, url_externa, rotulo) values ('${docPub}', 'https://x/anexo.pdf', 'Anexo') returning id`)
espera('admin anexa arquivo a documento publicado', r.rows?.length === 1)
r = await como('editor', `delete from documento_arquivos where documento_id = '${docPub}' returning 1`)
espera('editor NÃO remove arquivo de documento publicado', !r.rows?.length)
r = await como('admin', `select atualizado_por from publicacoes where id = '${pubId}'`)
espera('atualizado_por registra quem editou por último', r.rows?.[0]?.atualizado_por === U.admin)
r = await como('admin', `update municipios set config = config || '{"telefone": "16 0000-0000"}' where id = '${J}' returning 1`)
r = await como('admin', `select count(*)::int n from auditoria where tabela = 'municipios' and municipio_id = '${J}'`)
espera('auditoria de municipios grava o municipio_id', r.rows?.[0].n >= 1)
r = await como('admin', `
  with p as (insert into paginas (municipio_id, titulo, caminho) values ('${J}', 'LAI', 'lai') returning id),
       s as (insert into transparencia_secoes (municipio_id, titulo, slug) values ('${J}', 'Acesso', 'acesso') returning id)
  insert into transparencia_itens (secao_id, municipio_id, titulo, pagina_id) select s.id, '${J}', 'LAI', p.id from p, s returning pagina_id`)
r = await como('admin', `delete from paginas where id = '${r.rows?.[0]?.pagina_id}'`)
espera('página usada na Central de Transparência NÃO é excluída', !!r.erro)

console.log('\nProvisionamento de município (D-10)')
const conta = async (m) => (await db.query(`select
  (select count(*) from categorias where municipio_id = '${m}')::int c,
  (select count(*) from paginas where municipio_id = '${m}')::int p,
  (select count(*) from transparencia_secoes where municipio_id = '${m}')::int s,
  (select count(*) from transparencia_itens where municipio_id = '${m}')::int i`)).rows[0]
const antes = await conta(J)
espera('seed provisiona Jeriquara (categorias, páginas, Central)', antes.c >= 20 && antes.p >= 6 && antes.s >= 18 && antes.i >= 16)
r = await como('anon', `select count(*)::int n from paginas where municipio_id = '${J}' and caminho = 'e-sic'`)
espera('páginas padrão nascem em rascunho (anon não vê)', r.rows?.[0].n === 0)
r = await como('admin', `select provisionar_municipio('${J}')`)
const depois = await conta(J)
espera('provisionar de novo não duplica nada', !r.erro && JSON.stringify(antes) === JSON.stringify(depois))
r = await como('admin', `select criar_municipio('nova', 'Prefeitura de Nova', 'mg', 'nova.mg.gov.br')`)
espera('admin de município NÃO cria município', !!r.erro)
r = await como('plat', `select criar_municipio('nova', 'Prefeitura de Nova', 'mg', 'nova.mg.gov.br') as id`)
const nova = r.rows?.[0]?.id
espera('SECKE cria município pronto (domínio + pacote padrão)', !!nova
  && (await conta(nova)).s >= 18
  && (await db.query(`select municipio_por_dominio('nova.mg.gov.br') m`)).rows[0].m === nova)

console.log('\nMódulos genéricos')
r = await como('editor', `insert into orgaos (municipio_id, nome, slug) values ('${J}', 'Secretaria de Saúde', 'saude')`)
espera('editor NÃO altera estrutura organizacional', !!r.erro)
r = await como('admin', `insert into orgaos (municipio_id, nome, sigla, slug, responsavel_nome) values ('${J}', 'Secretaria Municipal de Saúde', 'SMS', 'saude', 'Maria Souza') returning id`)
const orgSaude = r.rows?.[0]?.id
espera('admin cadastra órgão', !!orgSaude)
r = await como('outro', `insert into servicos (municipio_id, titulo, slug, orgao_id) values ('${O}', 'X', 'x', '${orgSaude}')`)
espera('serviço NÃO aponta para órgão de outro município', !!r.erro)
r = await como('anon', `select tipo from buscar('${J}', 'saude') where tipo = 'orgao'`)
espera('busca encontra órgão', r.rows?.length === 1)

r = await como('editor', `insert into perguntas_frequentes (municipio_id, pergunta, resposta_html) values ('${J}', 'Como emitir o IPTU?', '<p>Pelo SIS-Web.</p>') returning id`)
const faq = r.rows?.[0]?.id
espera('editor cria pergunta frequente em rascunho', !!faq)
r = await como('editor', `update perguntas_frequentes set status = 'publicado', publicado_em = now() where id = '${faq}' returning 1`)
espera('editor NÃO publica pergunta frequente', !!r.erro || !r.rows?.length)
await como('admin', `update perguntas_frequentes set status = 'publicado', publicado_em = now() - interval '1 minute' where id = '${faq}'`)
r = await como('anon', `select tipo from buscar('${J}', 'iptu')`)
espera('busca encontra pergunta publicada', r.rows?.some(x => x.tipo === 'pergunta'))

r = await como('editor', `insert into eventos (municipio_id, titulo, slug, inicio_em, local) values ('${J}', 'Festa do Peão', 'festa-do-peao', now() + interval '10 days', 'Recinto de Exposições') returning id`)
espera('editor cria evento em rascunho', r.rows?.length === 1)
r = await como('anon', `select count(*)::int n from eventos`)
espera('anon não vê evento em rascunho', r.rows?.[0].n === 0)

r = await como('editor', `insert into destaques (municipio_id, tipo, nivel, titulo, status, publicado_em) values ('${J}', 'alerta', 'urgente', 'Alerta de chuva', 'publicado', now())`)
espera('editor NÃO publica alerta na home', !!r.erro)
r = await como('admin', `insert into destaques (municipio_id, tipo, titulo, status, publicado_em) values ('${J}', 'banner', 'Banner sem imagem', 'publicado', now())`)
espera('banner publicado exige imagem', !!r.erro)

const midiaJ = (await db.query(`insert into midias (municipio_id, storage_path, nome_original, mime_type) values ('${J}', '${J}/foto1.jpg', 'foto1.jpg', 'image/jpeg') returning id`)).rows[0].id
const midiaO = (await db.query(`insert into midias (municipio_id, storage_path, nome_original, mime_type) values ('${O}', '${O}/foto.jpg', 'foto.jpg', 'image/jpeg') returning id`)).rows[0].id
r = await como('editor', `insert into publicacao_midias (municipio_id, publicacao_id, midia_id) values ('${J}', '${pubId}', '${midiaJ}')`)
espera('editor NÃO altera galeria de notícia publicada', !!r.erro)
r = await como('admin', `insert into publicacao_midias (municipio_id, publicacao_id, midia_id) values ('${J}', '${pubId}', '${midiaO}')`)
espera('galeria NÃO usa foto de outro município', !!r.erro)
r = await como('admin', `insert into publicacao_midias (municipio_id, publicacao_id, midia_id) values ('${J}', '${pubId}', '${midiaJ}') returning 1`)
espera('admin monta galeria', r.rows?.length === 1)

r = await como('admin', `insert into documentos (municipio_id, titulo, slug, situacao, status, publicado_em) values ('${J}', 'Lei 3/2001', 'lei-3-2001', 'vigente', 'publicado', now()) returning id`)
const leiAntiga = r.rows?.[0]?.id
r = await como('editor', `insert into documentos (municipio_id, titulo, slug, situacao) values ('${J}', 'Lei 10/2026', 'lei-10-2026', 'vigente') returning id`)
const leiNova = r.rows?.[0]?.id
r = await como('editor', `insert into documento_relacoes (municipio_id, documento_id, relacionado_id, tipo) values ('${J}', '${leiNova}', '${leiAntiga}', 'revoga') returning 1`)
espera('editor registra que o rascunho revoga lei vigente', r.rows?.length === 1)
const docO = (await db.query(`insert into documentos (municipio_id, titulo, slug) values ('${O}', 'Lei O', 'lei-o') returning id`)).rows[0].id
r = await como('admin', `insert into documento_relacoes (municipio_id, documento_id, relacionado_id, tipo) values ('${J}', '${leiNova}', '${docO}', 'altera')`)
espera('relação NÃO liga lei de outro município', !!r.erro)

console.log('\nPermissões explícitas (0008, D-13)')
r = await como('anon', `select count(*)::int n from publicacoes`)
espera('anon lê notícia publicada', r.rows?.[0].n === 1)
r = await como('anon', `select municipio_por_dominio('jeriquara.sp.gov.br') m`)
espera('anon resolve município pelo domínio', r.rows?.[0].m === J)
r = await como('anon', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'x', 'anon-x')`)
espera('anon NÃO escreve', /permission denied/.test(r.erro ?? ''))
r = await como('anon', `select count(*) from chamados`)
espera('anon NÃO acessa chamados', /permission denied/.test(r.erro ?? ''))
r = await como('anon', `select provisionar_municipio('${J}')`)
espera('anon NÃO executa provisionamento', /permission denied/.test(r.erro ?? ''))
r = await como('admin', `delete from auditoria`)
espera('ninguém apaga auditoria', /permission denied/.test(r.erro ?? ''))
r = await como('admin', `truncate publicacoes`)
espera('TRUNCATE não existe para usuários', /permission denied/.test(r.erro ?? ''))

console.log('\nCampos do município (0010, D-20)')
r = await como('admin', `update municipios set tema = '{"cor_primaria": "#0b5a3c"}' where id = '${J}' returning 1`)
espera('admin altera o tema', r.rows?.length === 1)
r = await como('admin', `update municipios set ativo = false where id = '${J}'`)
espera('admin NÃO tira o portal do ar (ativo)', !!r.erro)
r = await como('admin', `update municipios set nome = 'Outro nome', slug = 'outro' where id = '${J}'`)
espera('admin NÃO altera nome/slug oficiais', !!r.erro)
r = await como('plat', `update municipios set nome = 'Prefeitura Municipal de Jeriquara' where id = '${J}' returning 1`)
espera('SECKE altera nome oficial', r.rows?.length === 1)

console.log('\nCache do portal (0011, D-30)')
const pendentes = async () => (await db.query(`select municipio_id from interno.cache_pendente order by 1`)).rows.map((x) => x.municipio_id)
await db.exec(`delete from interno.cache_pendente`)
r = await como('editor', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Cache', 'cache-1') returning id`)
espera('gravar conteúdo marca o município para limpar o cache', JSON.stringify(await pendentes()) === JSON.stringify([J]))
await db.exec(`delete from interno.cache_pendente`)
const redir = (await db.query(`insert into redirecionamentos (municipio_id, origem, destino) values ('${J}', '/antiga-cache/', '/nova') returning id`)).rows[0].id
await db.exec(`delete from interno.cache_pendente`)
await como('anon', `select registrar_acesso_redirecionamento('${redir}')`)
espera('contar acesso de redirecionamento NÃO limpa o cache', (await pendentes()).length === 0)
await db.exec(`update redirecionamentos set destino = '/outra' where id = '${redir}'`)
espera('mudar destino de redirecionamento limpa o cache', (await pendentes()).length === 1)
r = await como('admin', `select count(*) from interno.cache_pendente`)
espera('usuário NÃO lê a fila do cache', /permission denied/.test(r.erro ?? ''))
r = await como('anon', `select interno.limpar_cache_portal()`)
espera('anon NÃO dispara a limpeza do cache', /permission denied/.test(r.erro ?? ''))

console.log('\nVerificação de links (0012, RF18, D-31)')
await db.exec(`delete from verificacoes_links`)
r = await como('editor', `insert into verificacoes_links (municipio_id) values ('${J}')`)
espera('editor NÃO pede verificação de links', !!r.erro)
r = await como('anon', `insert into verificacoes_links (municipio_id) values ('${J}')`)
espera('anon NÃO pede verificação de links', !!r.erro)
r = await como('outro', `insert into verificacoes_links (municipio_id) values ('${J}')`)
espera('admin de outro município NÃO pede verificação aqui', !!r.erro)
r = await como('admin', `insert into verificacoes_links (municipio_id) values ('${J}') returning id`)
espera('admin pede verificação do próprio município', r.rows?.length === 1)
r = await como('admin', `insert into verificacoes_links (municipio_id) values ('${J}')`)
espera('só uma verificação em andamento por município', !!r.erro)
r = await como('admin', `select * from verificacao_fila`)
espera('usuário NÃO lê a fila de links', /permission denied/.test(r.erro ?? ''))
r = await como('admin', `select * from verificacao_iniciar()`)
espera('usuário NÃO inicia a verificação (só a Edge Function)', /permission denied/.test(r.erro ?? ''))
await db.exec(`
  insert into interno.configuracao values ('supabase_url', 'https://x.supabase.co'), ('ambiente', 'producao');
  insert into storage.objects (bucket_id, name) values ('midias', '${J}/existe.pdf');
  insert into paginas (municipio_id, titulo, caminho, status, publicado_em, corpo_html) values ('${J}', 'Links', 'teste-links', 'publicado', now(),
    '<a href="/noticias">interno</a> <a href="https://exemplo.org/x">externo</a> <a href="#topo">âncora</a> <a href="mailto:a@b">e-mail</a>
     <a href="https://x.supabase.co/storage/v1/object/public/midias/${J}/existe.pdf">ok</a>
     <a href="https://x.supabase.co/storage/v1/object/public/midias/${J}/sumiu.pdf">sumiu</a>');
  insert into paginas (municipio_id, titulo, caminho, status, corpo_html) values ('${J}', 'Rascunho', 'rascunho-links', 'rascunho', '<a href="https://rascunho.org">r</a>');
`)
const ver = (await db.query(`select * from verificacao_iniciar()`)).rows[0]
const fila = (await db.query(`select url, verificado, status_http from verificacao_fila where verificacao_id = '${ver.verificacao_id}' and origem_tabela = 'paginas' order by url`)).rows
espera('extrai links do publicado (interno vira absoluto; âncora, e-mail e rascunho ficam de fora)',
  JSON.stringify(fila.map((f) => f.url).filter((u) => !u.includes('storage'))) === JSON.stringify(['https://exemplo.org/x', 'https://jeriquara.sp.gov.br/noticias']))
espera('arquivo do Storage conferido no banco (existe = 200, sumiu = 404)',
  fila.find((f) => f.url.endsWith('existe.pdf'))?.status_http === 200 && fila.find((f) => f.url.endsWith('sumiu.pdf'))?.status_http === 404)
const lote = (await db.query(`select url from verificacao_proximos('${ver.verificacao_id}', 500)`)).rows.map((x) => x.url)
espera('próximo lote traz só os não conferidos, sem repetir', lote.length > 0 && !lote.some((u) => u.includes('storage')) && new Set(lote).size === lote.length)
await db.query(`select verificacao_registrar($1, $2)`, [ver.verificacao_id, JSON.stringify(lote.map((u) => ({ url: u, status_http: u.includes('exemplo.org/x') ? 404 : 200 })))])
const n = (await db.query(`select verificacao_concluir('${ver.verificacao_id}') n`)).rows[0].n
const probs = (await db.query(`select url from verificacao_problemas p join verificacoes_links v on v.id = p.verificacao_id where v.id = '${ver.verificacao_id}' and p.origem_tabela = 'paginas' order by url`)).rows.map((x) => x.url)
espera('problemas: link externo 404 e arquivo sumido (com o endereço como está no texto)',
  probs.length === 2 && probs.includes('https://exemplo.org/x') && probs.some((u) => u.endsWith('sumiu.pdf')) && n >= 2)
const n2 = (await db.query(`select verificacao_concluir('${ver.verificacao_id}') n`)).rows[0].n
const totalProbs = Number((await db.query(`select count(*) n from verificacao_problemas where verificacao_id = '${ver.verificacao_id}'`)).rows[0].n)
espera('concluir de novo não duplica os problemas (0014)', n2 === n && totalProbs === n)
r = await como('editor', `select count(*) n from verificacao_problemas`)
espera('editor NÃO vê o relatório de links (é do publicador)', r.rows?.[0]?.n === 0 || !!r.erro)
r = await como('admin', `select count(*) n from verificacao_problemas`)
espera('admin vê o relatório de links', Number(r.rows?.[0]?.n) >= 2)

console.log('\nExportação (0013, RF19, D-32)')
await db.exec(`delete from exportacoes`)
r = await como('editor', `insert into exportacoes (municipio_id) values ('${J}')`)
espera('editor NÃO pede exportação', !!r.erro)
r = await como('outro', `insert into exportacoes (municipio_id) values ('${J}')`)
espera('admin de outro município NÃO pede exportação aqui', !!r.erro)
r = await como('admin', `insert into exportacoes (municipio_id) values ('${J}') returning id`)
espera('admin pede exportação do próprio município', r.rows?.length === 1)
r = await como('admin', `insert into exportacoes (municipio_id) values ('${J}')`)
espera('só uma exportação em andamento por município', !!r.erro)
await db.exec(`insert into storage.objects (bucket_id, name) values ('exportacoes', '${J}/exportacao.zip'), ('exportacoes', '00000000-0000-4000-8000-000000000002/exportacao.zip')`)
r = await como('admin', `select name from storage.objects where bucket_id = 'exportacoes'`)
espera('admin baixa só a exportação do próprio município', r.rows?.length === 1 && r.rows[0].name.startsWith(J))
r = await como('editor', `select name from storage.objects where bucket_id = 'exportacoes'`)
espera('editor NÃO baixa exportação', r.rows?.length === 0)
r = await como('admin', `insert into storage.objects (bucket_id, name) values ('exportacoes', '${J}/falsa.zip')`)
espera('ninguém grava no bucket de exportação pela API', !!r.erro)

console.log(`\n${ok} ok, ${falhas} falhas`)
process.exit(falhas ? 1 : 0)
