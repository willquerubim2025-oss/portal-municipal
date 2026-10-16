// Lógica comum de edição de conteúdo publicável (status + publicado_em):
// carregar, salvar, publicar, agendar, despublicar e excluir. Cada módulo só
// descreve os seus campos (deLinha/paraLinha). Regras de publicação: D-09.
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { mensagemErro, supabase } from './supabase';
import { dataHora, deInputDataHora, paraInputDataHora } from './texto';
import { situacao } from '../components/Situacao';
import type { Status } from './tipos';

export type Acao = 'salvar' | 'publicar' | 'agendar' | 'despublicar';

export interface OpcoesEdicao<F> {
  tabela: string;
  /** Rota da lista, ex.: '/noticias'. A edição fica em `${rotaBase}/:id`. */
  rotaBase: string;
  /** Colunas carregadas (pode incluir relações). Precisa trazer status, publicado_em e atualizado_em. */
  select: string;
  vazio: F;
  deLinha: (linha: any) => F;
  /** Colunas a gravar (sem municipio_id, status e publicado_em, que o gancho controla). */
  paraLinha: (f: F) => Record<string, unknown>;
  validar?: (f: F) => string[];
  /** Regras extras só para publicar/agendar (ex.: banner precisa de imagem). */
  validarPublicacao?: (f: F) => string[];
  /** Grava tabelas filhas depois do registro principal (categorias, arquivos...). */
  aposSalvar?: (id: string, f: F) => Promise<void>;
  /** Mensagens de sucesso (o gênero muda por módulo: "Notícia publicada", "Documento publicado"). */
  mensagens: Record<Acao, string>;
  /** Quem pode publicar ESTE registro, quando depende dele (notícia de unidade, D-97). Padrão: o papel na rede. */
  podePublicarRegistro?: (f: F) => boolean;
}

export function useEdicao<F>(o: OpcoesEdicao<F>) {
  const { id } = useParams();
  const nova = !id;
  const navegar = useNavigate();
  const local = useLocation();
  const { atual, podePublicar: podePublicarRede } = useAuth();
  const mid = atual!.municipio.id;

  const [f, setF] = useState<F>(o.vazio);
  const [linha, setLinha] = useState<any>(null);
  const [carregando, setCarregando] = useState(!nova);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Mensagem de sucesso trazida da tela de criação (a rota /novo -> /:id remonta o componente).
  const [aviso, setAviso] = useState<string | null>((local.state as { aviso?: string } | null)?.aviso ?? null);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<Status>('rascunho');
  const [publicadoEm, setPublicadoEm] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [jaPublicado, setJaPublicado] = useState(false);
  const [agendarPara, setAgendarPara] = useState('');

  const recarregar = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from(o.tabela).select(o.select).eq('id', id).eq('municipio_id', mid).maybeSingle();
    if (error || !data) { setNaoEncontrado(true); setErro(error ? mensagemErro(error) : null); setCarregando(false); return; }
    const d = data as any;
    setLinha(d); setF(o.deLinha(d));
    setStatus(d.status); setPublicadoEm(d.publicado_em); setAtualizadoEm(d.atualizado_em);
    setJaPublicado(d.status !== 'rascunho');
    setAgendarPara(d.status === 'publicado' && d.publicado_em && new Date(d.publicado_em) > new Date() ? paraInputDataHora(d.publicado_em) : '');
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mid, o.tabela, o.select]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const mudar = useCallback(<K extends keyof F>(campo: K, valor: F[K]) => setF((x) => ({ ...x, [campo]: valor })), []);

  const sit = situacao(status, publicadoEm);
  const podePublicar = o.podePublicarRegistro ? o.podePublicarRegistro(f) : podePublicarRede;
  /** Editor não altera conteúdo publicado (D-09): formulário só leitura. */
  const bloqueado = status === 'publicado' && !podePublicar;

  async function salvar(acao: Acao): Promise<boolean> {
    setErro(null); setAviso(null);
    const problemas = [...(o.validar?.(f) ?? []), ...(acao === 'publicar' || acao === 'agendar' ? o.validarPublicacao?.(f) ?? [] : [])];
    if (problemas.length) { setErro(problemas.join(' ')); return false; }
    let novoStatus: Status = nova ? 'rascunho' : status;
    let novoPublicadoEm = publicadoEm;
    if (acao === 'publicar') {
      novoStatus = 'publicado';
      // Publicar agora: data de agora, salvo se já estava no ar com data passada (mantém a original).
      if (status !== 'publicado' || !publicadoEm || new Date(publicadoEm) > new Date()) novoPublicadoEm = new Date().toISOString();
    } else if (acao === 'agendar') {
      const quando = deInputDataHora(agendarPara);
      if (!quando || new Date(quando) <= new Date()) { setErro('Escolha uma data e hora futuras para agendar.'); return false; }
      novoStatus = 'publicado'; novoPublicadoEm = quando;
    } else if (acao === 'despublicar') {
      novoStatus = 'despublicado';
    }
    const registro = { ...o.paraLinha(f), municipio_id: mid, status: novoStatus, publicado_em: novoStatus === 'rascunho' ? null : novoPublicadoEm };
    setSalvando(true);
    try {
      const r = nova
        ? await supabase.from(o.tabela).insert(registro).select('id, status, publicado_em, atualizado_em').single()
        : await supabase.from(o.tabela).update(registro).eq('id', id).select('id, status, publicado_em, atualizado_em').single();
      if (r.error) throw r.error;
      const d = r.data as any;
      if (o.aposSalvar) await o.aposSalvar(d.id, f);
      setStatus(d.status); setPublicadoEm(d.publicado_em); setAtualizadoEm(d.atualizado_em);
      if (d.status !== 'rascunho') setJaPublicado(true);
      const msg = acao === 'agendar' ? `${o.mensagens.agendar} ${dataHora(d.publicado_em)}.` : o.mensagens[acao];
      setAviso(msg);
      if (nova) navegar(`${o.rotaBase}/${d.id}`, { replace: true, state: { aviso: msg } });
      setSalvando(false);
      return true;
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
      return false;
    }
  }

  async function excluir() {
    if (!window.confirm('Excluir definitivamente? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from(o.tabela).delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else navegar(o.rotaBase);
  }

  return {
    id, nova, mid, f, setF, mudar, linha, recarregar, carregando, naoEncontrado,
    erro, setErro, aviso, salvando, status, publicadoEm, atualizadoEm, jaPublicado, sit, bloqueado, podePublicar,
    agendarPara, setAgendarPara, salvar, excluir,
  };
}

export type Edicao<F> = ReturnType<typeof useEdicao<F>>;

/** Categorias de um escopo e órgãos ativos, para os seletores dos formulários. */
export function useOpcoes(escopo?: 'publicacao' | 'documento' | 'servico' | 'evento' | 'pergunta') {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [categorias, setCategorias] = useState<{ id: string; nome: string; slug: string }[]>([]);
  const [orgaos, setOrgaos] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    if (escopo) {
      supabase.from('categorias').select('id, nome, slug').eq('municipio_id', mid).eq('escopo', escopo).order('ordem').order('nome')
        .then(({ data }) => setCategorias(data ?? []));
    }
    supabase.from('orgaos').select('id, nome').eq('municipio_id', mid).eq('ativo', true).order('ordem').order('nome')
      .then(({ data }) => setOrgaos(data ?? []));
  }, [mid, escopo]);
  return { categorias, orgaos };
}
