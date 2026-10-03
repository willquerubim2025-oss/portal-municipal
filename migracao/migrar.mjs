// Migração WordPress → Portal Municipal (D-22). Genérica: o específico de cada prefeitura vem do mapa.
// Repetível: cada registro é localizado por legado.wp_id e atualizado (não duplica).
//
// Uso:
//   node migrar.mjs --mapa mapas/jeriquara.json --inventario ../inventario-bruto.json [--noticias 50] [--documentos 50] [--todos]
// Variáveis (.env): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MIGRACAO_EMAIL, MIGRACAO_SENHA
// O usuário da migração precisa ser da equipe da plataforma (SECKE) ou admin do município:
// tudo passa pelo RLS e fica na auditoria em nome dele.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { classificar, decodificar, numeroEAno, textoPlano } from './classificar.mjs';
import { preencherAlt } from './alt.mjs';

// ------------------------------------------------------------------ configuração
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
for (const linha of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const mapa = JSON.parse(fs.readFileSync(args.mapa ?? 'mapas/jeriquara.json', 'utf8'));
const inv = JSON.parse(fs.readFileSync(args.inventario ?? '../inventario-bruto.json', 'utf8'));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const PAUSA_MS = 250;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString('pt-BR'), ...a);

const relatorio = { inicio: new Date().toISOString(), noticias: 0, documentos: 0, arquivos_enviados: 0, arquivos_reaproveitados: 0, arquivos_falha: [], redirecionamentos: 0, erros: [] };

// ------------------------------------------------------------------ utilidades
const slugificar = (t) => decodificar(String(t)).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'sem-titulo';
const dataComFuso = (d) => `${d}${mapa.fuso}`;
const ehUpload = (u) => /\/wp-content\/uploads\//i.test(u);
// Endereço canônico de um arquivo: original (sem a miniatura -300x200 do WP), https e sem acento codificado.
// O mesmo arquivo aparece no WordPress com grafias diferentes; sem isso ele seria enviado duas vezes.
const urlOriginal = (u) => {
  let x = u.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1').replace(/^http:\/\//i, 'https://');
  try { x = decodeURI(x); } catch { /* já decodificado */ }
  return x;
};

function caminhoAntigo(link) {
  try { return decodeURIComponent(new URL(link).pathname).toLowerCase(); } catch { return null; }
}

