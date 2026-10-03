// Ponto de entrada do Worker (D-30): cache na borda por município.
//
// O cache de Workers da Cloudflare guarda a resposta pelo CAMINHO, não pelo domínio: sem cuidado,
// "/noticias" de uma prefeitura apareceria no site de outra. Por isso há duas entradas:
//   - default (portaria, sem cache): repassa a requisição ao Portal, com o domínio em ctx.props;
//   - Portal (com cache): o Astro. ctx.props entra na chave do cache, então cada domínio tem a sua cópia.
// O middleware marca cada resposta com a etiqueta do município (Cache-Tag: m-<id>), e o banco pede a
// limpeza das etiquetas dos municípios que mudaram (POST /__cache/limpar, migration 0011).
import { WorkerEntrypoint } from 'cloudflare:workers';
import { handle } from '@astrojs/cloudflare/handler';

interface Env { CACHE_SEGREDO?: string; [k: string]: unknown }
type ComCache = { cache: { purge(o: { tags: string[] }): Promise<{ success: boolean; errors?: unknown[] }> } };
type ComExports = { exports: { Portal(o: { props: { host: string } }): Fetcher & Portal } };

export class Portal extends WorkerEntrypoint<Env> {
  fetch(request: Request) {
    return handle(request, this.env as never, this.ctx);
  }
  /** Só esta entrada pode limpar o próprio cache (o escopo da limpeza é a entrada que a chama). */
  async limpar(tags: string[]) {
    return (this.ctx as unknown as ComCache).cache.purge({ tags });
  }
}

/** Comparação em tempo constante, para não vazar o segredo pelo tempo de resposta. */
function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function limparCache(request: Request, env: Env, portal: Portal): Promise<Response> {
  const segredo = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (request.method !== 'POST' || !env.CACHE_SEGREDO || !iguais(segredo, env.CACHE_SEGREDO)) {
    return new Response('Não autorizado', { status: 401 });
  }
  const corpo = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(corpo?.tags) ? corpo.tags.filter((t): t is string => typeof t === 'string' && /^m-[0-9a-f-]{36}$/.test(t)) : [];
  if (!tags.length) return Response.json({ success: false, erro: 'nenhuma etiqueta válida' }, { status: 400 });
  // A Cloudflare aceita até 100 etiquetas por limpeza.
  const resultados = [];
  for (let i = 0; i < tags.length; i += 100) resultados.push(await portal.limpar(tags.slice(i, i + 100)));
  const ok = resultados.every((r) => r.success);
  return Response.json({ success: ok, tags: tags.length, erros: resultados.flatMap((r) => r.errors ?? []) }, { status: ok ? 200 : 502 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const portal = (ctx as unknown as ComExports).exports.Portal({ props: { host: url.host.toLowerCase() } });
    if (url.pathname === '/__cache/limpar') return limparCache(request, env, portal);
    return portal.fetch(request);
  },
} satisfies ExportedHandler<Env>;
