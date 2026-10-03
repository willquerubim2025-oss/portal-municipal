// Remove da HOMOLOGAÇÃO o que os testes automáticos criaram ("E2E" no nome) e,
// com --exemplos, o conteúdo fictício de exemplo (legado.exemplo = true).
// Mantém os órgãos de exemplo (servem para mostrar a página à prefeitura).
// Simula por padrão; use --aplicar para apagar. Nunca roda na produção.
//
//   node e2e/limpar-homologacao.mjs [--exemplos] [--aplicar]
import { createClient } from '@supabase/supabase-js';

const URL_HOMOLOGACAO = 'https://kvilgamsyneenjtlllcf.supabase.co';
const CHAVE = 'sb_publishable_Be47d2VktOMB_5vhUi8Y7A_oQU9yTsv'; // publicável (homologação)
const aplicar = process.argv.includes('--aplicar');
const exemplos = process.argv.includes('--exemplos');

const sb = createClient(URL_HOMOLOGACAO, CHAVE, { auth: { persistSession: false } });
const { error: erroLogin } = await sb.auth.signInWithPassword({ email: 'secke.teste@exemplo.gov.br', password: 'Teste@Homologacao2026' });
if (erroLogin) throw new Error(`Login falhou: ${erroLogin.message}`);
if (!URL_HOMOLOGACAO.includes('kvilgamsyneenjtlllcf')) throw new Error('Este roteiro só roda na homologação.');

// [tabela, coluna de texto, coluna de id]
const ALVOS = [
  ['destaques', 'titulo'], ['menu_itens', 'rotulo'], ['transparencia_itens', 'titulo'], ['documento_relacoes', null],
  ['publicacoes', 'titulo'], ['documentos', 'titulo'], ['paginas', 'titulo'], ['servicos', 'titulo'], ['eventos', 'titulo'],
  ['perguntas_frequentes', 'pergunta'], ['orgaos', 'nome'], ['sistemas_externos', 'nome'], ['categorias', 'nome'],
];

let total = 0;
for (const [tabela, coluna] of ALVOS) {
  if (!coluna) continue;
  const { data: e2e } = await sb.from(tabela).select(`id, ${coluna}`).ilike(coluna, '%E2E%');
  let lista = e2e ?? [];
  if (exemplos && !['orgaos', 'menu_itens', 'transparencia_itens', 'sistemas_externos', 'categorias'].includes(tabela)) {
    const temLegado = !['destaques'].includes(tabela);
    if (temLegado) {
      const { data: ex } = await sb.from(tabela).select(`id, ${coluna}`).eq('legado->>exemplo', 'true');
      lista = [...lista, ...(ex ?? [])];
    } else {
      // destaques não tem legado: o único exemplo é o alerta "Campanha de vacinação".
      const { data: ex } = await sb.from(tabela).select(`id, ${coluna}`).eq(coluna, 'Campanha de vacinação');
      lista = [...lista, ...(ex ?? [])];
    }
  }
  const unicos = [...new Map(lista.map((x) => [x.id, x])).values()];
  if (!unicos.length) continue;
  console.log(`${tabela}: ${unicos.length}`);
  unicos.slice(0, 4).forEach((x) => console.log(`   - ${x[coluna]}`));
  if (unicos.length > 4) console.log(`   … e mais ${unicos.length - 4}`);
  total += unicos.length;
  if (aplicar) {
    const { error } = await sb.from(tabela).delete().in('id', unicos.map((x) => x.id));
    if (error) console.log(`   ERRO ao apagar: ${error.message}`);
  }
}
// Redirecionamentos criados pelos testes.
const { data: redir } = await sb.from('redirecionamentos').select('id, origem').ilike('origem', '%e2e%');
if (redir?.length) {
  console.log(`redirecionamentos: ${redir.length}`);
  total += redir.length;
  if (aplicar) await sb.from('redirecionamentos').delete().in('id', redir.map((x) => x.id));
}
// Usuários convidados nos testes perdem o acesso (a conta no Auth fica; sem vínculo não entra).
const { data: perfisTeste } = await sb.from('perfis').select('user_id').like('email', 'novo.e2e.%');
const { data: membros } = perfisTeste?.length
  ? await sb.from('membros').select('user_id').in('user_id', perfisTeste.map((p) => p.user_id))
  : { data: [] };
if (membros?.length) {
  console.log(`acessos de usuários de teste: ${membros.length}`);
  total += membros.length;
  if (aplicar) await sb.from('membros').delete().in('user_id', membros.map((m) => m.user_id));
}
console.log(`\n${total} itens ${aplicar ? 'apagados' : 'seriam apagados (simulação; use --aplicar)'}${exemplos ? ' (incluindo exemplos)' : ''}.`);
await sb.auth.signOut();
