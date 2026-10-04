import { FilterXSS, getDefaultWhiteList } from 'xss';
import { otimizarImagensDoTexto } from './imagens';

// HTML do editor (corpo de notícias, páginas, serviços, documentos) é sanitizado
// na renderização: nenhum <script>, on*="...", javascript: etc. chega ao visitante,
// mesmo que alguém com acesso ao painel cole código malicioso.
const base = getDefaultWhiteList();
const comClasse = (tags: string[]) => Object.fromEntries(tags.map((t) => [t, [...(base[t] ?? []), 'class', 'id']]));

const filtro = new FilterXSS({
  whiteList: {
    ...base,
    ...comClasse(['p', 'div', 'span', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'blockquote']),
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    // Vídeos do YouTube/Vimeo incorporados pelo editor.
    iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading'],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onTagAttr(tag, nome, valor) {
    if (tag === 'iframe' && nome === 'src' && !/^https:\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com)\//.test(valor)) return '';
    return undefined;
  },
});

export function htmlSeguro(html: string | null | undefined): string {
  // Depois de sanitizar: imagens do Storage no tamanho da coluna de texto (D-36).
  return html ? otimizarImagensDoTexto(filtro.process(html)) : '';
}
