// Área do consumidor (D-139): o portal fala direto com o banco do SigDoc, no navegador do consumidor.
// Só roda no navegador (importado pelos <script> do modal e da página /area-do-consumidor).
// A chave abaixo é a chave PÚBLICA (anon) do SigDoc, a mesma que vai no site sigdocconsumidor.com:
// não é segredo; quem protege os dados é o RLS do banco do SigDoc (cada consumidor só vê o que é dele).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SIGDOC_URL = 'https://bcasxgmpqasbxrewfdwx.supabase.co';
const SIGDOC_CHAVE_PUBLICA =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYXN4Z21wcWFzYnhyZXdmZHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDcyMTQsImV4cCI6MjA4Nzg4MzIxNH0.Ols4rb1JdhMkjKsc4okKgVoCPCR_YZrUEcLEcrfBirw';
/** Site do SigDoc: troca de senha ("esqueci minha senha") continua sendo feita lá. */
export const SIGDOC_SITE = 'https://sigdocconsumidor.com';
export const PAGINA_AREA = '/area-do-consumidor';

let cliente: SupabaseClient | null = null;
export function sigdoc(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(SIGDOC_URL, SIGDOC_CHAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sigdoc-consumidor' },
    });
  }
  return cliente;
}

export interface Consumidor {
  id: string; fullName: string; cpf: string | null; rg?: string | null; email: string; phone?: string | null;
  city?: string | null; cep?: string | null; addressNumber?: string | null; complement?: string | null; status: string;
}

const BLOQUEADOS = ['Desabilitado', 'Inabilitado', 'Inativo'];

export type Situacao =
  | { tipo: 'sem-login' }
  | { tipo: 'tecnico' }
  | { tipo: 'bloqueado' }
  | { tipo: 'sem-perfil' }
  | { tipo: 'completar'; consumidor: Consumidor }
  | { tipo: 'ok'; consumidor: Consumidor };

/** Quem está logado neste navegador e o que falta (mesmas regras do App.tsx do SigDoc). */
export async function situacaoAtual(): Promise<Situacao> {
  const sb = sigdoc();
  const { data: { session } } = await sb.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return { tipo: 'sem-login' };
  const { data: tecnico } = await sb.from('usuarios').select('id').eq('id', uid).maybeSingle();
  if (tecnico) return { tipo: 'tecnico' };
  const { data: c } = await sb.from('usuarios_consumidores').select('*').eq('id', uid).maybeSingle();
  if (!c) return { tipo: 'sem-perfil' };
  const consumidor = c as Consumidor;
  if (BLOQUEADOS.includes(consumidor.status)) return { tipo: 'bloqueado' };
  if (!consumidor.cpf) return { tipo: 'completar', consumidor };
  return { tipo: 'ok', consumidor };
}

export async function entrar(email: string, senha: string): Promise<{ erro?: string; confirmar?: boolean }> {
  const { error } = await sigdoc().auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) {
    if (/not confirmed/i.test(error.message)) return { erro: 'Seu e-mail ainda não foi confirmado. Abra o link que enviamos para o seu e-mail.', confirmar: true };
    return { erro: 'E-mail ou senha incorretos.' };
  }
  return {};
}

