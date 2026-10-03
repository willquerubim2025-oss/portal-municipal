// Fonte única de verdade, no painel, sobre QUEM está logado, em QUAIS municípios
// pode trabalhar e com QUAL papel (padrão do GeoEscolas). Nenhuma tela consulta
// `membros` ou `equipe_plataforma` por conta própria: todas usam useAuth().
//
// O frontend só esconde botões; quem garante a permissão é o banco (RLS + trigger
// checar_permissao_publicacao). Aqui é só para a interface não oferecer o que vai falhar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Acesso, MunicipioResumo, Papel } from '../lib/tipos';

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
  podePublicar: boolean;
  isAdmin: boolean;
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
  const [atualId, setAtualId] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAVE_MUNICIPIO); } catch { return null; }
  });

  const carregarPerfil = useCallback(async (userId: string) => {
    const [perfil, equipe, membros] = await Promise.all([
      supabase.from('perfis').select('nome').eq('user_id', userId).maybeSingle(),
      supabase.from('equipe_plataforma').select('nome').eq('user_id', userId).maybeSingle(),
      supabase.from('membros').select('papel, ativo, municipio:municipios(id, nome, slug, uf)').eq('user_id', userId).eq('ativo', true),
    ]);
    const plataforma = !!equipe.data;
    let lista: Acesso[];
    if (plataforma) {
      // SECKE: todos os municípios, como admin.
      const { data } = await supabase.from('municipios').select('id, nome, slug, uf').order('nome');
      lista = (data ?? []).map((m) => ({ municipio: m as MunicipioResumo, papel: 'admin' as Papel }));
    } else {
      lista = (membros.data ?? [])
        .filter((m) => m.municipio)
        .map((m) => ({ municipio: m.municipio as unknown as MunicipioResumo, papel: m.papel as Papel }))
        .sort((a, b) => a.municipio.nome.localeCompare(b.municipio.nome));
    }
    if (!plataforma && lista.length === 0) {
      // Login válido, mas sem vínculo ativo com nenhum município: sem acesso (nunca "admin por omissão").
      setErro('Seu usuário não está vinculado a nenhuma prefeitura. Fale com o administrador.');
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
      if (evento === 'SIGNED_OUT') { setAcessos([]); setIsPlataforma(false); setNome(''); }
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

  const escolherMunicipio = useCallback((id: string) => {
    setAtualId(id);
    try { localStorage.setItem(CHAVE_MUNICIPIO, id); } catch { /* navegação privada */ }
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return error ? 'E-mail ou senha incorretos.' : null;
  }, []);

  const sair = useCallback(async () => { setSaiu(true); await supabase.auth.signOut(); }, []);

  const valor: AuthValor = {
    sessao, carregando, erro, nome, isPlataforma, acessos, atual, escolherMunicipio,
    podePublicar: atual?.papel === 'admin' || atual?.papel === 'publicador',
    isAdmin: atual?.papel === 'admin',
    entrar, sair, saiu,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthValor {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
