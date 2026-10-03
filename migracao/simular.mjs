// Simulação: classifica todos os posts do inventário pelo mapa e gera um relatório
// para revisão, sem gravar nada. Uso: node simular.mjs <inventario.json> <mapa.json>
import fs from 'node:fs';
import path from 'node:path';
import { classificar, textoPlano, numeroEAno } from './classificar.mjs';

const [, , arqInventario = '../inventario-bruto.json', arqMapa = 'mapas/jeriquara.json'] = process.argv;
const inv = JSON.parse(fs.readFileSync(arqInventario, 'utf8'));
const mapa = JSON.parse(fs.readFileSync(arqMapa, 'utf8'));
const nomeCat = new Map(inv.categories.map((c) => [String(c.id), textoPlano(c.name)]));

const grupos = new Map();
for (const p of inv.posts) {
  const r = classificar(p, mapa);
  const chave = `${r.tipo === 'documento' ? 'Documento' : r.arquivo ? 'Notícia (arquivo)' : 'Notícia'} → ${r.categoria}${r.modalidade ? ` (${r.modalidade})` : ''}`;
  if (!grupos.has(chave)) grupos.set(chave, []);
  grupos.get(chave).push({ p, r });
}

const linhas = [];
const total = (f) => [...grupos].filter(([k]) => f(k)).reduce((s, [, v]) => s + v.length, 0);
linhas.push(`# Simulação da migração: ${mapa.municipio_slug}`, '', `Gerado em ${new Date().toLocaleString('pt-BR')} a partir de ${path.basename(arqInventario)} (${inv.posts.length} posts).`, '');
linhas.push(`- **Notícias:** ${total((k) => k.startsWith('Notícia →'))}`, `- **Notícias em arquivo** (fora das listagens, link mantido): ${total((k) => k.startsWith('Notícia (arquivo)'))}`, `- **Documentos:** ${total((k) => k.startsWith('Documento'))}`, '');
linhas.push('| Destino | Quantidade |', '|---|---|');
for (const [k, v] of [...grupos].sort((a, b) => b[1].length - a[1].length)) linhas.push(`| ${k} | ${v.length} |`);
linhas.push('', '## Exemplos por destino (até 6)', '');
for (const [k, v] of [...grupos].sort((a, b) => a[0].localeCompare(b[0]))) {
  linhas.push(`### ${k} (${v.length})`);
  for (const { p, r } of v.slice(0, 6)) {
    const na = r.tipo === 'documento' ? numeroEAno(p.title.rendered, p.date) : null;
    linhas.push(`- ${textoPlano(p.title.rendered).slice(0, 110)}  \n  <small>WP: ${p.categories.map((c) => nomeCat.get(String(c))).join(', ')} · regra: ${r.regra}${na?.numero ? ` · nº ${na.numero}/${na.ano}` : ''}</small>`);
  }
  linhas.push('');
}
fs.mkdirSync('relatorios', { recursive: true });
fs.writeFileSync(`relatorios/simulacao-${mapa.municipio_slug}.md`, linhas.join('\n'));
console.log(linhas.slice(0, 8 + grupos.size + 2).join('\n'));
