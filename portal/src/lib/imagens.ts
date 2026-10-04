// Imagens no tamanho certo (D-36). O portal serve /imagem/<largura>/<caminho no Storage>,
// redimensionada e em WebP pelo Images binding da Cloudflare (pages/imagem/...), com cache
// longo na borda. Só larguras desta lista: cada combinação imagem + largura conta como uma
// transformação na cota mensal, então poucas larguras = cota rende mais.
import { SUPABASE_URL } from 'astro:env/server';

export const LARGURAS = [320, 480, 640, 800, 1200, 1600] as const;
export type Largura = (typeof LARGURAS)[number];

const PREFIXO_STORAGE = '/storage/v1/object/public/midias/';
const codificar = (caminho: string) => caminho.split('/').map(encodeURIComponent).join('/');

/** Endereço da imagem redimensionada (relativo ao portal). */
export function urlImagem(storagePath: string, largura: Largura): string {
  return `/imagem/${largura}/${codificar(storagePath)}`;
}

/** srcset com as larguras pedidas (para o navegador escolher conforme a tela). */
export function srcsetImagem(storagePath: string, larguras: readonly Largura[]): string {
  return larguras.map((l) => `${urlImagem(storagePath, l)} ${l}w`).join(', ');
}

/** Caminho no Storage a partir da URL pública do bucket `midias` (ou null se for de fora). */
export function caminhoNoStorage(url: string): string | null {
  const i = url.indexOf(PREFIXO_STORAGE);
  if (i < 0 || !url.startsWith(SUPABASE_URL)) return null;
  try { return decodeURIComponent(url.slice(i + PREFIXO_STORAGE.length).split('?')[0]); } catch { return null; }
}

/**
 * Imagens dentro do texto (notícias, páginas…): troca o arquivo original do Storage pela
 * versão no tamanho da coluna de texto, com srcset, e carrega só quando aparecer na tela.
 * Imagens de fora do Storage ficam como estão.
 */
export function otimizarImagensDoTexto(html: string): string {
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (todo, antes: string, src: string, depois: string) => {
    const caminho = caminhoNoStorage(src.replace(/&amp;/g, '&'));
    if (!caminho) return todo;
    const lazy = /\bloading=/.test(antes + depois) ? '' : ' loading="lazy"';
    return `<img${antes}src="${urlImagem(caminho, 800)}" srcset="${srcsetImagem(caminho, [480, 800, 1200])}" sizes="(max-width: 840px) 100vw, 800px" decoding="async"${lazy}${depois}>`;
  });
}
