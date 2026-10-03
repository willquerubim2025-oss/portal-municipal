// Chamados de suporte e solicitações editoriais (RF20–RF22, D-06).
// O município abre e conversa; só a SECKE muda situação, prioridade e o consumo do saldo.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora } from '../../lib/texto';
import { Obrigatorio } from '../../components/Edicao';

export const TIPOS: Record<string, string> = {
  solicitacao_editorial: 'Solicitação editorial', suporte_tecnico: 'Suporte técnico', incidente: 'Incidente (site fora do ar, erro)', duvida: 'Dúvida',
};
export const SITUACOES: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_municipio: 'Aguardando a prefeitura', concluido: 'Concluído', cancelado: 'Cancelado',
};
const PRIORIDADES: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };

interface Saldo { contrato_id: string; numero: string; limite_solicitacoes: number | null; consumidas: number; saldo: number | null }

function useSaldo(mid: string) {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const carregar = useCallback(() => {
    supabase.from('saldo_solicitacoes').select('*').eq('municipio_id', mid).limit(1).maybeSingle().then(({ data }) => setSaldo(data));
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);
  return { saldo, recarregarSaldo: carregar };
}

function CaixaSaldo({ saldo }: { saldo: Saldo | null }) {
  if (!saldo) return null;
  if (saldo.limite_solicitacoes === null) return <p className="meta">Contrato {saldo.numero}: solicitações editoriais sem limite. Consumidas: {saldo.consumidas}.</p>;
  const pct = Math.min(100, Math.round((saldo.consumidas / Math.max(1, saldo.limite_solicitacoes)) * 100));
  return (
    <div className="caixa-saldo">
      <p><strong>{saldo.saldo}</strong> de {saldo.limite_solicitacoes} solicitações editoriais disponíveis <span className="meta">(contrato {saldo.numero})</span></p>
      <div className="barra-saldo" role="meter" aria-valuemin={0} aria-valuemax={saldo.limite_solicitacoes} aria-valuenow={saldo.consumidas} aria-label="Solicitações consumidas">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="meta">{saldo.consumidas} consumidas ({pct}%). O consumo é lançado pela SECKE ao concluir cada chamado.</p>
    </div>
  );
}

export function ListaChamados() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const { saldo } = useSaldo(mid);
  const [filtro, setFiltro] = useState('abertos');
  const [lista, setLista] = useState<any[] | null>(null);
  const [relatorio, setRelatorio] = useState<any[]>([]);

  useEffect(() => {
    let q = supabase.from('chamados').select('id, protocolo, titulo, tipo, status, prioridade, aberto_em, solicitacoes_consumidas')
      .eq('municipio_id', mid).order('aberto_em', { ascending: false }).limit(200);
    if (filtro === 'abertos') q = q.in('status', ['aberto', 'em_andamento', 'aguardando_municipio']);
    else if (filtro) q = q.eq('status', filtro);
    q.then(({ data }) => setLista(data ?? []));
  }, [mid, filtro]);
  useEffect(() => {
    supabase.from('relatorio_mensal_chamados').select('*').eq('municipio_id', mid).order('mes', { ascending: false }).limit(36)
      .then(({ data }) => setRelatorio(data ?? []));
  }, [mid]);

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Chamados</h1>
        <Link className="botao" to="/chamados/novo">Abrir chamado</Link>
      </div>
      <CaixaSaldo saldo={saldo} />
      <div className="filtros">
        <label>Situação
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="abertos">Em aberto</option>
            <option value="">Todos</option>
            {Object.entries(SITUACOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
      </div>
      {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Nenhum chamado.</p> : (
        <table className="tabela">
          <caption className="sr-only">Chamados</caption>
          <thead><tr><th scope="col">Protocolo</th><th scope="col">Assunto</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">Aberto em</th><th scope="col">Solicitações</th></tr></thead>
          <tbody>{lista.map((c) => (
            <tr key={c.id}>
              <td>#{c.protocolo}</td>
              <td><Link to={`/chamados/${c.id}`}>{c.titulo}</Link>{['alta', 'critica'].includes(c.prioridade) && <span className="etiqueta etiqueta-despublicado">{PRIORIDADES[c.prioridade]}</span>}</td>
              <td>{TIPOS[c.tipo]}</td>
              <td><span className={`etiqueta situacao-chamado-${c.status}`}>{SITUACOES[c.status]}</span></td>
              <td>{dataHora(c.aberto_em)}</td>
              <td>{c.solicitacoes_consumidas || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {relatorio.length > 0 && (
        <section className="secao-filha" aria-labelledby="t-relatorio">
          <h2 id="t-relatorio">Relatório mensal (para o fiscal do contrato)</h2>
          <table className="tabela">
            <thead><tr><th scope="col">Mês</th><th scope="col">Tipo</th><th scope="col">Abertos</th><th scope="col">Concluídos</th><th scope="col">Solicitações consumidas</th><th scope="col">Tempo médio até concluir</th></tr></thead>
            <tbody>{relatorio.map((r) => (
              <tr key={`${r.mes}-${r.tipo}-${r.contrato_id}`}>
                <td>{new Date(`${r.mes}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                <td>{TIPOS[r.tipo]}</td><td>{r.abertos}</td><td>{r.concluidos}</td><td>{r.solicitacoes_consumidas ?? 0}</td>
                <td>{r.horas_medias_ate_conclusao != null ? `${Number(r.horas_medias_ate_conclusao).toLocaleString('pt-BR')} h` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}

export function NovoChamado() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const navegar = useNavigate();
  const { saldo } = useSaldo(mid);
  const [tipo, setTipo] = useState('solicitacao_editorial');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!titulo.trim() || !descricao.trim()) return setErro('Preencha o assunto e a descrição.');
    setEnviando(true);
    const { data, error } = await supabase.from('chamados')
      .insert({ municipio_id: mid, contrato_id: saldo?.contrato_id ?? null, tipo, titulo: titulo.trim(), descricao: descricao.trim() })
      .select('id, protocolo').single();
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    navegar(`/chamados/${data.id}`, { replace: true, state: { aviso: `Chamado #${data.protocolo} aberto. A SECKE vai responder por aqui.` } });
  }

  return (
    <form className="formulario-conteudo" onSubmit={enviar} noValidate>
      <div className="cabecalho-tela"><div><p className="migalha"><Link to="/chamados">Chamados</Link></p><h1>Abrir chamado</h1></div></div>
      <CaixaSaldo saldo={saldo} />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <fieldset className="formulario" disabled={enviando}>
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
        </label>
        {tipo === 'solicitacao_editorial' && <p className="meta">Pedido para a SECKE publicar ou alterar conteúdo no portal. Pode consumir o saldo do contrato.</p>}
        <label><Obrigatorio>Assunto</Obrigatorio><input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150} /></label>
        <label><Obrigatorio>Descrição</Obrigatorio><textarea rows={8} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o que precisa. Se for publicação, indique título, texto e onde deve aparecer." /></label>
      </fieldset>
      <div className="barra-acoes"><button className="botao" disabled={enviando}>{enviando ? 'Enviando…' : 'Abrir chamado'}</button></div>
    </form>
  );
}

export function DetalheChamado() {
  const { id } = useParams();
  const local = useLocation();
  const { atual, isPlataforma } = useAuth();
  const mid = atual!.municipio.id;
  const { saldo, recarregarSaldo } = useSaldo(mid);
  const [c, setC] = useState<any>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [texto, setTexto] = useState('');
  const [interna, setInterna] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>((local.state as { aviso?: string } | null)?.aviso ?? null);
  // Controles da SECKE
  const [status, setStatus] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [consumidas, setConsumidas] = useState('0');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('chamados').select('*').eq('id', id).eq('municipio_id', mid).maybeSingle();
    if (error || !data) { setErro(error ? mensagemErro(error) : 'Chamado não encontrado.'); return; }
    setC(data); setStatus(data.status); setPrioridade(data.prioridade); setConsumidas(String(data.solicitacoes_consumidas));
    const { data: ms } = await supabase.from('chamado_mensagens').select('id, autor_id, mensagem, interna, em').eq('chamado_id', id).order('em');
    setMensagens(ms ?? []);
    const ids = [...new Set([data.aberto_por, ...(ms ?? []).map((m) => m.autor_id)].filter(Boolean))];
    if (ids.length) {
      const { data: ps } = await supabase.from('perfis').select('user_id, nome').in('user_id', ids);
      setNomes(Object.fromEntries((ps ?? []).map((p) => [p.user_id, p.nome])));
    }
  }, [id, mid]);
  useEffect(() => { carregar(); }, [carregar]);

  async function responder(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!texto.trim()) return;
    const { error } = await supabase.from('chamado_mensagens').insert({ chamado_id: id, mensagem: texto.trim(), interna: isPlataforma && interna });
    if (error) return setErro(mensagemErro(error));
    setTexto(''); setInterna(false); carregar();
  }

  async function salvarSecke(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    const n = Number(consumidas);
    if (!Number.isInteger(n) || n < 0) return setErro('Solicitações consumidas deve ser um número inteiro (0 ou mais).');
    const { error } = await supabase.from('chamados').update({
      status, prioridade, solicitacoes_consumidas: n,
      concluido_em: status === 'concluido' ? (c.concluido_em ?? new Date().toISOString()) : null,
    }).eq('id', id);
    if (error) return setErro(mensagemErro(error));
    setAviso('Chamado atualizado.'); carregar(); recarregarSaldo();
  }

  if (!c) return erro ? <><p className="erro" role="alert">{erro}</p><Link to="/chamados">Voltar</Link></> : <p role="status">Carregando…</p>;
  const encerrado = c.status === 'concluido' || c.status === 'cancelado';
  return (
    <>
      <div className="cabecalho-tela"><div>
        <p className="migalha"><Link to="/chamados">Chamados</Link></p>
        <h1>#{c.protocolo} · {c.titulo}</h1>
        <p className="meta">
          <span className={`etiqueta situacao-chamado-${c.status}`}>{SITUACOES[c.status]}</span> {TIPOS[c.tipo]} · prioridade {PRIORIDADES[c.prioridade].toLowerCase()}
          · aberto por {nomes[c.aberto_por] ?? '—'} em {dataHora(c.aberto_em)}{c.concluido_em && ` · concluído em ${dataHora(c.concluido_em)}`}
          {c.solicitacoes_consumidas > 0 && ` · consumiu ${c.solicitacoes_consumidas} solicitação(ões)`}
        </p>
      </div></div>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>

      <section className="conversa" aria-label="Conversa">
        <article className="mensagem mensagem-abertura">
          <p className="meta">{nomes[c.aberto_por] ?? 'Prefeitura'} · {dataHora(c.aberto_em)}</p>
          <p className="texto-mensagem">{c.descricao}</p>
        </article>
        {mensagens.map((m) => (
          <article key={m.id} className={`mensagem${m.interna ? ' mensagem-interna' : ''}`}>
            <p className="meta">{nomes[m.autor_id] ?? 'SECKE'} · {dataHora(m.em)}{m.interna && ' · nota interna (só a SECKE vê)'}</p>
            <p className="texto-mensagem">{m.mensagem}</p>
          </article>
        ))}
      </section>

      {!encerrado || isPlataforma ? (
        <form className="painel-form" onSubmit={responder} aria-labelledby="t-resposta">
          <h2 id="t-resposta">Responder</h2>
          <label className="sr-only" htmlFor="resposta">Mensagem</label>
          <textarea id="resposta" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {isPlataforma && <label className="opcao"><input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} /> Nota interna (a prefeitura não vê)</label>}
          <p><button className="botao-secundario">Enviar mensagem</button></p>
        </form>
      ) : <p className="meta">Chamado encerrado. Para continuar o assunto, abra um novo chamado.</p>}

      {isPlataforma && (
        <form className="painel-form" onSubmit={salvarSecke} aria-labelledby="t-secke">
          <h2 id="t-secke">Gestão (SECKE)</h2>
          <div className="linha-campos">
            <label>Situação<select value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(SITUACOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
            <label>Prioridade<select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>{Object.entries(PRIORIDADES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
            <label>Solicitações consumidas<input type="number" min={0} value={consumidas} onChange={(e) => setConsumidas(e.target.value)} /></label>
          </div>
          {saldo?.limite_solicitacoes != null && <p className="meta">Saldo atual do contrato: {saldo.saldo} de {saldo.limite_solicitacoes}.</p>}
          <p><button className="botao">Salvar</button></p>
        </form>
      )}
    </>
  );
}
