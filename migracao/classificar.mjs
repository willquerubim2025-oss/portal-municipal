// Classificação genérica de posts do WordPress em notícia ou documento (D-04, D-22).
// Toda regra específica de uma prefeitura vem do mapa (mapas/<municipio>.json).

export const textoPlano = (s) => decodificar(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function decodificar(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

const normal = (s) => textoPlano(s).toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * @returns {{ tipo: 'noticia'|'documento', categoria: string, modalidade?: string, categoriasNoticia?: string[], arquivo?: boolean, regra: string }}
 */
export function classificar(post, mapa) {
  const cats = post.categories.map(String);
  const titulo = normal(post.title?.rendered ?? post.title);
  const porTitulo = () => {
    for (const r of mapa.titulo) {
      if (new RegExp(r.padrao, 'i').test(titulo)) {
        if (r.arquivo) return { tipo: 'noticia', categoria: r.arquivo, categoriasNoticia: [r.arquivo], arquivo: true, regra: `título: ${r.padrao}` };
        return { tipo: 'documento', categoria: r.categoria_documento, regra: `título: ${r.padrao}` };
      }
    }
    return null;
  };

  // 0) Categoria de arquivo (ex.: boletins da Covid): notícia fora das listagens.
  const arq = cats.find((c) => mapa.arquivo_categorias?.[c]);
  if (arq) {
    const cat = mapa.arquivo_categorias[arq];
    return { tipo: 'noticia', categoria: cat, categoriasNoticia: [cat], arquivo: true, regra: 'categoria de arquivo' };
  }
  // 1) Licitação: a modalidade vence.
  const mod = cats.find((c) => mapa.modalidades[c]);
  if (mod) return { tipo: 'documento', categoria: 'licitacoes', modalidade: mapa.modalidades[mod], regra: `modalidade ${mapa.modalidades[mod]}` };
  // 2) Categoria de documento direta.
  const direta = cats.find((c) => mapa.documento_direto[c]);
  if (direta) {
    // Concursos e afins ainda podem ser refinados pelo título (ex.: processo seletivo).
    return { tipo: 'documento', categoria: mapa.documento_direto[direta], regra: `categoria ${direta}` };
  }
  // 3) Categoria genérica de documento: decide pelo título.
  if (cats.some((c) => mapa.documento_pelo_titulo.includes(c))) {
    const padrao = cats.map((c) => mapa.padrao_por_categoria?.[c]).find(Boolean);
    return porTitulo() ?? { tipo: 'documento', categoria: padrao ?? mapa.titulo_padrao_documento, regra: 'categoria genérica, título sem padrão' };
  }
  // 3b) Mesmo sem categoria de documento, títulos de ato oficial viram documento (ex.: decreto em "GABINETE").
  const t = porTitulo();
  if (t && t.tipo === 'documento' && t.categoria !== mapa.titulo_padrao_documento) return t;
  if (t?.arquivo) return t;
  // 4) Notícia, com as categorias temáticas mapeadas.
  const tematicas = [...new Set(cats.map((c) => mapa.noticia[c]).filter(Boolean))];
  // Sem categoria temática no WordPress: tenta o prefixo do título ("Saúde Pública: ...").
  if (!tematicas.length && titulo.includes(':')) {
    const prefixo = titulo.slice(0, titulo.indexOf(':'));
    const r = (mapa.noticia_por_prefixo ?? []).find((x) => new RegExp(x.padrao).test(prefixo));
    if (r) tematicas.push(r.categoria);
  }
  return {
    tipo: 'noticia',
    categoria: tematicas[0] ?? mapa.noticia_categoria_padrao,
    categoriasNoticia: tematicas.length ? tematicas : [mapa.noticia_categoria_padrao],
    regra: tematicas.length ? 'notícia temática' : 'notícia geral',
  };
}

/** "DECRETO Nº 1.542 DE 09 DE MAIO DE 2022" → { numero: '1.542', ano: 2022 } */
export function numeroEAno(titulo, dataIso) {
  const t = textoPlano(titulo);
  const m = t.match(/N[º°o.]*\s*\.?\s*([\d.]+)\s*(?:[\/-]\s*(\d{4}))?/i);
  const anoTexto = t.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return {
    numero: m ? m[1].replace(/\.$/, '') : null,
    ano: m?.[2] ? Number(m[2]) : anoTexto ? Number(anoTexto[1]) : Number(String(dataIso).slice(0, 4)),
  };
}
