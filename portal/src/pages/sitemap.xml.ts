import type { APIRoute } from 'astro';
import { urlsSitemap } from '../lib/consultas';
import { moduloAtivo } from '../lib/municipio';
import { supabase } from '../lib/supabase';

// Sitemap por município (D-15): só conteúdo publicado (o RLS garante) e no domínio principal.
export const GET: APIRoute = async ({ locals }) => {
  const { municipio: m, dominioPrincipal } = locals.contexto;
  const origem = `https://${dominioPrincipal}`;
  const fixas = [
    '/', '/noticias', '/documentos', '/transparencia',
    moduloAtivo(m, 'legislacao') && '/legislacao',
    moduloAtivo(m, 'carta_servicos') && '/servicos',
    moduloAtivo(m, 'agenda') && '/eventos',
    moduloAtivo(m, 'perguntas_frequentes') && '/perguntas-frequentes',
    moduloAtivo(m, 'estrutura_organizacional') && '/estrutura-organizacional',
  ].filter(Boolean) as string[];
  // Busca de escola e supervisor: só quando a rede tem unidades cadastradas.
  const { count: unidades } = await supabase().from('unidades').select('id', { count: 'exact', head: true }).eq('municipio_id', m.id);
  if (unidades) fixas.push('/fale-com-o-supervisor');

  const desligado = (c: string) =>
    (c.startsWith('/servicos/') && !moduloAtivo(m, 'carta_servicos')) ||
    (c.startsWith('/eventos/') && !moduloAtivo(m, 'agenda')) ||
    (c.startsWith('/estrutura-organizacional/') && !moduloAtivo(m, 'estrutura_organizacional'));
  const conteudo = (await urlsSitemap(m.id)).filter((u) => !desligado(u.caminho));

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const linhas = [
    ...fixas.map((c) => `<url><loc>${esc(origem + (c === '/' ? '' : c))}</loc></url>`),
    ...conteudo.map((u) => `<url><loc>${esc(origem + u.caminho)}</loc><lastmod>${u.atualizado.slice(0, 10)}</lastmod></url>`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${linhas.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
