// Fonte única de verdade, no painel, sobre QUEM está logado, em QUAIS municípios
// pode trabalhar e com QUAL papel (padrão do GeoEscolas). Nenhuma tela consulta
// `membros`, `usuario_papeis` ou `equipe_plataforma` por conta própria: todas usam useAuth().
//
// Dois sistemas de papéis convivem (D-38, D-78):
//  - papel antigo (membros: admin/publicador/editor), de Jeriquara;
//  - papéis configuráveis (usuario_papeis + papel_permissoes), consultados por pode().
// Desde a fase 1B, o conteúdo aceita os dois: conteudo.editar ≈ editor, conteudo.publicar ≈ publicador,
// organizacao.administrar ≈ admin. `nivel` é o maior dos dois (o mesmo que is_membro/pode_publicar/is_admin no banco).
//
// O frontend só esconde botões; quem garante a permissão é o banco (RLS + public.pode()).
// Aqui é só para a interface não oferecer o que vai falhar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Acesso, MunicipioResumo, Papel } from '../lib/tipos';
import type { MinhaPermissao } from '../lib/permissoes';

interface AuthValor {
  sessao: Session | null;
  carregando: boolean;
  erro: string | null;
  nome: string;
  isPlataforma: boolean;
  acessos: Acesso[];
  /** Município em edição (escolhido no seletor; lembrado no navegador). */
  atual: Acesso | null;
  escolherMunicipio: (id: string) => void;
  /** Papel equivalente no conteúdo: o antigo ou o que as permissões de conteúdo dão (o maior). */
  nivel: Papel | null;
  podePublicar: boolean;
  isAdmin: boolean;
  /** Permissões configuráveis do usuário no município atual (public.minhas_permissoes). */
  permissoes: MinhaPermissao[];
  permissoesCarregadas: boolean;
  /** Tem a permissão em algum escopo? (SECKE: sempre.) O escopo exato é conferido pelo banco. */
  pode: (codigo: string) => boolean;
  /** Tem a permissão para toda a rede? */
  podeNaRede: (codigo: string) => boolean;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  /** true depois de um "Sair" explícito: o login não deve voltar à página do usuário anterior. */
  saiu: boolean;
}

