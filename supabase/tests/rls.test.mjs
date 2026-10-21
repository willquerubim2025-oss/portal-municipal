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

console.log('\nPNTP 2026 (0015, RF11, D-35)')
const nCrit = Number((await db.query(`select count(*) n from pntp_criterios where ciclo = 2026`)).rows[0].n)
const nPref = Number((await db.query(`select count(*) n from pntp_criterios where ciclo = 2026 and matriz in ('COMUM', 'COMUM (EXCETO ESTATAIS)', 'COMUM (EXCETO ESTATAIS INDEPENDENTES)', 'EXECUTIVO', 'EXECUTIVO e CONSÓRCIOS')`)).rows[0].n)
const nEss = Number((await db.query(`select count(*) n from pntp_criterios where ciclo = 2026 and essencial`)).rows[0].n)
espera('matriz 2026 carregada (181 critérios; 96 de prefeitura; essencial coerente com a classificação)', nCrit === 181 && nPref === 96 && nEss === 12)
r = await como('anon', `select count(*) n from pntp_criterios`)
espera('critérios do PNTP são públicos (referência)', Number(r.rows?.[0]?.n) >= 181)
const crit = '2026-COMUM-1.4'
r = await como('admin', `insert into pntp_atendimento (municipio_id, criterio_id, situacao, evidencia_url) values ('${J}', '${crit}', 'atende', 'https://exemplo.gov.br/busca') returning 1`)
espera('admin registra atendimento do PNTP com link de evidência', r.rows?.length === 1)
r = await como('editor', `update pntp_atendimento set situacao = 'nao_atende' where criterio_id = '${crit}' returning 1`)
espera('editor NÃO altera o acompanhamento do PNTP', !r.rows?.length)
r = await como('outro', `select count(*) n from pntp_atendimento where municipio_id = '${J}'`)
espera('outro município NÃO vê o acompanhamento do PNTP', Number(r.rows?.[0]?.n) === 0)
r = await como('admin', `insert into pntp_criterios (id, ciclo, dimensao, descricao) values ('x', 2026, 'x', 'x')`)
espera('admin do município NÃO altera a matriz', !!r.erro)


console.log('\nSegurança (0016)')
const novoU = 'a0000000-0000-4000-8000-000000000005'
await db.exec(`insert into auth.users values ('${novoU}', 'novo@x'); insert into membros (municipio_id, user_id, papel) values ('${J}', '${novoU}', 'editor')`)
r = await como('outro', `insert into perfis (user_id, nome, email) values ('${novoU}', 'Intruso', 'novo@x')`)
espera('admin de outro município NÃO cria perfil de membro de Jeriquara', !!r.erro)
r = await como('admin', `insert into perfis (user_id, nome, email) values ('${novoU}', 'Novo', 'novo@x') returning 1`)
espera('admin cria perfil de membro do próprio município', r.rows?.length === 1)
r = await como('admin', `select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) order by 1`)
espera('nenhuma função SECURITY DEFINER do schema public é chamável por anon ou authenticated', r.rows?.length === 0)
const acessosAntes = Number((await db.query(`select acessos from redirecionamentos where id = '${redir}'`)).rows[0].acessos)
r = await como('anon', `select registrar_acesso_redirecionamento('${redir}')`)
const acessosDepois = Number((await db.query(`select acessos from redirecionamentos where id = '${redir}'`)).rows[0].acessos)
espera('anon ainda conta acesso de redirecionamento', !r.erro && acessosDepois === acessosAntes + 1)
r = await como('anon', `select count(*)::int n from municipios where public.is_membro(id)`)
espera('policies continuam funcionando para o anon (is_membro = falso)', r.rows?.[0]?.n === 0)
r = await como('admin', `select is_admin('${J}') a, is_admin('${O}') b`)
espera('is_admin continua respondendo pelo usuário', r.rows?.[0]?.a === true && r.rows?.[0]?.b === false)
const midiaRasc = (await db.query(`insert into midias (municipio_id, storage_path, nome_original, mime_type) values ('${J}', '${J}/edital-rascunho.pdf', 'edital.pdf', 'application/pdf') returning id`)).rows[0].id
await db.exec(`insert into documento_arquivos (documento_id, midia_id, rotulo) values ('${leiNova}', '${midiaRasc}', 'Edital')`)
r = await como('anon', `select count(*)::int n from midias where id = '${midiaRasc}'`)
espera('anon NÃO vê mídia de documento em rascunho (nem o storage_path)', r.rows?.[0]?.n === 0)
r = await como('anon', `select count(*)::int n from midias where id = '${midiaJ}'`)
espera('anon vê mídia da galeria de notícia publicada', r.rows?.[0]?.n === 1)
r = await como('anon', `select g.midia from publicacoes p, lateral (select json_agg(m.storage_path) midia from publicacao_midias pm join midias m on m.id = pm.midia_id where pm.publicacao_id = p.id) g where p.id = '${pubId}'`)
espera('portal monta a galeria da notícia publicada', JSON.stringify(r.rows?.[0]?.midia) === JSON.stringify([`${J}/foto1.jpg`]))
r = await como('outro', `select count(*)::int n from midias where id = '${midiaRasc}'`)
espera('admin de outro município NÃO vê mídia de rascunho de Jeriquara', r.rows?.[0]?.n === 0)
r = await como('editor', `select count(*)::int n from midias where id = '${midiaRasc}'`)
espera('membro vê todas as mídias do próprio município', r.rows?.[0]?.n === 1)

console.log('\nOrganização contratante (0017)')
r = await como('admin', `update municipios set tipo_ente = 'camara' where id = '${J}'`)
espera('admin NÃO altera o tipo da organização', !!r.erro)
r = await como('admin', `update municipios set cidade = 'Outra' where id = '${J}'`)
espera('admin NÃO altera a cidade da organização', !!r.erro)
r = await como('plat', `select criar_municipio('cidade-educacao', 'Secretaria de Educação de Cidade', 'sp') id`)
const sec = r.rows?.[0]?.id
r = await como('plat', `update municipios set tipo_ente = 'secretaria', cidade = 'Cidade', codigo_ibge = '3500000' where id = '${sec}' returning 1`)
espera('SECKE cadastra secretaria como organização própria', r.rows?.length === 1)
r = await como('admin', `insert into publicacoes (municipio_id, titulo, slug) values ('${sec}', 'Invasão', 'invasao-sec')`)
espera('admin da prefeitura NÃO escreve na secretaria (organizações isoladas)', !!r.erro)
r = await como('plat', `update municipios set codigo_ibge = '123' where id = '${sec}'`)
espera('código IBGE exige 7 dígitos', !!r.erro)

