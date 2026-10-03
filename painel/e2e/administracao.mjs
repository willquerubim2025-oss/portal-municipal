// Fase 4 do painel: usuários (convite pela Edge Function), chamados com saldo e auditoria.
// Requer o painel (5190) contra a homologação, com a Edge Function convidar-usuario publicada.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const B = 'http://localhost:5190';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prints');
fs.mkdirSync(OUT, { recursive: true });
const SENHA = 'Teste@Homologacao2026';
const sx = Date.now().toString().slice(-6);
const novoEmail = `novo.e2e.${sx}@exemplo.gov.br`;
let ok = 0, falhas = 0;
const espera = (nome, cond) => { cond ? ok++ : falhas++; console.log(`${cond ? '  ✔' : '  ✘'} ${nome}`); };
const ve = (loc, t = 20000) => loc.waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);

const browser = await chromium.launch();
let ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR', permissions: ['clipboard-read', 'clipboard-write'] });
let page = await ctx.newPage();
const errosConsole = [];
const observar = (p) => {
  p.on('pageerror', (e) => errosConsole.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401|403|409)/.test(m.text())) errosConsole.push(m.text()); });
  p.on('dialog', (d) => d.accept());
};
observar(page);
const tb = (nome) => page.getByRole('textbox', { name: nome, exact: true });

async function entrar(email, senha = SENHA) {
  await page.goto(`${B}/entrar`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 20000 });
}
async function sair() {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/entrar/);
}

console.log('Usuários: convite');
await entrar('admin.teste@exemplo.gov.br');
await page.goto(`${B}/usuarios`);
espera('lista mostra o editor de teste', await ve(page.getByRole('cell', { name: 'editor.teste@exemplo.gov.br' })));
espera('admin não pode mudar o próprio papel', !(await page.getByRole('combobox', { name: 'Papel de Admin de Teste' }).isVisible()));
await page.getByRole('button', { name: 'Convidar usuário' }).click();
await tb('Nome completo').fill(`Novo Usuário E2E ${sx}`);
await tb('E-mail').fill(novoEmail);
await page.getByRole('combobox', { name: 'Papel', exact: true }).selectOption('editor');
await page.getByRole('button', { name: 'Convidar', exact: true }).click();
const temLink = await ve(page.getByRole('textbox', { name: 'Link de convite' }), 30000);
const enviouEmail = !temLink && await ve(page.getByText('Enviamos um e-mail'), 2000);
espera('convite criado (link para repassar ou e-mail enviado)', temLink || enviouEmail);
await page.screenshot({ path: `${OUT}/f4-convite.png`, fullPage: true });
const link = temLink ? await page.getByRole('textbox', { name: 'Link de convite' }).inputValue() : null;
await page.getByRole('button', { name: 'Concluir' }).click();
espera('convidado aparece na lista como editor', await ve(page.getByRole('combobox', { name: `Papel de Novo Usuário E2E ${sx}` })));

