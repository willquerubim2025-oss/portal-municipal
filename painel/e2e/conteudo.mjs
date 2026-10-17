// Bateria 2: documentos, páginas, serviços, agenda, perguntas e avisos, e o que aparece no portal.
import { CONTAS, OUT, PAINEL, PORTAL, abrirNavegador, aguardar, entrar, novaPagina, placar, sair, status, sufixo, texto, ve } from './comum.mjs';

const { espera, fim } = placar();
const sx = sufixo();
const browser = await abrirNavegador();
const page = await novaPagina(browser);
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
const endereco = () => page.getByRole('textbox', { name: 'Endereço no site', exact: true }).inputValue();

await entrar(page, CONTAS.admin);

console.log('Documentos');
async function novoDocumento(tipo, titulo) {
  await page.goto(`${PAINEL}/documentos/novo`);
  await page.getByRole('heading', { level: 1, name: 'Novo documento' }).waitFor();
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption({ label: tipo });
  await campo('Título').fill(titulo);
  await page.getByLabel('Número', { exact: true }).fill(sx);
  await page.getByLabel('Data do documento', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Ementa', { exact: true }).fill('Documento criado pelo teste automático.');
  await page.getByRole('combobox', { name: 'Situação de vigência', exact: true }).selectOption('vigente');
  return salvarRascunho();
}
espera('resolução salva como rascunho', await novoDocumento('Resoluções', `Resolução E2E nº ${sx}/2026`));
espera('resolução publicada', await publicar('Documento publicado'));
espera('portaria salva como rascunho', await novoDocumento('Portarias', `Portaria E2E nº ${sx}/2026`));
const urlDoc = page.url();
await page.getByLabel('Nome do arquivo no site', { exact: true }).fill('Íntegra da portaria');
await page.getByLabel('ou endereço externo', { exact: true }).fill('https://www.example.com/portaria.pdf');
await page.getByRole('button', { name: 'Anexar' }).click();
espera('arquivo (link externo) anexado', await ve(page.locator('#t-arquivos ~ ol a', { hasText: 'Íntegra da portaria' })));
await page.getByRole('combobox', { name: 'Este documento', exact: true }).selectOption('regulamenta');
await page.getByLabel('Buscar documento', { exact: true }).fill(`Resolução E2E nº ${sx}`);
await page.getByRole('button', { name: `Resolução E2E nº ${sx}/2026` }).click();
espera('relação "regulamenta" registrada', await ve(page.locator('.lista-filhos li', { hasText: 'Regulamenta' })));
espera('portaria publicada', await publicar('Documento publicado'));
const slugDoc = await endereco();
await page.screenshot({ path: `${OUT}/c1-documento.png`, fullPage: true });

console.log('\nPáginas');
await page.goto(`${PAINEL}/paginas/novo`);
await campo('Título').fill(`Histórico E2E ${sx}`);
await page.getByRole('combobox', { name: 'Página-mãe', exact: true }).selectOption({ label: 'Sobre a Secretaria (/sobre)' });
espera('endereço hierárquico montado', (await page.getByText(/Endereço completo:/).textContent()).includes(`/sobre/historico-e2e-${sx}`));
espera('página salva', await salvarRascunho());
espera('página publicada', await publicar('Página publicada'));

console.log('\nServiços');
await page.goto(`${PAINEL}/servicos/novo`);
await campo('Nome do serviço').fill(`Transporte escolar E2E ${sx}`);
await page.getByLabel('O que é', { exact: true }).fill('Serviço de teste.');
await page.getByLabel('Prazo', { exact: true }).fill('15 dias úteis');
await page.getByLabel('Link do serviço on-line', { exact: true }).fill('ftp://errado');
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
espera('link inválido é recusado', await ve(page.getByRole('alert').filter({ hasText: 'https://' })));
await page.getByLabel('Link do serviço on-line', { exact: true }).fill('https://www.example.com/transporte');
espera('serviço salvo', await salvarRascunho());
espera('serviço publicado', await publicar('Serviço publicado'));
const slugServ = await endereco();

console.log('\nAgenda');
await page.goto(`${PAINEL}/eventos/novo`);
await campo('Nome do evento').fill(`Feira de ciências E2E ${sx}`);
await page.getByLabel(/^Início/).fill('2026-12-10T09:00');
await page.getByLabel('Término', { exact: true }).fill('2026-12-09T09:00');
await page.getByRole('button', { name: 'Salvar rascunho' }).click();
espera('término antes do início é recusado', await ve(page.getByRole('alert').filter({ hasText: 'término' })));
await page.getByLabel('Término', { exact: true }).fill('2026-12-10T17:00');
await page.getByLabel('Local', { exact: true }).fill('Ginásio municipal');
espera('evento salvo', await salvarRascunho());
espera('evento publicado', await publicar('Evento publicado'));
const slugEvento = await endereco();

console.log('\nPerguntas frequentes');
await page.goto(`${PAINEL}/perguntas/novo`);
await campo('Pergunta').fill(`Pergunta E2E ${sx}?`);
await page.getByRole('textbox', { name: 'Resposta' }).click();
await page.keyboard.type('Resposta do teste automático.');
espera('pergunta salva', await salvarRascunho());
espera('pergunta publicada', await publicar('Pergunta publicada'));

console.log('\nBanners e avisos');
await page.goto(`${PAINEL}/destaques/novo`);
await campo('Título').fill(`Aviso E2E ${sx}`);
espera('banner salvo sem imagem (rascunho pode)', await salvarRascunho());
await page.getByRole('button', { name: 'Publicar agora' }).click();
espera('banner sem imagem NÃO é publicado (mensagem clara)', await ve(page.getByRole('alert').filter({ hasText: 'envie a imagem' })));
await page.getByLabel(/Alerta em faixa/).check();
await page.getByLabel('Texto', { exact: true }).fill('teste automático de aviso');
await page.getByRole('combobox', { name: 'Nível', exact: true }).selectOption('informativo');
const avisoNoAr = await publicar('No ar');
if (!avisoNoAr) console.log('    tela:', await page.getByRole('alert').allInnerTexts(), await page.getByRole('status').allInnerTexts());
espera('aviso em faixa publicado', avisoNoAr);

console.log('\nRedator (permissões)');
await sair(page);
await entrar(page, CONTAS.redator);
await page.goto(`${PAINEL}/servicos/novo`);
await campo('Nome do serviço').fill(`Serviço do redator E2E ${sx}`);
espera('redator salva serviço como rascunho', await salvarRascunho());
espera('redator não vê "Publicar agora"', !(await page.getByRole('button', { name: 'Publicar agora' }).isVisible()));
await page.goto(urlDoc);
espera('documento publicado fica só leitura para o redator', await ve(page.getByRole('note').filter({ hasText: 'Só um publicador' })));
espera('redator não vê "Anexar" no documento publicado', !(await page.getByRole('button', { name: 'Anexar' }).isVisible()));

console.log('\nPortal (o que foi publicado aparece no site)');
await aguardar(1500);
espera(`documento no portal: /documentos/${slugDoc}`, (await status(`${PORTAL}/documentos/${slugDoc}`)) === 200);
espera('página filha no portal', (await status(`${PORTAL}/sobre/historico-e2e-${sx}`)) === 200);
espera('serviço no portal', (await status(`${PORTAL}/servicos/${slugServ}`)) === 200);
espera('evento no portal', (await status(`${PORTAL}/eventos/${slugEvento}`)) === 200);
espera('aviso em faixa aparece no portal', (await texto(`${PORTAL}/`)).includes(`Aviso E2E ${sx}`));
espera('relação aparece no portal ("Regulamenta")', (await texto(`${PORTAL}/documentos/${slugDoc}`)).includes('Regulamenta'));

espera(`sem erros no console${page.erros.length ? ': ' + page.erros.slice(0, 3).join(' | ') : ''}`, page.erros.length === 0);
await fim(browser, `sufixo ${sx}`);