console.log('\nPacote padrão por tipo de organização (0022)')
const secoesDe = async (m) => (await db.query(`select string_agg(slug, ',' order by ordem) s from transparencia_secoes where municipio_id = '${m}'`)).rows[0].s ?? ''
const secoesJAntes = (await secoesDe(J))
const catsDe = async (m) => (await db.query(`select string_agg(slug, ',' order by slug) s from categorias where municipio_id = '${m}' and escopo = 'documento'`)).rows[0].s ?? ''
r = await como('plat', `select criar_municipio('pref-pacote', 'Prefeitura de Pacote', 'sp') id`)
const prefPac = r.rows?.[0]?.id
espera('prefeitura continua com o pacote de prefeitura (18 seções, Lei Orgânica)', (await secoesDe(prefPac)).split(',').length === 18 && (await catsDe(prefPac)).includes('lei-organica'))
r = await como('plat', `select criar_municipio('sec-pacote', 'Secretaria de Pacote', 'sp', null, 'secretaria') id`)
const secPac = r.rows?.[0]?.id
espera('secretaria nova nasce com o pacote de secretaria',
  (await secoesDe(secPac)) === 'institucional,contas-publicas,editais,conselhos,planejamento,sic,ouvidoria,lgpd,acessibilidade')
espera('secretaria nova NÃO tem Lei Orgânica, licitações nem PPA',
  !/lei-organica|licitacoes|planejamento|concursos/.test(await catsDe(secPac)) && (await catsDe(secPac)).includes('leis-e-decretos'))
r = await db.query(`select config->'legislacao_categorias' c from municipios where id = '${secPac}'`)
espera('legislação da secretaria lista os atos da área', JSON.stringify(r.rows[0].c) === '["leis-e-decretos","portarias","resolucoes"]')
r = await db.query(`select count(*)::int n from transparencia_itens ti join transparencia_secoes ts on ts.id = ti.secao_id where ts.municipio_id = '${secPac}' and ts.slug = 'contas-publicas'`)
espera('sem site da prefeitura cadastrado, o atalho de contas públicas não é criado (sem link quebrado)', r.rows[0].n === 0)
// Secretaria criada com o pacote antigo (cidade-educacao, acima): ganha um documento em Licitações e troca o pacote.
await db.exec(`insert into documentos (municipio_id, titulo, slug, categoria_id) select '${sec}', 'Edital 1', 'edital-1', id from categorias where municipio_id = '${sec}' and slug = 'licitacoes'`)
await db.exec(`update municipios set config = config || '{"site_prefeitura": "https://cidade.sp.gov.br"}' where id = '${sec}'`)
r = await como('admin', `select aplicar_pacote_tipo('${sec}')`)
espera('admin de organização NÃO troca o pacote', !!r.erro)
r = await como('plat', `select aplicar_pacote_tipo('${sec}')`)
espera('SECKE troca o pacote de uma secretaria antiga', !r.erro)
const secoesSec = (await secoesDe(sec)).split(',')
espera('seções vazias de prefeitura saem (receitas, obras, emendas, saúde)', !secoesSec.some((x) => ['receitas', 'obras', 'emendas', 'saude', 'diarias'].includes(x)))
espera('seção de prefeitura com documento fica (licitações)', secoesSec.includes('licitacoes') && (await catsDe(sec)).includes('licitacoes'))
espera('seções de secretaria entram', ['contas-publicas', 'editais', 'conselhos', 'planejamento'].every((x) => secoesSec.includes(x)))
espera('categorias vazias de prefeitura saem (Lei Orgânica, PPA)', !/lei-organica|planejamento/.test(await catsDe(sec)))
r = await db.query(`select ti.url from transparencia_itens ti join transparencia_secoes ts on ts.id = ti.secao_id where ts.municipio_id = '${sec}' and ts.slug = 'contas-publicas'`)
espera('atalho de contas públicas aponta para o site da prefeitura', r.rows[0]?.url === 'https://cidade.sp.gov.br')
r = await db.query(`select count(*)::int n from paginas where municipio_id = '${sec}' and caminho in ('sobre', 'e-sic')`)
espera('ganha a página "Sobre a Secretaria" e perde o e-SIC vazio', r.rows[0].n === 1)
r = await como('plat', `select aplicar_pacote_tipo('${sec}')`)
espera('trocar o pacote de novo não duplica nada', !r.erro && (await secoesDe(sec)).split(',').length === secoesSec.length)
espera('outra organização (prefeitura) não muda', (await secoesDe(J)) === secoesJAntes)
await db.exec(`delete from municipios where id in ('${prefPac}', '${secPac}')`)


console.log('\nPermissões configuráveis (0018)')
const UP = { dir: 'a0000000-0000-4000-8000-000000000011', viz: 'a0000000-0000-4000-8000-000000000012',
             adm: 'a0000000-0000-4000-8000-000000000013', vinc: 'a0000000-0000-4000-8000-000000000014',
             reg: 'a0000000-0000-4000-8000-000000000015' }
Object.assign(U, UP)
await db.exec(`insert into auth.users values ${Object.values(UP).map(u => `('${u}', '${u}@x')`).join(',')}`)
// No teste as organizações vêm do seed (depois das migrações); em produção a 0018 já as provisiona.
await db.exec(`select provisionar_papeis(id) from municipios`)
const papel = async (m, slug) => (await db.query(`select id from papeis where municipio_id = '${m}' and slug = '${slug}'`)).rows[0]?.id
espera('organizações existentes recebem os papéis padrão', !!(await papel(J, 'administrador')) && !!(await papel(J, 'diretor')))
r = await db.query(`select count(*)::int n from papel_permissoes pp join papeis p on p.id = pp.papel_id where p.municipio_id = '${J}' and p.slug = 'administrador' and pp.ativo`)
espera('Administrador nasce com todo o catálogo ligado', r.rows[0].n === Number((await db.query(`select count(*) n from permissoes where ativa`)).rows[0].n))
r = await como('plat', `select criar_municipio('org-nova-papeis', 'Org Nova', 'sp') id`)
espera('organização criada já nasce com papéis', !!(await papel(r.rows?.[0]?.id, 'administrador')))

