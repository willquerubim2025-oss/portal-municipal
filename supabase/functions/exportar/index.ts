// Edge Function: exportação completa de um município (RF19, D-32).
//
// Chamada a cada minuto pelo pg_cron (interno.disparar_rotinas) quando há exportação
// pendente. Pega a mais antiga, lê todas as tabelas do município (paginando de 1.000 em
// 1.000) e grava um ZIP no bucket privado "exportacoes", na pasta do município:
//   dados/<tabela>.json e dados/<tabela>.csv   (CSV com ";" e BOM, abre direto no Excel)
//   arquivos.csv                               (todos os arquivos, com o endereço público de cada um)
//   arquivos-enderecos.txt                     (só os endereços, um por linha: baixar com wget -i)
//   LEIA-ME.txt
// Os arquivos em si (vários GB) não vão no ZIP: ficam públicos no endereço indicado, e a
// SECKE entrega a cópia integral ao fim do contrato (ver docs).
// Deploy com verify_jwt = false: chamar de fora só adianta o trabalho já pedido.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { Zip, ZipDeflate, strToU8 } from 'npm:fflate@0.8.2';

const MANTER_ULTIMAS = 3;

// Tabela, filtro pelo município e ordem estável para paginar.
// `via`: tabela sem municipio_id, filtrada pelo registro pai (join do PostgREST).
interface Fonte { tabela: string; ordem: string[]; via?: string; extra?: (q: any) => any }
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
  { tabela: 'auditoria', ordem: ['id'] },
];
// Colunas técnicas que não fazem sentido fora do banco.
const OMITIR = new Set(['busca']);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

async function lerTudo(sb: SupabaseClient, f: Fonte, mid: string): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(f.tabela).select(f.via ? `*, ${f.via}!inner(municipio_id)` : '*');
    q = f.tabela === 'municipios' ? q.eq('id', mid) : f.via ? q.eq(`${f.via}.municipio_id`, mid) : q.eq('municipio_id', mid);
    if (f.extra) q = f.extra(q);
    for (const c of f.ordem) q = q.order(c);
    const { data, error } = await q.range(de, de + 999);
    if (error) throw new Error(`${f.tabela}: ${error.message}`);
    for (const l of data as Record<string, unknown>[]) {
      if (f.via) delete l[f.via];
      for (const k of OMITIR) delete l[k];
      linhas.push(l);
    }
    if (data.length < 1000) return linhas;
  }
}

function csv(linhas: Record<string, unknown>[]): string {
  if (!linhas.length) return '﻿';
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const celula = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(';'))].join('\r\n');
}

const LEIA_ME = (nome: string, quando: string, contagem: string) => `Exportação completa do portal: ${nome}
Gerada em: ${quando}

Formato aberto (RF19). Cada tabela está em dois formatos com o mesmo conteúdo:
  dados/<tabela>.json  JSON (lista de registros), para sistemas
  dados/<tabela>.csv   CSV separado por ponto e vírgula, UTF-8, abre no Excel e no LibreOffice
Campos com estrutura (listas, objetos) aparecem no CSV como JSON.
Os registros se ligam pelos campos *_id (ex.: publicacao_categorias.publicacao_id = publicacoes.id).

Arquivos (PDFs, imagens…):
  arquivos.csv               um por linha, com nome original, tipo, tamanho e endereço público
  arquivos-enderecos.txt     só os endereços, para baixar todos de uma vez (ex.: wget -i arquivos-enderecos.txt)
Os arquivos não vão dentro deste ZIP por causa do tamanho. A cópia integral pode ser pedida à SECKE.

Registros por tabela:
${contagem}
`;

