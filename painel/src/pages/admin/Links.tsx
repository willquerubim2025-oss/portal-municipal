// Links quebrados (RF18, D-31). A verificação roda toda semana sozinha (pg_cron) e pode
// ser pedida aqui. Quem confere é a Edge Function verificar-links; esta tela só pede e lê.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora } from '../../lib/texto';

interface Verificacao { id: string; status: string; iniciado_em: string; concluido_em: string | null; total_links: number | null; problemas: number | null; erro: string | null }
interface Problema { id: number; tipo: string; url: string; status_http: number | null; erro: string | null; origem_tabela: string; origem_id: string; origem_titulo: string | null }

// Onde corrigir cada tipo de conteúdo no painel.
const ONDE: Record<string, { rotulo: string; editar: (id: string) => string }> = {
  publicacoes: { rotulo: 'Notícia', editar: (id) => `/noticias/${id}` },
  documentos: { rotulo: 'Documento', editar: (id) => `/documentos/${id}` },
  paginas: { rotulo: 'Página', editar: (id) => `/paginas/${id}` },
  servicos: { rotulo: 'Serviço', editar: (id) => `/servicos/${id}` },
  eventos: { rotulo: 'Evento', editar: (id) => `/eventos/${id}` },
  perguntas_frequentes: { rotulo: 'Pergunta frequente', editar: (id) => `/perguntas/${id}` },
  destaques: { rotulo: 'Banner/alerta', editar: (id) => `/destaques/${id}` },
  orgaos: { rotulo: 'Órgão', editar: (id) => `/orgaos/${id}` },
  menu_itens: { rotulo: 'Menu', editar: () => '/menus' },
  transparencia_itens: { rotulo: 'Transparência', editar: () => '/transparencia' },
  sistemas_externos: { rotulo: 'Sistema externo', editar: () => '/transparencia' },
};
const SITUACAO: Record<string, string> = {
  pendente: 'Na fila: começa em até 1 minuto.',
  processando: 'Em andamento. Pode levar alguns minutos; esta tela se atualiza sozinha.',
  concluida: 'Concluída',
  erro: 'Interrompida',
};
const POR_PAGINA = 100;

function motivo(p: Problema): string {
  if (p.status_http === 404) return 'Não encontrado (404)';
  if (p.status_http === 410) return 'Removido (410)';
  if (p.status_http && p.status_http >= 500) return `Erro no servidor de destino (${p.status_http})`;
  return p.erro ?? 'Sem resposta';
}

