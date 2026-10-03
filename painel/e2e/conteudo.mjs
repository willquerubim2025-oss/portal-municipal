import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const B = 'http://localhost:5190';
const PORTAL = 'http://localhost:4321';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prints');
fs.mkdirSync(OUT, { recursive: true });
const SENHA = 'Teste@Homologacao2026';
const sufixo = Date.now().toString().slice(-6);
let ok = 0, falhas = 0;
const espera = (nome, cond) => { cond ? ok++ : falhas++; console.log(`${cond ? '  ✔' : '  ✘'} ${nome}`); };
const ve = (loc, t = 15000) => loc.waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' })).newPage();
const errosConsole = [];
page.on('pageerror', (e) => errosConsole.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|409)/.test(m.text())) errosConsole.push(m.text()); });

async function entrar(email) {
  await page.goto(`${B}/entrar`);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 20000 });
}
const campo = (nome) => page.getByRole('textbox', { name: nome, exact: true });
async function salvarRascunho() {
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  try { await page.waitForURL(/\/[0-9a-f-]{36}$/, { timeout: 15000 }); }
  catch (err) { console.log('    alerta na tela:', await page.getByRole('alert').allTextContents()); throw err; }
  return ve(page.getByRole('status').filter({ hasText: 'Alterações salvas' }));
}
async function publicar(textoOk) {
  await page.getByRole('button', { name: 'Publicar agora' }).click();
  return ve(page.getByRole('status').filter({ hasText: textoOk }));
}
const status = async (url) => (await fetch(url, { redirect: 'manual' })).status;

await entrar('admin.teste@exemplo.gov.br');

console.log('Documentos');
await page.goto(`${B}/documentos`);
espera('lista de documentos carrega os exemplos', await ve(page.getByRole('link', { name: 'Lei Municipal nº 10/2026' })));
await page.getByRole('link', { name: 'Novo documento' }).click();
await page.waitForURL(/\/documentos\/novo$/);
await page.getByRole('heading', { level: 1, name: 'Novo documento' }).waitFor();
await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption({ label: 'Decretos' });
await campo('Título').fill(`Decreto E2E nº ${sufixo}/2026`);
await page.getByLabel('Número', { exact: true }).fill(sufixo);
await page.getByLabel('Data do documento', { exact: true }).fill('2026-10-01');
await page.getByLabel('Ementa', { exact: true }).fill('Decreto criado pelo teste automático.');
await page.getByRole('combobox', { name: 'Situação de vigência', exact: true }).selectOption('vigente');
espera('documento salvo como rascunho', await salvarRascunho());
const urlDoc = page.url();
await page.getByLabel('Nome do arquivo no site', { exact: true }).fill('Íntegra do decreto');
await page.getByLabel('ou endereço externo', { exact: true }).fill('https://www.example.com/decreto.pdf');
await page.getByRole('button', { name: 'Anexar' }).click();
espera('arquivo (link externo) anexado', await ve(page.locator('#t-arquivos ~ ol a', { hasText: 'Íntegra do decreto' })));
await page.getByRole('combobox', { name: 'Este documento', exact: true }).selectOption('regulamenta');
await page.getByLabel('Buscar documento', { exact: true }).fill('Lei Municipal nº 10');
await page.getByRole('button', { name: 'Lei Municipal nº 10/2026' }).click();
espera('relação "regulamenta" registrada', await ve(page.locator('.lista-filhos li', { hasText: 'Regulamenta' })));
espera('documento publicado', await publicar('Documento publicado'));
const slugDoc = await page.getByRole('textbox', { name: 'Endereço no site', exact: true }).inputValue();
await page.screenshot({ path: `${OUT}/f2-documento.png`, fullPage: true });

console.log('\nPáginas');
await page.goto(`${B}/paginas/novo`);
await campo('Título').fill(`Historia E2E ${sufixo}`);
await page.getByRole('combobox', { name: 'Página-mãe', exact: true }).selectOption({ label: 'O Município (/o-municipio)' });
espera('endereço hierárquico montado', (await page.getByText(/Endereço completo:/).textContent()).includes(`/o-municipio/historia-e2e-${sufixo}`));
espera('página salva', await salvarRascunho());
espera('página publicada', await publicar('Página publicada'));

