// Bateria 1: login e notícias (rascunho do redator, publicação pelo administrador, imagem e galeria).
import { CONTAS, OUT, PAINEL, abrirNavegador, entrar, novaPagina, placar, sair, sufixo, ve } from './comum.mjs';

const { espera, fim } = placar();
const titulo = `Teste E2E ${sufixo()}`;
// PNG 2x2 válido para testar o envio de imagem.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');

const browser = await abrirNavegador();
const page = await novaPagina(browser, { ignorar: /status of 400/ });

console.log('Acesso');
await page.goto(PAINEL);
await page.waitForURL(/\/entrar/);
espera('sem sessão vai para /entrar', page.url().includes('/entrar'));
await page.getByLabel('E-mail', { exact: true }).fill(CONTAS.redator.email);
await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
await page.getByRole('button', { name: 'Entrar' }).click();
espera('senha errada mostra erro', await ve(page.getByRole('alert').filter({ hasText: 'incorretos' }), 10000));

console.log('\nRedator (conteudo.editar)');
await entrar(page, CONTAS.redator);
espera('redator entra e vê o início', true);
espera('redator não vê "Identidade visual" nem "Papéis" no menu',
  !(await page.getByRole('link', { name: 'Identidade visual e dados' }).isVisible()) && !(await page.getByRole('link', { name: 'Papéis e permissões' }).isVisible()));
await page.getByRole('link', { name: 'Notícias e avisos' }).click();
await page.getByRole('link', { name: 'Nova notícia' }).click();
await page.getByRole('textbox', { name: 'Título', exact: true }).fill(titulo);
espera('endereço gerado a partir do título', (await page.getByLabel('Endereço no site').inputValue()).startsWith('teste-e2e-'));
await page.getByLabel(/^Resumo/).fill('Resumo criado pelo teste automático.');
await page.getByRole('textbox', { name: 'Texto da notícia' }).click();
await page.keyboard.type('Primeiro parágrafo do teste.');
await page.getByRole('button', { name: 'Negrito' }).click();
await page.keyboard.type(' Trecho em negrito.');
espera('redator não vê "Publicar agora"', !(await page.getByRole('button', { name: 'Publicar agora' }).isVisible()));
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
await page.waitForURL(/\/noticias\/[0-9a-f-]{36}$/, { timeout: 15000 });
espera('rascunho salvo', await ve(page.getByRole('status').filter({ hasText: 'Alterações salvas' }), 10000));
const urlRascunho = page.url();
espera('redator gera o link de pré-visualização', await page.getByRole('button', { name: /Pré-visualizar/ }).isVisible());
await page.screenshot({ path: `${OUT}/n1-rascunho-redator.png`, fullPage: true });

// Notícia já publicada fica só leitura para quem não publica.
await page.goto(`${PAINEL}/noticias?situacao=publicado`);
await page.locator('table.tabela tbody a').first().click();
espera('publicada fica bloqueada para o redator', await ve(page.getByRole('note').filter({ hasText: 'Só um publicador' }), 10000));
espera('campo título desabilitado', await page.getByRole('textbox', { name: 'Título', exact: true }).isDisabled());
await sair(page);

console.log('\nAdministrador');
await entrar(page, CONTAS.admin);
espera('administrador vê "Identidade visual" no menu', await page.getByRole('link', { name: 'Identidade visual e dados' }).isVisible());
await page.goto(urlRascunho);
await page.getByRole('textbox', { name: 'Título', exact: true }).waitFor();
await page.locator('fieldset.campo-imagem input[type=file]').setInputFiles({ name: 'foto teste.png', mimeType: 'image/png', buffer: png });
await page.getByRole('button', { name: 'Enviar imagem' }).click();
espera('sem texto alternativo a imagem é recusada', await ve(page.getByRole('alert').filter({ hasText: 'texto alternativo' }), 5000));
await page.getByLabel(/Descreva a imagem/).fill('Imagem de teste automático');
await page.getByRole('button', { name: 'Enviar imagem' }).click();
espera('imagem enviada ao Storage', await ve(page.locator('.imagem-atual img'), 15000));
const categoria = page.locator('fieldset', { has: page.getByText('Categorias', { exact: true }) }).getByRole('checkbox').first();
if (await categoria.isVisible()) await categoria.check();
await page.getByRole('button', { name: 'Publicar agora' }).click();
espera('administrador publica', await ve(page.getByRole('status').filter({ hasText: 'Notícia publicada' }), 15000));
espera('etiqueta Publicado', await page.locator('.etiqueta-publicado').first().isVisible());
espera('endereço travado depois de publicar', await page.getByLabel('Endereço no site').evaluate((e) => e.readOnly));
await page.screenshot({ path: `${OUT}/n2-publicada-admin.png`, fullPage: true });

await page.locator('.nova-foto input[type=file]').setInputFiles({ name: 'galeria.png', mimeType: 'image/png', buffer: png });
await page.getByLabel(/Descrição da foto/).fill('Foto da galeria de teste');
await page.getByRole('button', { name: 'Adicionar à galeria' }).click();
espera('foto adicionada à galeria', await ve(page.locator('.galeria-editor li img').first(), 15000));

await page.getByRole('button', { name: 'Retirar do site' }).click();
espera('administrador retira do site', await ve(page.getByRole('status').filter({ hasText: 'retirada do site' }), 15000));
await page.goto(`${PAINEL}/noticias?situacao=despublicado`);
espera('filtro por situação encontra a notícia', await ve(page.getByRole('link', { name: titulo }), 10000));

espera(`sem erros no console${page.erros.length ? ': ' + page.erros.slice(0, 3).join(' | ') : ''}`, page.erros.length === 0);
await fim(browser, `título: ${titulo}`);
