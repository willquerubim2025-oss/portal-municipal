// Imagem redimensionada (D-36): /imagem/<largura>/<caminho no Storage>.
// Busca o original no Storage, reduz para a largura pedida e entrega em WebP pelo Images
// binding da Cloudflare. Cota grátis: 5.000 transformações únicas por mês; passando dela,
// a Cloudflare não cobra, apenas recusa as novas: aí entregamos o original (cache curto,
// para tentar de novo no dia seguinte).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { urlMidia } from '../../../lib/supabase';
import { LARGURAS } from '../../../lib/imagens';

const TRANSFORMAVEIS = /^image\/(jpeg|png|webp|avif)$/;
const cabecalhos = (tipo: string, diasNaBorda: number, origem: string) => ({
  'Content-Type': tipo,
  'Cache-Control': 'public, max-age=86400',
  // Cache na borda próprio (o middleware não sobrescreve): a imagem de um caminho não muda.
  'Cloudflare-CDN-Cache-Control': `public, max-age=${diasNaBorda * 86400}`,
  'X-Imagem': origem,
});

export const GET: APIRoute = async ({ params, locals }) => {
  const largura = Number(params.largura);
  const caminho = params.caminho ?? '';
  // Só larguras da lista e só imagens da própria prefeitura (a cota é da conta inteira).
  if (!(LARGURAS as readonly number[]).includes(largura) || !caminho.startsWith(`${locals.contexto.municipio.id}/`) || caminho.includes('..')) {
    return new Response('Não encontrado', { status: 404 });
  }

  const origem = await fetch(urlMidia(caminho)!);
  if (!origem.ok || !origem.body) return new Response('Não encontrado', { status: origem.status === 404 ? 404 : 502 });
  const tipo = origem.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
  const images = (env as unknown as { IMAGES?: any }).IMAGES;
  if (!TRANSFORMAVEIS.test(tipo) || !images) {
    return new Response(origem.body, { headers: cabecalhos(tipo, 30, 'original') });
  }

  // Duas cópias do fluxo: uma para transformar, outra para o caso de a transformação falhar.
  const [paraTransformar, reserva] = origem.body.tee();
  try {
    const saida = await images.input(paraTransformar)
      .transform({ width: largura, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: 80 });
    await reserva.cancel();
    return new Response(saida.image(), { headers: cabecalhos('image/webp', 30, 'otimizada') });
  } catch {
    return new Response(reserva, { headers: cabecalhos(tipo, 1, 'original') });
  }
};
