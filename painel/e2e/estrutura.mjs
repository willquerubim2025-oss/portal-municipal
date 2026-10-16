// Bateria 3: estrutura organizacional, menus, transparência, sistemas, identidade visual,
// categorias e redirecionamentos (manual e em lote). Restaura a identidade original no fim.
import { CONTAS, OUT, PAINEL, PORTAL, abrirNavegador, aguardar, entrar, novaPagina, placar, sair, sufixo, texto, ve } from './comum.mjs';

const { espera, fim } = placar();
const sx = sufixo();
const browser = await abrirNavegador();
const page = await novaPagina(browser);
const tb = (nome) => page.getByRole('textbox', { name: nome, exact: true });
const cb = (nome) => page.getByRole('combobox', { name: nome, exact: true });
const sucesso = (t) => ve(page.getByRole('status').filter({ hasText: t }));

await entrar(page, CONTAS.admin);

console.log('Estrutura organizacional');
await page.goto(`${PAINEL}/orgaos`);
await page.getByRole('link', { name: 'Novo órgão' }).click();
await tb('Nome').fill(`Divisão E2E ${sx}`);
await tb('Sigla').fill('DE2E');
const pai = cb('Subordinado a');
const opcoesPai = await pai.locator('option').allTextContents();
if (opcoesPai.length > 1) await pai.selectOption({ index: 1 });
await tb('Telefone').fill('(19) 0000-9999');
await page.getByRole('button', { name: 'Salvar' }).click();
espera('órgão salvo', await sucesso('Órgão salvo'));
const slugOrgao = await tb('Endereço no site').inputValue();
espera('órgão aparece no portal', (await fetch(`${PORTAL}/estrutura-organizacional/${slugOrgao}`)).status === 200);

console.log('\nMenus');
await page.goto(`${PAINEL}/menus`);
await page.getByRole('button', { name: 'Adicionar item' }).click();
await tb('Texto no menu').fill(`Ouvidoria E2E ${sx}`);
await page.getByLabel('Uma página').check();
await cb('Página').selectOption({ label: 'Ouvidoria (/ouvidoria)' });
await page.getByRole('button', { name: 'Salvar item' }).click();
espera('item novo no menu', await ve(page.locator('.arvore strong', { hasText: `Ouvidoria E2E ${sx}` })));
espera('item aparece no menu do portal', (await texto(`${PORTAL}/`)).includes(`Ouvidoria E2E ${sx}`));

console.log('\nTransparência');
await page.goto(`${PAINEL}/transparencia`);
const botaoItem = page.getByRole('button', { name: /^\+ Item em / }).first();
espera('central com seções', await ve(botaoItem));
await botaoItem.click();
await tb('Título').fill(`Relatório E2E ${sx}`);
await page.getByLabel('Um endereço', { exact: true }).check();
await tb('Endereço').fill('https://www.example.com/relatorio');
await page.getByRole('button', { name: 'Salvar item' }).click();
espera('item criado na seção', await ve(page.locator('.lista-filhos strong', { hasText: `Relatório E2E ${sx}` })));
espera('item aparece na Transparência do portal', (await texto(`${PORTAL}/transparencia`)).includes(`Relatório E2E ${sx}`));

console.log('\nSistemas');
await page.goto(`${PAINEL}/sistemas`);
await page.getByRole('button', { name: 'Novo sistema' }).click();
await tb('Nome').fill(`Sistema E2E ${sx}`);
await tb('Endereço').fill('ftp://errado');
await page.getByRole('button', { name: 'Salvar sistema' }).click();
espera('endereço inválido recusado', await ve(page.getByRole('alert').filter({ hasText: 'http' })));
await tb('Endereço').fill('https://www.example.com/sistema');
await page.getByRole('button', { name: 'Salvar sistema' }).click();
espera('sistema criado', await ve(page.locator('td', { hasText: `Sistema E2E ${sx}` }).first()));

