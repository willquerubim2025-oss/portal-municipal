// Edge Function: o administrador corrige o nome e/ou o e-mail (login) de uma pessoa da organização
// (D-134 do portal; D-74 da CI). O e-mail mora no Supabase Auth, então só a chave de serviço muda.
//
// Quem pode: administrador da organização (is_admin) ou administrador da CI (ci.e_admin), conferidos
// com o token de quem chama. Em quem: só em pessoa ligada SOMENTE a esta organização (membros,
// usuario_papeis ou ci.membros) e que não seja da equipe da plataforma. Conta compartilhada com outra
// organização é recusada: mudar o login dela afetaria a outra (quem resolve é a SECKE).
// A mudança vai para a auditoria (tabela perfis), com o antes e o depois.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const autorizacao = req.headers.get('Authorization') ?? '';
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: quem }, error: erroSessao } = await comoUsuario.auth.getUser(autorizacao.replace(/^Bearer /i, ''));
  if (erroSessao || !quem) return resposta(401, { erro: 'Sessão inválida. Entre de novo.' });

  let corpo: { municipio_id?: string; user_id?: string; nome?: string; email?: string };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: 'Corpo inválido.' }); }
  const municipioId = corpo.municipio_id ?? '';
  const alvo = corpo.user_id ?? '';
  const nome = (corpo.nome ?? '').trim();
  const email = (corpo.email ?? '').trim().toLowerCase();
  if (!uuid.test(municipioId) || !uuid.test(alvo)) return resposta(400, { erro: 'Pessoa ou organização inválida.' });
  if (!nome && !email) return resposta(400, { erro: 'Informe o nome ou o e-mail novo.' });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return resposta(400, { erro: 'E-mail inválido.' });

  // Permissão de quem chama (com o token dele).
  const [adm, admCi] = await Promise.all([
    comoUsuario.rpc('is_admin', { p_municipio: municipioId }),
    comoUsuario.schema('ci').rpc('e_admin', { p_municipio: municipioId }),
  ]);
  if (!adm.data && !admCi.data) return resposta(403, { erro: 'Só o administrador pode alterar os dados de uma pessoa.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

  // A pessoa precisa estar ligada a esta organização, e só a ela.
  const [m, up, cm, ep] = await Promise.all([
    admin.from('membros').select('municipio_id').eq('user_id', alvo),
    admin.from('usuario_papeis').select('municipio_id').eq('user_id', alvo),
    admin.schema('ci').from('membros').select('municipio_id').eq('user_id', alvo),
    admin.from('equipe_plataforma').select('user_id').eq('user_id', alvo),
  ]);
  const orgs = new Set([...(m.data ?? []), ...(up.data ?? []), ...(cm.data ?? [])].map((x) => x.municipio_id as string));
  if (!orgs.has(municipioId)) return resposta(404, { erro: 'Esta pessoa não faz parte da organização.' });
  if (orgs.size > 1 || (ep.data ?? []).length) {
    return resposta(409, { erro: 'Esta pessoa também atende outra organização. Para não afetar a outra, peça a mudança à SECKE.' });
  }

  const { data: antes } = await admin.from('perfis').select('nome, email').eq('user_id', alvo).maybeSingle();

  if (email && email !== (antes?.email ?? '').toLowerCase()) {
    const { data: lista } = await admin.from('perfis').select('user_id').ilike('email', email).neq('user_id', alvo).limit(1);
    if ((lista ?? []).length) return resposta(409, { erro: 'Já existe outra pessoa com esse e-mail.' });
    const mud = await admin.auth.admin.updateUserById(alvo, { email, email_confirm: true });
    if (mud.error) return resposta(400, { erro: 'Não foi possível trocar o e-mail.', detalhe: mud.error.message });
  }
  const novo = { ...(nome ? { nome } : {}), ...(email ? { email } : {}) };
  const per = await admin.from('perfis').upsert({ user_id: alvo, nome: nome || antes?.nome || email, email: email || antes?.email, ...novo }, { onConflict: 'user_id' });
  if (per.error) return resposta(500, { erro: 'O login mudou, mas o perfil não foi gravado.', detalhe: per.error.message });

  await admin.from('auditoria').insert({
    municipio_id: municipioId, tabela: 'perfis', registro_id: alvo, acao: 'UPDATE', user_id: quem.id,
    antes: antes ?? null, depois: { nome: nome || antes?.nome, email: email || antes?.email },
  });
  return resposta(200, { ok: true });
});