const Contexto = createContext<AuthValor | undefined>(undefined);
const CHAVE_MUNICIPIO = 'painel.municipio';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [isPlataforma, setIsPlataforma] = useState(false);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [saiu, setSaiu] = useState(false);
  const [permissoes, setPermissoes] = useState<MinhaPermissao[]>([]);
  const [permissoesDe, setPermissoesDe] = useState<string | null>(null);
  const [atualId, setAtualId] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAVE_MUNICIPIO); } catch { return null; }
  });

  const carregarPerfil = useCallback(async (userId: string) => {
    const [perfil, equipe, membros, vinculos] = await Promise.all([
      supabase.from('perfis').select('nome').eq('user_id', userId).maybeSingle(),
      supabase.from('equipe_plataforma').select('nome').eq('user_id', userId).maybeSingle(),
      supabase.from('membros').select('papel, ativo, municipio:municipios(id, nome, slug, uf)').eq('user_id', userId).eq('ativo', true),
      supabase.from('usuario_papeis').select('papel:papeis(nome, ativo), municipio:municipios(id, nome, slug, uf)').eq('user_id', userId).eq('ativo', true),
    ]);
    const plataforma = !!equipe.data;
    let lista: Acesso[];
    if (plataforma) {
      // SECKE: todos os municípios, como admin.
      const { data } = await supabase.from('municipios').select('id, nome, slug, uf').order('nome');
      lista = (data ?? []).map((m) => ({ municipio: m as MunicipioResumo, papel: 'admin' as Papel, papeis: [] }));
    } else {
      // Junta os dois sistemas de papéis por organização.
      const porMunicipio = new Map<string, Acesso>();
      for (const m of membros.data ?? []) {
        const mun = m.municipio as unknown as MunicipioResumo | null;
        if (mun) porMunicipio.set(mun.id, { municipio: mun, papel: m.papel as Papel, papeis: [] });
      }
      for (const v of vinculos.data ?? []) {
        const mun = v.municipio as unknown as MunicipioResumo | null;
        const papel = v.papel as unknown as { nome: string; ativo: boolean } | null;
        if (!mun || !papel?.ativo) continue;
        const a = porMunicipio.get(mun.id) ?? { municipio: mun, papel: null, papeis: [] };
        if (!a.papeis.includes(papel.nome)) a.papeis.push(papel.nome);
        porMunicipio.set(mun.id, a);
      }
      lista = [...porMunicipio.values()].sort((a, b) => a.municipio.nome.localeCompare(b.municipio.nome));
    }
    if (!plataforma && lista.length === 0) {
      // Login válido, mas sem vínculo ativo com nenhuma organização: sem acesso (nunca "admin por omissão").
      setErro('Seu usuário não está vinculado a nenhuma organização. Fale com o administrador.');
    } else {
      setErro(null);
    }
    setNome(perfil.data?.nome ?? equipe.data?.nome ?? '');
    setIsPlataforma(plataforma);
    setAcessos(lista);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      if (data.session?.user) await carregarPerfil(data.session.user.id);
      setCarregando(false);
    });
    const { data: inscricao } = supabase.auth.onAuthStateChange((evento, nova) => {
      setSessao(nova);
      if (evento === 'SIGNED_OUT') { setAcessos([]); setIsPlataforma(false); setNome(''); setPermissoes([]); setPermissoesDe(null); }
      // Não await dentro do callback (recomendação do supabase-js para evitar travas).
      if (evento === 'SIGNED_IN' && nova?.user) {
        setSaiu(false);
        setCarregando(true);
        setTimeout(() => carregarPerfil(nova.user.id).finally(() => setCarregando(false)), 0);
      }
    });
    return () => { ativo = false; inscricao.subscription.unsubscribe(); };
  }, [carregarPerfil]);

  const atual = useMemo(
    () => acessos.find((a) => a.municipio.id === atualId) ?? (acessos.length === 1 ? acessos[0] : null),
    [acessos, atualId],
  );

  // Permissões configuráveis da organização em edição (recarrega ao trocar de organização).
  const atualMid = atual?.municipio.id ?? null;
  useEffect(() => {
    if (!atualMid || !sessao) return;
    let ativo = true;
    supabase.rpc('minhas_permissoes', { p_municipio: atualMid }).then(({ data }) => {
      if (!ativo) return;
      setPermissoes((data ?? []) as MinhaPermissao[]);
      setPermissoesDe(atualMid);
    });
    return () => { ativo = false; };
  }, [atualMid, sessao]);

  const escolherMunicipio = useCallback((id: string) => {
    setAtualId(id);
    try { localStorage.setItem(CHAVE_MUNICIPIO, id); } catch { /* navegação privada */ }
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return error ? 'E-mail ou senha incorretos.' : null;
  }, []);

  const sair = useCallback(async () => { setSaiu(true); await supabase.auth.signOut(); }, []);

  const pode = useCallback((codigo: string) => isPlataforma || permissoes.some((p) => p.permissao === codigo), [isPlataforma, permissoes]);
  const podeNaRede = useCallback(
    (codigo: string) => isPlataforma || permissoes.some((p) => p.permissao === codigo && p.escopo === 'rede'),
    [isPlataforma, permissoes],
  );

  const permissoesAtuais = permissoesDe === atualMid ? permissoes : [];
  const tem = (c: string) => permissoesAtuais.some((p) => p.permissao === c);
  const nivel: Papel | null = isPlataforma || atual?.papel === 'admin' || tem('organizacao.administrar') ? 'admin'
    : atual?.papel === 'publicador' || tem('conteudo.publicar') ? 'publicador'
    : atual?.papel === 'editor' || tem('conteudo.editar') ? 'editor' : null;

  const valor: AuthValor = {
    sessao, carregando, erro, nome, isPlataforma, acessos, atual, escolherMunicipio,
    nivel: atual ? nivel : null,
    podePublicar: !!atual && (nivel === 'admin' || nivel === 'publicador'),
    isAdmin: !!atual && nivel === 'admin',
    permissoes: permissoesAtuais,
    permissoesCarregadas: isPlataforma || (!!atualMid && permissoesDe === atualMid),
    pode, podeNaRede,
    entrar, sair, saiu,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthValor {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
