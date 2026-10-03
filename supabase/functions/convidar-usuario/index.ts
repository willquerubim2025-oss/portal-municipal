// Edge Function: convida um usuário para o painel de um município (D-21).
//
// A chave de serviço só cria a conta no Auth e grava o perfil (nome/e-mail, sem
// nenhum poder). O vínculo com o município (membros, que dá o papel) é gravado COM O
// TOKEN DE QUEM CONVIDA: o RLS confere que ele é admin daquele município e a
// auditoria registra quem fez.
//
// Envio do convite: tenta o e-mail do Supabase. Sem SMTP configurado (ou com o
// limite atingido), gera o link de convite e devolve para o admin repassar.
import { createClient } from 'npm:@supabase/supabase-js@2';

const PAPEIS = ['admin', 'publicador', 'editor'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const chavePublica = Deno.env.get('SUPABASE_ANON_KEY')!;
  const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const autorizacao = req.headers.get('Authorization') ?? '';

  // Cliente com a identidade de quem chamou: tudo o que ele grava passa pelo RLS.
  const comoUsuario = createClient(url, chavePublica, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: quem }, error: erroSessao } = await comoUsuario.auth.getUser(autorizacao.replace(/^Bearer /i, ''));
  if (erroSessao || !quem) return resposta(401, { erro: 'Sessão inválida. Entre de novo no painel.' });

  let corpo: { municipio_id?: string; email?: string; nome?: string; papel?: string; redirect_to?: string };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: 'Corpo inválido.' }); }
  const email = (corpo.email ?? '').trim().toLowerCase();
  const nome = (corpo.nome ?? '').trim();
  const papel = corpo.papel ?? '';
  const municipioId = corpo.municipio_id ?? '';
  if (!/^\S+@\S+\.\S+$/.test(email)) return resposta(400, { erro: 'E-mail inválido.' });
  if (!nome) return resposta(400, { erro: 'Informe o nome.' });
  if (!PAPEIS.includes(papel)) return resposta(400, { erro: 'Papel inválido.' });
  if (email === quem.email?.toLowerCase()) return resposta(400, { erro: 'Você não pode alterar o seu próprio acesso.' });

  const { data: ehAdmin, error: erroPapel } = await comoUsuario.rpc('is_admin', { p_municipio: municipioId });
  if (erroPapel || !ehAdmin) return resposta(403, { erro: 'Só o administrador da prefeitura pode convidar usuários.' });

  // O endereço de retorno só pode ser o painel (o Supabase ainda confere a lista de URLs permitidas).
  const redirectTo = /^(https:\/\/|http:\/\/localhost[:/])/.test(corpo.redirect_to ?? '') ? corpo.redirect_to : undefined;
  const admin = createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | undefined;
  let link: string | null = null;
  let enviado = false;
  let existente = false;

  const convite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nome } });
  if (!convite.error && convite.data.user) {
    userId = convite.data.user.id;
    enviado = true;
  } else {
    // Sem e-mail (SMTP) ou usuário já cadastrado: gera o link sem enviar.
    const gerado = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo, data: { nome } } });
    if (!gerado.error && gerado.data.user) {
      userId = gerado.data.user.id;
      link = gerado.data.properties?.action_link ?? null;
    } else {
      // Já existe no Auth (ex.: atende outra prefeitura): só cria o vínculo.
      const existenteLink = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
      if (existenteLink.error || !existenteLink.data.user) {
        return resposta(500, { erro: 'Não foi possível criar o usuário.', detalhe: existenteLink.error?.message ?? gerado.error?.message });
      }
      userId = existenteLink.data.user.id;
      // Nunca entrou (ex.: a conta foi criada mas o e-mail falhou): devolve o link para criar a senha.
      existente = !!existenteLink.data.user.last_sign_in_at;
      if (!existente) link = existenteLink.data.properties?.action_link ?? null;
    }
  }

  // Vínculo (papel) com o token de quem convidou: RLS + auditoria.
  const vinculo = await comoUsuario.from('membros').upsert(
    { municipio_id: municipioId, user_id: userId, papel, ativo: true },
    { onConflict: 'municipio_id,user_id' },
  );
  if (vinculo.error) return resposta(500, { erro: 'Usuário criado, mas o acesso à prefeitura não foi gravado.', detalhe: vinculo.error.message });
  // Perfil pelo servidor: o admin só "enxerga" perfis de colegas, e o convidado ainda não era.
  // Não sobrescreve o nome de quem já tinha perfil (atende outra prefeitura).
  const perfil = await admin.from('perfis').upsert({ user_id: userId, nome, email }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (perfil.error) return resposta(500, { erro: 'Acesso criado, mas o perfil não foi gravado.', detalhe: perfil.error.message });

  return resposta(200, { user_id: userId, enviado, link, existente });
});
