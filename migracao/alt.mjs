// Descrição (alt) das imagens dentro do texto. O WordPress costuma gravar alt="" nas imagens
// inseridas no conteúdo, o que as esconde de leitores de tela (eMAG). Usa o texto alternativo
// da mídia migrada (midias.texto_alternativo, marcado para revisão) ou "Imagem: <título>".

const aspas = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Caminho no Storage a partir da URL pública (…/object/public/midias/<caminho>). */
export function caminhoNoStorage(src) {
  const i = src.indexOf('/object/public/midias/');
  if (i < 0) return null;
  try { return decodeURIComponent(src.slice(i + '/object/public/midias/'.length).split('?')[0]); } catch { return null; }
}

/**
 * Preenche alt vazio ou ausente. `altPorCaminho(caminho)` devolve o texto alternativo da mídia, se houver.
 * Imagens que já têm descrição não são tocadas.
 */
export function preencherAlt(html, altPorCaminho, titulo) {
  return String(html ?? '').replace(/<img\b([^>]*?)(\/?)>/gi, (todo, attrs, fecha) => {
    const atual = attrs.match(/\balt="([^"]*)"/i);
    if (atual && atual[1].trim()) return todo;
    const src = attrs.match(/\bsrc="([^"]*)"/i)?.[1] ?? '';
    const caminho = caminhoNoStorage(src);
    const texto = (caminho && altPorCaminho(caminho)) || (titulo ? `Imagem: ${titulo}` : null);
    if (!texto) return todo;
    const sem = attrs.replace(/\s*\balt(="[^"]*")?(?=\s|$)/i, '');
    return `<img${sem} alt="${aspas(texto)}"${fecha}>`;
  });
}