if (link) {
  console.log('\nConvidado abre o link e cria a senha');
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  const p2 = await ctx2.newPage();
  observar(p2);
  await p2.goto(link);
  const naTela = await p2.getByRole('heading', { name: 'Nova senha' }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  espera(`link leva à tela de nova senha (${new URL(p2.url()).host}${new URL(p2.url()).pathname})`, naTela && p2.url().startsWith(B));
  if (naTela && p2.url().startsWith(B)) {
    await p2.getByLabel('Nova senha').fill('curta');
    await p2.getByLabel('Repita a senha').fill('curta');
    await p2.getByRole('button', { name: 'Salvar senha' }).click();
    espera('senha curta é recusada', await p2.getByRole('alert').filter({ hasText: '10 caracteres' }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
    await p2.getByLabel('Nova senha').fill('SenhaDoConvidado2026');
    await p2.getByLabel('Repita a senha').fill('SenhaDoConvidado2026');
    await p2.getByRole('button', { name: 'Salvar senha' }).click();
    const entrou = await p2.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    espera('convidado entra no painel', entrou);
    espera('convidado entra como Editor', entrou && (await p2.locator('.topo-usuario').innerText()).includes('Editor'));
  }
  await ctx2.close();
}

console.log('\nUsuários: papel e acesso');
await page.getByRole('combobox', { name: `Papel de Novo Usuário E2E ${sx}` }).selectOption('publicador');
espera('papel alterado para publicador', await ve(page.getByRole('status').filter({ hasText: 'agora é publicador' })));
await page.getByRole('button', { name: `Desativar Novo Usuário E2E ${sx}` }).click();
espera('acesso desativado', await ve(page.getByRole('status').filter({ hasText: 'Acesso desativado' })));
await sair();
if (link) {
  await page.goto(`${B}/entrar`);
  await page.getByLabel('E-mail').fill(novoEmail);
  await page.getByLabel('Senha').fill('SenhaDoConvidado2026');
  await page.getByRole('button', { name: 'Entrar' }).click();
  espera('usuário desativado não acessa o painel', await ve(page.getByRole('alert').filter({ hasText: 'não está vinculado' })));
  await page.goto(`${B}/`); // limpa
  await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  page = await ctx.newPage(); observar(page);
}

console.log('\nChamados');
await entrar('editor.teste@exemplo.gov.br');
await page.goto(`${B}/chamados`);
const saldoAntes = Number((await page.locator('.caixa-saldo strong').first().innerText({ timeout: 20000 })).trim());
espera(`saldo do contrato visível (${saldoAntes})`, Number.isFinite(saldoAntes));
await page.getByRole('link', { name: 'Abrir chamado' }).click();
await tb('Assunto').fill(`Publicar edital E2E ${sx}`);
await tb('Descrição').fill('Favor publicar o edital anexo na área de licitações.');
await page.getByRole('button', { name: 'Abrir chamado' }).click();
espera('chamado aberto com protocolo', await ve(page.getByRole('status').filter({ hasText: /Chamado #\d+ aberto/ })));
const urlChamado = page.url();
espera('editor não vê a gestão da SECKE', !(await page.getByRole('heading', { name: 'Gestão (SECKE)' }).isVisible()));
await sair();

await entrar('secke.teste@exemplo.gov.br');
await page.goto(urlChamado);
await page.getByRole('heading', { name: 'Gestão (SECKE)' }).waitFor();
await page.getByLabel('Mensagem').fill('Nota interna E2E: conferir anexo com o setor de compras.');
await page.getByLabel('Nota interna (a prefeitura não vê)').check();
await page.getByRole('button', { name: 'Enviar mensagem' }).click();
espera('SECKE registra nota interna', await ve(page.locator('.mensagem-interna')));
await page.getByLabel('Mensagem').fill('Edital publicado. Confira no portal.');
await page.getByRole('button', { name: 'Enviar mensagem' }).click();
await ve(page.locator('.mensagem', { hasText: 'Edital publicado' }));
await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('concluido');
await page.getByRole('spinbutton', { name: 'Solicitações consumidas' }).fill('2');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
espera('SECKE conclui e lança 2 solicitações', await ve(page.getByRole('status').filter({ hasText: 'Chamado atualizado' })));
await page.screenshot({ path: `${OUT}/f4-chamado-secke.png`, fullPage: true });
await sair();

await entrar('editor.teste@exemplo.gov.br');
await page.goto(urlChamado);
await ve(page.locator('.mensagem', { hasText: 'Edital publicado' }));
espera('prefeitura vê a resposta', await page.locator('.mensagem', { hasText: 'Edital publicado' }).isVisible());
espera('prefeitura NÃO vê a nota interna', !(await page.getByText('Nota interna E2E').isVisible()));
espera('chamado concluído para a prefeitura', await page.locator('.situacao-chamado-concluido').first().isVisible());
await page.goto(`${B}/chamados`);
const saldoDepois = Number((await page.locator('.caixa-saldo strong').first().innerText({ timeout: 20000 })).trim());
espera(`saldo caiu 2 (${saldoAntes} → ${saldoDepois})`, saldoDepois === saldoAntes - 2);
espera('editor não vê Auditoria no menu', !(await page.getByRole('link', { name: 'Auditoria' }).isVisible()));
await sair();

console.log('\nAuditoria');
await entrar('admin.teste@exemplo.gov.br');
await page.goto(`${B}/auditoria`);
espera('auditoria lista alterações recentes', await ve(page.locator('.lista-auditoria > li').first()));
await page.getByRole('combobox', { name: 'O quê' }).selectOption('membros');
espera('registro do acesso concedido ao convidado, com autor', await ve(page.locator('.lista-auditoria > li', { hasText: 'Admin de Teste' }).first()));
const comDetalhe = page.locator('.lista-auditoria details').first();
if (await comDetalhe.isVisible()) { await comDetalhe.locator('summary').click(); }
espera('detalhe mostra o campo alterado (papel ou ativo)', await ve(page.locator('.tabela-compacta td', { hasText: /^(papel|ativo)$/ }).first(), 5000));
await page.screenshot({ path: `${OUT}/f4-auditoria.png`, fullPage: true });

espera(`sem erros no console${errosConsole.length ? ': ' + errosConsole.slice(0, 3).join(' | ') : ''}`, errosConsole.length === 0);
console.log(`\n${ok} ok, ${falhas} falhas · sufixo ${sx}`);
await browser.close();
process.exit(falhas ? 1 : 0);