export function Links() {
  const { atual, isAdmin } = useAuth();
  const mid = atual!.municipio.id;
  const [ultima, setUltima] = useState<Verificacao | null | undefined>(undefined);
  const [concluida, setConcluida] = useState<Verificacao | null>(null);
  const [problemas, setProblemas] = useState<Problema[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [tipo, setTipo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);

  const carregar = useCallback(async () => {
    const campos = 'id, status, iniciado_em, concluido_em, total_links, problemas, erro';
    const [{ data: u, error: e1 }, { data: c }] = await Promise.all([
      supabase.from('verificacoes_links').select(campos).eq('municipio_id', mid).order('iniciado_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('verificacoes_links').select(campos).eq('municipio_id', mid).eq('status', 'concluida').order('concluido_em', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (e1) setErro(mensagemErro(e1));
    setUltima((u as Verificacao) ?? null);
    setConcluida((c as Verificacao) ?? null);
  }, [mid]);

  useEffect(() => { carregar(); }, [carregar]);

  // Enquanto há verificação na fila ou em andamento, atualiza a cada 10 s.
  const emAndamento = ultima && ['pendente', 'processando'].includes(ultima.status);
  useEffect(() => {
    if (!emAndamento) return;
    const t = setInterval(carregar, 10_000);
    return () => clearInterval(t);
  }, [emAndamento, carregar]);

  // Problemas da última verificação concluída.
  useEffect(() => {
    if (!concluida) { setProblemas([]); return; }
    let ativo = true;
    setProblemas(null);
    let q = supabase.from('verificacao_problemas').select('id, tipo, url, status_http, erro, origem_tabela, origem_id, origem_titulo', { count: 'exact' })
      .eq('verificacao_id', concluida.id).order('origem_tabela').order('origem_titulo').order('id')
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    if (tipo) q = q.eq('tipo', tipo);
    q.then(({ data, count, error }) => {
      if (!ativo) return;
      if (error) setErro(mensagemErro(error));
      setProblemas((data ?? []) as Problema[]);
      setTotal(count ?? 0);
    });
    return () => { ativo = false; };
  }, [concluida, pagina, tipo]);

  async function verificarAgora() {
    setPedindo(true); setErro(null);
    const { error } = await supabase.from('verificacoes_links').insert({ municipio_id: mid });
    setPedindo(false);
    if (error) setErro(error.code === '23505' ? 'Já há uma verificação em andamento.' : mensagemErro(error));
    await carregar();
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Links quebrados</h1>
        <button type="button" onClick={verificarAgora} disabled={pedindo || !!emAndamento}>
          {emAndamento ? 'Verificação em andamento' : pedindo ? 'Pedindo…' : 'Verificar agora'}
        </button>
      </div>
      <p className="meta">
        O portal confere toda semana (domingo de madrugada) os links de todo o conteúdo publicado: textos, anexos, menus,
        transparência e sistemas. Arquivos do próprio portal são conferidos no banco; os demais, acessando cada endereço.
      </p>
      {erro && <p className="erro" role="alert">{erro}</p>}

      {ultima === undefined ? <p role="status">Carregando…</p> : !ultima ? (
        <p>Nenhuma verificação feita ainda. Use <strong>Verificar agora</strong> ou aguarde a verificação semanal.</p>
      ) : (
        <section aria-labelledby="t-situacao" className="secao-filha">
          <h2 id="t-situacao">Situação</h2>
          <p role="status">
            <strong>{SITUACAO[ultima.status] ?? ultima.status}</strong>
            {ultima.status === 'erro' && ultima.erro ? ` (${ultima.erro})` : ''}
            {' '}Iniciada em <time dateTime={ultima.iniciado_em}>{dataHora(ultima.iniciado_em)}</time>
            {ultima.total_links != null && ` · ${ultima.total_links.toLocaleString('pt-BR')} links`}
          </p>
          {concluida && (
            <p>
              Última concluída em <time dateTime={concluida.concluido_em!}>{dataHora(concluida.concluido_em!)}</time>:{' '}
              <strong>{(concluida.problemas ?? 0).toLocaleString('pt-BR')} {concluida.problemas === 1 ? 'problema' : 'problemas'}</strong>
              {' '}em {(concluida.total_links ?? 0).toLocaleString('pt-BR')} links.
            </p>
          )}
        </section>
      )}

      {concluida && (
        <section aria-labelledby="t-problemas">
          <h2 id="t-problemas">Problemas encontrados</h2>
          <div className="filtros">
            <label>Tipo
              <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1); }}>
                <option value="">Todos</option>
                <option value="link_quebrado">Não encontrado ou removido</option>
                <option value="pagina_indisponivel">Indisponível (erro ou sem resposta)</option>
              </select>
            </label>
          </div>
          <p className="meta">
            “Indisponível” pode ser passageiro (o site de destino estava fora do ar na hora). “Não encontrado” costuma ser
            definitivo: troque o link ou remova-o. Os problemas somem na próxima verificação depois de corrigidos.
          </p>
          {!problemas ? <p role="status">Carregando…</p> : problemas.length === 0 ? <p>Nenhum problema. 🎉</p> : (
            <table className="tabela">
              <caption className="sr-only">Links com problema e onde estão</caption>
              <thead><tr><th scope="col">Onde está</th><th scope="col">Link</th><th scope="col">Motivo</th></tr></thead>
              <tbody>
                {problemas.map((p) => {
                  const onde = ONDE[p.origem_tabela];
                  const restrito = ['orgaos', 'menu_itens', 'transparencia_itens', 'sistemas_externos'].includes(p.origem_tabela) && !isAdmin;
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="meta">{onde?.rotulo ?? p.origem_tabela}</span><br />
                        {onde && !restrito ? <Link to={onde.editar(p.origem_id)}>{p.origem_titulo ?? 'Abrir'}</Link> : (p.origem_titulo ?? '—')}
                      </td>
                      <td className="quebra-tudo"><a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}<span className="sr-only"> (abre em nova aba)</span></a></td>
                      <td>{motivo(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {paginas > 1 && (
            <nav className="paginacao" aria-label="Paginação">
              <button type="button" className="botao-secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anteriores</button>
              <span>Página {pagina} de {paginas} ({total.toLocaleString('pt-BR')} problemas)</span>
              <button type="button" className="botao-secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Próximos</button>
            </nav>
          )}
        </section>
      )}
    </>
  );
}
