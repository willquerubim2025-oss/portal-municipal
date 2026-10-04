// Auditoria automática de acessibilidade (axe-core, WCAG 2.x A e AA, base do eMAG).
// Só lê: não cria nem altera nada. Roda contra a homologação publicada por padrão.
//   node e2e/acessibilidade.mjs
//   PORTAL_URL=http://localhost:4321 PAINEL_URL=http://localhost:5190 node e2e/acessibilidade.mjs
// O axe acha ~30–40% dos problemas de acessibilidade; o resto exige teste manual
// (leitor de tela, só teclado). Ver docs/07-pendencias.md.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTAL = process.env.PORTAL_URL ?? 'https://portal-municipal-homologacao.portal-municipal.workers.dev';
const PAINEL = process.env.PAINEL_URL ?? 'https://painel-municipal-homologacao.portal-municipal.workers.dev';
const SENHA = 'Teste@Homologacao2026';
const REGRAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'relatorios');
fs.mkdirSync(PASTA, { recursive: true });

const resultados = []; // { onde, url, violacoes: [{ id, impacto, ajuda, nos, exemplos }] }

async function auditar(page, onde) {
  await page.waitForLoadState('networkidle').catch(() => {});
  const r = await new AxeBuilder({ page }).withTags(REGRAS).analyze();
  const violacoes = r.violations.map((v) => ({
    id: v.id, impacto: v.impact, ajuda: v.help, nos: v.nodes.length,
    exemplos: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} → ${(n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim()}`),
  }));
  resultados.push({ onde, url: page.url(), violacoes });
  const n = violacoes.reduce((s, v) => s + v.nos, 0);
  console.log(`${violacoes.length ? '  ✘' : '  ✔'} ${onde}${violacoes.length ? `: ${violacoes.map((v) => `${v.id} (${v.nos})`).join(', ')}` : ''}`);
  return n;
}

/** Primeiro link da página que casa com o padrão (para abrir um item de exemplo). */
async function primeiroLink(page, padrao) {
  const hrefs = await page.$$eval('main a[href]', (as) => as.map((a) => a.getAttribute('href')));
  return hrefs.find((h) => padrao.test(h ?? ''));
}

const browser = await chromium.launch();

// ------------------------------------------------------------------ portal
const PAGINAS_PORTAL = ['/', '/noticias', '/documentos', '/legislacao', '/servicos', '/eventos', '/perguntas-frequentes',
  '/estrutura-organizacional', '/transparencia', '/busca?q=saude', '/o-municipio', '/o-municipio/historia', '/departamentos',
  '/fale-conosco', '/acessibilidade', '/mapa-do-site', '/pagina-que-nao-existe'];

for (const [rotulo, contexto] of [
  ['computador', { viewport: { width: 1366, height: 900 } }],
  ['celular', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  for (const contraste of [false, true]) {
    console.log(`\nPortal (${rotulo}${contraste ? ', alto contraste' : ''})`);
    const ctx = await browser.newContext({ ...contexto, locale: 'pt-BR' });
    if (contraste) await ctx.addInitScript(() => { try { localStorage.setItem('contraste', '1'); } catch {} });
    const page = await ctx.newPage();
    const paginas = [...PAGINAS_PORTAL];
    // Um exemplo de notícia e de documento (os mais recentes).
    await page.goto(`${PORTAL}/noticias`);
    const noticia = await primeiroLink(page, /^\/noticias\/[^/?]+$/);
    await page.goto(`${PORTAL}/documentos`);
    const documento = await primeiroLink(page, /^\/documentos\/[^/?]+$/);
    if (noticia) paginas.splice(2, 0, noticia);
    if (documento) paginas.splice(4, 0, documento);
    // Celular e alto contraste: só as páginas de modelo diferente (o resto repete o layout).
    const lista = rotulo === 'celular' || contraste ? paginas.filter((p) => ['/', '/noticias', noticia, '/documentos', documento, '/transparencia'].includes(p)) : paginas;
    for (const p of lista) {
      await page.goto(`${PORTAL}${p}`);
      await auditar(page, `portal ${rotulo}${contraste ? ' contraste' : ''} ${p}`);
    }
    await ctx.close();
  }
}

// ------------------------------------------------------------------ painel
console.log('\nPainel (admin)');
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
const page = await ctx.newPage();
await page.goto(`${PAINEL}/entrar`);
await auditar(page, 'painel /entrar');
await page.goto(`${PAINEL}/esqueci-senha`);
await auditar(page, 'painel /esqueci-senha');
await page.goto(`${PAINEL}/entrar`);
await page.getByLabel('E-mail').fill('admin.teste@exemplo.gov.br');
await page.getByLabel('Senha').fill(SENHA);
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('heading', { level: 1, name: /Olá/ }).waitFor({ timeout: 20000 });

const TELAS = ['/', '/noticias', '/noticias/nova', '/documentos', '/documentos/novo', '/paginas', '/paginas/novo', '/servicos',
  '/servicos/novo', '/eventos', '/eventos/novo', '/perguntas', '/perguntas/novo', '/destaques', '/destaques/novo', '/orgaos',
  '/orgaos/novo', '/menus', '/transparencia', '/pntp', '/identidade', '/categorias', '/redirecionamentos', '/usuarios', '/chamados',
  '/chamados/novo', '/auditoria', '/links', '/exportar'];
for (const t of TELAS) {
  await page.goto(`${PAINEL}${t}`);
  // Telas que carregam dados: espera o "Carregando…" sumir.
  await page.getByText('Carregando…').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await auditar(page, `painel ${t}`);
}
// Um item existente aberto para edição (formulário completo, com editor de texto).
await page.goto(`${PAINEL}/noticias`);
const item = await page.locator('main a[href^="/noticias/"]').filter({ hasNotText: /nova/i }).first().getAttribute('href').catch(() => null);
if (item) { await page.goto(`${PAINEL}${item}`); await page.getByText('Carregando…').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {}); await auditar(page, `painel ${item} (edição)`); }
await browser.close();

// ------------------------------------------------------------------ relatório
const porRegra = new Map();
for (const r of resultados) for (const v of r.violacoes) {
  const a = porRegra.get(v.id) ?? { ...v, paginas: [], total: 0 };
  a.paginas.push(r.onde); a.total += v.nos; porRegra.set(v.id, a);
}
const ordem = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const regras = [...porRegra.values()].sort((a, b) => ordem[a.impacto] - ordem[b.impacto] || b.total - a.total);
const linhas = [
  `# Auditoria automática de acessibilidade`, '',
  `${new Date().toLocaleString('pt-BR')} · axe-core · regras ${REGRAS.join(', ')}`,
  `Portal: ${PORTAL} · Painel: ${PAINEL}`, '',
  `**${resultados.length} páginas auditadas; ${resultados.filter((r) => r.violacoes.length).length} com problema; ${regras.length} tipos de problema.**`, '',
  ...regras.flatMap((v) => [
    `## ${v.id} (${v.impacto}): ${v.ajuda}`,
    `- Ocorrências: ${v.total}, em ${v.paginas.length} página(s): ${v.paginas.slice(0, 8).join('; ')}${v.paginas.length > 8 ? '…' : ''}`,
    ...v.exemplos.map((e) => `- Exemplo: \`${e.replace(/`/g, "'")}\``), '',
  ]),
];
const arq = path.join(PASTA, 'acessibilidade.md');
fs.writeFileSync(arq, linhas.join('\n'));
console.log(`\n${resultados.length} páginas, ${regras.length} tipos de problema. Relatório: ${path.relative(process.cwd(), arq)}`);
process.exit(regras.length ? 1 : 0);
