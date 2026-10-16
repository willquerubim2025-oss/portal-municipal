// Prepara (uma vez) as contas de teste da organização de E2E_ORG na HOMOLOGAÇÃO (D-98):
//   - papel "Redator (teste)" (conteudo.editar na rede) e o usuário E2E_REDATOR_EMAIL nele;
//   - papel "Comunicação da escola (teste)" (conteudo.publicar só na unidade, fase 1C) e o
//     usuário E2E_ESCOLA_EMAIL vinculado à unidade E2E_ESCOLA_UNIDADE (slug; padrão: a primeira).
// Usa o login do administrador de teste e o convite do painel (Edge Function convidar-usuario);
// o link do convite é aberto no painel local para gravar a senha E2E_SENHA_TESTES.
// Pode rodar de novo: o que já existe fica como está.   Uso: node e2e/preparar.mjs
import { createClient } from '@supabase/supabase-js';
import { CONTAS, ORG, PAINEL, SUPABASE_URL, CHAVE_PUBLICA, abrirNavegador, novaPagina } from './comum.mjs';

// O link do convite volta para o painel local: sem ele no ar, o convite se perde.
if (!(await fetch(PAINEL).then((r) => r.ok).catch(() => false))) {
  console.error(`O painel não está respondendo em ${PAINEL}. Suba com: npx vite --mode homologacao --port 5190`);
  process.exit(2);
}
const sb = createClient(SUPABASE_URL, CHAVE_PUBLICA, { auth: { persistSession: false } });
const { error: erroLogin } = await sb.auth.signInWithPassword({ email: CONTAS.admin.email, password: CONTAS.admin.senha });
if (erroLogin) throw new Error(`Login do administrador falhou: ${erroLogin.message}`);
const { data: org } = await sb.from('municipios').select('id, nome').eq('slug', ORG).single();
console.log(`Organização: ${org.nome}`);

async function papel(slug, nome, permissao, escopo) {
  let { data: p } = await sb.from('papeis').select('id').eq('municipio_id', org.id).eq('slug', slug).maybeSingle();
  if (!p) {
    const r = await sb.from('papeis').insert({ municipio_id: org.id, slug, nome, descricao: 'Papel dos testes automáticos (apagar antes da ida ao ar).' }).select('id').single();
    if (r.error) throw r.error;
    p = r.data;
    console.log(`  papel criado: ${nome}`);
  }
  const r = await sb.from('papel_permissoes').upsert({ municipio_id: org.id, papel_id: p.id, permissao_codigo: permissao, ativo: true, escopo },
    { onConflict: 'papel_id,permissao_codigo' });
  if (r.error) throw new Error(`${nome}: ${r.error.message}${escopo !== 'rede' ? ' (a migração 0026 foi aplicada?)' : ''}`);
  return p.id;
}

async function conta(conta, nome, papelId, unidadeId = null) {
  const { data: perfil } = await sb.from('perfis').select('user_id').ilike('email', conta.email).maybeSingle();
  if (perfil) {
    const r = await sb.from('usuario_papeis').insert({ municipio_id: org.id, user_id: perfil.user_id, papel_id: papelId, unidade_id: unidadeId });
    if (r.error && r.error.code !== '23505') console.log(`  aviso (${conta.email}): ${r.error.message}`);
    console.log(`  ${conta.email}: já existe`);
    return;
  }
  const { data, error } = await sb.functions.invoke('convidar-usuario', {
    body: { municipio_id: org.id, nome, email: conta.email, papel_id: papelId, unidade_id: unidadeId, regiao_id: null, redirect_to: `${PAINEL}/redefinir-senha` },
  });
  if (error) throw new Error(`Convite de ${conta.email}: ${error.message}`);
  if (!data?.link) { console.log(`  ${conta.email}: conta já existia no login; defina a senha pelo "Esqueci minha senha".`); return; }
  const browser = await abrirNavegador();
  const page = await novaPagina(browser);
  await page.goto(data.link);
  await page.getByRole('heading', { name: 'Nova senha' }).waitFor({ timeout: 20000 });
  await page.getByLabel('Nova senha').fill(conta.senha);
  await page.getByLabel('Repita a senha').fill(conta.senha);
  await page.getByRole('button', { name: 'Salvar senha' }).click();
  await page.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 20000 });
  await browser.close();
  console.log(`  ${conta.email}: criada`);
}

const papelRedator = await papel('redator-teste', 'Redator (teste)', 'conteudo.editar', 'rede');
await conta(CONTAS.redator, 'Redator E2E', papelRedator);

const papelEscola = await papel('comunicacao-escola-teste', 'Comunicação da escola (teste)', 'conteudo.publicar', 'unidade');
let q = sb.from('unidades').select('id, nome').eq('municipio_id', org.id).eq('ativo', true).order('nome').limit(1);
if (process.env.E2E_ESCOLA_UNIDADE) q = sb.from('unidades').select('id, nome').eq('municipio_id', org.id).eq('slug', process.env.E2E_ESCOLA_UNIDADE);
const { data: [unidade] = [] } = await q;
if (!unidade) throw new Error('Nenhuma unidade encontrada para a conta da escola.');
console.log(`Unidade da conta da escola: ${unidade.nome}`);
await conta(CONTAS.escola, 'Escola E2E', papelEscola, unidade.id);

await sb.auth.signOut();
console.log('\nPronto.');
