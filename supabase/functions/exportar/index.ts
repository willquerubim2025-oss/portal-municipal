// Edge Function: exportação completa de um município (RF19, D-32).
//
// Chamada a cada minuto pelo pg_cron (interno.disparar_rotinas) quando há exportação
// pendente. Gera um ZIP no bucket privado "exportacoes", na pasta do município:
//   dados/<tabela>.json e dados/<tabela>.csv   (CSV com ";" e BOM, abre direto no Excel)
//   arquivos.csv                               (todos os arquivos, com o endereço público de cada um)
//   arquivos-enderecos.txt                     (só os endereços, um por linha: baixar com wget -i)
//   LEIA-ME.txt
// Os arquivos em si (vários GB) não vão no ZIP: ficam públicos no endereço indicado, e a
// SECKE entrega a cópia integral ao fim do contrato (ver docs).
//
// Limites da Edge Function (descobertos no primeiro teste com Jeriquara): ~150 MB de
// memória e 2 s de CPU por chamada. Por isso:
//  - cada tabela é lida de 1.000 em 1.000 linhas e comprimida aos pedaços com o compressor
//    nativo (CompressionStream), não em JavaScript;
//  - cada chamada processa tabelas até um orçamento de texto, guarda os pedaços já
//    comprimidos numa pasta temporária (com um manifesto) e chama a si mesma para continuar;
//  - o último passo só junta os pedaços num ZIP (cópia de bytes, sem comprimir de novo).
// Deploy com verify_jwt = false: chamar de fora só adianta o trabalho já pedido.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MANTER_ULTIMAS = 3;
const ORCAMENTO_TEXTO = 12_000_000;   // caracteres processados por chamada (aprox. 1 s de CPU)
const BOM = String.fromCharCode(0xfeff);   // faz o Excel abrir o CSV como UTF-8
const FIM_LINHA = '\r\n';

// Tabela, filtro pelo município e ordem estável para paginar.
// `via`: tabela sem municipio_id, filtrada pelo registro pai (join do PostgREST).
// `semCsv`: só JSON (colunas com estrutura grande, inúteis numa planilha).
interface Fonte { tabela: string; ordem: string[]; via?: string; extra?: (q: any) => any; semCsv?: boolean }
const FONTES: Fonte[] = [
  { tabela: 'municipios', ordem: ['id'] },
  { tabela: 'municipio_dominios', ordem: ['dominio'] },
  { tabela: 'categorias', ordem: ['id'] },
  { tabela: 'midias', ordem: ['id'] },
  { tabela: 'publicacoes', ordem: ['id'] },
  { tabela: 'publicacao_categorias', ordem: ['publicacao_id', 'categoria_id'], via: 'publicacoes' },
  { tabela: 'publicacao_midias', ordem: ['publicacao_id', 'midia_id'] },
  { tabela: 'paginas', ordem: ['id'] },
  { tabela: 'documentos', ordem: ['id'] },
  { tabela: 'documento_arquivos', ordem: ['id'], via: 'documentos' },
  { tabela: 'documento_relacoes', ordem: ['id'] },
  { tabela: 'servicos', ordem: ['id'] },
  { tabela: 'eventos', ordem: ['id'] },
  { tabela: 'perguntas_frequentes', ordem: ['id'] },
  { tabela: 'destaques', ordem: ['id'] },
  { tabela: 'menus', ordem: ['id'] },
  { tabela: 'menu_itens', ordem: ['id'] },
  { tabela: 'orgaos', ordem: ['id'] },
  { tabela: 'sistemas_externos', ordem: ['id'] },
  { tabela: 'transparencia_secoes', ordem: ['id'] },
  { tabela: 'transparencia_itens', ordem: ['id'] },
  { tabela: 'pntp_atendimento', ordem: ['criterio_id'] },
  { tabela: 'redirecionamentos', ordem: ['id'] },
  { tabela: 'membros', ordem: ['user_id'] },
  { tabela: 'contratos', ordem: ['id'] },
  { tabela: 'chamados', ordem: ['id'] },
  // Notas internas da SECKE nos chamados não são do município.
  { tabela: 'chamado_mensagens', ordem: ['id'], via: 'chamados', extra: (q) => q.eq('interna', false) },
  { tabela: 'auditoria', ordem: ['id'], semCsv: true },
];
// Colunas técnicas que não fazem sentido fora do banco.
const OMITIR = new Set(['busca']);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

