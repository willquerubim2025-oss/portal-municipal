import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const B = 'http://localhost:5190';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prints');
fs.mkdirSync(OUT, { recursive: true });
const SENHA = 'Teste@Homologacao2026';
const titulo = `Teste E2E ${Date.now()}`;
let ok = 0, falhas = 0;
const ve = (loc, t = 15000) => loc.waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);
const espera = (nome, cond) => { cond ? ok++ : falhas++; console.log(`${cond ? '  ✔' : '  ✘'} ${nome}`); };

// PNG 2x2 válido para testar upload.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
const page = await ctx.newPage();
const errosConsole = [];
page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()); });
page.on('pageerror', (e) => errosConsole.push(String(e)));

async function entrar(email) {
  await page.goto(`${B}/entrar`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 15000 });
}
async function sair() {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/entrar/, { timeout: 10000 });
}

console.log('Acesso');
await page.goto(B);
await page.waitForURL(/\/entrar/);
espera('sem sessão vai para /entrar', page.url().includes('/entrar'));
await page.screenshot({ path: `${OUT}/01-login.png` });
await page.getByLabel('E-mail').fill('editor.teste@exemplo.gov.br');
await page.getByLabel('Senha').fill('senha-errada');
await page.getByRole('button', { name: 'Entrar' }).click();
espera('senha errada mostra erro', await ve(page.getByRole('alert').filter({ hasText: 'incorretos' }), 10000));

console.log('\nEditor');
await entrar('editor.teste@exemplo.gov.br');
espera('editor entra e vê o início', true);
espera('editor não vê "Usuários" no menu', !(await page.getByText('Usuários').isVisible()));
await page.screenshot({ path: `${OUT}/02-inicio-editor.png` });

await page.getByRole('link', { name: 'Nova notícia' }).first().click();
await page.getByRole('textbox', { name: 'Título', exact: true }).fill(titulo);
espera('endereço gerado do título', (await page.getByLabel('Endereço no site').inputValue()).startsWith('teste-e2e-'));
await page.getByLabel(/^Resumo/).fill('Resumo criado pelo teste automático.');
await page.getByRole('textbox', { name: 'Texto da notícia' }).click();
await page.keyboard.type('Primeiro parágrafo do teste.');
await page.getByRole('button', { name: 'Negrito' }).click();
await page.keyboard.type(' Trecho em negrito.');
espera('editor não vê "Publicar agora"', !(await page.getByRole('button', { name: 'Publicar agora' }).isVisible()));
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
await page.waitForURL(/\/noticias\/[0-9a-f-]{36}$/, { timeout: 15000 });
espera('rascunho salvo', await ve(page.getByRole('status').filter({ hasText: 'Alterações salvas' }), 10000));
const urlRascunho = page.url();
await page.screenshot({ path: `${OUT}/03-rascunho-editor.png`, fullPage: true });

// Notícia publicada (dado de exemplo) fica só leitura para o editor.
await page.goto(`${B}/noticias`);
await page.getByRole('link', { name: /Campanha de vacinação/ }).click();
espera('publicada fica bloqueada para o editor', await ve(page.getByRole('note').filter({ hasText: 'Só um publicador' }), 10000));
espera('campo título desabilitado', await page.getByRole('textbox', { name: 'Título', exact: true }).isDisabled());
await page.screenshot({ path: `${OUT}/04-publicada-bloqueada.png` });
await sair();

console.log('\nAdmin');
await entrar('admin.teste@exemplo.gov.br');
espera('admin vê "Usuários" no menu', await page.getByText('Usuários').isVisible());
await page.goto(urlRascunho);
await page.getByRole('textbox', { name: 'Título', exact: true }).waitFor();
// Imagem de destaque com texto alternativo obrigatório.
await page.locator('fieldset.campo-imagem input[type=file]').setInputFiles({ name: 'foto teste.png', mimeType: 'image/png', buffer: png });
await page.getByRole('button', { name: 'Enviar imagem' }).click();
espera('sem texto alternativo a imagem é recusada', await ve(page.getByRole('alert').filter({ hasText: 'texto alternativo' }), 5000));
await page.getByLabel(/Descreva a imagem/).fill('Imagem de teste automático');
await page.getByRole('button', { name: 'Enviar imagem' }).click();
espera('imagem enviada ao Storage', await ve(page.locator('.imagem-atual img'), 15000));
await page.getByRole('checkbox', { name: 'Saúde' }).check();
await page.getByRole('button', { name: 'Publicar agora' }).click();
espera('admin publica', await ve(page.getByRole('status').filter({ hasText: 'Notícia publicada' }), 15000));
espera('etiqueta Publicado', await page.locator('.etiqueta-publicado').first().isVisible());
espera('endereço travado depois de publicar', await page.getByLabel('Endereço no site').evaluate((e) => e.readOnly));
await page.screenshot({ path: `${OUT}/05-publicada-admin.png`, fullPage: true });

// Galeria (só depois de salvo).
await page.locator('.nova-foto input[type=file]').setInputFiles({ name: 'galeria.png', mimeType: 'image/png', buffer: png });
await page.getByLabel(/Descrição da foto/).fill('Foto da galeria de teste');
await page.getByRole('button', { name: 'Adicionar à galeria' }).click();
espera('foto adicionada à galeria', await ve(page.locator('.galeria-editor li img').first(), 15000));

await page.getByRole('button', { name: 'Retirar do site' }).click();
espera('admin despublica', await ve(page.getByRole('status').filter({ hasText: 'retirada do site' }), 15000));

await page.goto(`${B}/noticias?situacao=despublicado`);
espera('filtro por situação encontra a notícia', await ve(page.getByRole('link', { name: titulo }), 10000));
await page.screenshot({ path: `${OUT}/06-lista.png` });

const erros = errosConsole.filter((e) => !/favicon|status of 400/.test(e));
espera(`sem erros no console${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`, erros.length === 0);
console.log(`\n${ok} ok, ${falhas} falhas · título: ${titulo}`);
await browser.close();
process.exit(falhas ? 1 : 0);
