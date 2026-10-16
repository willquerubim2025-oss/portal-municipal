// Base comum das baterias de teste do painel (D-98): contas, navegador e conferências.
//
// As contas e senhas NÃO ficam no código (D-25): vêm de painel/e2e/.env.e2e (fora do git,
// modelo em .env.e2e.exemplo) ou de variáveis de ambiente. Os testes rodam na HOMOLOGAÇÃO,
// na organização de E2E_ORG (padrão: paulinia-educacao), com painel e portal locais:
//   painel: npx vite --mode homologacao --port 5190
//   portal: npm run dev (porta 4321, DOMINIO_DEV apontando para a mesma organização)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = path.dirname(fileURLToPath(import.meta.url));
const arquivoEnv = path.join(PASTA, '.env.e2e');
if (fs.existsSync(arquivoEnv)) {
  for (const linha of fs.readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const env = (nome, padrao) => process.env[nome] || padrao;
function exigir(nome) {
  const v = process.env[nome];
  if (!v) { console.error(`Falta ${nome} em painel/e2e/.env.e2e (veja .env.e2e.exemplo).`); process.exit(2); }
  return v;
}

export const PAINEL = env('E2E_PAINEL', 'http://localhost:5190');
export const PORTAL = env('E2E_PORTAL', 'http://localhost:4321');
export const ORG = env('E2E_ORG', 'paulinia-educacao');
export const SUPABASE_URL = 'https://kvilgamsyneenjtlllcf.supabase.co'; // homologação, sempre
export const CHAVE_PUBLICA = 'sb_publishable_Be47d2VktOMB_5vhUi8Y7A_oQU9yTsv';
export const OUT = path.join(PASTA, 'prints');
fs.mkdirSync(OUT, { recursive: true });

/** Contas de teste. As de redator e escola são criadas por `node e2e/preparar.mjs`. */
export const CONTAS = {
  get admin() { return { email: env('E2E_ADMIN_EMAIL', 'admin.teste@secke.dev'), senha: exigir('E2E_ADMIN_SENHA') }; },
  get redator() { return { email: env('E2E_REDATOR_EMAIL', 'redator.e2e@secke.dev'), senha: exigir('E2E_SENHA_TESTES') }; },
  get escola() { return { email: env('E2E_ESCOLA_EMAIL', 'escola.e2e@secke.dev'), senha: exigir('E2E_SENHA_TESTES') }; },
  get secke() { return { email: env('E2E_SECKE_EMAIL', 'secke.teste@exemplo.gov.br'), senha: exigir('E2E_SECKE_SENHA') }; },
};

export const sufixo = () => Date.now().toString().slice(-6);

/** Placar da bateria: espera(nome, condição) e fim(). */
export function placar() {
  let ok = 0, falhas = 0;
  const espera = (nome, cond) => { cond ? ok++ : falhas++; console.log(`${cond ? '  ✔' : '  ✘'} ${nome}`); return !!cond; };
  const fim = async (browser, extra = '') => {
    console.log(`\n${ok} ok, ${falhas} falhas${extra ? ` · ${extra}` : ''}`);
    await browser?.close();
    process.exit(falhas ? 1 : 0);
  };
  return { espera, fim };
}

export const ve = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);
export const aguardar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirNavegador() {
  const executablePath = process.env.E2E_CHROMIUM || undefined; // ex.: /opt/pw-browsers/chromium
  return chromium.launch({ executablePath });
}

/** Página nova que junta os erros de console (menos os HTTP esperados em testes de permissão). */
export async function novaPagina(browser, { ignorar = /status of (400|401|403|409)/ } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.erros = [];
  page.on('pageerror', (e) => page.erros.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorar.test(m.text()) && !/favicon/.test(m.location()?.url ?? '')) page.erros.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  return page;
}

export async function entrar(page, conta) {
  await page.goto(`${PAINEL}/entrar`);
  await page.getByLabel('E-mail', { exact: true }).fill(conta.email);
  await page.getByLabel('Senha', { exact: true }).fill(conta.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const ola = page.getByRole('heading', { level: 1, name: /Olá/ });
  const escolha = page.getByRole('heading', { name: /Qual prefeitura/ });
  await ola.or(escolha).first().waitFor({ timeout: 20000 });
  // Quem trabalha em várias organizações (ex.: SECKE) escolhe a de teste.
  if (await escolha.isVisible()) {
    await page.getByRole('button', { name: new RegExp(await nomeOrganizacao()) }).click();
    await ola.waitFor({ timeout: 20000 });
  }
}

let nomeOrg;
/** Nome da organização de teste (para escolher no painel e conferir no portal). */
export async function nomeOrganizacao() {
  if (!nomeOrg) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/municipios?slug=eq.${ORG}&select=nome`, { headers: { apikey: CHAVE_PUBLICA } });
    nomeOrg = (await r.json())[0]?.nome ?? ORG;
  }
  return nomeOrg;
}
export async function sair(page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/entrar/, { timeout: 10000 });
}

export const status = async (url) => (await fetch(url, { redirect: 'manual' })).status;
export const texto = async (url) => (await fetch(url)).text();

/** Confere que o portal local mostra a organização certa antes de testar contra ele. */
export async function conferirPortal(espera, nomeOrganizacao) {
  const html = await texto(`${PORTAL}/`).catch(() => '');
  return espera(`portal local (${PORTAL}) mostra a organização de teste`, html.includes(nomeOrganizacao));
}