// ------------------------------------------------------------------ ZIP
// Escritor mínimo de ZIP: cada arquivo já chega comprimido (deflate) com CRC e tamanhos.
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(crc: number, dados: Uint8Array): number {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Comprime aos pedaços com o deflate nativo; guarda CRC e tamanho do original. */
class Entrada {
  crc = 0;
  tamanho = 0;
  private saida: Uint8Array[] = [];
  private escritor: WritableStreamDefaultWriter<Uint8Array>;
  private lendo: Promise<void>;
  private cod = new TextEncoder();
  constructor(public nome: string) {
    const cs = new CompressionStream('deflate-raw');
    this.escritor = cs.writable.getWriter();
    this.lendo = (async () => { for await (const p of cs.readable) this.saida.push(p); })();
  }
  async escrever(texto: string) {
    if (!texto) return;
    const b = this.cod.encode(texto);
    this.crc = crc32(this.crc, b);
    this.tamanho += b.length;
    await this.escritor.write(b);
  }
  async fechar(): Promise<Blob> {
    await this.escritor.close();
    await this.lendo;
    return new Blob(this.saida);
  }
}

interface Item { nome: string; caminho: string; crc: number; tamanho: number; comprimido: number }

function zipDosPedacos(itens: Item[], dados: Blob[]): Blob {
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const cod = new TextEncoder();
  const partes: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  itens.forEach((it, i) => {
    const nome = cod.encode(it.nome);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 8, true);
    l.setUint16(10, hora, true); l.setUint16(12, data, true); l.setUint32(14, it.crc, true);
    l.setUint32(18, it.comprimido, true); l.setUint32(22, it.tamanho, true); l.setUint16(26, nome.length, true); l.setUint16(28, 0, true);
    partes.push(l.buffer, nome, dados[i]);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 8, true); c.setUint16(12, hora, true); c.setUint16(14, data, true); c.setUint32(16, it.crc, true);
    c.setUint32(20, it.comprimido, true); c.setUint32(24, it.tamanho, true); c.setUint16(28, nome.length, true);
    c.setUint32(42, pos, true);
    central.push(new Uint8Array(c.buffer), nome);
    pos += 30 + nome.length + it.comprimido;
  });
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, itens.length, true); fim.setUint16(10, itens.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fim.buffer], { type: 'application/zip' });
}

// ------------------------------------------------------------------ dados
/** Lê a tabela de 1.000 em 1.000 e entrega cada página; a tabela inteira nunca fica na memória. */
async function* paginas(sb: SupabaseClient, f: Fonte, mid: string): AsyncGenerator<Record<string, unknown>[]> {
  for (let de = 0; ; de += 1000) {
    let q = sb.from(f.tabela).select(f.via ? `*, ${f.via}!inner(municipio_id)` : '*');
    q = f.tabela === 'municipios' ? q.eq('id', mid) : f.via ? q.eq(`${f.via}.municipio_id`, mid) : q.eq('municipio_id', mid);
    if (f.extra) q = f.extra(q);
    for (const c of f.ordem) q = q.order(c);
    const { data, error } = await q.range(de, de + 999);
    if (error) throw new Error(`${f.tabela}: ${error.message}`);
    const linhas = data as Record<string, unknown>[];
    for (const l of linhas) {
      if (f.via) delete l[f.via];
      for (const k of OMITIR) delete l[k];
    }
    if (linhas.length) yield linhas;
    if (linhas.length < 1000) return;
  }
}

const celula = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function csv(linhas: Record<string, unknown>[]): string {
  if (!linhas.length) return BOM;
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  return BOM + [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(';'))].join(FIM_LINHA);
}

