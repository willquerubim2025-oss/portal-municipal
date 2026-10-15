// Envia o catálogo de permissões do código (src/lib/permissoes.catalogo.json) ao banco: insere as novas
// (desligadas para todos os papéis), atualiza as existentes e inativa as que saíram do código (D-38).
// Só a chave de serviço pode chamar public.sincronizar_permissoes. Nunca versionar a chave (D-25).
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run permissoes:sincronizar
//
// Rodar a cada deploy do painel, na homologação e na produção.
import fs from 'node:fs';

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (chave de serviço do ambiente).');
  process.exit(1);
}
const catalogo = JSON.parse(fs.readFileSync(new URL('../src/lib/permissoes.catalogo.json', import.meta.url), 'utf8'));
const r = await fetch(`${url}/rest/v1/rpc/sincronizar_permissoes`, {
  method: 'POST',
  headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_catalogo: catalogo }),
});
const corpo = await r.text();
if (!r.ok) { console.error(`Falhou (${r.status}): ${corpo}`); process.exit(1); }
console.log(`Catálogo sincronizado (${catalogo.length} permissões):`, corpo);