export async function entrarComGoogle(): Promise<{ erro?: string }> {
  const { error } = await sigdoc().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${PAGINA_AREA}`, queryParams: { prompt: 'select_account' } },
  });
  return error ? { erro: 'Não foi possível abrir o login do Google. Tente de novo.' } : {};
}

export async function loginGoogleAtivo(): Promise<boolean> {
  try {
    const { data } = await sigdoc().from('configuracoes_sistema').select('valor').eq('chave', 'login_google').maybeSingle();
    return (data as { valor?: string } | null)?.valor === 'sim';
  } catch { return false; }
}

export async function sair(): Promise<void> {
  try { await sigdoc().auth.signOut(); } catch { /* sai mesmo sem internet */ }
}

export interface DadosCadastro {
  nome: string; cpf: string; rg: string; telefone: string; cidade: string; cep: string; numero: string; complemento?: string;
  email: string; senha: string;
}

/** Cadastro por e-mail e senha: igual ao do SigDoc (conta + perfil pela função anthropic-proxy, modo createConsumerProfile). */
export async function cadastrar(d: DadosCadastro): Promise<{ erro?: string }> {
  const sb = sigdoc();
  const cpf = d.cpf.replace(/\D/g, '');
  const { data, error } = await sb.auth.signUp({
    email: d.email.trim(),
    password: d.senha,
    options: {
      emailRedirectTo: `${location.origin}${PAGINA_AREA}`,
      data: { full_name: d.nome.trim(), cpf, city: d.cidade, user_type: 'consumer' },
    },
  });
  if (error) {
    if (/database error/i.test(error.message)) return { erro: 'Não foi possível criar o cadastro. Confira se este CPF ou e-mail já não tem cadastro.' };
    if (/already registered|already exists/i.test(error.message)) return { erro: 'Este e-mail já tem cadastro. Use "Entrar".' };
    if (/password/i.test(error.message)) return { erro: 'A senha precisa ter pelo menos 6 caracteres e não pode ser uma senha conhecida/vazada.' };
    return { erro: 'Não foi possível criar o cadastro. Tente de novo.' };
  }
  if (!data.user) return { erro: 'Não foi possível criar o cadastro. Tente de novo.' };
  const perfil = {
    id: data.user.id, email: d.email.trim(), fullName: d.nome.trim(), cpf, city: d.cidade,
    rg: d.rg.trim() || null, cep: d.cep.replace(/\D/g, '') || null, addressNumber: d.numero.trim() || null,
    complement: d.complemento?.trim() || null, phone: d.telefone.trim() || null, status: 'Pendente',
  };
  const { error: erroPerfil } = await sb.functions.invoke('anthropic-proxy', { body: { mode: 'createConsumerProfile', profileData: perfil } });
  if (erroPerfil) console.warn('[área do consumidor] perfil:', erroPerfil.message);
  return {};
}

export async function reenviarConfirmacao(email: string): Promise<{ erro?: string }> {
  const { error } = await sigdoc().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${location.origin}${PAGINA_AREA}` } });
  return error ? { erro: 'Não foi possível reenviar agora. Aguarde um minuto e tente de novo.' } : {};
}

export async function esqueciSenha(email: string): Promise<{ erro?: string }> {
  const { error } = await sigdoc().auth.resetPasswordForEmail(email.trim(), { redirectTo: SIGDOC_SITE });
  return error ? { erro: 'Não foi possível enviar agora. Aguarde um minuto e tente de novo.' } : {};
}

/** Primeiro acesso pelo Google: função completar_cadastro_consumidor do SigDoc (valida tudo no banco). */
export async function completarCadastro(d: Omit<DadosCadastro, 'email' | 'senha'>): Promise<{ erro?: string }> {
  const { error } = await sigdoc().rpc('completar_cadastro_consumidor', {
    p_nome: d.nome, p_cpf: d.cpf, p_rg: d.rg, p_telefone: d.telefone, p_cidade: d.cidade,
    p_cep: d.cep, p_numero: d.numero, p_complemento: d.complemento || null,
  });
  return error ? { erro: error.message || 'Não foi possível concluir o cadastro.' } : {};
}

/** Editar meus dados (o banco não deixa o consumidor mudar o próprio status nem o id). */
export async function salvarDados(id: string, d: Partial<Consumidor>): Promise<{ erro?: string }> {
  const dados: Record<string, unknown> = { ...d };
  if (typeof dados.cpf === 'string') dados.cpf = (dados.cpf as string).replace(/\D/g, '');
  if (typeof dados.cep === 'string') dados.cep = (dados.cep as string).replace(/\D/g, '');
  const { error } = await sigdoc().from('usuarios_consumidores').update(dados).eq('id', id);
  if (error) return { erro: /cpf/i.test(error.message) ? 'CPF inválido ou já cadastrado.' : 'Não foi possível salvar. Tente de novo.' };
  return {};
}

// ---------- Atendimento online ----------
export interface Mensagem {
  id: string; chatId: string; senderId: string; senderName: string; senderType: 'consumer' | 'technician';
  content: string; type: 'text' | 'audio' | 'file'; fileUrl?: string; timestamp: string;
}
export interface Atendimento {
  id: string; consumerId: string; consumerName: string; consumerCpf: string; consumerCity: string;
  status: 'waiting' | 'in-progress' | 'completed'; createdAt: string; updatedAt: string;
  attendedBy?: string | null; attendedAt?: string | null; completedAt?: string | null;
  messages: Mensagem[] | null; transcriptionPdf?: string | null;
}