/** HTML do WordPress → HTML semântico neutro (D-22): sem classes, estilos e data-*, títulos H2/H3. */
export function limparHtml(html) {
  let h = String(html ?? '');
  h = h.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<h1(\s[^>]*)?>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>')
    .replace(/<h[4-6](\s[^>]*)?>/gi, '<h3>').replace(/<\/h[4-6]>/gi, '</h3>')
    .replace(/<\/?(span|font|div|section|article|center)(\s[^>]*)?>/gi, '');
  // Mantém só atributos úteis.
  h = h.replace(/<([a-z0-9]+)(\s[^>]*?)?(\/?)>/gi, (_, tag, attrs = '', fecha) => {
    const manter = [];
    for (const m of attrs.matchAll(/([a-z-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      const nome = m[1].toLowerCase();
      if (['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'target'].includes(nome)) manter.push(`${nome}="${(m[3] ?? m[4]).replace(/"/g, '&quot;')}"`);
    }
    return `<${tag.toLowerCase()}${manter.length ? ` ${manter.join(' ')}` : ''}${fecha}>`;
  });
  h = h.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return h;
}

// ------------------------------------------------------------------ banco
let MID;
const cacheCategorias = new Map();
const cacheMidias = new Map(); // url antiga → { id, storage_path, mime_type }

async function entrar() {
  const { error } = await sb.auth.signInWithPassword({ email: process.env.MIGRACAO_EMAIL, password: process.env.MIGRACAO_SENHA });
  if (error) throw new Error(`Login da migração falhou: ${error.message}`);
  const { data, error: e2 } = await sb.from('municipios').select('id, nome').eq('slug', mapa.municipio_slug).single();
  if (e2) throw new Error(`Município ${mapa.municipio_slug} não encontrado: ${e2.message}`);
  MID = data.id;
  log(`Migrando para ${data.nome} (${MID})`);
}

async function garantirCategorias() {
  for (const [escopo, lista] of Object.entries(mapa.categorias_novas)) {
    for (const [slug, nome] of lista) {
      await sb.from('categorias').upsert({ municipio_id: MID, escopo, slug, nome }, { onConflict: 'municipio_id,escopo,slug', ignoreDuplicates: true });
    }
  }
  const { data } = await sb.from('categorias').select('id, escopo, slug').eq('municipio_id', MID);
  for (const c of data ?? []) cacheCategorias.set(`${c.escopo}:${c.slug}`, c.id);
}
const idCategoria = (escopo, slug) => {
  const id = cacheCategorias.get(`${escopo}:${slug}`);
  if (!id) throw new Error(`Categoria ${escopo}:${slug} não existe (falta no provisionamento ou em categorias_novas do mapa).`);
  return id;
};

// ------------------------------------------------------------------ arquivos
const mediaPorUrl = new Map(inv.media.map((m) => [urlOriginal(m.source_url), m]));
const mediaPorPost = new Map();
for (const m of inv.media) { if (m.post) { if (!mediaPorPost.has(m.post)) mediaPorPost.set(m.post, []); mediaPorPost.get(m.post).push(m); } }

function nomeArquivo(url) {
  const base = decodeURIComponent(url.split('/').pop().split('?')[0]);
  const ponto = base.lastIndexOf('.');
  const nome = (ponto > 0 ? base.slice(0, ponto) : base).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'arquivo';
  const ext = ponto > 0 ? base.slice(ponto + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return { original: base, seguro: ext ? `${nome}.${ext}` : nome };
}

/** Baixa um arquivo do site antigo e envia ao Storage, uma vez só (reaproveita pelo legado.url). */
async function migrarArquivo(url, titulo, dataPost) {
  url = urlOriginal(url);
  if (cacheMidias.has(url)) return cacheMidias.get(url);
  const { data: existente } = await sb.from('midias').select('id, storage_path, mime_type, texto_alternativo')
    .eq('municipio_id', MID).eq('legado->>url', url).maybeSingle();
  if (existente) { relatorio.arquivos_reaproveitados++; cacheMidias.set(url, existente); return existente; }
  // O caminho no Storage é determinístico (id da mídia no WP + nome): se já existe, reaproveita sem baixar de novo.
  const media = mediaPorUrl.get(url);
  const d = new Date(dataPost);
  const { original, seguro } = nomeArquivo(url);
  const caminho = `${MID}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/wp-${media?.id ?? Buffer.from(url).toString('base64url').slice(-10)}-${seguro}`;
  const { data: mesmoCaminho } = await sb.from('midias').select('id, storage_path, mime_type, texto_alternativo').eq('storage_path', caminho).maybeSingle();
  if (mesmoCaminho) { relatorio.arquivos_reaproveitados++; cacheMidias.set(url, mesmoCaminho); return mesmoCaminho; }
  if (args['sem-arquivos']) return null;

  await dormir(PAUSA_MS);
  let resp;
  try {
    // Nomes com acento: codificar a URL (doc 05, descoberta 4).
    resp = await fetch(encodeURI(url), { headers: { 'User-Agent': 'SECKE-Migracao/1.0 (contrato com o Municipio)' } });
  } catch (e) { relatorio.arquivos_falha.push({ url, post: titulo, erro: String(e) }); return null; }
  if (!resp.ok) { relatorio.arquivos_falha.push({ url, post: titulo, erro: `HTTP ${resp.status}` }); return null; }
  const corpo = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
  const up = await sb.storage.from('midias').upload(caminho, corpo, { contentType: mime, cacheControl: '31536000', upsert: true });
  if (up.error) { relatorio.arquivos_falha.push({ url, post: titulo, erro: up.error.message }); return null; }
  const tituloMedia = media ? textoPlano(media.title?.rendered) : '';
  const alt = mime.startsWith('image/') ? (tituloMedia && !/^(img|image|whatsapp|dsc|foto)?[-_ ]?\d/i.test(tituloMedia) ? tituloMedia : `Imagem: ${titulo}`) : null;
  const { data: midia, error } = await sb.from('midias').insert({
    municipio_id: MID, storage_path: caminho, nome_original: original, mime_type: mime, tamanho_bytes: corpo.length,
    titulo: tituloMedia || null, texto_alternativo: alt,
    legado: { wp_id: media?.id ?? null, url, alt_automatico: !!alt },
  }).select('id, storage_path, mime_type, texto_alternativo').single();
  if (error?.code === '23505') {
    // Mesmo arquivo com outra grafia de URL já migrado neste caminho: reaproveita.
    const { data: igual } = await sb.from('midias').select('id, storage_path, mime_type, texto_alternativo').eq('storage_path', caminho).single();
    relatorio.arquivos_reaproveitados++; cacheMidias.set(url, igual); return igual;
  }
  if (error) { relatorio.arquivos_falha.push({ url, post: titulo, erro: error.message }); return null; }
  relatorio.arquivos_enviados++;
  // O endereço antigo do arquivo passa a redirecionar para o novo (links externos e Google).
  const origem = caminhoAntigo(url);
  if (origem) {
    await sb.from('redirecionamentos').upsert({ municipio_id: MID, origem, destino: sb.storage.from('midias').getPublicUrl(caminho).data.publicUrl, codigo: 301 }, { onConflict: 'municipio_id,origem' });
    relatorio.redirecionamentos++;
  }
  cacheMidias.set(url, midia);
  return midia;
}

/** Todos os arquivos do post: anexados a ele + citados no HTML. */
function arquivosDoPost(post) {
  const urls = new Set((mediaPorPost.get(post.id) ?? []).map((m) => m.source_url));
  const html = post.content?.rendered ?? '';
  for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) if (ehUpload(m[1])) urls.add(urlOriginal(decodificar(m[1])));
  return [...urls];
}

// ------------------------------------------------------------------ links internos
const novoCaminho = new Map(); // caminho antigo → caminho novo (preenchido antes de migrar)

function reescreverLinks(html) {
  return html.replace(/(href|src)="([^"]+)"/gi, (todo, attr, url) => {
    const u = decodificar(url);
    if (ehUpload(u)) {
      const m = cacheMidias.get(urlOriginal(u));
      return m ? `${attr}="${sb.storage.from('midias').getPublicUrl(m.storage_path).data.publicUrl}"` : todo;
    }
    if (u.startsWith(mapa.site_antigo) || u.startsWith(mapa.site_antigo.replace('://www.', '://'))) {
      const c = caminhoAntigo(u);
      if (c && novoCaminho.has(c)) return `${attr}="${novoCaminho.get(c)}"`;
      if (c) return `${attr}="${c}"`; // relativo: o redirecionamento cuida
    }
    return todo;
  });
}

// Texto alternativo de uma mídia já migrada, pelo caminho no Storage (para imagens dentro do texto).
const altDaMidia = (caminho) => [...cacheMidias.values()].find((m) => m?.storage_path === caminho)?.texto_alternativo ?? null;

// ------------------------------------------------------------------ registros
async function localizar(tabela, wpId) {
  const { data } = await sb.from(tabela).select('id, slug').eq('municipio_id', MID).eq('legado->>wp_id', String(wpId)).maybeSingle();
  return data;
}
async function slugLivre(tabela, slug, wpId) {
  const { data } = await sb.from(tabela).select('id, legado').eq('municipio_id', MID).eq('slug', slug).maybeSingle();
  return !data || String(data.legado?.wp_id) === String(wpId) ? slug : `${slug}-${wpId}`.slice(0, 120);
}
async function gravar(tabela, wpId, linha) {
  const atual = await localizar(tabela, wpId);
  const r = atual
    ? await sb.from(tabela).update(linha).eq('id', atual.id).select('id').single()
    : await sb.from(tabela).insert(linha).select('id').single();
  if (r.error) throw new Error(`${tabela} wp ${wpId}: ${r.error.message}`);
  return r.data.id;
}

async function migrarPost(post, c) {
  const titulo = textoPlano(post.title.rendered);
  const publicadoEm = dataComFuso(post.date);
  const urls = arquivosDoPost(post);
  const midias = [];
  for (const u of urls) { const m = await migrarArquivo(u, titulo, post.date); if (m) midias.push({ url: u, ...m }); }
  const html = preencherAlt(reescreverLinks(limparHtml(post.content?.rendered)), altDaMidia, titulo);
  const texto = textoPlano(html);
  const legado = { wp_id: post.id, url: post.link, wp_categorias: post.categories };
  const tabela = c.tipo === 'documento' ? 'documentos' : 'publicacoes';
  const slug = await slugLivre(tabela, slugificar(decodeURIComponent(post.slug)), post.id);
  const destino = `/${c.tipo === 'documento' ? 'documentos' : 'noticias'}/${slug}`;

  // Arquivo já usado dentro do texto (imagem ou link) não precisa aparecer de novo.
  // Os demais anexados ao post no WordPress viram anexos (documento) ou galeria/lista (notícia):
  // sem isso, as fotos de galeria das notícias ficavam sem lugar (descoberto na rodada completa).
  const unicas = [...new Map(midias.map((m) => [m.id, m])).values()];
  const noTexto = (m) => html.includes(m.storage_path);
  const rotulo = (m) => textoPlano(mediaPorUrl.get(urlOriginal(m.url))?.title?.rendered) || nomeArquivo(urlOriginal(m.url)).original;

  let id;
  if (c.tipo === 'documento') {
    const { numero, ano } = numeroEAno(post.title.rendered, post.date);
    id = await gravar('documentos', post.id, {
      municipio_id: MID, categoria_id: idCategoria('documento', c.categoria), titulo, slug, numero, ano,
      data_documento: post.date.slice(0, 10), ementa: texto ? texto.slice(0, 500) : null, descricao_html: html || null,
      metadados: c.modalidade ? { modalidade: c.modalidade } : {}, status: 'publicado', publicado_em: publicadoEm, legado,
    });
    // Todo arquivo anexado e não citado no texto vira anexo (PDF, ZIP, DOC e também imagens escaneadas).
    const anexos = unicas.filter((m) => !noTexto(m));
    await sb.from('documento_arquivos').delete().eq('documento_id', id);
    if (anexos.length) {
      const { error } = await sb.from('documento_arquivos').insert(anexos.map((m, i) => ({
        documento_id: id, midia_id: m.id, ordem: i, rotulo: rotulo(m),
      })));
      if (error) relatorio.erros.push({ wp: post.id, erro: `anexos: ${error.message}` });
    }
    relatorio.documentos++;
  } else {
    const imagens = unicas.filter((m) => m.mime_type.startsWith('image/'));
    const destaque = imagens[0] ?? null;
    // Galeria: fotos anexadas que não são a de destaque nem aparecem no texto.
    const galeria = imagens.filter((m) => m.id !== destaque?.id && !noTexto(m));
    // PDFs e outros arquivos anexados à notícia e não citados no texto: lista "Arquivos" no fim.
    const outros = unicas.filter((m) => !m.mime_type.startsWith('image/') && !noTexto(m));
    const publica = (m) => sb.storage.from('midias').getPublicUrl(m.storage_path).data.publicUrl;
    const corpo = outros.length
      ? `${html}\n<h2>Arquivos</h2>\n<ul>${outros.map((m) => `<li><a href="${publica(m)}">${rotulo(m).replace(/</g, '&lt;')}</a></li>`).join('')}</ul>`
      : html;
    id = await gravar('publicacoes', post.id, {
      municipio_id: MID, tipo: /^AVISO\b/i.test(titulo) ? 'aviso' : 'noticia', titulo, slug,
      resumo: texto ? (texto.length > 250 ? `${texto.slice(0, 247).replace(/\s+\S*$/, '')}…` : texto) : null,
      corpo_html: corpo || null, imagem_destaque_id: destaque?.id ?? null, status: 'publicado', publicado_em: publicadoEm,
      // Arquivo (ex.: boletins da Covid): sai das listagens logo após a publicação; o link continua.
      expira_em: c.arquivo ? new Date(new Date(publicadoEm).getTime() + 60_000).toISOString() : null,
      legado,
    });
    await sb.from('publicacao_categorias').delete().eq('publicacao_id', id);
    await sb.from('publicacao_categorias').insert((c.categoriasNoticia ?? []).map((s) => ({ publicacao_id: id, categoria_id: idCategoria('publicacao', s) })));
    await sb.from('publicacao_midias').delete().eq('publicacao_id', id);
    if (galeria.length) {
      const { error } = await sb.from('publicacao_midias').insert(galeria.map((m, i) => ({ municipio_id: MID, publicacao_id: id, midia_id: m.id, ordem: i })));
      if (error) relatorio.erros.push({ wp: post.id, erro: `galeria: ${error.message}` });
      relatorio.fotos_galeria = (relatorio.fotos_galeria ?? 0) + galeria.length;
    }
    relatorio.noticias++;
  }
  const origem = caminhoAntigo(post.link);
  if (origem && origem !== destino) {
    await sb.from('redirecionamentos').upsert({ municipio_id: MID, origem, destino, codigo: 301 }, { onConflict: 'municipio_id,origem' });
    relatorio.redirecionamentos++;
  }
}

// ------------------------------------------------------------------ páginas (D-29)
// Etapa própria (--paginas): o mapa diz quais páginas do WordPress migram e para qual caminho,
// quais páginas novas as agrupam (pais) e para onde vai cada endereço antigo sem conteúdo ou duplicado.
const semBarra = (c) => (c.length > 1 ? c.replace(/\/+$/, '') : c);

async function gravarPagina(caminho, linha, wpId) {
  // O pai é a página do caminho acima (a/b → a); precisa existir antes (pais e ordem do mapa).
  const acima = caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/')) : null;
  let parent_id = null;
  if (acima) {
    const { data } = await sb.from('paginas').select('id').eq('municipio_id', MID).eq('caminho', acima).maybeSingle();
    if (!data) throw new Error(`página ${caminho}: a página-pai ${acima} não existe`);
    parent_id = data.id;
  }
  const atual = wpId
    ? await localizar('paginas', wpId)
    : (await sb.from('paginas').select('id').eq('municipio_id', MID).eq('caminho', caminho).maybeSingle()).data;
  const valores = { municipio_id: MID, caminho, parent_id, ...linha };
  const r = atual
    ? await sb.from('paginas').update(valores).eq('id', atual.id).select('id').single()
    : await sb.from('paginas').insert(valores).select('id').single();
  if (r.error) throw new Error(`página ${caminho}: ${r.error.message}`);
  return r.data.id;
}

async function redirecionar(origem, destino) {
  if (!origem || semBarra(origem) === semBarra(destino)) return;
  const { error } = await sb.from('redirecionamentos').upsert({ municipio_id: MID, origem, destino, codigo: 301 }, { onConflict: 'municipio_id,origem' });
  if (error) relatorio.erros.push({ origem, erro: `redirecionamento: ${error.message}` });
  else relatorio.redirecionamentos++;
}

async function migrarPaginas() {
  const cfg = mapa.paginas;
  if (!cfg) throw new Error('O mapa não tem a seção "paginas".');
  const porId = new Map(inv.pages.map((p) => [p.id, p]));
  for (const m of cfg.migrar) {
    const c0 = porId.has(m.wp) ? caminhoAntigo(porId.get(m.wp).link) : null;
    if (c0) novoCaminho.set(c0, `/${m.caminho}`);
  }
  for (const [o, d] of Object.entries(cfg.redirecionar ?? {})) if (!/^https?:/.test(d)) novoCaminho.set(o, d);

  for (const [i, p] of (cfg.pais ?? []).entries()) {
    await gravarPagina(p.caminho, { titulo: p.titulo, resumo: p.resumo ?? null, ordem: i, status: 'publicado', publicado_em: new Date().toISOString() });
  }
  for (const [i, m] of cfg.migrar.entries()) {
    const pg = porId.get(m.wp);
    if (!pg) { relatorio.erros.push({ wp: m.wp, erro: 'página não está no inventário' }); continue; }
    try {
      // Arquivos citados no texto + anexos que não são imagem (fotos soltas anexadas à página não têm lugar numa página).
      const citados = new Set();
      for (const x of (pg.content?.rendered ?? '').matchAll(/(?:href|src)=["']([^"']+)["']/gi)) if (ehUpload(x[1])) citados.add(urlOriginal(decodificar(x[1])));
      const anexos = (mediaPorPost.get(pg.id) ?? []).filter((x) => !x.mime_type?.startsWith('image/')).map((x) => urlOriginal(x.source_url));
      const midias = [];
      for (const u of new Set([...citados, ...anexos])) { const md = await migrarArquivo(u, m.titulo, pg.date); if (md) midias.push({ url: u, ...md }); }
      let html = preencherAlt(reescreverLinks(limparHtml(pg.content?.rendered)), altDaMidia, m.titulo);
      const soltos = midias.filter((md) => !html.includes(md.storage_path));
      if (soltos.length) {
        const publica = (md) => sb.storage.from('midias').getPublicUrl(md.storage_path).data.publicUrl;
        const rotulo = (md) => textoPlano(mediaPorUrl.get(urlOriginal(md.url))?.title?.rendered) || nomeArquivo(urlOriginal(md.url)).original;
        html += `\n<h2>Arquivos</h2>\n<ul>${soltos.map((md) => `<li><a href="${publica(md)}">${rotulo(md).replace(/</g, '&lt;')}</a></li>`).join('')}</ul>`;
      }
      await gravarPagina(m.caminho, {
        titulo: m.titulo ?? textoPlano(pg.title.rendered), corpo_html: html || null, ordem: i,
        status: 'publicado', publicado_em: dataComFuso(pg.date), legado: { wp_id: pg.id, url: pg.link },
      }, pg.id);
      await redirecionar(caminhoAntigo(pg.link), `/${m.caminho}`);
      relatorio.paginas = (relatorio.paginas ?? 0) + 1;
    } catch (e) { relatorio.erros.push({ wp: m.wp, titulo: m.titulo, erro: String(e.message ?? e) }); }
  }

  // Endereços antigos: regra do mapa; senão, mesmo endereço no portal novo (nada a fazer); senão, o padrão.
  const migradas = new Set(cfg.migrar.map((m) => porId.get(m.wp)).filter(Boolean).map((p) => caminhoAntigo(p.link)));
  const mesmo = new Set(cfg.mesmo_endereco ?? []);
  for (const pg of inv.pages) {
    const origem = caminhoAntigo(pg.link);
    if (!origem || migradas.has(origem) || mesmo.has(origem)) continue;
    const destino = cfg.redirecionar?.[origem] ?? cfg.padrao ?? '/';
    if (!cfg.redirecionar?.[origem]) relatorio.paginas_para_padrao = [...(relatorio.paginas_para_padrao ?? []), origem];
    await redirecionar(origem, destino);
  }
  // Regras do mapa para endereços que não são páginas do inventário (ex.: links antigos de menu).
  for (const [o, d] of Object.entries(cfg.redirecionar ?? {})) if (!inv.pages.some((pg) => caminhoAntigo(pg.link) === o)) await redirecionar(o, d);
}

// Dados institucionais do mapa (endereço, telefone…) em municipios.config. Só preenche o que está vazio
// ou marcado como exemplo, para não sobrescrever o que a prefeitura já corrigiu pelo painel.
async function preencherDadosInstitucionais() {
  const dados = { ...mapa.dados_institucionais }; delete dados._comentario;
  const { data } = await sb.from('municipios').select('config').eq('id', MID).single();
  const config = { ...(data?.config ?? {}) };
  const exemplo = (v) => !v || /exemplo|0000-0000/i.test(String(v));
  const mudou = Object.keys(dados).filter((k) => exemplo(config[k]));
  for (const k of mudou) config[k] = dados[k];
  if (!mudou.length) return log('Dados institucionais: nada a preencher.');
  const { error } = await sb.from('municipios').update({ config }).eq('id', MID);
  if (error) relatorio.erros.push({ erro: `dados institucionais: ${error.message}` });
  else log(`Dados institucionais preenchidos: ${mudou.join(', ')}`);
}

// ------------------------------------------------------------------ execução
await entrar();
await garantirCategorias();

const classificados = inv.posts.map((p) => ({ p, c: classificar(p, mapa) })).sort((a, b) => b.p.date.localeCompare(a.p.date));
// Caminho novo de todos os posts (para reescrever links internos mesmo dos que ainda não migraram).
for (const { p, c } of classificados) {
  const c0 = caminhoAntigo(p.link);
  if (c0) novoCaminho.set(c0, `/${c.tipo === 'documento' ? 'documentos' : 'noticias'}/${slugificar(decodeURIComponent(p.slug))}`);
}
if (args.paginas) {
  // Arquivos já migrados (para reescrever links de upload nas páginas sem baixar de novo).
  for (let de = 0; ; de += 1000) {
    const { data } = await sb.from('midias').select('id, storage_path, mime_type, texto_alternativo, legado').eq('municipio_id', MID).not('legado', 'is', null).range(de, de + 999);
    for (const md of data ?? []) if (md.legado?.url) cacheMidias.set(md.legado.url, md);
    if (!data || data.length < 1000) break;
  }
  await migrarPaginas();
  if (mapa.dados_institucionais) await preencherDadosInstitucionais();
}
const escolhidos = args.paginas ? [] : args.todos ? classificados : [
  ...classificados.filter((x) => x.c.tipo === 'noticia' && !x.c.arquivo).slice(0, Number(args.noticias ?? 0)),
  ...classificados.filter((x) => x.c.tipo === 'documento').slice(0, Number(args.documentos ?? 0)),
];
log(`${escolhidos.length} posts selecionados (${args.todos ? 'todos' : `amostra: ${args.noticias ?? 0} notícias + ${args.documentos ?? 0} documentos`})`);

let n = 0;
for (const { p, c } of escolhidos) {
  n++;
  try { await migrarPost(p, c); }
  catch (e) { relatorio.erros.push({ wp: p.id, titulo: textoPlano(p.title.rendered).slice(0, 80), erro: String(e.message ?? e) }); }
  if (n % 10 === 0) log(`${n}/${escolhidos.length} · ${relatorio.arquivos_enviados} arquivos enviados · ${relatorio.erros.length} erros`);
}

relatorio.fim = new Date().toISOString();
fs.mkdirSync('relatorios', { recursive: true });
const arq = path.join('relatorios', `migracao-${mapa.municipio_slug}-${relatorio.fim.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(arq, JSON.stringify(relatorio, null, 2));
// Arquivos acima do limite de upload: lista para a prefeitura comprimir e reenviar (D-26).
// Rodar a migração de novo, depois de resolver o limite, envia os que faltaram e os anexa ao documento.
const grandes = relatorio.arquivos_falha.filter((f) => /maximum allowed size|too large|413/i.test(f.erro));
const unicos = [...new Map(grandes.map((f) => [f.url, f])).values()];
if (unicos.length) {
  const csv = ['arquivo;endereco_no_site_antigo', ...unicos.map((f) => `${f.url.split('/').pop()};${f.url}`)].join(String.fromCharCode(10));
  const arqCsv = path.join('relatorios', `arquivos-grandes-${mapa.municipio_slug}.csv`);
  // BOM (U+FEFF) para o Excel abrir com acentos corretos.
  fs.writeFileSync(arqCsv, String.fromCharCode(0xfeff) + csv);
  console.log('');
  console.log('*'.repeat(78));
  console.log(`*  ATENÇÃO: ${unicos.length} arquivo(s) acima do limite de upload (50 MB com o teto de gastos ligado)`);
  console.log(`*  ficaram de fora. Lista para a prefeitura comprimir: ${arqCsv}`);
  console.log('*  Ver docs/11-checklist-ir-ao-ar.md. Depois de resolver, rode a migração de novo.');
  console.log('*'.repeat(78));
}
log(`Fim: ${relatorio.paginas ?? 0} páginas, ${relatorio.noticias} notícias, ${relatorio.documentos} documentos, ${relatorio.arquivos_enviados} arquivos enviados (${relatorio.arquivos_reaproveitados} reaproveitados, ${relatorio.arquivos_falha.length} falhas), ${relatorio.redirecionamentos} redirecionamentos, ${relatorio.erros.length} erros. Relatório: ${arq}`);
await sb.auth.signOut();
