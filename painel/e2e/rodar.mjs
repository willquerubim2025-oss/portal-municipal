// Roda as baterias de teste em sequência (contas: e2e/.env.e2e; preparar uma vez com `node e2e/preparar.mjs`) e, mesmo se alguma falhar, limpa da homologação
// o que os testes criaram (itens "E2E"). Uso: npm run e2e
import { spawnSync } from 'node:child_process';

const BATERIAS = ['noticias', 'conteudo', 'estrutura', 'administracao', 'escola'];
const falhas = [];
for (const b of BATERIAS) {
  console.log(`\n=== ${b} ===`);
  const r = spawnSync(process.execPath, [`e2e/${b}.mjs`], { stdio: 'inherit' });
  if (r.status !== 0) falhas.push(b);
}
console.log('\n=== limpeza da homologação ===');
spawnSync(process.execPath, ['e2e/limpar-homologacao.mjs', '--aplicar'], { stdio: 'inherit' });
console.log(falhas.length ? `\nFALHOU: ${falhas.join(', ')}` : '\nTodas as baterias passaram.');
process.exit(falhas.length ? 1 : 0);