Deno.serve(async () => {
  const urlProjeto = Deno.env.get('SUPABASE_URL')!;
  const sb = createClient(urlProjeto, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pega a pendente mais antiga; o filtro por status evita que duas execuções peguem a mesma.
  const { data: fila } = await sb.from('exportacoes').select('id, municipio_id').eq('status', 'pendente').order('criado_em').limit(1);
  if (!fila?.length) return json({ nada_a_fazer: true });
  const { id, municipio_id: mid } = fila[0];
  const { data: pega } = await sb.from('exportacoes').update({ status: 'processando', atualizado_em: new Date().toISOString() })
    .eq('id', id).eq('status', 'pendente').select('id');
  if (!pega?.length) return json({ nada_a_fazer: true });

  try {
    const partes: Uint8Array[] = [];
    let falha: Error | null = null;
    const zip = new Zip((err, pedaco) => { if (err) falha = err; else partes.push(pedaco); });
    const adicionar = (nome: string, texto: string) => {
      const arq = new ZipDeflate(nome, { level: 6 });
      zip.add(arq);
      arq.push(strToU8(texto), true);
    };

    const contagem: string[] = [];
    let municipio: Record<string, unknown> | null = null;
    let midias: Record<string, unknown>[] = [];
    for (const f of FONTES) {
      const linhas = await lerTudo(sb, f, mid);
      if (f.tabela === 'municipios') municipio = linhas[0] ?? null;
      if (f.tabela === 'midias') midias = linhas;
      adicionar(`dados/${f.tabela}.json`, JSON.stringify(linhas, null, 1));
      adicionar(`dados/${f.tabela}.csv`, csv(linhas));
      contagem.push(`  ${f.tabela.padEnd(24)} ${linhas.length}`);
      await sb.from('exportacoes').update({ atualizado_em: new Date().toISOString() }).eq('id', id);
    }

    // Usuários do painel: só nome, e-mail e cargo de quem é membro deste município.
    const { data: membros } = await sb.from('membros').select('user_id').eq('municipio_id', mid);
    const ids = (membros ?? []).map((m) => m.user_id);
    const { data: perfis } = ids.length ? await sb.from('perfis').select('user_id, nome, email, cargo').in('user_id', ids) : { data: [] };
    adicionar('dados/usuarios.json', JSON.stringify(perfis ?? [], null, 1));
    adicionar('dados/usuarios.csv', csv(perfis ?? []));
    contagem.push(`  ${'usuarios'.padEnd(24)} ${(perfis ?? []).length}`);

    const publica = (p: unknown) => sb.storage.from('midias').getPublicUrl(String(p)).data.publicUrl;
    const arquivos = midias.map((m) => ({
      nome_original: m.nome_original, tipo: m.mime_type, tamanho_bytes: m.tamanho_bytes, titulo: m.titulo,
      texto_alternativo: m.texto_alternativo, midia_id: m.id, endereco: publica(m.storage_path),
    }));
    adicionar('arquivos.csv', csv(arquivos));
    adicionar('arquivos-enderecos.txt', arquivos.map((a) => a.endereco).join('\n') + '\n');

    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    adicionar('LEIA-ME.txt', LEIA_ME(String(municipio?.nome ?? mid), quando, contagem.join('\n')));
    zip.end();
    if (falha) throw falha;

    const tamanho = partes.reduce((s, p) => s + p.length, 0);
    const corpo = new Uint8Array(tamanho);
    let pos = 0;
    for (const p of partes) { corpo.set(p, pos); pos += p.length; }
    const slug = String(municipio?.slug ?? 'municipio');
    const caminho = `${mid}/exportacao-${slug}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`;
    const { error: eUp } = await sb.storage.from('exportacoes').upload(caminho, corpo, { contentType: 'application/zip', upsert: true });
    if (eUp) throw new Error(`envio do ZIP: ${eUp.message}`);

    await sb.from('exportacoes').update({
      status: 'concluida', arquivo_path: caminho, erro: null, concluido_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
    }).eq('id', id);

    // Guarda só as últimas exportações do município (as antigas ocupam espaço sem uso).
    const { data: antigas } = await sb.from('exportacoes').select('id, arquivo_path').eq('municipio_id', mid)
      .eq('status', 'concluida').order('concluido_em', { ascending: false }).range(MANTER_ULTIMAS, 1000);
    const apagar = (antigas ?? []).filter((a) => a.arquivo_path);
    if (apagar.length) {
      await sb.storage.from('exportacoes').remove(apagar.map((a) => a.arquivo_path!));
      await sb.from('exportacoes').update({ arquivo_path: null }).in('id', apagar.map((a) => a.id));
    }
    return json({ exportacao: id, caminho, bytes: tamanho });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('exportacoes').update({ status: 'erro', erro: msg.slice(0, 500), atualizado_em: new Date().toISOString() }).eq('id', id);
    return json({ exportacao: id, erro: msg }, 500);
  }
});
