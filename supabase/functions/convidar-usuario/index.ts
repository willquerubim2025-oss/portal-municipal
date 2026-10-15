// Edge Function: convida um usuário para o painel de um município (D-21).
//
// A chave de serviço só cria a conta no Auth e grava o perfil (nome/e-mail, sem
// nenhum poder). O vínculo com o município é gravado COM O TOKEN DE QUEM CONVIDA:
//  - `papel` (antigo: admin/publicador/editor) → membros; o RLS exige is_admin;
//  - `papel_id` (papel configurável, D-38/D-78) → usuario_papeis, com unidade_id ou
//    regiao_id opcionais; o RLS exige usuarios.vincular (e permissoes.gerenciar para
//    o papel Administrador). Toda mudança vai para a auditoria / histórico.
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

  let corpo: {
    municipio_id?: string; email?: string; nome?: string; papel?: string; redirect_to?: string;
    papel_id?: string; unidade_id?: string | null; regiao_id?: string | null;
  };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: 'Corpo inválido.' }); }
  const email = (corpo.email ?? '').trim().toLowerCase();
  const nome = (corpo.nome ?? '').trim();
  const papel = corpo.papel ?? '';
  const papelId = corpo.papel_id ?? '';
  const unidadeId = corpo.unidade_id || null;
  const regiaoId = corpo.regiao_id || null;
  const municipioId = corpo.municipio_id ?? '';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!/^\S+@\S+\.\S+$/.test(email)) return resposta(400, { erro: 'E-mail inválido.' });
  if (!nome) return resposta(400, { erro: 'Informe o nome.' });
  if (!uuid.test(municipioId)) return resposta(400, { erro: 'Organização inválida.' });
  if (papelId ? !uuid.test(papelId) || papel : !PAPEIS.includes(papel)) return resposta(400, { erro: 'Papel inválido.' });
  if ((unidadeId && !uuid.test(unidadeId)) || (regiaoId && !uuid.test(regiaoId)) || (unidadeId && regiaoId)) {
    return resposta(400, { erro: 'Escolha a unidade ou a região, não as duas.' });
  }
  if (email === quem.email?.toLowerCase()) return resposta(400, { erro: 'Você não pode alterar o seu próprio acesso.' });

  // Checagem antecipada (o RLS confere de novo ao gravar): não cria conta para quem não poderia convidar.
  const checagem = papelId
    ? await comoUsuario.rpc('pode', { p_municipio: municipioId, p_permissao: 'usuarios.vincular' })
    : await comoUsuario.rpc('is_admin', { p_municipio: municipioId });
  if (checagem.error || !checagem.data) {
    return resposta(403, { erro: papelId ? 'Você não tem permissão para atribuir papéis nesta organização.' : 'Só o administrador da prefeitura pode convidar usuários.' });
  }
  if (papelId) {
    // O papel precisa existir, estar ativo e ser desta organização (RLS de papeis: quem vincula vê).
    const { data: p } = await comoUsuario.from('papeis').select('id, ativo').eq('id', papelId).eq('municipio_id', municipioId).maybeSingle();
    if (!p?.ativo) return resposta(400, { erro: 'Papel inválido ou desativado.' });
  }

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
  let erroVinculo: string | null = null;
  if (papelId) {
    const ins = await comoUsuario.from('usuario_papeis').insert(
      { municipio_id: municipioId, user_id: userId, papel_id: papelId, unidade_id: unidadeId, regiao_id: regiaoId },
    );
    if (ins.error?.code === '23505') {
      // Já tinha esse papel nesse lugar: só reativa.
      let q = comoUsuario.from('usuario_papeis').update({ ativo: true }).eq('user_id', userId!).eq('papel_id', papelId);
      q = unidadeId ? q.eq('unidade_id', unidadeId) : q.is('unidade_id', null);
      q = regiaoId ? q.eq('regiao_id', regiaoId) : q.is('regiao_id', null);
      const up = await q;
      if (up.error) erroVinculo = up.error.message;
    } else if (ins.error) erroVinculo = ins.error.message;
  } else {
    const up = await comoUsuario.from('membros').upsert(
      { municipio_id: municipioId, user_id: userId, papel, ativo: true },
      { onConflict: 'municipio_id,user_id' },
    );
    if (up.error) erroVinculo = up.error.message;
  }
  if (erroVinculo) return resposta(500, { erro: 'Usuário criado, mas o acesso à organização não foi gravado.', detalhe: erroVinculo });
  // Perfil pelo servidor: o admin só "enxerga" perfis de colegas, e o convidado ainda não era.
  // Não sobrescreve o nome de quem já tinha perfil (atende outra prefeitura).
  const perfil = await admin.from('perfis').upsert({ user_id: userId, nome, email }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (perfil.error) return resposta(500, { erro: 'Acesso criado, mas o perfil não foi gravado.', detalhe: perfil.error.message });

  return resposta(200, { user_id: userId, enviado, link, existente });
});
