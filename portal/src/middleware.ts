import { defineMiddleware } from 'astro:middleware';
import { DOMINIO_DEV } from 'astro:env/server';
import { resolverMunicipio } from './lib/municipio';
import { supabase } from './lib/supabase';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = ctx.url;
  // Arquivos do build (em produção são servidos direto pela Cloudflare, sem passar aqui).
  if (url.pathname.startsWith('/_')) return next();

  const local = LOCAL.test(url.hostname);
  const dominio = local && DOMINIO_DEV ? DOMINIO_DEV : url.hostname;

  const contexto = await resolverMunicipio(dominio);
  if (!contexto) {
    return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Site não encontrado</title><p>Nenhum portal está configurado para este endereço.</p></html>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
  }

  // Domínio canônico (D-15): www/alternativos → domínio principal, com 301.
  if (!local && contexto.dominio !== contexto.dominioPrincipal) {
    return ctx.redirect(`https://${contexto.dominioPrincipal}${url.pathname}${url.search}`, 301);
  }
  // URLs sem barra final (D-15). Endereços do WordPress terminam com "/": antes de
  // tirar a barra, confere os redirecionamentos, para levar ao destino num salto só.
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    const antiga = await redirecionar(contexto.municipio.id, url);
    if (antiga) return antiga;
    return ctx.redirect(url.pathname.replace(/\/+$/, '') + url.search, 301);
  }

  ctx.locals.contexto = contexto;
  let resposta = await next();

  // Rota inexistente: talvez seja uma URL do site antigo (RM04, tabela redirecionamentos).
  if (resposta.status === 404) {
    const redirecionada = await redirecionar(contexto.municipio.id, url);
    if (redirecionada) resposta = redirecionada;
  }

  const headers = new Headers(resposta.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  // Homologação nunca é indexada (D-15).
  if (contexto.homologacao) headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', resposta.status === 200 ? 'public, max-age=60' : 'no-store');
  }
  return new Response(resposta.body, { status: resposta.status, statusText: resposta.statusText, headers });
});

async function redirecionar(municipioId: string, url: URL): Promise<Response | null> {
  const caminho = decodeURIComponent(url.pathname).toLowerCase();
  const candidatos = url.search ? [caminho + url.search.toLowerCase(), caminho, caminho + '/'] : [caminho, caminho + '/'];
  const { data } = await supabase()
    .from('redirecionamentos')
    .select('id, origem, destino, codigo')
    .eq('municipio_id', municipioId)
    .in('origem', candidatos);
  if (!data?.length) return null;
  // Prefere a origem mais específica (com query string).
  const r = data.sort((a, b) => b.origem.length - a.origem.length)[0];
  await supabase().rpc('registrar_acesso_redirecionamento', { p_id: r.id });
  if (r.codigo === 410) {
    return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Conteúdo removido</title><p>Este conteúdo foi removido.</p><p><a href="/">Ir para a página inicial</a></p></html>',
      { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response(null, { status: r.codigo, headers: { Location: r.destino, 'Cache-Control': 'public, max-age=3600' } });
}
