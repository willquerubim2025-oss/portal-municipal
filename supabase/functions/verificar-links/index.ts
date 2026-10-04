// Edge Function: verificação de links quebrados (RF18, D-31).
//
// Chamada a cada minuto pelo pg_cron (interno.disparar_rotinas) quando há verificação
// na fila. Não recebe parâmetros: pega a verificação em andamento (ou a pendente mais
// antiga), confere os links em lotes até o orçamento de tempo e para. A próxima
// chamada continua de onde parou. Os links para arquivos do próprio Storage já foram
// conferidos no banco (verificacao_iniciar); aqui só vão os demais.
// Deploy com verify_jwt = false: chamar de fora só adianta o trabalho já pedido.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORCAMENTO_MS = 110_000;   // folga dentro do limite de execução da Edge Function
const LOTE = 40;
const SIMULTANEOS = 8;
const TEMPO_LIMITE_MS = 10_000;
const AGENTE = 'SECKE-Portal-Municipal/1.0 (verificador de links)';

type Resultado = { url: string; status_http: number | null; erro: string | null };

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

async function requisitar(url: string, metodo: 'HEAD' | 'GET') {
  const r = await fetch(url, {
    method: metodo,
    redirect: 'follow',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    headers: { 'User-Agent': AGENTE, ...(metodo === 'GET' ? { Range: 'bytes=0-0' } : {}) },
  });
  await r.body?.cancel();
  return r.status;
}

/** HEAD primeiro (não baixa nada); se o servidor não aceita HEAD, um GET de 1 byte. */
async function conferir(url: string): Promise<Resultado> {
  let alvo = url;
  try { alvo = new URL(url).href; } catch {
    try { alvo = new URL(encodeURI(url)).href; } catch { return { url, status_http: null, erro: 'endereço inválido' }; }
  }
  try {
    let status = await requisitar(alvo, 'HEAD');
    if ([403, 404, 405, 501].includes(status)) status = await requisitar(alvo, 'GET');
    return { url, status_http: status, erro: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const erro = /timed? ?out|aborted|TimeoutError/i.test(msg) ? 'não respondeu em 10 s'
      : /dns|lookup|name or service|resolve/i.test(msg) ? 'endereço não existe (DNS)'
      : /certificate|tls|ssl/i.test(msg) ? 'certificado de segurança inválido'
      : msg.slice(0, 200);
    return { url, status_http: null, erro };
  }
}

async function emParalelo<T, R>(itens: T[], fn: (x: T) => Promise<R>, n: number): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) { const k = i++; saida[k] = await fn(itens[k]); }
  }));
  return saida;
}

Deno.serve(async () => {
  const inicio = Date.now();
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: atual, error: e1 } = await sb.rpc('verificacao_iniciar');
  if (e1) return json({ erro: e1.message }, 500);
  if (!atual?.length) return json({ nada_a_fazer: true });
  const id: string = atual[0].verificacao_id;

  let conferidos = 0;
  while (Date.now() - inicio < ORCAMENTO_MS) {
    const { data: lote, error: e2 } = await sb.rpc('verificacao_proximos', { p_verificacao: id, p_limite: LOTE });
    if (e2) return json({ erro: e2.message }, 500);
    if (!lote?.length) break;
    const resultados = await emParalelo(lote.map((x: { url: string }) => x.url), conferir, SIMULTANEOS);
    const { error: e3 } = await sb.rpc('verificacao_registrar', { p_verificacao: id, p_resultados: resultados });
    if (e3) return json({ erro: e3.message }, 500);
    conferidos += resultados.length;
  }

  // -1 = ainda falta conferir (orçamento acabou ou outra execução tem um lote reservado).
  const { data: problemas, error: e4 } = await sb.rpc('verificacao_concluir', { p_verificacao: id });
  if (e4) return json({ erro: e4.message }, 500);
  return json({ verificacao: id, conferidos, concluida: problemas !== -1, problemas: problemas === -1 ? null : problemas });
});
