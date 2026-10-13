// Consultas do portal. Tudo passa pelo RLS com a chave publicável: só volta o
// que está publicado (status = 'publicado' e publicado_em <= agora) e ativo.
import { supabase } from './supabase';

const POR_PAGINA = 12;
const agora = () => new Date().toISOString();

/** Remove acentos: a coluna `busca` é indexada sem acento (f_unaccent). */
export const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

function erro<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

export interface Pagina<T> { itens: T[]; total: number; pagina: number; paginas: number }
function paginar<T>(itens: T[] | null, total: number | null, pagina: number): Pagina<T> {
  return { itens: itens ?? [], total: total ?? 0, pagina, paginas: Math.max(1, Math.ceil((total ?? 0) / POR_PAGINA)) };
}
const faixa = (pagina: number) => [(pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1] as const;

// ---------------------------------------------------------------- categorias
export type Escopo = 'publicacao' | 'documento' | 'servico' | 'evento' | 'pergunta';
const ROTA_ESCOPO: Record<Escopo, string> = {
  publicacao: '/noticias', documento: '/documentos', servico: '/servicos', evento: '/eventos', pergunta: '/perguntas-frequentes',
};
export const hrefCategoria = (escopo: Escopo, slug: string) => `${ROTA_ESCOPO[escopo]}?categoria=${encodeURIComponent(slug)}`;

export async function categorias(municipioId: string, escopo: Escopo) {
  return erro(await supabase().from('categorias')
    .select('id, nome, slug, parent_id, descricao')
    .eq('municipio_id', municipioId).eq('escopo', escopo).order('ordem').order('nome'));
}

// ---------------------------------------------------------------- menus
export interface ItemMenu { rotulo: string; href: string | null; novaAba: boolean; filhos: ItemMenu[] }

export async function menu(municipioId: string, local: string): Promise<ItemMenu[]> {
  const { data } = await supabase().from('menus')
    .select('menu_itens(id, parent_id, rotulo, url, nova_aba, ordem, pagina:paginas(caminho), categoria:categorias(escopo, slug))')
    .eq('municipio_id', municipioId).eq('local', local).maybeSingle();
  const linhas = ((data?.menu_itens ?? []) as any[]).sort((a, b) => a.ordem - b.ordem);
  const mapa = new Map<string, ItemMenu & { parent: string | null }>();
  for (const l of linhas) {
    const href = l.url ?? (l.pagina ? `/${l.pagina.caminho}` : l.categoria ? hrefCategoria(l.categoria.escopo, l.categoria.slug) : null);
    mapa.set(l.id, { rotulo: l.rotulo, href, novaAba: l.nova_aba, filhos: [], parent: l.parent_id });
  }
  const raiz: ItemMenu[] = [];
  for (const item of mapa.values()) {
    const pai = item.parent ? mapa.get(item.parent) : undefined;
    (pai ? pai.filhos : raiz).push(item);
  }
  return raiz;
}

// ---------------------------------------------------------------- notícias
const CAMPOS_NOTICIA = 'id, tipo, titulo, slug, resumo, publicado_em, destaque, prioridade, imagem:midias!publicacoes_imagem_destaque_id_municipio_id_fkey(storage_path, texto_alternativo)';

export async function noticias(municipioId: string, opcoes: { pagina?: number; categoria?: string; limite?: number; destaque?: boolean } = {}) {
  const pagina = Math.max(1, opcoes.pagina ?? 1);
  let q = supabase().from('publicacoes')
    .select(opcoes.categoria ? `${CAMPOS_NOTICIA}, cat:publicacao_categorias!inner(categoria:categorias!inner(slug))` : CAMPOS_NOTICIA, { count: 'exact' })
    .eq('municipio_id', municipioId)
    // Aviso expirado sai das listagens, mas o link continua funcionando (D-12).
    .or(`expira_em.is.null,expira_em.gt.${agora()}`)
    .order('publicado_em', { ascending: false });
  if (opcoes.categoria) q = q.eq('cat.categoria.slug', opcoes.categoria);
  if (opcoes.destaque) q = q.eq('destaque', true);
  if (opcoes.limite) {
    const r = await q.limit(opcoes.limite);
    return paginar(erro(r) as any[], r.count, 1);
  }
  const r = await q.range(...faixa(pagina));
  return paginar(erro(r) as any[], r.count, pagina);
}

export async function noticia(municipioId: string, slug: string) {
  return erro(await supabase().from('publicacoes')
    .select(`id, tipo, titulo, slug, resumo, corpo_html, publicado_em, atualizado_em,
      imagem:midias!publicacoes_imagem_destaque_id_municipio_id_fkey(storage_path, texto_alternativo),
      galeria:publicacao_midias(legenda, ordem, midia:midias(storage_path, texto_alternativo)),
      categorias:publicacao_categorias(categoria:categorias(nome, slug)),
      orgao:orgaos(nome, slug)`)
    .eq('municipio_id', municipioId).eq('slug', slug).maybeSingle()) as any;
}

// ---------------------------------------------------------------- destaques e eventos
export async function destaques(municipioId: string) {
  return erro(await supabase().from('destaques')
    .select('id, tipo, nivel, titulo, texto, url, nova_aba, botao_rotulo, frequencia, versao, fim_em, imagem:midias(storage_path, texto_alternativo)')
    .eq('municipio_id', municipioId)
    .or(`fim_em.is.null,fim_em.gt.${agora()}`)
    .order('ordem')) as any[];
}

/** Eventos de um intervalo, para o calendário da home (D-53): com imagem (encarte) e quem realiza. */
export async function eventosCalendario(municipioId: string, desde: Date, ate: Date) {
  return erro(await supabase().from('eventos')
    .select('id, titulo, slug, resumo, inicio_em, fim_em, dia_inteiro, local, orgao:orgaos(nome), imagem:midias!eventos_imagem_id_municipio_id_fkey(storage_path, texto_alternativo)')
    .eq('municipio_id', municipioId).eq('tipo', 'evento')
    .lte('inicio_em', ate.toISOString()).or(`fim_em.gte.${desde.toISOString()},and(fim_em.is.null,inicio_em.gte.${desde.toISOString()})`)
    .order('inicio_em').limit(200)) as any[];
}

export async function eventos(municipioId: string, opcoes: { pagina?: number; passados?: boolean; limite?: number; categoria?: string } = {}) {
  const pagina = Math.max(1, opcoes.pagina ?? 1);
  let q = supabase().from('eventos')
    .select(`id, tipo, titulo, slug, resumo, inicio_em, fim_em, dia_inteiro, local${opcoes.categoria ? ', categoria:categorias!inner(slug)' : ''}`, { count: 'exact' })
    .eq('municipio_id', municipioId);
  // Próximos: ainda não terminaram. Passados: já terminaram, do mais recente para trás.
  const fimOuInicio = `fim_em.gte.${agora()},and(fim_em.is.null,inicio_em.gte.${agora()})`;
  q = opcoes.passados
    ? q.not('inicio_em', 'gte', agora()).or(`fim_em.lt.${agora()},fim_em.is.null`).order('inicio_em', { ascending: false })
    : q.or(fimOuInicio).order('inicio_em');
  if (opcoes.categoria) q = q.eq('categoria.slug', opcoes.categoria);
  const r = opcoes.limite ? await q.limit(opcoes.limite) : await q.range(...faixa(pagina));
  return paginar(erro(r) as any[], r.count, opcoes.limite ? 1 : pagina);
}

export async function evento(municipioId: string, slug: string) {
  return erro(await supabase().from('eventos')
    .select('*, orgao:orgaos(nome, slug), imagem:midias!eventos_imagem_id_municipio_id_fkey(storage_path, texto_alternativo)')
    .eq('municipio_id', municipioId).eq('slug', slug).maybeSingle()) as any;
}

// ---------------------------------------------------------------- documentos
export async function documentos(municipioId: string, opcoes: { pagina?: number; categorias?: string[]; ano?: number; termo?: string; situacao?: string } = {}) {
  const pagina = Math.max(1, opcoes.pagina ?? 1);
  let q = supabase().from('documentos')
    .select('id, titulo, slug, numero, ano, data_documento, ementa, situacao, publicado_em, categoria:categorias!inner(nome, slug)', { count: 'exact' })
    .eq('municipio_id', municipioId)
    .order('data_documento', { ascending: false, nullsFirst: false })
    .order('publicado_em', { ascending: false });
  if (opcoes.categorias?.length) q = q.in('categoria.slug', opcoes.categorias);
  if (opcoes.ano) q = q.eq('ano', opcoes.ano);
  if (opcoes.situacao) q = q.eq('situacao', opcoes.situacao);
  if (opcoes.termo) q = q.textSearch('busca', semAcento(opcoes.termo), { type: 'websearch', config: 'portuguese' });
  const r = await q.range(...faixa(pagina));
  return paginar(erro(r) as any[], r.count, pagina);
}

export async function anosDocumentos(municipioId: string): Promise<number[]> {
  const linhas = erro(await supabase().from('documentos').select('ano').eq('municipio_id', municipioId).not('ano', 'is', null).order('ano', { ascending: false }).limit(1000));
  return [...new Set((linhas as { ano: number }[]).map((l) => l.ano))];
}

export async function documento(municipioId: string, slug: string) {
  return erro(await supabase().from('documentos')
    .select(`*, categoria:categorias(nome, slug), orgao:orgaos(nome, slug),
      arquivos:documento_arquivos(id, rotulo, url_externa, ordem, midia:midias(storage_path, mime_type, tamanho_bytes)),
      relacoes:documento_relacoes!documento_relacoes_documento_id_municipio_id_fkey(tipo, observacao, alvo:documentos!documento_relacoes_relacionado_id_municipio_id_fkey(titulo, slug)),
      relacionado_por:documento_relacoes!documento_relacoes_relacionado_id_municipio_id_fkey(tipo, observacao, origem:documentos!documento_relacoes_documento_id_municipio_id_fkey(titulo, slug))`)
    .eq('municipio_id', municipioId).eq('slug', slug).maybeSingle()) as any;
}

// ---------------------------------------------------------------- serviços, perguntas, órgãos
export async function servicos(municipioId: string, opcoes: { categoria?: string; termo?: string } = {}) {
  let q = supabase().from('servicos')
    .select(`id, titulo, slug, descricao, categoria:categorias${opcoes.categoria ? '!inner' : ''}(nome, slug)`)
    .eq('municipio_id', municipioId).order('titulo');
  if (opcoes.categoria) q = q.eq('categoria.slug', opcoes.categoria);
  if (opcoes.termo) q = q.textSearch('busca', semAcento(opcoes.termo), { type: 'websearch', config: 'portuguese' });
  return erro(await q) as any[];
}

/** Cards da Área de Serviços da página inicial (0020): publicados e "em breve", na ordem do painel. */
export async function servicosHome(municipioId: string) {
  const linhas = erro(await supabase().from('servicos')
    .select('id, titulo, slug, descricao, icone, ordem, em_breve, url_externa, sistema:sistemas_externos(url, ativo)')
    .eq('municipio_id', municipioId).eq('na_home', true).order('ordem').order('titulo')) as any[];
  return linhas.map((s) => ({
    ...s,
    href: s.em_breve ? null : s.url_externa ?? (s.sistema?.ativo ? s.sistema.url : null) ?? `/servicos/${s.slug}`,
    externo: !s.em_breve && /^https?:/.test(s.url_externa ?? (s.sistema?.ativo ? s.sistema.url : '') ?? ''),
  }));
}

/** Equipe gestora visível (0019): o RLS já esconde os ocultos e a seção desligada. */
export async function equipe(municipioId: string) {
  return erro(await supabase().from('equipe')
    .select('id, nome, cargo, nivel, email, telefone, ordem, orgao:orgaos(nome), foto:midias!equipe_foto_id_municipio_id_fkey(storage_path, texto_alternativo)')
    .eq('municipio_id', municipioId).order('nivel').order('ordem').order('nome')) as any[];
}

/** Escola pelo nome, sigla ou bairro, com o supervisor responsável (0019). */
export async function buscarUnidade(municipioId: string, termo: string) {
  return erro(await supabase().rpc('buscar_unidade', { p_municipio: municipioId, p_termo: termo, p_limite: 20 })) as {
    id: string; nome: string; sigla: string | null; tipo: string; bairro: string | null; endereco: string | null;
    telefone: string | null; email: string | null; supervisor_nome: string | null; supervisor_cargo: string | null;
    supervisor_email: string | null; supervisor_telefone: string | null;
  }[];
}

export async function servico(municipioId: string, slug: string) {
  return erro(await supabase().from('servicos')
    .select('*, categoria:categorias(nome, slug), orgao:orgaos(nome, slug, telefone, email, endereco, horario_atendimento)')
    .eq('municipio_id', municipioId).eq('slug', slug).maybeSingle()) as any;
}

export async function perguntas(municipioId: string) {
  return erro(await supabase().from('perguntas_frequentes')
    .select('id, pergunta, resposta_html, categoria:categorias(nome, slug, ordem)')
    .eq('municipio_id', municipioId).order('ordem')) as any[];
}

export async function orgaos(municipioId: string) {
  return erro(await supabase().from('orgaos')
    .select('id, parent_id, tipo, nome, sigla, slug, responsavel_nome, responsavel_cargo, telefone, email')
    .eq('municipio_id', municipioId).eq('ativo', true).order('ordem').order('nome')) as any[];
}

export async function orgao(municipioId: string, slug: string) {
  return erro(await supabase().from('orgaos')
    .select('*, foto:midias!orgaos_responsavel_foto_id_municipio_id_fkey(storage_path, texto_alternativo)')
    .eq('municipio_id', municipioId).eq('slug', slug).eq('ativo', true).maybeSingle()) as any;
}

// ---------------------------------------------------------------- transparência e páginas
export async function centralTransparencia(municipioId: string) {
  const secoes = erro(await supabase().from('transparencia_secoes')
    .select(`id, titulo, slug, descricao, icone, ordem,
      itens:transparencia_itens(id, titulo, descricao, url, ordem, ativo,
        pagina:paginas(caminho, status), categoria:categorias(escopo, slug), sistema:sistemas_externos(url, nome, ativo))`)
    .eq('municipio_id', municipioId).order('ordem')) as any[];
  for (const s of secoes) {
    s.itens = (s.itens ?? [])
      .filter((i: any) => i.ativo && !(i.pagina === null && !i.url && !i.categoria && !i.sistema))
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((i: any) => ({
        ...i,
        href: i.url ?? (i.pagina ? `/${i.pagina.caminho}` : i.categoria ? hrefCategoria(i.categoria.escopo, i.categoria.slug) : i.sistema?.url),
        externo: !!i.sistema || /^https?:/.test(i.url ?? ''),
      }));
  }
  return secoes;
}

export async function pagina(municipioId: string, caminho: string) {
  const p = erro(await supabase().from('paginas')
    .select('id, titulo, caminho, resumo, corpo_html, publicado_em, atualizado_em, parent_id')
    .eq('municipio_id', municipioId).eq('caminho', caminho).maybeSingle()) as any;
  if (!p) return null;
  p.filhas = erro(await supabase().from('paginas').select('titulo, caminho, resumo')
    .eq('municipio_id', municipioId).eq('parent_id', p.id).order('ordem').order('titulo'));
  return p;
}

/** Todas as páginas publicadas, em árvore (para o mapa do site). */
export interface NoPagina { titulo: string; caminho: string; filhas: NoPagina[] }
export async function arvorePaginas(municipioId: string): Promise<NoPagina[]> {
  const linhas = erro(await supabase().from('paginas').select('id, parent_id, titulo, caminho')
    .eq('municipio_id', municipioId).order('ordem').order('titulo').limit(2000)) as any[];
  const nos = new Map(linhas.map((l) => [l.id, { titulo: l.titulo, caminho: l.caminho, filhas: [] as NoPagina[], pai: l.parent_id }]));
  const raiz: NoPagina[] = [];
  for (const n of nos.values()) (n.pai && nos.get(n.pai) ? nos.get(n.pai)!.filhas : raiz).push(n);
  return raiz;
}

// ---------------------------------------------------------------- busca e sitemap
export async function buscar(municipioId: string, termo: string, pagina = 1) {
  return erro(await supabase().rpc('buscar', {
    p_municipio: municipioId, p_termo: termo, p_limite: 20, p_offset: (Math.max(1, pagina) - 1) * 20,
  })) as { tipo: string; id: string; titulo: string; resumo: string | null; caminho: string; publicado_em: string | null }[];
}

export async function urlsSitemap(municipioId: string) {
  const s = supabase();
  const [pub, pag, doc, ser, eve, org] = await Promise.all([
    s.from('publicacoes').select('slug, atualizado_em').eq('municipio_id', municipioId).limit(50000),
    s.from('paginas').select('caminho, atualizado_em').eq('municipio_id', municipioId).limit(50000),
    s.from('documentos').select('slug, atualizado_em').eq('municipio_id', municipioId).limit(50000),
    s.from('servicos').select('slug, atualizado_em').eq('municipio_id', municipioId).limit(50000),
    s.from('eventos').select('slug, atualizado_em').eq('municipio_id', municipioId).limit(50000),
    s.from('orgaos').select('slug, atualizado_em').eq('municipio_id', municipioId).eq('ativo', true).limit(50000),
  ]);
  const u = (lista: any[] | null, prefixo: string, campo = 'slug') =>
    (lista ?? []).map((l) => ({ caminho: `${prefixo}${l[campo]}`, atualizado: l.atualizado_em as string }));
  return [
    ...u(pub.data, '/noticias/'), ...u(pag.data, '/', 'caminho'), ...u(doc.data, '/documentos/'),
    ...u(ser.data, '/servicos/'), ...u(eve.data, '/eventos/'), ...u(org.data, '/estrutura-organizacional/'),
  ];
}