console.log('\nIdentidade visual');
await page.goto(`${PAINEL}/identidade`);
await tb('Cor principal (cabeçalho)').waitFor();
const corOriginal = await tb('Cor principal (cabeçalho)').inputValue();
const sloganOriginal = await tb('Slogan / descrição').inputValue();
await tb('Cor principal (cabeçalho)').fill('#ffff00');
espera('aviso de contraste ruim na hora', await ve(page.getByText(/abaixo do mínimo/).first()));
await page.getByRole('button', { name: 'Salvar identidade' }).click();
espera('cor clara demais é recusada', await ve(page.getByRole('alert').filter({ hasText: 'clara demais' })));
const temLayout = await page.getByRole('heading', { name: 'Cores do layout' }).isVisible();
if (temLayout) {
  await tb('Cor principal (cabeçalho)').fill(corOriginal);
  const acento = tb('Cor de acento (botão do destaque, faixa de aviso)');
  const acentoOriginal = await acento.inputValue();
  await acento.fill(corOriginal);
  espera('cor do layout com contraste ruim é apontada', await ve(page.getByText('Contraste insuficiente')));
  await page.getByRole('button', { name: 'Salvar identidade' }).click();
  espera('cor do layout ruim impede salvar', await ve(page.getByRole('alert').filter({ hasText: 'Ajuste as cores do layout' })));
  await acento.fill(acentoOriginal);
}
// Uma variação mínima da cor original, para conferir que o portal aplica a mudança.
const corTeste = corOriginal.toLowerCase() === '#004349' ? '#004348' : '#004349';
await tb('Cor principal (cabeçalho)').fill(corTeste);
await tb('Slogan / descrição').fill(`Slogan E2E ${sx}`);
await page.getByRole('button', { name: 'Salvar identidade' }).click();
espera('identidade salva', await sucesso('Identidade salva'));
await page.screenshot({ path: `${OUT}/e1-identidade.png`, fullPage: true });
let aplicou = false; // o portal guarda os dados da organização por até 60 s
for (let i = 0; i < 14 && !aplicou; i++) { aplicou = (await texto(`${PORTAL}/`)).includes(`--cor-primaria:${corTeste}`); if (!aplicou) await aguardar(5000); }
espera('nova cor aplicada no portal (até 60 s)', aplicou);
await tb('Cor principal (cabeçalho)').fill(corOriginal);
await tb('Slogan / descrição').fill(sloganOriginal);
await page.getByRole('button', { name: 'Salvar identidade' }).click();
espera('identidade original restaurada', await sucesso('Identidade salva'));

console.log('\nCategorias');
await page.goto(`${PAINEL}/categorias`);
await tb('Nova categoria').fill(`Cultura E2E ${sx}`);
await page.getByRole('button', { name: 'Adicionar' }).click();
espera('categoria criada', await ve(page.locator('.lista-filhos strong', { hasText: `Cultura E2E ${sx}` })));
await page.getByRole('button', { name: `Excluir Cultura E2E ${sx}` }).click();
espera('categoria excluída', await page.locator('.lista-filhos strong', { hasText: `Cultura E2E ${sx}` }).waitFor({ state: 'detached', timeout: 10000 }).then(() => true).catch(() => false));

console.log('\nRedirecionamentos');
await page.goto(`${PAINEL}/redirecionamentos`);
await tb('Endereço antigo').fill(`https://site-antigo.exemplo/Pagina-Velha-E2E-${sx}/`);
await tb('Leva para').fill('/servicos');
await page.getByRole('button', { name: 'Criar' }).click();
espera('redirecionamento criado e normalizado', await sucesso(`/pagina-velha-e2e-${sx}/`));
const r = await fetch(`${PORTAL}/pagina-velha-e2e-${sx}/`, { redirect: 'manual' });
espera('portal responde 301 para /servicos', r.status === 301 && (r.headers.get('location') ?? '').endsWith('/servicos'));
const csv = `endereco antigo;destino;tipo\n/lote-e2e-${sx}/a.html;/noticias;301\n/lote-e2e-${sx}/b;sem-barra\n/lote-e2e-${sx}/c;;410\n`;
await page.locator('[aria-labelledby=t-importar-redir] input[type=file]').setInputFiles({ name: 'lista.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
espera('importação mostra 2 linhas prontas e 1 com problema', await ve(page.getByText(/2 linhas prontas para importar; 1 com problema/)));
await page.getByRole('button', { name: 'Importar 2' }).click();
espera('lista importada', await sucesso('2 linhas processadas'));
espera('portal responde 410 para o endereço removido', (await fetch(`${PORTAL}/lote-e2e-${sx}/c`, { redirect: 'manual' })).status === 410);

console.log('\nRedator não acessa a estrutura');
await sair(page);
await entrar(page, CONTAS.redator);
espera('menu do redator sem "Menus"', !(await page.getByRole('link', { name: 'Menus' }).isVisible()));
await page.goto(`${PAINEL}/identidade`);
await page.waitForTimeout(1500);
espera('redator é mandado para o início ao abrir /identidade', new URL(page.url()).pathname === '/');

espera(`sem erros no console${page.erros.length ? ': ' + page.erros.slice(0, 3).join(' | ') : ''}`, page.erros.length === 0);
await fim(browser, `sufixo ${sx}`);
