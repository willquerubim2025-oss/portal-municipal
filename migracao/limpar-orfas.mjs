// Remove mídias migradas que não são usadas em lugar nenhum (ex.: cópias de uma rodada antiga).
// Só considera mídias com legado.url (vindas da migração). Simula por padrão; use --aplicar para apagar.
// Uso: node limpar-orfas.mjs --mapa mapas/jeriquara.json [--aplicar]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const aplicar = process.argv.includes('--aplicar');
const iMapa = process.argv.indexOf('--mapa');
const mapa = JSON.parse(fs.readFileSync(iMapa > 0 ? process.argv[iMapa + 1] : 'mapas/jeriquara.json', 'utf8'));
for (const linha of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: process.env.MIGRACAO_EMAIL, password: process.env.MIGRACAO_SENHA });
const { data: mun } = await sb.from('municipios').select('id').eq('slug', mapa.municipio_slug).single();
const MID = mun.id;

async function todas(tabela, colunas, filtro = (q) => q) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtro(sb.from(tabela).select(colunas).eq('municipio_id', MID)).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

const midias = await todas('midias', 'id, storage_path, tamanho_bytes, legado', (q) => q.not('legado->>url', 'is', null));
const usadas = new Set();
const marcar = (id) => id && usadas.add(id);
// Referências diretas.
// Anexos de documentos: em páginas de 1.000 (o PostgREST devolve no máximo 1.000 linhas por consulta;
// sem paginar, anexos além do milésimo pareciam "sem uso" e seriam apagados).
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('documento_arquivos').select('midia_id, documento:documentos!inner(municipio_id)')
    .eq('documento.municipio_id', MID).not('midia_id', 'is', null).order('id').range(de, de + 999);
  if (error) throw new Error(`documento_arquivos: ${error.message}`);
  data.forEach((a) => marcar(a.midia_id));
  if (data.length < 1000) break;
}
(await todas('publicacoes', 'imagem_destaque_id')).forEach((p) => marcar(p.imagem_destaque_id));
(await todas('publicacao_midias', 'midia_id')).forEach((p) => marcar(p.midia_id));
(await todas('orgaos', 'responsavel_foto_id')).forEach((o) => marcar(o.responsavel_foto_id));
(await todas('eventos', 'imagem_id')).forEach((e) => marcar(e.imagem_id));
(await todas('destaques', 'imagem_id')).forEach((d) => marcar(d.imagem_id));
// Referências no HTML (imagens e links dentro do texto).
const textos = [
  ...(await todas('publicacoes', 'corpo_html')).map((x) => x.corpo_html),
  ...(await todas('documentos', 'descricao_html')).map((x) => x.descricao_html),
  ...(await todas('paginas', 'corpo_html')).map((x) => x.corpo_html),
  ...(await todas('servicos', 'requisitos_html, etapas_html')).flatMap((x) => [x.requisitos_html, x.etapas_html]),
].filter(Boolean).join('\n');
const { data: mtemas } = await sb.from('municipios').select('tema, config').eq('id', MID).single();
const caminhosTema = JSON.stringify(mtemas);

const orfas = midias.filter((m) => !usadas.has(m.id) && !textos.includes(m.storage_path) && !caminhosTema.includes(m.storage_path));
const mb = orfas.reduce((s, m) => s + (m.tamanho_bytes ?? 0), 0) / 1048576;
console.log(`${midias.length} mídias migradas · ${orfas.length} órfãs (${mb.toFixed(1)} MB)${aplicar ? '' : ' · simulação (use --aplicar para apagar)'}`);
if (!aplicar) { orfas.slice(0, 5).forEach((m) => console.log('  -', m.legado?.url)); process.exit(0); }

let apagadas = 0;
for (let i = 0; i < orfas.length; i += 100) {
  const lote = orfas.slice(i, i + 100);
  const st = await sb.storage.from('midias').remove(lote.map((m) => m.storage_path));
  if (st.error) { console.error('Storage:', st.error.message); continue; }
  const { error } = await sb.from('midias').delete().in('id', lote.map((m) => m.id));
  if (error) { console.error('midias:', error.message); continue; }
  apagadas += lote.length;
}
console.log(`Apagadas: ${apagadas} mídias órfãs (${mb.toFixed(1)} MB liberados).`);
