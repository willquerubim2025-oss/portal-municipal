// Bateria 4: dar acesso a alguém (convite por Vínculos), suspender o acesso, chamados com a SECKE e auditoria.
// Precisa da Edge Function convidar-usuario publicada na homologação.
import { CONTAS, OUT, PAINEL, abrirNavegador, entrar, novaPagina, placar, sair, sufixo, ve } from './comum.mjs';

const { espera, fim } = placar();
const sx = sufixo();
const novoEmail = `novo.e2e.${sx}@secke.dev`;
const novoNome = `Novo Usuário E2E ${sx}`;
const senhaNovo = `Convidado-${sx}-E2E`;
const browser = await abrirNavegador();
let page = await novaPagina(browser);
const tb = (nome) => page.getByRole('textbox', { name: nome, exact: true });

console.log('Vínculos: convite');
await entrar(page, CONTAS.admin);
await page.goto(`${PAINEL}/vinculos`);
await page.getByRole('button', { name: 'Dar papel a alguém' }).click();
await page.getByLabel(/^ou e-mail/).fill(novoEmail);
await page.getByRole('combobox', { name: 'Papel' }).selectOption({ label: 'Redator (teste)' });
await page.getByRole('button', { name: 'Atribuir papel' }).click();
espera('pessoa sem conta: o painel pede o nome', await ve(page.getByRole('alert').filter({ hasText: 'Informe o nome' })));
await page.getByLabel(/Nome completo/).fill(novoNome);
await page.getByRole('button', { name: 'Convidar e atribuir papel' }).click();
const temLink = await ve(page.getByRole('textbox', { name: 'Link de convite' }), 30000);
const enviouEmail = !temLink && await ve(page.getByText(/Enviamos|e-mail/), 2000);
espera('convite criado (link para repassar ou e-mail enviado)', temLink || enviouEmail);
await page.screenshot({ path: `${OUT}/a1-convite.png`, fullPage: true });
const link = temLink ? await page.getByRole('textbox', { name: 'Link de convite' }).inputValue() : null;
await page.getByRole('button', { name: 'Concluir' }).click();
espera('convidado aparece nos vínculos', await ve(page.getByText(novoNome).first()));

if (link) {
  console.log('\nConvidado abre o link e cria a senha');
  const p2 = await novaPagina(browser);
  await p2.goto(link);
  const naTela = await p2.getByRole('heading', { name: 'Nova senha' }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  espera(`link leva à tela de nova senha do painel (${new URL(p2.url()).host})`, naTela && p2.url().startsWith(PAINEL));
  if (naTela) {
    await p2.getByLabel('Nova senha').fill('curta');
    await p2.getByLabel('Repita a senha').fill('curta');
    await p2.getByRole('button', { name: 'Salvar senha' }).click();
    espera('senha curta é recusada', await ve(p2.getByRole('alert').filter({ hasText: '10 caracteres' }), 5000));
    await p2.getByLabel('Nova senha').fill(senhaNovo);
    await p2.getByLabel('Repita a senha').fill(senhaNovo);
    await p2.getByRole('button', { name: 'Salvar senha' }).click();
    const entrou = await ve(p2.getByRole('heading', { level: 1, name: /Olá/ }), 20000);
    espera('convidado entra no painel', entrou);
    espera('convidado vê Notícias, mas não Identidade visual',
      entrou && await p2.getByRole('link', { name: 'Notícias e avisos' }).isVisible() && !(await p2.getByRole('link', { name: 'Identidade visual e dados' }).isVisible()));
  }
  await p2.context().close();
}

console.log('\nVínculos: suspender');
await page.goto(`${PAINEL}/vinculos`);
await page.getByRole('button', { name: new RegExp(`^Suspender .* de ${novoNome}`) }).click();
espera('vínculo suspenso', await ve(page.getByRole('status').filter({ hasText: 'Vínculo suspenso' })));
await sair(page);
if (link) {
  await page.goto(`${PAINEL}/entrar`);
  await page.getByLabel('E-mail', { exact: true }).fill(novoEmail);
  await page.getByLabel('Senha', { exact: true }).fill(senhaNovo);
  await page.getByRole('button', { name: 'Entrar' }).click();
  espera('quem teve o acesso suspenso não entra', await ve(page.getByRole('alert').filter({ hasText: 'não está vinculado' })));
  await page.context().close();
  page = await novaPagina(browser);
}

console.log('\nChamados');
await entrar(page, CONTAS.redator);
await page.goto(`${PAINEL}/chamados`);
await page.getByRole('link', { name: 'Abrir chamado' }).click();
await tb('Assunto').fill(`Publicar edital E2E ${sx}`);
await tb('Descrição').fill('Favor publicar o edital anexo na área de editais.');
await page.getByRole('button', { name: 'Abrir chamado' }).click();
espera('chamado aberto com protocolo', await ve(page.getByRole('status').filter({ hasText: /Chamado #\d+ aberto/ })));
const urlChamado = page.url();
espera('redator não vê a gestão da SECKE', !(await page.getByRole('heading', { name: 'Gestão (SECKE)' }).isVisible()));
await sair(page);

await entrar(page, CONTAS.secke);
await page.goto(urlChamado);
await page.getByRole('heading', { name: 'Gestão (SECKE)' }).waitFor();
await page.getByLabel('Mensagem').fill('Nota interna E2E: conferir o anexo.');
await page.getByLabel('Nota interna (a prefeitura não vê)').check();
await page.getByRole('button', { name: 'Enviar mensagem' }).click();
espera('SECKE registra nota interna', await ve(page.locator('.mensagem-interna')));
await page.getByLabel('Mensagem').fill('Edital publicado. Confira no portal.');
await page.getByRole('button', { name: 'Enviar mensagem' }).click();
await ve(page.locator('.mensagem', { hasText: 'Edital publicado' }));
await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('concluido');
await page.getByRole('spinbutton', { name: 'Solicitações consumidas' }).fill('1');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
espera('SECKE conclui o chamado', await ve(page.getByRole('status').filter({ hasText: 'Chamado atualizado' })));
await sair(page);

await entrar(page, CONTAS.redator);
await page.goto(urlChamado);
espera('a organização vê a resposta', await ve(page.locator('.mensagem', { hasText: 'Edital publicado' })));
espera('a organização NÃO vê a nota interna', !(await page.getByText('Nota interna E2E').isVisible()));
espera('chamado concluído para a organização', await page.locator('.situacao-chamado-concluido').first().isVisible());
espera('redator não vê Auditoria no menu', !(await page.getByRole('link', { name: 'Auditoria' }).isVisible()));
await sair(page);

console.log('\nAuditoria');
await entrar(page, CONTAS.admin);
await page.goto(`${PAINEL}/auditoria`);
espera('auditoria lista alterações recentes', await ve(page.locator('.lista-auditoria > li').first()));
await page.screenshot({ path: `${OUT}/a2-auditoria.png`, fullPage: true });

espera(`sem erros no console${page.erros.length ? ': ' + page.erros.slice(0, 3).join(' | ') : ''}`, page.erros.length === 0);
await fim(browser, `sufixo ${sx} · convidado ${novoEmail}`);