export async function atendimentoAberto(consumidorId: string): Promise<Atendimento | null> {
  const { data } = await sigdoc().from('atendimentos_online').select('*')
    .eq('consumerId', consumidorId).in('status', ['waiting', 'in-progress'])
    .order('createdAt', { ascending: false }).limit(1);
  return (data?.[0] as Atendimento) ?? null;
}

/** Quantas pessoas aguardam na fila da cidade (só a contagem, sem dados de ninguém). */
export async function filaDaCidade(cidade: string): Promise<number | null> {
  const { data, error } = await sigdoc().rpc('contar_fila_cidade', { p_cidade: cidade.trim().toUpperCase() });
  return !error && typeof data === 'number' ? data : null;
}

/** Posição na fila: quantos da mesma cidade chegaram antes (regra do gatilho trg_fila_ordem_chegada). */
export async function posicaoNaFila(a: Atendimento): Promise<number | null> {
  const { data, error } = await sigdoc().rpc('posicao_fila_atendimento', { p_id: a.id });
  if (!error && typeof data === 'number') return data;
  return null;
}

export async function solicitarAtendimento(c: Consumidor): Promise<{ erro?: string; atendimento?: Atendimento }> {
  const aberto = await atendimentoAberto(c.id);
  if (aberto) return { atendimento: aberto };
  const cidade = (c.city || '').trim().toUpperCase();
  if (!cidade) return { erro: 'Sua cidade não está no cadastro. Atualize em "Meus dados".' };
  const qtd = (await filaDaCidade(cidade)) ?? 0;
  const id = crypto.randomUUID();
  const agora = new Date().toISOString();
  const boasVindas: Mensagem = {
    id: crypto.randomUUID(), chatId: id, senderId: 'system', senderName: 'Sistema', senderType: 'technician',
    content: `Aguarde, logo você será atendido por um dos técnicos, você é o número: ${qtd + 1} da fila`, type: 'text', timestamp: agora,
  };
  const novo = {
    id, consumerId: c.id, consumerName: c.fullName, consumerCpf: (c.cpf || '').replace(/\D/g, ''), consumerEmail: c.email,
    consumerPhone: c.phone || '', consumerCity: cidade, status: 'waiting', createdAt: agora, updatedAt: agora, waitingTime: 0,
    messages: [boasVindas],
  };
  const { error } = await sigdoc().from('atendimentos_online').insert(novo);
  if (error) return { erro: 'Não foi possível solicitar o atendimento. Tente de novo.' };
  return { atendimento: novo as unknown as Atendimento };
}

export async function lerAtendimento(id: string): Promise<Atendimento | null> {
  const { data } = await sigdoc().from('atendimentos_online').select('*').eq('id', id).maybeSingle();
  return (data as Atendimento) ?? null;
}

export async function enviarMensagem(a: Atendimento, c: Consumidor, texto: string): Promise<{ erro?: string }> {
  const msg: Mensagem = {
    id: crypto.randomUUID(), chatId: a.id, senderId: c.id, senderName: c.fullName, senderType: 'consumer',
    content: texto, type: 'text', timestamp: new Date().toISOString(),
  };
  const { error } = await sigdoc().rpc('append_atendimento_message', {
    p_id: a.id, p_message: msg, p_claim_if_waiting: false, p_technician_name: null,
  });
  return error ? { erro: 'A mensagem não foi enviada. Tente de novo.' } : {};
}

const LIMITE_ARQUIVO = 15 * 1024 * 1024; // 15 MB
const EXT_AUDIO: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