// Unidades e região de Jeriquara
await db.exec(`
  insert into regioes (id, municipio_id, nome, slug) values ('c0000000-0000-4000-8000-000000000001', '${J}', 'Norte', 'norte');
  insert into unidades (id, municipio_id, nome, slug, bairro, regiao_id) values
    ('b0000000-0000-4000-8000-000000000001', '${J}', 'EMEF João Aranha', 'emef-joao-aranha', 'Jardim Bela Vista', 'c0000000-0000-4000-8000-000000000001'),
    ('b0000000-0000-4000-8000-000000000002', '${J}', 'EMEI Vizinha', 'emei-vizinha', 'Centro', null);
  insert into unidades (id, municipio_id, nome, slug) values ('b0000000-0000-4000-8000-000000000009', '${O}', 'Escola de Outra', 'escola-outra');
`)
const E1 = 'b0000000-0000-4000-8000-000000000001', E2 = 'b0000000-0000-4000-8000-000000000002', EO = 'b0000000-0000-4000-8000-000000000009'
r = await como('admin', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${U.adm}', '${await papel(J, 'administrador')}')`)
espera('admin antigo (membros) NÃO usa os módulos novos sem papel novo', !!r.erro)
r = await como('plat', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${U.adm}', '${await papel(J, 'administrador')}') returning 1`)
espera('SECKE atribui o primeiro Administrador', r.rows?.length === 1)
r = await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id, unidade_id) values ('${J}', '${U.dir}', '${await papel(J, 'diretor')}', '${E1}') returning 1`)
espera('Administrador vincula diretor à escola', r.rows?.length === 1)
r = await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${U.adm}', '${await papel(J, 'diretor')}')`)
espera('ninguém se dá papel sozinho', !!r.erro)
r = await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id, unidade_id) values ('${J}', '${U.dir}', '${await papel(J, 'diretor')}', '${EO}')`)
espera('vínculo NÃO aponta unidade de outra organização', !!r.erro)
r = await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${O}', '${U.dir}', '${await papel(O, 'administrador')}')`)
espera('Administrador de uma organização NÃO vincula na outra', !!r.erro)

r = await como('dir', `update unidades set telefone = '16 1111-1111' where id = '${E1}' returning 1`)
espera('diretor edita a própria escola', r.rows?.length === 1)
r = await como('dir', `update unidades set telefone = '16 2222-2222' where id = '${E2}' returning 1`)
espera('diretor NÃO edita a escola vizinha', !r.rows?.length)
r = await como('dir', `update unidades set ativo = false where id = '${E1}'`)
espera('diretor NÃO desativa a própria escola (campo da rede)', !!r.erro)
r = await como('dir', `insert into unidades (municipio_id, nome, slug) values ('${J}', 'Nova', 'nova')`)
espera('diretor NÃO cria unidade', !!r.erro)
r = await como('adm', `update unidades set ativo = false where id = '${E2}' returning 1`)
espera('Administrador gerencia unidades', r.rows?.length === 1)
await como('adm', `update unidades set ativo = true where id = '${E2}'`)

