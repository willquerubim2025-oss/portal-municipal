// Bateria 5: notícia da unidade (permissões, fase 1C, D-97). A conta da escola (preparar.mjs) tem
// conteudo.publicar só na própria unidade: escreve e publica as notícias dela e não vê o resto.
import { CONTAS, PAINEL, PORTAL, abrirNavegador, aguardar, entrar, novaPagina, placar, sair, status, sufixo, texto, ve } from './comum.mjs';

const { espera, fim } = placar();
const sx = sufixo();
const titulo = `Feira da escola E2E ${sx}`;
const browser = await abrirNavegador();
const page = await novaPagina(browser);

console.log('Conta da escola');
await entrar(page, CONTAS.escola);
espera('menu mostra "Notícias e avisos"', await page.getByRole('link', { name: 'Notícias e avisos' }).isVisible());
espera('menu NÃO mostra Páginas, Documentos nem Identidade visual',
  !(await page.getByRole('link', { name: 'Páginas' }).isVisible()) && !(await page.getByRole('link', { name: 'Documentos e legislação' }).isVisible())
  && !(await page.getByRole('link', { name: 'Identidade visual e dados' }).isVisible()));
await page.goto(`${PAINEL}/paginas`);
await page.waitForTimeout(1500);
espera('abrir /paginas manda de volta ao início', new URL(page.url()).pathname === '/');

await page.goto(`${PAINEL}/noticias`);
await page.getByRole('link', { name: 'Nova notícia' }).click();
const unidade = page.getByRole('combobox', { name: /^Unidade/ });
espera('notícia nova já vem com a unidade da escola', await ve(unidade) && (await unidade.inputValue()) !== '');
espera('só a unidade dela na lista (sem "notícia da organização")', !(await unidade.locator('option', { hasText: 'Nenhuma' }).count()));
espera('sem "Destacar na página inicial"', !(await page.getByLabel('Destacar na página inicial').isVisible()));
const nomeUnidade = (await unidade.locator('option:checked').textContent())?.trim();
await page.getByRole('textbox', { name: 'Título', exact: true }).fill(titulo);
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
await page.waitForURL(/\/noticias\/[0-9a-f-]{36}$/, { timeout: 15000 });
espera('rascunho da escola salvo', await ve(page.getByRole('status').filter({ hasText: 'Alterações salvas' })));
espera('a escola vê "Publicar agora" na notícia dela', await page.getByRole('button', { name: 'Publicar agora' }).isVisible());
await page.getByRole('button', { name: 'Publicar agora' }).click();
espera('a escola publica a notícia dela', await ve(page.getByRole('status').filter({ hasText: 'Notícia publicada' })));
const slug = await page.getByRole('textbox', { name: 'Endereço no site', exact: true }).inputValue();

await page.goto(`${PAINEL}/noticias`);
await page.locator('table.tabela tbody tr').first().waitFor();
const linhas = await page.locator('table.tabela tbody tr').allInnerTexts();
espera(`a lista mostra só notícias da unidade (${linhas.length})`, linhas.every((l) => l.includes(nomeUnidade ?? '???')));

console.log('\nPortal');
await aguardar(1500);
espera('notícia da escola no portal', (await status(`${PORTAL}/noticias/${slug}`)) === 200);
espera('a página mostra o nome da unidade', (await texto(`${PORTAL}/noticias/${slug}`)).includes(nomeUnidade ?? '???'));
await sair(page);

console.log('\nAdministrador vê e marca unidades');
await entrar(page, CONTAS.admin);
await page.goto(`${PAINEL}/noticias?q=${encodeURIComponent(titulo)}`);
espera('administrador vê a notícia da escola', await ve(page.getByRole('link', { name: titulo })));
await page.getByRole('link', { name: 'Nova notícia' }).click();
const unidadeAdm = page.getByRole('combobox', { name: /^Unidade/ });
espera('para a rede a unidade é opcional ("notícia da organização")', await ve(unidadeAdm) && (await unidadeAdm.inputValue()) === '');

espera(`sem erros no console${page.erros.length ? ': ' + page.erros.slice(0, 3).join(' | ') : ''}`, page.erros.length === 0);
await fim(browser, `título: ${titulo}`);