/** Foto, documento ou áudio na conversa: mesmo caminho do SigDoc (bucket chat-files, pasta = id do atendimento). */
export async function enviarArquivo(a: Atendimento, c: Consumidor, arquivo: Blob, nome: string, tipo: 'file' | 'audio'): Promise<{ erro?: string }> {
  if (arquivo.size > LIMITE_ARQUIVO) return { erro: 'Arquivo grande demais. O limite é 15 MB.' };
  const sb = sigdoc();
  const id = crypto.randomUUID();
  const mime = (arquivo.type || 'application/octet-stream').split(';')[0];
  const caminho = tipo === 'audio'
    ? `${a.id}/${id}.${EXT_AUDIO[mime] ?? 'webm'}`
    : `${a.id}/${id}_${nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: erroEnvio } = await sb.storage.from('chat-files').upload(caminho, arquivo, { contentType: mime, upsert: false });
  if (erroEnvio) return { erro: 'Não foi possível enviar o arquivo. Tente de novo.' };
  const fileUrl = sb.storage.from('chat-files').getPublicUrl(caminho).data.publicUrl;
  const msg: Mensagem = {
    id, chatId: a.id, senderId: c.id, senderName: c.fullName, senderType: 'consumer',
    content: tipo === 'audio' ? 'Mensagem de áudio' : nome, type: tipo, fileUrl, timestamp: new Date().toISOString(),
  };
  const { error } = await sb.rpc('append_atendimento_message', { p_id: a.id, p_message: msg, p_claim_if_waiting: false, p_technician_name: null });
  return error ? { erro: 'O arquivo foi enviado, mas a mensagem não. Tente de novo.' } : {};
}

export async function encerrarAtendimento(a: Atendimento): Promise<{ erro?: string }> {
  const agora = new Date().toISOString();
  const { error } = await sigdoc().from('atendimentos_online')
    .update({ status: 'completed', updatedAt: agora, ...(a.status === 'in-progress' ? { completedAt: agora } : {}) })
    .eq('id', a.id);
  return error ? { erro: 'Não foi possível encerrar. Tente de novo.' } : {};
}

/** Avisa quando o atendimento muda (mensagem nova, técnico assumiu, encerrado). Devolve a função que para de ouvir. */
export function ouvirAtendimento(id: string, aoMudar: () => void): () => void {
  const sb = sigdoc();
  const canal = sb.channel(`portal-atendimento-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos_online', filter: `id=eq.${id}` }, () => aoMudar())
    .subscribe();
  // Reserva: se o tempo real cair (rede do órgão, proxy), confere a cada 8 s.
  const timer = setInterval(aoMudar, 8000);
  return () => { clearInterval(timer); sb.removeChannel(canal); };
}

export async function historico(cpf: string): Promise<Atendimento[]> {
  const digitos = (cpf || '').replace(/\D/g, '');
  if (!digitos) return [];
  const { data } = await sigdoc().from('atendimentos_online')
    .select('id, status, createdAt, updatedAt, attendedBy, attendedAt, completedAt, consumerCity, transcriptionPdf')
    .eq('consumerCpf', digitos).order('createdAt', { ascending: false }).limit(100);
  return (data as Atendimento[]) ?? [];
}

export interface Documento { id: string; dateTime: string; documentType?: string; contentSnippet?: string; pdfData?: string | null }
export async function documentos(cpf: string): Promise<Documento[]> {
  const digitos = (cpf || '').replace(/\D/g, '');
  if (!digitos) return [];
  const { data } = await sigdoc().from('protocolos').select('id, dateTime, documentType, contentSnippet, pdfData').eq('cliente_cpf', digitos);
  return ((data as Documento[]) ?? [])
    .filter((d) => d.pdfData)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
}

const LINK_ARQUIVO = /^https:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/(chat-files|transcriptions|protocolos-pdf)\/([^?#]+)/;
/** Abre um PDF/arquivo guardado no SigDoc: link de arquivo privado vira link temporário (os buckets são privados). */
export async function linkArquivo(valor: string): Promise<string | null> {
  if (!valor) return null;
  const m = LINK_ARQUIVO.exec(valor);
  if (m) {
    let caminho = m[2];
    try { caminho = decodeURIComponent(caminho); } catch { /* mantém */ }
    const { data } = await sigdoc().storage.from(m[1]).createSignedUrl(caminho, 3 * 60 * 60);
    return data?.signedUrl ?? valor;
  }
  if (/^https?:\/\//.test(valor)) return valor;
  // PDF antigo guardado no próprio banco (base64).
  try {
    const b64 = valor.startsWith('data:') ? valor.split(',')[1] ?? '' : valor;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  } catch { return null; }
}

// ---------- Utilidades de formulário ----------
export function mascaraCpf(v: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
export function mascaraTelefone(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function mascaraCep(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
/** Mesma conta de public.cpf_valido no banco do SigDoc (só os dígitos verificadores). */
export function cpfValido(valor: string): boolean {
  const d = (valor || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}