const LEIA_ME = (nome: string, quando: string, contagem: string) => `Exportação completa do portal: ${nome}
Gerada em: ${quando}

Formato aberto (RF19). Cada tabela está em dados/<tabela>.json (JSON, lista de registros) e,
exceto a auditoria, também em dados/<tabela>.csv (separado por ponto e vírgula, UTF-8, abre no
Excel e no LibreOffice). Campos com estrutura (listas, objetos) aparecem no CSV como JSON.
Os registros se ligam pelos campos *_id (ex.: publicacao_categorias.publicacao_id = publicacoes.id).

Arquivos (PDFs, imagens…):
  arquivos.csv               um por linha, com nome original, tipo, tamanho e endereço público
  arquivos-enderecos.txt     só os endereços, para baixar todos de uma vez (ex.: wget -i arquivos-enderecos.txt)
Os arquivos não vão dentro deste ZIP por causa do tamanho. A cópia integral pode ser pedida à SECKE.

Registros por tabela:
${contagem}
`;

interface Manifesto { feitas: string[]; itens: Item[]; contagem: Record<string, number> }

// ------------------------------------------------------------------ execução
Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = sb.storage.from('exportacoes');

  // "pendente" = há trabalho a fazer (nova ou continuação). O filtro por status evita que
  // duas execuções peguem a mesma.
  const { data: fila } = await sb.from('exportacoes').select('id, municipio_id').eq('status', 'pendente').order('criado_em').limit(1);
  if (!fila?.length) return json({ nada_a_fazer: true });
  const { id, municipio_id: mid } = fila[0];
  const { data: pega } = await sb.from('exportacoes').update({ status: 'processando', atualizado_em: new Date().toISOString() })
    .eq('id', id).eq('status', 'pendente').select('id');
  if (!pega?.length) return json({ nada_a_fazer: true });

  const pasta = `${mid}/tmp-${id}`;
  try {
    const { data: man } = await bucket.download(`${pasta}/manifesto.json`);
    const manifesto: Manifesto = man ? JSON.parse(await man.text()) : { feitas: [], itens: [], contagem: {} };
    const guardar = async (e: Entrada) => {
      const blob = await e.fechar();
      const caminho = `${pasta}/${manifesto.itens.length}.bin`;
      const { error } = await bucket.upload(caminho, blob, { contentType: 'application/octet-stream', upsert: true });
      if (error) throw new Error(`pedaço ${e.nome}: ${error.message}`);
      manifesto.itens.push({ nome: e.nome, caminho, crc: e.crc, tamanho: e.tamanho, comprimido: blob.size });
    };

    // 1) Tabelas, até o orçamento desta chamada.
    let texto = 0;
    for (const f of FONTES) {
      if (manifesto.feitas.includes(f.tabela)) continue;
      if (texto > ORCAMENTO_TEXTO) break;
      const js = new Entrada(`dados/${f.tabela}.json`);
      const cs = f.semCsv ? null : new Entrada(`dados/${f.tabela}.csv`);
      let colunas: string[] | null = null;
      let n = 0;
      await js.escrever('[');
      await cs?.escrever(BOM);
      for await (const pagina of paginas(sb, f, mid)) {
        // Todas as linhas de uma tabela têm as mesmas colunas (select *).
        if (!colunas) { colunas = Object.keys(pagina[0]); await cs?.escrever(colunas.join(';')); }
        const cols = colunas;
        const pj = pagina.map((l, i) => (n + i ? ',\n' : '\n') + JSON.stringify(l)).join('');
        await js.escrever(pj);
        texto += pj.length;
        if (cs) {
          const pc = pagina.map((l) => FIM_LINHA + cols.map((c) => celula(l[c])).join(';')).join('');
          await cs.escrever(pc);
          texto += pc.length;
        }
        n += pagina.length;
      }
      await js.escrever('\n]\n');
      await guardar(js);
      if (cs) await guardar(cs);
      manifesto.feitas.push(f.tabela);
      manifesto.contagem[f.tabela] = n;
      await sb.from('exportacoes').update({ atualizado_em: new Date().toISOString() }).eq('id', id);
    }

    const salvarManifesto = () => bucket.upload(`${pasta}/manifesto.json`, JSON.stringify(manifesto), { contentType: 'application/json', upsert: true });

    // Ainda falta tabela: guarda o progresso, devolve à fila e chama a si mesma.
    if (manifesto.feitas.length < FONTES.length) {
      await salvarManifesto();
      await sb.from('exportacoes').update({ status: 'pendente', atualizado_em: new Date().toISOString() }).eq('id', id);
      // @ts-ignore EdgeRuntime existe no runtime do Supabase
      EdgeRuntime.waitUntil(fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/exportar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }).catch(() => {}));
      return json({ exportacao: id, continua: true, feitas: manifesto.feitas.length, de: FONTES.length });
    }

    // 2) Último passo: usuários, lista de arquivos, LEIA-ME e montagem do ZIP.
    const pequenos = async (nome: string, conteudo: string) => { const e = new Entrada(nome); await e.escrever(conteudo); await guardar(e); };
    const { data: membros } = await sb.from('membros').select('user_id').eq('municipio_id', mid);
    const ids = (membros ?? []).map((m) => m.user_id);
    const { data: perfis } = ids.length ? await sb.from('perfis').select('user_id, nome, email, cargo').in('user_id', ids) : { data: [] };
    await pequenos('dados/usuarios.json', JSON.stringify(perfis ?? [], null, 1));
    await pequenos('dados/usuarios.csv', csv(perfis ?? []));
    manifesto.contagem.usuarios = (perfis ?? []).length;

    const arquivos: Record<string, unknown>[] = [];
    const publica = (p: unknown) => sb.storage.from('midias').getPublicUrl(String(p)).data.publicUrl;
    for await (const pagina of paginas(sb, { tabela: 'midias', ordem: ['id'] }, mid)) {
      for (const m of pagina) arquivos.push({
        nome_original: m.nome_original, tipo: m.mime_type, tamanho_bytes: m.tamanho_bytes, titulo: m.titulo,
        texto_alternativo: m.texto_alternativo, midia_id: m.id, endereco: publica(m.storage_path),
      });
    }
    await pequenos('arquivos.csv', csv(arquivos));
    await pequenos('arquivos-enderecos.txt', arquivos.map((a) => a.endereco).join('\n') + '\n');

    const { data: mun } = await sb.from('municipios').select('nome, slug').eq('id', mid).single();
    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const contagem = Object.entries(manifesto.contagem).map(([t, n]) => `  ${t.padEnd(24)} ${n}`).join('\n');
    await pequenos('LEIA-ME.txt', LEIA_ME(String(mun?.nome ?? mid), quando, contagem));

    const dados: Blob[] = [];
    for (const it of manifesto.itens) {
      const { data, error } = await bucket.download(it.caminho);
      if (error || !data) throw new Error(`pedaço ${it.nome}: ${error?.message ?? 'não encontrado'}`);
      dados.push(data);
    }
    const zip = zipDosPedacos(manifesto.itens, dados);
    const caminho = `${mid}/exportacao-${mun?.slug ?? 'municipio'}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`;
    const { error: eUp } = await bucket.upload(caminho, zip, { contentType: 'application/zip', upsert: true });
    if (eUp) throw new Error(`envio do ZIP: ${eUp.message}`);

    await sb.from('exportacoes').update({
      status: 'concluida', arquivo_path: caminho, erro: null, concluido_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
    }).eq('id', id);
    await bucket.remove([...manifesto.itens.map((i) => i.caminho), `${pasta}/manifesto.json`]);

    // Guarda só as últimas exportações do município (as antigas ocupam espaço sem uso).
    const { data: antigas } = await sb.from('exportacoes').select('id, arquivo_path').eq('municipio_id', mid)
      .eq('status', 'concluida').order('concluido_em', { ascending: false }).range(MANTER_ULTIMAS, 1000);
    const apagar = (antigas ?? []).filter((a) => a.arquivo_path);
    if (apagar.length) {
      await bucket.remove(apagar.map((a) => a.arquivo_path!));
      await sb.from('exportacoes').update({ arquivo_path: null }).in('id', apagar.map((a) => a.id));
    }
    return json({ exportacao: id, caminho, bytes: zip.size });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('exportacoes').update({ status: 'erro', erro: msg.slice(0, 500), atualizado_em: new Date().toISOString() }).eq('id', id);
    return json({ exportacao: id, erro: msg }, 500);
  }
});