console.log('\nServiços');
await page.goto(`${B}/servicos/novo`);
await campo('Nome do serviço').fill(`Alvará E2E ${sufixo}`);
await page.getByLabel('O que é', { exact: true }).fill('Serviço de teste.');
await page.getByLabel('Prazo', { exact: true }).fill('15 dias úteis');
await page.getByLabel('Link do serviço on-line', { exact: true }).fill('ftp://errado');
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
espera('link inválido é recusado', await ve(page.getByRole('alert').filter({ hasText: 'https://' })));
await page.getByLabel('Link do serviço on-line', { exact: true }).fill('https://www.example.com/alvara');
espera('serviço salvo', await salvarRascunho());
espera('serviço publicado', await publicar('Serviço publicado'));
const slugServ = await page.getByRole('textbox', { name: 'Endereço no site', exact: true }).inputValue();

console.log('\nAgenda');
await page.goto(`${B}/eventos/novo`);
await campo('Nome do evento').fill(`Feira E2E ${sufixo}`);
await page.getByLabel(/^Início/).fill('2026-12-10T09:00');
await page.getByLabel('Término', { exact: true }).fill('2026-12-09T09:00');
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
espera('término antes do início é recusado', await ve(page.getByRole('alert').filter({ hasText: 'término' })));
await page.getByLabel('Término', { exact: true }).fill('2026-12-10T17:00');
await page.getByLabel('Local', { exact: true }).fill('Praça Central');
espera('evento salvo', await salvarRascunho());
espera('evento publicado', await publicar('Evento publicado'));
const slugEvento = await page.getByRole('textbox', { name: 'Endereço no site', exact: true }).inputValue();

console.log('\nPerguntas frequentes');
await page.goto(`${B}/perguntas/novo`);
await campo('Pergunta').fill(`Pergunta E2E ${sufixo}?`);
await page.getByRole('textbox', { name: 'Resposta' }).click();
await page.keyboard.type('Resposta do teste automático.');
espera('pergunta salva', await salvarRascunho());
espera('pergunta publicada', await publicar('Pergunta publicada'));

console.log('\nBanners e alertas');
await page.goto(`${B}/destaques/novo`);
await campo('Título').fill(`Banner E2E ${sufixo}`);
espera('banner salvo sem imagem (rascunho pode)', await salvarRascunho());
await page.getByRole('button', { name: 'Publicar agora' }).click();
espera('banner sem imagem NÃO é publicado (mensagem clara)', await ve(page.getByRole('alert').filter({ hasText: 'envie a imagem' })));
await page.getByLabel(/Alerta em faixa/).check();
await page.getByLabel('Texto', { exact: true }).fill('teste automático de alerta');
await page.getByRole('combobox', { name: 'Nível', exact: true }).selectOption('urgente');
espera('alerta publicado', await publicar('No ar'));
await page.screenshot({ path: `${OUT}/f2-alerta.png`, fullPage: true });

console.log('\nEditor (permissões)');
await page.getByRole('button', { name: 'Sair' }).click();
await page.waitForURL(/\/entrar/);
await entrar('editor.teste@exemplo.gov.br');
await page.goto(`${B}/servicos/novo`);
await campo('Nome do serviço').fill(`Serviço do editor E2E ${sufixo}`);
espera('editor salva serviço como rascunho', await salvarRascunho());
espera('editor não vê "Publicar agora"', !(await page.getByRole('button', { name: 'Publicar agora' }).isVisible()));
await page.goto(urlDoc);
espera('documento publicado fica só leitura para o editor', await ve(page.getByRole('note').filter({ hasText: 'Só um publicador' })));
espera('editor não vê "Anexar" no documento publicado', !(await page.getByRole('button', { name: 'Anexar' }).isVisible()));

console.log('\nPortal (o que foi publicado aparece no site)');
await new Promise((r) => setTimeout(r, 1500));
espera(`documento no portal: /documentos/${slugDoc}`, (await status(`${PORTAL}/documentos/${slugDoc}`)) === 200);
espera('página filha no portal', (await status(`${PORTAL}/o-municipio/historia-e2e-${sufixo}`)) === 200);
espera('serviço no portal', (await status(`${PORTAL}/servicos/${slugServ}`)) === 200);
espera('evento no portal', (await status(`${PORTAL}/eventos/${slugEvento}`)) === 200);
const home = await (await fetch(`${PORTAL}/`)).text();
espera('alerta urgente aparece no portal', home.includes(`Banner E2E ${sufixo}`) && home.includes('alerta-urgente'));
const docHtml = await (await fetch(`${PORTAL}/documentos/${slugDoc}`)).text();
espera('relação aparece no portal ("Regulamenta")', docHtml.includes('Regulamenta'));

espera(`sem erros no console${errosConsole.length ? ': ' + errosConsole.slice(0, 3).join(' | ') : ''}`, errosConsole.length === 0);
console.log(`\n${ok} ok, ${falhas} falhas · sufixo ${sufixo}`);
await browser.close();
process.exit(falhas ? 1 : 0);
