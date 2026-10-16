// Notícias de unidade (fase 1C, D-97): quais unidades a pessoa pode marcar numa notícia
// e em quais pode publicar. Quem tem conteúdo na rede escolhe qualquer unidade (ou nenhuma);
// quem só tem na unidade/região escolhe entre as suas e não pode deixar sem unidade.
// O banco confere tudo de novo (public.edita_unidade / publica_unidade, 0026).
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from './supabase';

export interface UnidadeOpcao { id: string; nome: string; regiao_id: string | null }

export function useUnidadesNoticia() {
  const { atual, nivel, podePublicar, noticiasUnidade } = useAuth();
  const mid = atual?.municipio.id;
  const [todas, setTodas] = useState<UnidadeOpcao[]>([]);

  useEffect(() => {
    if (!mid) return;
    let ativo = true;
    supabase.from('unidades').select('id, nome, regiao_id').eq('municipio_id', mid).eq('ativo', true).order('nome')
      .then(({ data }) => { if (ativo) setTodas((data ?? []) as UnidadeOpcao[]); });
    return () => { ativo = false; };
  }, [mid]);

  const cobre = (u: UnidadeOpcao, codigos: string[]) => noticiasUnidade.some((p) => codigos.includes(p.permissao)
    && ((p.escopo === 'unidade' && p.unidade_id === u.id) || (p.escopo === 'regiao' && !!p.regiao_id && p.regiao_id === u.regiao_id)));

  /** Só escreve notícias de unidade (sem conteúdo na rede). */
  const soUnidade = !nivel && noticiasUnidade.length > 0;
  const opcoes = soUnidade ? todas.filter((u) => cobre(u, ['conteudo.editar', 'conteudo.publicar'])) : todas;
  const podePublicarNa = (unidadeId: string) => {
    if (podePublicar) return true;
    const u = todas.find((x) => x.id === unidadeId);
    return !!u && cobre(u, ['conteudo.publicar']);
  };
  return { soUnidade, opcoes, todas, podePublicarNa };
}
