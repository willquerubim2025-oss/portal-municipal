// Fase 3 do painel: estrutura organizacional, menus, transparência, identidade, categorias e redirecionamentos.
// Requer painel (5190) e portal (4321) rodando contra a homologação.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const B = 'http://localhost:5190';
const PORTAL = 'http://localhost:4321';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prints');
fs.mkdirSync(OUT, { recursive: true });
const SENHA = 'Teste@Homologacao2026';
const sx = Date.now().toString().slice(-6);
let ok = 0, falhas = 0;
const espera = (nome, cond) => { cond ? ok++ : falhas++; console.log(`${cond ? '  ✔' : '  ✘'} ${nome}`); };
const ve = (loc, t = 15000) => loc.waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);
const texto = async (url) => (await fetch(url)).text();
const aguardar = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' })).newPage();
const errosConsole = [];
page.on('pageerror', (e) => errosConsole.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|403|409)/.test(m.text())) errosConsole.push(m.text()); });
page.on('dialog', (d) => d.accept());

async function entrar(email) {
  await page.goto(`${B}/entrar`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 20000 });
}
const tb = (nome) => page.getByRole('textbox', { name: nome, exact: true });
const cb = (nome) => page.getByRole('combobox', { name: nome, exact: true });
const sucesso = (t) => ve(page.getByRole('status').filter({ hasText: t }));

await entrar('admin.teste@exemplo.gov.br');

console.log('Estrutura organizacional');
await page.goto(`${B}/orgaos`);
espera('árvore mostra o Gabinete', await ve(page.getByRole('link', { name: 'Gabinete do Prefeito' })));
await page.getByRole('link', { name: 'Novo órgão' }).click();
await tb('Nome').fill(`Secretaria E2E ${sx}`);
await tb('Sigla').fill('SE2E');
await cb('Subordinado a').selectOption({ label: 'Gabinete do Prefeito' });
await tb('Telefone').fill('(16) 0000-9999');
await page.getByRole('button', { name: 'Salvar' }).click();
espera('órgão salvo', await sucesso('Órgão salvo'));
const slugOrgao = await tb('Endereço no site').inputValue();
espera('órgão aparece no portal', (await fetch(`${PORTAL}/estrutura-organizacional/${slugOrgao}`)).status === 200);

console.log('\nMenus');
await page.goto(`${B}/menus`);
const vazio = await ve(page.getByRole('button', { name: 'Começar com o menu padrão' }), 5000);
if (vazio) await page.getByRole('button', { name: 'Começar com o menu padrão' }).click();
espera('menu principal com itens', await ve(page.locator('.arvore strong', { hasText: 'Notícias' })));
await page.getByRole('button', { name: 'Adicionar item' }).click();
await tb('Texto no menu').fill(`Ouvidoria E2E ${sx}`);
await page.getByLabel('Uma página').check();
await cb('Página').selectOption({ label: 'Ouvidoria (/ouvidoria)' });
await page.getByRole('button', { name: 'Salvar item' }).click();
espera('item novo no menu', await ve(page.locator('.arvore strong', { hasText: `Ouvidoria E2E ${sx}` })));
await page.screenshot({ path: `${OUT}/f3-menus.png`, fullPage: true });
espera('item aparece no menu do portal', (await texto(`${PORTAL}/`)).includes(`Ouvidoria E2E ${sx}`));

console.log('\nTransparência');
await page.goto(`${B}/transparencia`);
// Usa uma seção ainda vazia (oculta no site); cada execução preenche uma.
const oculta = page.locator('article', { has: page.getByText('oculta no site') }).first();
espera('há seção vazia marcada como oculta', await ve(oculta));
const secao = (await oculta.locator('h2').innerText()).replace('oculta no site', '').trim();
await page.getByRole('button', { name: `+ Item em ${secao}` }).click();
await tb('Título').fill(`Obras em andamento E2E ${sx}`);
await page.getByLabel('Um endereço', { exact: true }).check();
await tb('Endereço').fill('https://www.example.com/obras');
await page.getByRole('button', { name: 'Salvar item' }).click();
espera('item criado na seção vazia', await ve(page.locator('.lista-filhos strong', { hasText: `Obras em andamento E2E ${sx}` })));
espera('a seção passa a aparecer no portal', (await texto(`${PORTAL}/transparencia`)).includes(`Obras em andamento E2E ${sx}`));
await page.getByRole('tab', { name: 'Sistemas externos' }).click();
const achou = await ve(page.locator('td', { hasText: 'SIS-Web' }).first());
if (!achou) console.log('    painel:', (await page.locator('[role=tabpanel]').innerText()).slice(0, 300).split(String.fromCharCode(10)).join(' | '));
espera('sistemas do seed listados', achou);
await page.getByRole('button', { name: 'Novo sistema' }).click();
await tb('Nome').fill(`Sistema E2E ${sx}`);
await tb('Endereço').fill('ftp://errado');
await page.getByRole('button', { name: 'Salvar sistema' }).click();
espera('endereço inválido recusado', await ve(page.getByRole('alert').filter({ hasText: 'http' })));
await tb('Endereço').fill('https://www.example.com/sistema');
await page.getByRole('button', { name: 'Salvar sistema' }).click();
espera('sistema criado', await ve(page.locator('td', { hasText: `Sistema E2E ${sx}` }).first()));

