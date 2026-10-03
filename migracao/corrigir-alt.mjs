// Preenche a descrição (alt) das imagens dentro do texto do conteúdo JÁ migrado (ver alt.mjs).
// Só mexe em registros migrados (legado preenchido): o que foi escrito no painel não é tocado.
//
// Uso: node corrigir-alt.mjs --mapa mapas/jeriquara.json            (simula)
//      node corrigir-alt.mjs --mapa mapas/jeriquara.json --aplicar   (grava)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { preencherAlt } from './alt.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
for (const linha of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const mapa = JSON.parse(fs.readFileSync(args.mapa ?? 'mapas/jeriquara.json', 'utf8'));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const { error: eLogin } = await sb.auth.signInWithPassword({ email: process.env.MIGRACAO_EMAIL, password: process.env.MIGRACAO_SENHA });
if (eLogin) throw new Error(`Login falhou: ${eLogin.message}`);
const { data: mun } = await sb.from('municipios').select('id, nome').eq('slug', mapa.municipio_slug).single();
console.log(`${args.aplicar ? 'APLICANDO' : 'Simulação'} em ${mun.nome} (${process.env.SUPABASE_URL})`);

// Todas as consultas paginam: o PostgREST devolve no máximo 1.000 linhas (D-28).
async function todos(consulta) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) throw new Error(error.message);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

const alts = new Map((await todos(() => sb.from('midias').select('storage_path, texto_alternativo').eq('municipio_id', mun.id).not('texto_alternativo', 'is', null)))
  .map((m) => [m.storage_path, m.texto_alternativo]));

const alvos = [['publicacoes', 'corpo_html'], ['documentos', 'descricao_html'], ['paginas', 'corpo_html']];
let total = 0, imagens = 0;
for (const [tabela, coluna] of alvos) {
  const linhas = await todos(() => sb.from(tabela).select(`id, titulo, ${coluna}`).eq('municipio_id', mun.id).not('legado', 'is', null).ilike(coluna, '%<img%').order('id'));
  let n = 0;
  for (const l of linhas) {
    const novo = preencherAlt(l[coluna], (c) => alts.get(c), l.titulo);
    if (novo === l[coluna]) continue;
    n++; imagens += (l[coluna].match(/<img\b/gi) ?? []).length;
    if (args.aplicar) {
      const { error } = await sb.from(tabela).update({ [coluna]: novo }).eq('id', l.id);
      if (error) console.log(`  erro em ${tabela} ${l.id}: ${error.message}`);
    } else if (n <= 2) console.log(`  exemplo (${tabela}): ${(novo.match(/<img[^>]*>/i) ?? [''])[0].slice(0, 220)}`);
  }
  console.log(`${tabela}: ${n} de ${linhas.length} com imagem ${args.aplicar ? 'corrigidos' : 'seriam corrigidos'}`);
  total += n;
}
console.log(`Total: ${total} registros (${imagens} imagens nesses textos).${args.aplicar ? '' : ' Para gravar: --aplicar'}`);
await sb.auth.signOut();
