import type { APIRoute } from 'astro';

// robots.txt por domínio (D-15). Homologação: bloqueia tudo.
export const GET: APIRoute = ({ locals }) => {
  const { dominioPrincipal, homologacao } = locals.contexto;
  const corpo = homologacao
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /busca\n\nSitemap: https://${dominioPrincipal}/sitemap.xml\n`;
  return new Response(corpo, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