console.log('\nIdentidade visual');
await page.goto(`${B}/identidade`);
await tb('Cor principal (cabeçalho)').waitFor();
const corOriginal = await tb('Cor principal (cabeçalho)').inputValue();
await tb('Cor principal (cabeçalho)').fill('#ffff00');
espera('aviso de contraste ruim na hora', await ve(page.getByText(/abaixo do mínimo/).first()));
await page.getByRole('button', { name: 'Salvar identidade' }).click();
espera('cor clara demais é recusada', await ve(page.getByRole('alert').filter({ hasText: 'clara demais' })));
await tb('Cor principal (cabeçalho)').fill('#7a1f1f');
await tb('Slogan / descrição').fill(`Slogan E2E ${sx}`);
await page.getByRole('button', { name: 'Salvar identidade' }).click();
espera('identidade salva', await sucesso('Identidade salva'));
await page.screenshot({ path: `${OUT}/f3-identidade.png`, fullPage: true });
// O portal guarda os dados do município por até 60 s.
let aplicou = false;
for (let i = 0; i < 14 && !aplicou; i++) { aplicou = (await texto(`${PORTAL}/`)).includes('--cor-primaria:#7a1f1f'); if (!aplicou) await aguardar(5000); }
espera('nova cor aplicada no portal (até 60 s)', aplicou);
await tb('Cor principal (cabeçalho)').fill(corOriginal);
await tb('Slogan / descrição').fill('Portal oficial da Prefeitura Municipal de Jeriquara/SP.');
await page.getByRole('button', { name: 'Salvar identidade' }).click();
espera('cor original restaurada', await sucesso('Identidade salva'));

console.log('\nCategorias');
await page.goto(`${B}/categorias`);
await tb('Nova categoria').fill(`Cultura E2E ${sx}`);
await page.getByRole('button', { name: 'Adicionar' }).click();
espera('categoria criada', await ve(page.locator('.lista-filhos strong', { hasText: `Cultura E2E ${sx}` })));
await page.getByRole('button', { name: `Excluir Cultura E2E ${sx}` }).click();
espera('categoria excluída', await page.locator('.lista-filhos strong', { hasText: `Cultura E2E ${sx}` }).waitFor({ state: 'detached', timeout: 10000 }).then(() => true).catch(() => false));

console.log('\nRedirecionamentos');
await page.goto(`${B}/redirecionamentos`);
await tb('Endereço antigo').fill(`https://www.jeriquara.sp.gov.br/Pagina-Velha-E2E-${sx}/`);
await tb('Leva para').fill('/servicos');
await page.getByRole('button', { name: 'Criar' }).click();
espera('redirecionamento criado e normalizado', await sucesso(`/pagina-velha-e2e-${sx}/`));
const r = await fetch(`${PORTAL}/pagina-velha-e2e-${sx}/`, { redirect: 'manual' });
espera('portal responde 301 para /servicos', r.status === 301 && (r.headers.get('location') ?? '').endsWith('/servicos'));

console.log('\nEditor não acessa a estrutura');
await page.getByRole('button', { name: 'Sair' }).click();
await page.waitForURL(/\/entrar/);
await entrar('editor.teste@exemplo.gov.br');
espera('menu do editor sem "Menus"', !(await page.getByRole('link', { name: 'Menus' }).isVisible()));
await page.goto(`${B}/identidade`);
await page.waitForTimeout(1500);
espera('editor é mandado para o início ao abrir /identidade', new URL(page.url()).pathname === '/');

espera(`sem erros no console${errosConsole.length ? ': ' + errosConsole.slice(0, 3).join(' | ') : ''}`, errosConsole.length === 0);
console.log(`\n${ok} ok, ${falhas} falhas · sufixo ${sx}`);
await browser.close();
process.exit(falhas ? 1 : 0);