// Escopo região
const papelReg = (await como('adm', `insert into papeis (municipio_id, slug, nome) values ('${J}', 'coordenador-regional', 'Coordenador regional') returning id`)).rows?.[0]?.id
espera('papel novo criado pelo painel', !!papelReg)
r = await como('adm', `insert into papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo) values ('${J}', '${papelReg}', 'unidades.editar', true, 'regiao') returning 1`)
espera('Administrador liga permissão com escopo região', r.rows?.length === 1)
r = await como('adm', `insert into papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo) values ('${J}', '${papelReg}', 'equipe.gerenciar', true, 'unidade')`)
espera('escopo que não se aplica à permissão é recusado', !!r.erro)
await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id, regiao_id) values ('${J}', '${U.reg}', '${papelReg}', 'c0000000-0000-4000-8000-000000000001')`)
r = await como('reg', `update unidades set email = 'a@x' where id = '${E1}' returning 1`)
espera('escopo região edita escola da região', r.rows?.length === 1)
r = await como('reg', `update unidades set email = 'a@x' where id = '${E2}' returning 1`)
espera('escopo região NÃO edita escola fora da região', !r.rows?.length)
r = await como('adm', `update papel_permissoes set ativo = false where papel_id = '${papelReg}' and permissao_codigo = 'unidades.editar' returning 1`)
r = await como('reg', `update unidades set email = 'b@x' where id = '${E1}' returning 1`)
espera('permissão desligada bloqueia no banco', !r.rows?.length)

// Salvaguardas
r = await como('adm', `update papel_permissoes set ativo = false where papel_id = '${await papel(J, 'administrador')}' and permissao_codigo = 'permissoes.gerenciar' returning 1`)
espera('Administrador NÃO perde permissoes.gerenciar', !!r.erro)
r = await como('adm', `delete from papeis where id = '${await papel(J, 'administrador')}'`)
espera('papel Administrador NÃO é excluído', !!r.erro)
r = await como('adm', `update papeis set protegido = true where id = '${papelReg}'`)
espera('ninguém marca papel como protegido pelo painel', !!r.erro)
await db.exec(`insert into usuario_papeis (municipio_id, user_id, papel_id) select '${J}', '${U.vinc}', id from papeis where municipio_id = '${J}' and slug = 'professor'`)
const papelVinc = (await como('adm', `insert into papeis (municipio_id, slug, nome) values ('${J}', 'secretario-escolar', 'Secretário') returning id`)).rows[0].id
await como('adm', `insert into papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo) values ('${J}', '${papelVinc}', 'usuarios.vincular', true)`)
await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${U.vinc}', '${papelVinc}')`)
r = await como('vinc', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${U.viz}', '${await papel(J, 'administrador')}')`)
espera('quem só vincula NÃO dá o papel Administrador', !!r.erro)
r = await como('vinc', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${U.viz}', '${await papel(J, 'professor')}') returning 1`)
espera('quem vincula dá papel comum', r.rows?.length === 1)
r = await como('adm', `select tabela, acao, user_id from log_permissoes where municipio_id = '${J}' and papel_id = '${papelReg}' order by id`)
espera('histórico registra quem ligou e desligou', r.rows?.length >= 3 && r.rows.every(x => x.user_id === U.adm))
r = await como('dir', `select count(*)::int n from log_permissoes`)
espera('diretor NÃO lê o histórico de permissões', r.rows?.[0]?.n === 0)
r = await como('outro', `select count(*)::int n from papeis where municipio_id = '${J}'`)
espera('admin de outra organização NÃO vê os papéis de Jeriquara', r.rows?.[0]?.n === 0)
r = await como('dir', `select permissao, escopo, unidade_id from minhas_permissoes('${J}')`)
espera('painel sabe o que o diretor pode (e onde)', r.rows?.length === 1 && r.rows[0].permissao === 'unidades.editar' && r.rows[0].unidade_id === E1)
r = await como('anon', `select count(*)::int n from permissoes`)
espera('anon NÃO lê o catálogo de permissões', !!r.erro || r.rows?.[0]?.n === 0)

// Catálogo vindo do código
await db.query(`select sincronizar_permissoes($1)`, [JSON.stringify([
  ...(await db.query(`select codigo, modulo, nome, escopos from permissoes where ativa`)).rows,
  { codigo: 'noticias.publicar', modulo: 'Notícias', nome: 'Publicar notícias', escopos: ['rede', 'unidade'] }])])
r = await db.query(`select count(*)::int n from papel_permissoes where permissao_codigo = 'noticias.publicar' and ativo`)
espera('permissão nova do código nasce desligada para todos', r.rows[0].n === 0)
r = await como('adm', `select sincronizar_permissoes('[]')`)
espera('só o servidor sincroniza o catálogo', /permission denied/.test(r.erro ?? ''))

console.log('\nEquipe gestora e unidades (0019)')
r = await como('adm', `insert into equipe (municipio_id, nome, cargo, nivel, visivel, dados_confirmados, email) values ('${J}', 'Ana Supervisora', 'Supervisora de Ensino', 2, true, true, 'ana@x') returning id`)
const sup = r.rows?.[0]?.id
espera('Administrador cadastra membro da equipe', !!sup)
await como('adm', `update unidades set supervisor_id = '${sup}' where id = '${E1}'`)
r = await como('dir', `update unidades set supervisor_id = null where id = '${E1}'`)
espera('diretor NÃO troca o supervisor da escola', !!r.erro)
const fotoEq = (await db.query(`insert into midias (municipio_id, storage_path, nome_original, mime_type) values ('${J}', '${J}/ana.jpg', 'ana.jpg', 'image/jpeg') returning id`)).rows[0].id
r = await como('adm', `update equipe set foto_id = '${fotoEq}' where id = '${sup}'`)
espera('foto sem autorização de imagem é recusada', !!r.erro)
r = await como('adm', `update equipe set foto_id = '${fotoEq}', autorizacao_imagem = true where id = '${sup}' returning 1`)
espera('foto com autorização é aceita', r.rows?.length === 1)
r = await como('anon', `select count(*)::int n from midias where id = '${fotoEq}'`)
espera('foto autorizada de membro visível é pública', r.rows?.[0]?.n === 1)
r = await como('adm', `insert into equipe (municipio_id, nome, cargo, nivel) values ('${J}', 'Oculto', 'Diretor de Divisão', 3) returning id`)
r = await como('anon', `select nome from equipe where municipio_id = '${J}'`)
espera('anon vê só membros visíveis', r.rows?.length === 1 && r.rows[0].nome === 'Ana Supervisora')
r = await como('anon', `select nome, supervisor_nome, supervisor_email from buscar_unidade('${J}', 'bela vista')`)
espera('busca por bairro sem acento acha a escola e o supervisor', r.rows?.length === 1 && r.rows[0].supervisor_nome === 'Ana Supervisora')
r = await como('anon', `select count(*)::int n from buscar_unidade('${O}', 'joao')`)
espera('busca de unidade não vaza entre organizações', r.rows?.[0]?.n === 0)
await como('plat', `update municipios set config = config || '{"modulos": {"equipe_gestora": false}}' where id = '${J}'`)
r = await como('anon', `select count(*)::int n from equipe where municipio_id = '${J}'`)
espera('seção desligada esconde a equipe inteira', r.rows?.[0]?.n === 0)
r = await como('anon', `select supervisor_nome from buscar_unidade('${J}', 'aranha')`)
espera('com a seção desligada, a busca traz a escola sem o supervisor', r.rows?.length === 1 && r.rows[0].supervisor_nome === null)
r = await como('dir', `insert into equipe (municipio_id, nome, cargo, nivel) values ('${J}', 'X', 'Y', 1)`)
espera('diretor NÃO mexe na equipe gestora', !!r.erro)
r = await como('outro', `insert into equipe (municipio_id, nome, cargo, nivel) values ('${J}', 'X', 'Y', 1)`)
espera('outra organização NÃO mexe na equipe', !!r.erro)

console.log('\nPágina inicial (0020)')
r = await como('admin', `insert into destaques (municipio_id, tipo, nivel, titulo, status, publicado_em, fim_em) values ('${J}', 'alerta', 'urgente', 'Matrículas até sexta', 'publicado', now() - interval '2 days', now() - interval '1 day') returning id, versao, frequencia`)
const av = r.rows?.[0]
espera('aviso nasce na versão 1, uma vez por visitante', av?.versao === 1 && av?.frequencia === 'uma_vez')
r = await como('admin', `update destaques set titulo = 'Matrículas até segunda' where id = '${av.id}' returning versao`)
espera('editar o aviso sobe a versão (volta a aparecer)', r.rows?.[0]?.versao === 2)
r = await como('admin', `insert into destaques (municipio_id, tipo, titulo, publicacao_id) values ('${O}', 'alerta', 'x', '${pubId}')`)
espera('destaque NÃO liga notícia de outra organização', !!r.erro)
r = await como('admin', `update publicacoes set prioridade = 'manchete' where id = '${pubId}'`)
espera('prioridade só aceita principal/secundária', !!r.erro)
r = await como('admin', `insert into servicos (municipio_id, titulo, slug, na_home, em_breve, ordem, icone) values ('${J}', 'Área do Estudante', 'area-do-estudante', true, true, 2, 'graduation-cap') returning 1`)
espera('card de serviço "em breve" cadastrado', r.rows?.length === 1)

console.log('\nPermissões de conteúdo (0021, fase 1B)')
const UC = { red: 'a0000000-0000-4000-8000-000000000021' }
Object.assign(U, UC)
await db.exec(`insert into auth.users values ('${UC.red}', 'red@x');
  insert into perfis (user_id, nome, email) values ('${U.dir}', 'Diretora', 'dir@x'), ('${UC.red}', 'Redator', 'red@x')
  on conflict (user_id) do nothing`)
// Papel "Redator" só com conteudo.editar; U.red vinculado a ele.
const papelRed = (await como('adm', `insert into papeis (municipio_id, slug, nome) values ('${J}', 'redator', 'Redator') returning id`)).rows?.[0]?.id
await como('adm', `insert into papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo) values ('${J}', '${papelRed}', 'conteudo.editar', true, 'rede')`)
await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id) values ('${J}', '${UC.red}', '${papelRed}')`)
r = await db.query(`select count(*)::int n from permissoes where codigo in ('conteudo.editar', 'conteudo.publicar', 'organizacao.administrar') and ativa`)
espera('catálogo tem as 3 permissões de conteúdo', r.rows[0].n === 3)
r = await db.query(`select count(*)::int n from papel_permissoes pp join papeis p on p.id = pp.papel_id
  where p.protegido and pp.ativo and pp.permissao_codigo in ('conteudo.editar', 'conteudo.publicar', 'organizacao.administrar')`)
espera('Administrador de cada organização tem as 3 ligadas', r.rows[0].n === 3 * Number((await db.query(`select count(*) n from papeis where protegido`)).rows[0].n))
r = await como('adm', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Matrícula 2027', 'matricula-2027') returning id`)
espera('Administrador configurável cria notícia', r.rows?.length === 1)
const pubAdm = r.rows?.[0]?.id
r = await como('adm', `update publicacoes set status = 'publicado', publicado_em = now() - interval '1 minute' where id = '${pubAdm}' returning 1`)
espera('Administrador configurável publica', r.rows?.length === 1)
r = await como('dir', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Festa junina', 'festa-junina')`)
espera('Diretor sem permissão de conteúdo NÃO cria notícia', !!r.erro)
r = await como('red', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Rascunho do redator', 'rascunho-redator') returning id`)
espera('Redator (conteudo.editar) cria rascunho', r.rows?.length === 1)
const pubRed = r.rows?.[0]?.id
r = await como('red', `update publicacoes set status = 'publicado', publicado_em = now() where id = '${pubRed}'`)
espera('Redator NÃO publica', !!r.erro)
r = await como('red', `insert into publicacoes (municipio_id, titulo, slug, status, publicado_em) values ('${J}', 'Direto', 'direto', 'publicado', now())`)
espera('Redator NÃO publica direto no insert', !!r.erro)
r = await como('red', `update publicacoes set titulo = 'mudou' where id = '${pubAdm}' returning 1`)
espera('Redator NÃO altera conteúdo publicado', !!r.erro || !r.rows?.length)
r = await como('red', `select count(*)::int n from auditoria`)
espera('Redator NÃO lê auditoria (não administra)', r.rows?.[0].n === 0)
r = await como('adm', `select count(*)::int n from auditoria where municipio_id = '${J}'`)
espera('Administrador configurável lê auditoria', r.rows?.[0].n > 0)
r = await como('adm', `update municipios set config = config || '{"slogan": "teste 1B"}' where id = '${J}' returning 1`)
espera('Administrador configurável edita a configuração da organização', r.rows?.length === 1)
r = await como('adm', `insert into publicacoes (municipio_id, titulo, slug) values ('${O}', 'Invasão', 'invasao-1b')`)
espera('Administrador configurável NÃO escreve em outra organização', !!r.erro)
r = await como('adm', `select count(*)::int n from perfis where user_id in ('${U.dir}', '${UC.red}')`)
espera('Administrador vê o perfil dos colegas com papel configurável', r.rows?.[0].n === 2)
r = await como('red', `select count(*)::int n from perfis where user_id = '${U.dir}'`)
espera('quem trabalha com conteúdo também vê os colegas', r.rows?.[0].n === 1)
r = await como('outro', `select count(*)::int n from perfis where user_id in ('${U.dir}', '${UC.red}')`)
espera('admin de outra organização NÃO vê esses perfis', r.rows?.[0].n === 0)
r = await como('dir', `select count(*)::int n from publicacoes where id = '${pubRed}'`)
espera('Diretor sem conteúdo NÃO vê rascunhos', r.rows?.[0].n === 0)
await como('adm', `update papel_permissoes set ativo = false where papel_id = '${papelRed}' and permissao_codigo = 'conteudo.editar'`)
r = await como('red', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Depois de desligar', 'depois-desligar')`)
espera('desligar a permissão no painel vale na hora', !!r.erro)
r = await como('editor', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Editor antigo segue', 'editor-antigo-segue') returning 1`)
espera('editor antigo (membros) continua criando', r.rows?.length === 1)

console.log('\nPré-visualização de rascunho (0023)')
r = await como('editor', `insert into publicacoes (municipio_id, titulo, slug, corpo_html) values ('${J}', 'Rascunho para prévia', 'rascunho-previa', '<p>ainda não saiu</p>') returning id`)
const rascPrev = r.rows?.[0]?.id
r = await como('editor', `select criar_previa('publicacoes', '${rascPrev}') t`)
const tokPrev = r.rows?.[0]?.t
espera('editor gera o link de pré-visualização do rascunho', !!tokPrev)
r = await como('anon', `select previa_publicacao('${tokPrev}', '${J}') p`)
espera('o portal (anon) lê o rascunho pelo token', r.rows?.[0]?.p?.titulo === 'Rascunho para prévia' && r.rows?.[0]?.p?.status === 'rascunho')
r = await como('anon', `select count(*)::int n from publicacoes where id = '${rascPrev}'`)
espera('sem o token, o rascunho continua invisível', r.rows?.[0]?.n === 0)
r = await como('anon', `select previa_publicacao('${tokPrev}', '${O}') p`)
espera('token NÃO abre o rascunho no domínio de outra organização', r.rows?.[0]?.p === null)
r = await como('anon', `select previa_publicacao(gen_random_uuid(), '${J}') p`)
espera('token inventado não abre nada', r.rows?.[0]?.p === null)
r = await como('outro', `select criar_previa('publicacoes', '${rascPrev}') t`)
espera('admin de outra organização NÃO gera link do rascunho', !!r.erro)
r = await como('anon', `select criar_previa('publicacoes', '${rascPrev}') t`)
espera('visitante NÃO gera link', !!r.erro)
r = await como('anon', `select count(*)::int n from previas`)
espera('a tabela de tokens não é legível', !!r.erro)
r = await como('editor', `select count(*)::int n from previas`)
espera('nem por quem edita', !!r.erro)
await db.exec(`update previas set expira_em = now() - interval '1 minute' where token = '${tokPrev}'`)
r = await como('anon', `select previa_publicacao('${tokPrev}', '${J}') p`)
espera('link vencido (30 min) não abre mais', r.rows?.[0]?.p === null)

console.log('\nPré-visualização de páginas, serviços e eventos (0024)')
r = await como('admin', `insert into paginas (municipio_id, titulo, caminho, corpo_html) values ('${J}', 'Página em rascunho', 'pagina-rascunho', '<p>x</p>') returning id`)
const pagPrev = r.rows?.[0]?.id
r = await como('admin', `insert into servicos (municipio_id, titulo, slug, descricao) values ('${J}', 'Serviço em rascunho', 'servico-rascunho', 'd') returning id`)
const servPrev = r.rows?.[0]?.id
r = await como('admin', `insert into eventos (municipio_id, titulo, slug, inicio_em) values ('${J}', 'Evento em rascunho', 'evento-rascunho', now() + interval '3 days') returning id`)
const evPrev = r.rows?.[0]?.id
for (const [tabela, id, titulo] of [['paginas', pagPrev, 'Página em rascunho'], ['servicos', servPrev, 'Serviço em rascunho'], ['eventos', evPrev, 'Evento em rascunho'], ['publicacoes', rascPrev, 'Rascunho para prévia']]) {
  r = await como('editor', `select criar_previa('${tabela}', '${id}') t`)
  const t = r.rows?.[0]?.t
  r = await como('anon', `select previa_conteudo('${t}', '${J}') c`)
  espera(`prévia de ${tabela}: o portal lê o rascunho pelo token`, r.rows?.[0]?.c?.tabela === tabela && r.rows?.[0]?.c?.dados?.titulo === titulo)
  r = await como('anon', `select previa_conteudo('${t}', '${O}') c`)
  espera(`prévia de ${tabela}: NÃO abre no domínio de outra organização`, r.rows?.[0]?.c === null)
}
r = await como('outro', `select criar_previa('eventos', '${evPrev}') t`)
espera('admin de outra organização NÃO gera link de evento', !!r.erro)
r = await como('editor', `select criar_previa('documentos', '${evPrev}') t`)
espera('tabela fora da lista NÃO gera link', !!r.erro)

console.log('\nSistemas dos servidores (0025)')
const papelDir = await papel(J, 'diretor')
r = await como('admin', `insert into sistemas_externos (municipio_id, nome, url, publico) values
  ('${J}', 'Sistema de todos os servidores', 'https://todos.exemplo', 'servidor'),
  ('${J}', 'Sistema só de diretores', 'https://diretores.exemplo', 'servidor'),
  ('${J}', 'Portal público', 'https://publico.exemplo', 'cidadao') returning id, nome`)
const sisDir = r.rows?.find((x) => x.nome === 'Sistema só de diretores')?.id
r = await como('admin', `insert into sistema_papeis (municipio_id, sistema_id, papel_id) values ('${J}', '${sisDir}', '${papelDir}') returning 1`)
espera('admin restringe um sistema a um papel', r.rows?.length === 1)
r = await como('outro', `insert into sistema_papeis (municipio_id, sistema_id, papel_id) values ('${J}', '${sisDir}', '${papelDir}')`)
espera('admin de outra organização NÃO mexe nos sistemas', !!r.erro)
const meus = async (quem) => ((await como(quem, `select nome from meus_sistemas('${J}') order by nome`)).rows ?? []).map((x) => x.nome)
espera('Diretor vê o sistema de todos e o dos diretores', JSON.stringify(await meus('dir')) === JSON.stringify(['Sistema de todos os servidores', 'Sistema só de diretores']))
espera('Redator vê só o sistema de todos', JSON.stringify(await meus('red')) === JSON.stringify(['Sistema de todos os servidores']))
espera('admin antigo vê todos os sistemas de servidor', (await meus('admin')).length === 2)
espera('link público não entra em "Meus sistemas"', !(await meus('admin')).includes('Portal público'))
espera('quem é de outra organização não vê nenhum', (await meus('outro')).length === 0)
r = await como('anon', `select string_agg(nome, ',') n from sistemas_externos where municipio_id = '${J}'`)
espera('visitante do portal NÃO vê os sistemas de servidor', !(r.rows?.[0]?.n ?? '').includes('Sistema') && (r.rows?.[0]?.n ?? '').includes('Portal público'))
r = await como('anon', `select count(*)::int n from meus_sistemas('${J}')`)
espera('visitante NÃO chama meus_sistemas', !!r.erro)

console.log('\nNotícias das unidades (0026, fase 1C)')
const UN = { esc: 'a0000000-0000-4000-8000-000000000031', escred: 'a0000000-0000-4000-8000-000000000032', escreg: 'a0000000-0000-4000-8000-000000000033' }
Object.assign(U, UN)
await db.exec(`insert into auth.users values ${Object.values(UN).map(u => `('${u}', '${u}@x')`).join(',')}`)
r = await db.query(`select escopos from permissoes where codigo = 'conteudo.publicar'`)
espera('conteudo.publicar aceita escopo de unidade e região', ['unidade', 'regiao'].every((e) => r.rows[0].escopos.includes(e)))
// Papel "Comunicação da escola": publica só na unidade; "Redator da escola": só edita na unidade.
const papelCom = (await como('adm', `insert into papeis (municipio_id, slug, nome) values ('${J}', 'comunicacao-escola', 'Comunicação da escola') returning id`)).rows?.[0]?.id
const papelRedEsc = (await como('adm', `insert into papeis (municipio_id, slug, nome) values ('${J}', 'redator-escola', 'Redator da escola') returning id`)).rows?.[0]?.id
r = await como('adm', `insert into papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo) values
  ('${J}', '${papelCom}', 'conteudo.publicar', true, 'unidade'), ('${J}', '${papelRedEsc}', 'conteudo.editar', true, 'unidade') returning 1`)
espera('Administrador liga conteúdo com escopo de unidade', r.rows?.length === 2)
await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id, unidade_id) values
  ('${J}', '${UN.esc}', '${papelCom}', '${E1}'), ('${J}', '${UN.escred}', '${papelRedEsc}', '${E1}')`)
// Na região Norte (onde fica a E1), com publicar.
const papelRegCom = (await como('adm', `insert into papeis (municipio_id, slug, nome) values ('${J}', 'comunicacao-regiao', 'Comunicação da região') returning id`)).rows?.[0]?.id
await como('adm', `insert into papel_permissoes (municipio_id, papel_id, permissao_codigo, ativo, escopo) values ('${J}', '${papelRegCom}', 'conteudo.publicar', true, 'regiao')`)
await como('adm', `insert into usuario_papeis (municipio_id, user_id, papel_id, regiao_id) values ('${J}', '${UN.escreg}', '${papelRegCom}', 'c0000000-0000-4000-8000-000000000001')`)

r = await como('esc', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Feira de ciências da E1', 'feira-e1', '${E1}') returning id`)
espera('escola cria notícia da própria unidade', r.rows?.length === 1)
const pubE1 = r.rows?.[0]?.id
r = await como('esc', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Notícia da vizinha', 'noticia-vizinha', '${E2}')`)
espera('escola NÃO cria notícia de outra unidade', !!r.erro)
r = await como('esc', `insert into publicacoes (municipio_id, titulo, slug) values ('${J}', 'Notícia da rede', 'noticia-rede-esc')`)
espera('escola NÃO cria notícia da organização (sem unidade)', !!r.erro)
r = await como('esc', `update publicacoes set status = 'publicado', publicado_em = now() - interval '1 minute' where id = '${pubE1}' returning 1`)
espera('escola com "publicar" na unidade publica a notícia dela', r.rows?.length === 1)
r = await como('esc', `update publicacoes set unidade_id = '${E2}' where id = '${pubE1}' returning 1`)
espera('escola NÃO passa a notícia para outra unidade', !!r.erro || !r.rows?.length)
r = await como('esc', `update publicacoes set unidade_id = null where id = '${pubE1}' returning 1`)
espera('escola NÃO tira a unidade da notícia', !!r.erro || !r.rows?.length)
r = await como('esc', `select count(*)::int n from publicacoes where status <> 'publicado'`)
espera('escola NÃO vê rascunhos da rede nem de outras unidades', r.rows?.[0]?.n === 0)
r = await como('esc', `update publicacoes set titulo = 'invadiu' where id = '${pubRed}' returning 1`)
espera('escola NÃO altera notícia da rede', !!r.erro || !r.rows?.length)
r = await como('esc', `insert into paginas (municipio_id, titulo, caminho) values ('${J}', 'Página da escola', 'pagina-escola')`)
espera('escola NÃO cria páginas (só notícias)', !!r.erro)
r = await como('esc', `insert into midias (municipio_id, storage_path, nome_original, mime_type, tamanho_bytes, texto_alternativo) values ('${J}', '${J}/2026/10/foto-e1.jpg', 'foto-e1.jpg', 'image/jpeg', 10, 'Alunos na feira') returning id`)
espera('escola envia imagem para a notícia', r.rows?.length === 1)
const midE1 = r.rows?.[0]?.id
r = await como('esc', `insert into storage.objects (bucket_id, name) values ('midias', '${J}/2026/10/foto-e1.jpg') returning 1`)
espera('escola envia o arquivo ao Storage da organização', r.rows?.length === 1)
r = await como('esc', `insert into storage.objects (bucket_id, name) values ('midias', '${O}/2026/10/invasao.jpg')`)
espera('escola NÃO envia arquivo para outra organização', !!r.erro)
r = await como('esc', `insert into publicacao_midias (municipio_id, publicacao_id, midia_id, ordem) values ('${J}', '${pubE1}', '${midE1}', 1) returning 1`)
espera('escola monta a galeria da notícia dela', r.rows?.length === 1)
r = await como('esc', `select criar_previa('publicacoes', '${pubE1}') t`)
espera('escola gera prévia da notícia dela', !!r.rows?.[0]?.t)
r = await como('esc', `select criar_previa('publicacoes', '${pubRed}') t`)
espera('escola NÃO gera prévia de notícia da rede', !!r.erro)

r = await como('esc', `insert into publicacoes (municipio_id, titulo, slug, unidade_id, destaque) values ('${J}', 'Quer destaque', 'quer-destaque', '${E1}', true) returning destaque`)
espera('escola NÃO coloca a notícia em destaque na página inicial', r.rows?.[0]?.destaque === false)
await como('admin', `update publicacoes set destaque = true where slug = 'quer-destaque'`)
r = await como('esc', `update publicacoes set titulo = 'Quer destaque (editada)', destaque = false where slug = 'quer-destaque' returning destaque`)
espera('escola edita a notícia que a rede destacou, e o destaque fica', r.rows?.[0]?.destaque === true)
r = await como('escred', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Rascunho da E1', 'rascunho-e1', '${E1}') returning id`)
espera('redator da escola cria rascunho da unidade', r.rows?.length === 1)
const rascE1 = r.rows?.[0]?.id
r = await como('escred', `update publicacoes set status = 'publicado', publicado_em = now() where id = '${rascE1}'`)
espera('redator da escola NÃO publica', !!r.erro)
r = await como('escred', `update publicacoes set titulo = 'mudou' where id = '${pubE1}' returning 1`)
espera('redator da escola NÃO altera notícia já publicada', !!r.erro || !r.rows?.length)
r = await como('escred', `delete from publicacoes where id = '${rascE1}' returning 1`)
espera('redator da escola NÃO exclui', !!r.erro || !r.rows?.length)

r = await como('escreg', `select count(*)::int n from publicacoes where id in ('${pubE1}', '${rascE1}')`)
espera('quem tem a região vê as notícias das unidades dela', r.rows?.[0]?.n === 2)
r = await como('escreg', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Fora da região', 'fora-regiao', '${E2}')`)
espera('quem tem a região NÃO escreve em unidade fora dela', !!r.erro)

r = await como('editor', `select count(*)::int n from publicacoes where id = '${rascE1}'`)
espera('editor da rede vê o rascunho da escola', r.rows?.[0]?.n === 1)
r = await como('admin', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Rede marca a escola', 'rede-marca-escola', '${E2}') returning 1`)
espera('quem é da rede marca qualquer unidade', r.rows?.length === 1)
r = await como('admin', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Unidade de outra org', 'unidade-outra-org', '${EO}')`)
espera('notícia NÃO aponta unidade de outra organização', !!r.erro)
r = await como('anon', `select unidade_id from publicacoes where id = '${pubE1}'`)
espera('o portal vê a notícia publicada da escola, com a unidade', r.rows?.[0]?.unidade_id === E1)
await como('adm', `update papel_permissoes set ativo = false where papel_id = '${papelCom}'`)
r = await como('esc', `insert into publicacoes (municipio_id, titulo, slug, unidade_id) values ('${J}', 'Depois de desligar', 'depois-desligar-esc', '${E1}')`)
espera('desligar o papel da escola vale na hora', !!r.erro)

console.log('\nFoto de capa de páginas e serviços (0027)')
r = await como('admin', `insert into midias (municipio_id, storage_path, nome_original, mime_type, texto_alternativo) values ('${J}', '${J}/2026/10/capa.jpg', 'capa.jpg', 'image/jpeg', 'Fachada da escola') returning id`)
const capa = r.rows?.[0]?.id
r = await como('admin', `insert into paginas (municipio_id, titulo, caminho, imagem_id) values ('${J}', 'Página com capa', 'pagina-com-capa', '${capa}') returning id`)
const pagCapa = r.rows?.[0]?.id
espera('página guarda a foto de capa', !!pagCapa)
r = await como('anon', `select count(*)::int n from midias where id = '${capa}'`)
espera('capa de página em rascunho NÃO é pública', r.rows?.[0]?.n === 0)
await como('admin', `update paginas set status = 'publicado', publicado_em = now() - interval '1 minute' where id = '${pagCapa}'`)
r = await como('anon', `select count(*)::int n from midias where id = '${capa}'`)
espera('capa de página publicada é pública', r.rows?.[0]?.n === 1)
r = await db.query(`insert into midias (municipio_id, storage_path, nome_original, mime_type) values ('${O}', '${O}/2026/10/de-outra.jpg', 'de-outra.jpg', 'image/jpeg') returning id`)
r = await como('admin', `update servicos set imagem_id = '${r.rows[0].id}' where municipio_id = '${J}' returning 1`)
espera('serviço NÃO usa foto de outra organização', !!r.erro)
r = await como('editor', `select criar_previa('paginas', '${pagCapa}') t`)
r = await como('anon', `select previa_conteudo('${r.rows?.[0]?.t}', '${J}') c`)
espera('pré-visualização da página traz a capa', r.rows?.[0]?.c?.dados?.imagem?.texto_alternativo === 'Fachada da escola')

console.log('\nVídeos nas páginas de serviço (0028)')
r = await como('admin', `update servicos set videos = '[{"titulo": "Como fazer a inscrição", "caminho": "${J}/videos/inscricao.mp4", "capa": "${J}/videos/inscricao.jpg"}]' where municipio_id = '${J}' returning 1`)
espera('serviço guarda vídeo da própria organização', r.rows?.length > 0)
r = await como('admin', `update servicos set videos = '[{"titulo": "De outra", "caminho": "${O}/videos/x.mp4"}]' where municipio_id = '${J}' returning 1`)
espera('serviço NÃO aponta para vídeo de outra organização', !!r.erro)
r = await como('admin', `update servicos set videos = '[{"titulo": "Capa de outra", "caminho": "${J}/videos/x.mp4", "capa": "${O}/videos/x.jpg"}]' where municipio_id = '${J}' returning 1`)
espera('serviço NÃO usa capa de vídeo de outra organização', !!r.erro)
r = await como('admin', `update servicos set videos = '[{"caminho": "${J}/videos/x.mp4"}]' where municipio_id = '${J}' returning 1`)
espera('vídeo sem título é recusado', !!r.erro)
r = await como('admin', `update servicos set videos_titulo = 'Inscrição para creche' where municipio_id = '${J}' returning 1`)
espera('serviço guarda o título da seção de vídeos', r.rows?.length > 0)
r = await como('anon', `select videos, videos_titulo from servicos limit 1`)
espera('o portal (visitante) pode ler a coluna de vídeos', !r.erro)

console.log('\nSistemas na página inicial (0030)')
r = await como('admin', `insert into midias (municipio_id, storage_path, nome_original, mime_type, texto_alternativo) values ('${J}', '${J}/2026/10/logo-siss.png', 'logo-siss.png', 'image/png', 'Logo do SISS') returning id`)
const logoSis = r.rows?.[0]?.id
r = await como('anon', `select count(*)::int n from midias where id = '${logoSis}'`)
espera('logo ainda sem sistema NÃO é público', r.rows?.[0]?.n === 0)
r = await como('admin', `insert into sistemas_externos (municipio_id, nome, url, publico, na_home, ordem, icone, logo_id) values ('${J}', 'SISS teste', 'https://exemplo.gov.br/siss', 'cidadao', true, 1, 'school', '${logoSis}') returning id`)
const sisHome = r.rows?.[0]?.id
espera('admin cadastra sistema na página inicial com logo', !!sisHome)
r = await como('anon', `select count(*)::int n from midias where id = '${logoSis}'`)
espera('logo de sistema público e ativo é público', r.rows?.[0]?.n === 1)
r = await como('anon', `select na_home, ordem, icone, logo_id from sistemas_externos where id = '${sisHome}'`)
espera('o portal lê os campos do bloco de sistemas', r.rows?.[0]?.na_home === true)
await como('admin', `update sistemas_externos set publico = 'servidor', na_home = false where id = '${sisHome}'`)
r = await como('anon', `select count(*)::int n from midias where id = '${logoSis}'`)
espera('logo de sistema só de servidores (fora da página inicial) NÃO é público', r.rows?.[0]?.n === 0)
r = await como('anon', `select count(*)::int n from sistemas_externos where id = '${sisHome}'`)
espera('visitante NÃO vê sistema de servidores fora da página inicial', r.rows?.[0]?.n === 0)
r = await db.query(`insert into midias (municipio_id, storage_path, nome_original, mime_type) values ('${O}', '${O}/2026/10/logo-outra.png', 'logo-outra.png', 'image/png') returning id`)
r = await como('admin', `update sistemas_externos set logo_id = '${r.rows[0].id}' where id = '${sisHome}' returning 1`)
espera('sistema NÃO usa logo de outra organização', !!r.erro)

console.log('\nSistemas em breve e de servidores na página inicial (0031)')
await como('admin', `update sistemas_externos set na_home = true where id = '${sisHome}'`)
r = await como('anon', `select publico from sistemas_externos where id = '${sisHome}'`)
espera('visitante vê sistema de servidores marcado para a página inicial', r.rows?.[0]?.publico === 'servidor')
r = await como('anon', `select count(*)::int n from midias where id = '${logoSis}'`)
espera('logo de sistema de servidores na página inicial é público', r.rows?.[0]?.n === 1)
r = await como('admin', `insert into sistemas_externos (municipio_id, nome, publico, na_home, em_breve) values ('${J}', 'CI teste', 'servidor', true, true) returning id`)
espera('admin cadastra sistema "em breve" sem endereço', r.rows?.length === 1)
r = await como('admin', `insert into sistemas_externos (municipio_id, nome, publico) values ('${J}', 'Sem endereço', 'cidadao') returning id`)
espera('sistema sem endereço e fora do "em breve" é recusado', !!r.erro)
await como('admin', `update sistemas_externos set ativo = false where id = '${sisHome}'`)
r = await como('anon', `select count(*)::int n from sistemas_externos where id = '${sisHome}'`)
espera('visitante NÃO vê sistema inativo, mesmo na página inicial', r.rows?.[0]?.n === 0)

console.log('\nExclusão de organização com permissões')
r = await como('plat', `delete from municipios where slug = 'org-nova-papeis' returning 1`)
espera('SECKE exclui organização com papéis (cascata não trava)', r.rows?.length === 1)

console.log(`\n${ok} ok, ${falhas} falhas`)
process.exit(falhas ? 1 : 0)
